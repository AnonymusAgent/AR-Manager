import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { codingRequests, claims, users, codingDocuments, claimDocuments, claimStatusHistory } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getCurrentUser, isSupervisorOrAbove } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const page = parseInt(sp.get('page') || '1');
    const limit = parseInt(sp.get('limit') || '20');

    const conditions = [];
    if (status) conditions.push(eq(codingRequests.status, status as 'sent_to_coding' | 'under_review' | 'corrected' | 'returned_to_billing' | 'resubmitted'));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(codingRequests).where(whereClause);

    const rows = await db.select({
      id: codingRequests.id, claimId: codingRequests.claimId, status: codingRequests.status,
      denialReason: codingRequests.denialReason, comments: codingRequests.comments,
      correctionNotes: codingRequests.correctionNotes, createdAt: codingRequests.createdAt,
      updatedAt: codingRequests.updatedAt, sentBy: codingRequests.sentBy, assignedTo: codingRequests.assignedTo,
      claimNumber: claims.claimNumber, patientName: claims.patientName,
    }).from(codingRequests)
      .leftJoin(claims, eq(codingRequests.claimId, claims.id))
      .where(whereClause)
      .orderBy(desc(codingRequests.createdAt))
      .limit(limit).offset((page - 1) * limit);

    const withNames = await Promise.all(rows.map(async (r) => {
      const [sender] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, r.sentBy)).limit(1);
      let assigneeName = null;
      if (r.assignedTo) {
        const [a] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, r.assignedTo)).limit(1);
        assigneeName = a ? `${a.firstName} ${a.lastName}` : null;
      }
      return { ...r, senderName: sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown', assigneeName };
    }));

    return NextResponse.json({ codingRequests: withNames, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('Get coding requests error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { claimId, denialReason, comments, assignedTo } = await request.json();
    if (!claimId) return NextResponse.json({ error: 'Claim ID required' }, { status: 400 });

    const [claim] = await db.select().from(claims).where(eq(claims.id, claimId)).limit(1);
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

    const [codingReq] = await db.insert(codingRequests).values({
      claimId, denialReason, comments, sentBy: user.id, assignedTo,
    }).returning();

    // Update claim status
    await db.update(claims).set({ status: 'sent_to_coding', updatedAt: new Date() }).where(eq(claims.id, claimId));
    await db.insert(claimStatusHistory).values({ claimId, previousStatus: claim.status, newStatus: 'sent_to_coding', changedBy: user.id, reason: 'Sent to coding team' });

    // Auto-attach existing claim documents
    const claimDocs = await db.select().from(claimDocuments).where(eq(claimDocuments.claimId, claimId));
    for (const doc of claimDocs) {
      await db.insert(codingDocuments).values({
        codingRequestId: codingReq.id, documentType: doc.documentType,
        fileName: doc.fileName, fileData: doc.fileData, mimeType: doc.mimeType, uploadedBy: user.id,
      });
    }

    if (assignedTo) {
      await createNotification({ userId: assignedTo, type: 'task_assigned', title: 'Coding Request', message: `Claim ${claim.claimNumber} needs coding review` });
    }

    await createAuditLog({ userId: user.id, action: 'sent_to_coding', entityType: 'codingRequest', entityId: codingReq.id, newValue: { claimId, claimNumber: claim.claimNumber } });

    return NextResponse.json({ codingRequest: codingReq });
  } catch (error) {
    console.error('Create coding request error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
