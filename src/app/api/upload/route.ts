import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { uploadedFiles, claims, practices } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser, canUploadFiles } from '@/lib/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit';
import { parseExcelBuffer, parseCSVContent, parsePDFText } from '@/lib/file-parser';
import { createNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canUploadFiles(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const practiceId = formData.get('practiceId') as string;
    const provider = formData.get('provider') as string;
    const assignedTo = formData.get('assignedTo') as string;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Require practice and assigned user (unless admin override)
    if (!practiceId && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Practice selection is required for AR upload' }, { status: 400 });
    }
    if (!assignedTo && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Assigned user is required for AR upload' }, { status: 400 });
    }

    // Validate practice exists
    if (practiceId) {
      const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId)).limit(1);
      if (!practice) return NextResponse.json({ error: 'Selected practice not found' }, { status: 400 });
    }

    const fileName = file.name;
    const fileType = fileName.split('.').pop()?.toLowerCase() || '';
    const fileSize = file.size;

    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file type. Supported: xlsx, xls, csv, pdf' }, { status: 400 });
    }

    // Create upload record
    const [uploadRecord] = await db.insert(uploadedFiles).values({
      fileName, fileType, fileSize, uploadedBy: user.id, status: 'processing',
    }).returning();

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      let parsedData: import('@/lib/file-parser').ParsedClaimData[] = [];

      if (fileType === 'csv') {
        parsedData = parseCSVContent(buffer.toString('utf-8'));
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        parsedData = parseExcelBuffer(buffer);
      } else if (fileType === 'pdf') {
        parsedData = parsePDFText(buffer.toString('utf-8'));
      }

      // Insert claims with practice and user assignment
      const claimsToInsert = parsedData.map((data) => ({
        claimNumber: data.claimNumber || `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        accountNumber: data.accountNumber,
        patientName: data.patientName,
        dateOfService: data.dateOfService,
        cptCodes: data.cptCodes,
        provider: provider || data.provider,
        insurance: data.insurance,
        payer: data.payer,
        billedAmount: data.billedAmount,
        paidAmount: data.paidAmount,
        balance: data.balance,
        status: 'new' as const,
        workflowStatus: 'unworked',
        practiceId: practiceId || undefined,
        uploadedFileId: uploadRecord.id,
        assignedTo: assignedTo || undefined,
        assignedBy: user.id,
        assignedAt: assignedTo ? new Date() : undefined,
        additionalData: data.additionalData,
      }));

      if (claimsToInsert.length > 0) {
        await db.insert(claims).values(claimsToInsert);
      }

      // Update upload record
      await db.update(uploadedFiles).set({
        status: 'completed', totalRecords: parsedData.length, processedRecords: parsedData.length,
      }).where(eq(uploadedFiles.id, uploadRecord.id));

      // Notify assigned user
      if (assignedTo) {
        await createNotification({
          userId: assignedTo,
          type: 'new_assignment',
          title: 'New AR Assigned',
          message: `${parsedData.length} claim(s) have been assigned to you`,
        });
      }

      await createAuditLog({
        userId: user.id, action: AUDIT_ACTIONS.FILE_UPLOADED, entityType: 'uploadedFile',
        entityId: uploadRecord.id,
        newValue: { fileName, fileType, recordCount: parsedData.length, practiceId, assignedTo },
      });

      return NextResponse.json({ success: true, uploadId: uploadRecord.id, recordsProcessed: parsedData.length });
    } catch (parseError) {
      await db.update(uploadedFiles).set({
        status: 'error', errorMessage: parseError instanceof Error ? parseError.message : 'Unknown error',
      }).where(eq(uploadedFiles.id, uploadRecord.id));
      throw parseError;
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process file upload' }, { status: 500 });
  }
}
