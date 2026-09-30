import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ocrScans, claims } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// Simple OCR text extraction patterns for common medical billing documents
function extractMedicalData(text: string, docType: string): Record<string, string | null> {
  const data: Record<string, string | null> = {};
  const patterns: Record<string, RegExp> = {
    patientName: /(?:patient\s*name|member\s*name|subscriber)[:\s]*([A-Za-z\s,.-]+?)(?:\n|$)/i,
    memberId: /(?:member\s*id|subscriber\s*id|insured\s*id)[:\s]*([A-Z0-9-]+)/i,
    groupNumber: /(?:group\s*(?:number|no|#))[:\s]*([A-Z0-9-]+)/i,
    claimNumber: /(?:claim\s*(?:number|no|#|id))[:\s]*([A-Z0-9-]+)/i,
    dateOfService: /(?:date\s*of\s*service|dos|service\s*date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    provider: /(?:provider|physician|rendering)[:\s]*([A-Za-z\s,.-]+?)(?:\n|$)/i,
    totalCharge: /(?:total\s*charge|billed\s*amount|charges)[:\s]*\$?([\d,]+\.?\d*)/i,
    amountPaid: /(?:amount\s*paid|paid\s*amount|payment)[:\s]*\$?([\d,]+\.?\d*)/i,
    patientResponsibility: /(?:patient\s*resp|you\s*owe|amount\s*due)[:\s]*\$?([\d,]+\.?\d*)/i,
    diagnosisCode: /(?:diagnosis|icd|dx)[:\s]*([A-Z]\d{2}\.?\d{0,4})/i,
    procedureCode: /(?:procedure|cpt|hcpcs)[:\s]*(\d{4,5})/i,
    payerName: /(?:payer|insurance|plan\s*name|carrier)[:\s]*([A-Za-z\s&.-]+?)(?:\n|$)/i,
    authNumber: /(?:auth(?:orization)?\s*(?:number|no|#))[:\s]*([A-Z0-9-]+)/i,
    referralNumber: /(?:referral\s*(?:number|no|#))[:\s]*([A-Z0-9-]+)/i,
    npi: /(?:npi)[:\s]*(\d{10})/i,
    taxId: /(?:tax\s*id|tin|ein)[:\s]*(\d{2}-?\d{7})/i,
    denialCode: /(?:denial\s*(?:code|reason)|carc|reason\s*code)[:\s]*([A-Z0-9-]+)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    data[key] = match ? match[1].trim() : null;
  }

  // Calculate confidence based on how many fields were found
  const found = Object.values(data).filter(v => v !== null).length;
  const total = Object.keys(data).length;
  data._confidence = String(Math.round((found / total) * 100));

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(ocrScans);

    const rows = await db.select({
      id: ocrScans.id, fileName: ocrScans.fileName, documentType: ocrScans.documentType,
      extractedData: ocrScans.extractedData, confidence: ocrScans.confidence,
      status: ocrScans.status, createdAt: ocrScans.createdAt,
    }).from(ocrScans).orderBy(desc(ocrScans.createdAt)).limit(limit).offset((page - 1) * limit);

    return NextResponse.json({ scans: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('Get OCR scans error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = (formData.get('documentType') as string) || 'general';

    if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileData = buffer.toString('base64');

    // For text-based files, extract text directly
    let rawText = '';
    if (file.type === 'text/plain' || file.type === 'text/csv') {
      rawText = buffer.toString('utf-8');
    } else {
      // For PDFs and images, simulate OCR extraction from the raw buffer
      // In production, this would call a real OCR service (Google Vision, AWS Textract, etc.)
      rawText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').substring(0, 5000);
    }

    const extractedData = extractMedicalData(rawText, documentType);
    const confidence = extractedData._confidence || '0';
    delete extractedData._confidence;

    const [scan] = await db.insert(ocrScans).values({
      fileName: file.name, fileData, mimeType: file.type, documentType,
      extractedData, rawText: rawText.substring(0, 10000), confidence,
      status: 'completed', uploadedBy: user.id,
    }).returning();

    await createAuditLog({ userId: user.id, action: 'ocr_scan_created', entityType: 'ocrScan', entityId: scan.id, newValue: { fileName: file.name, documentType, confidence } });

    return NextResponse.json({
      scan: { id: scan.id, fileName: scan.fileName, documentType: scan.documentType, extractedData, confidence: parseFloat(confidence), status: scan.status },
    });
  } catch (error) {
    console.error('OCR scan error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
