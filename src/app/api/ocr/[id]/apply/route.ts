import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ocrScans, claims } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const { claimId, editedData } = await request.json();

    const [scan] = await db.select().from(ocrScans).where(eq(ocrScans.id, id)).limit(1);
    if (!scan) return NextResponse.json({ error: 'Scan not found' }, { status: 404 });

    const data = editedData || (scan.extractedData as Record<string, string | null>);

    if (claimId) {
      // Apply extracted data to existing claim
      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (data.patientName) updateFields.patientName = data.patientName;
      if (data.claimNumber) updateFields.claimNumber = data.claimNumber;
      if (data.provider) updateFields.provider = data.provider;
      if (data.payerName) updateFields.insurance = data.payerName;
      if (data.totalCharge) updateFields.billedAmount = data.totalCharge.replace(/,/g, '');
      if (data.amountPaid) updateFields.paidAmount = data.amountPaid.replace(/,/g, '');
      if (data.procedureCode) updateFields.cptCodes = data.procedureCode;

      await db.update(claims).set(updateFields).where(eq(claims.id, claimId));
      await db.update(ocrScans).set({ appliedToClaimId: claimId, reviewedBy: user.id, reviewedAt: new Date(), status: 'applied' }).where(eq(ocrScans.id, id));

      await createAuditLog({ userId: user.id, action: 'ocr_data_applied', entityType: 'claim', entityId: claimId, newValue: updateFields });
    } else {
      // Save edited data back to scan
      await db.update(ocrScans).set({ extractedData: data, reviewedBy: user.id, reviewedAt: new Date(), status: 'reviewed' }).where(eq(ocrScans.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Apply OCR error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
