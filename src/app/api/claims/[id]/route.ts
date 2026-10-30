import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { claims, users, claimNotes, claimStatusHistory, claimDocuments, denialCodes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit';
import { ensureSaaSColumns, safeErrorDetail } from '@/lib/db-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
    }
    await ensureSaaSColumns();

    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, id))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Check access
    if (user.role === 'ar_executive' && claim.assignedTo !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get assignee details
    let assignee = null;
    if (claim.assignedTo) {
      const [assigneeData] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(eq(users.id, claim.assignedTo))
        .limit(1);
      assignee = assigneeData;
    }

    // Get reviewer details
    let reviewer = null;
    if (claim.reviewedBy) {
      const [reviewerData] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(eq(users.id, claim.reviewedBy))
        .limit(1);
      reviewer = reviewerData;
    }

    // Get notes (fault-isolated: a broken related table must not block opening the claim)
    const safe = async <T,>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> => {
      try { return await fn(); } catch (e) { console.error(`Get claim: ${label} failed:`, e); return fallback; }
    };
    const notes = await safe(() => db
      .select({
        id: claimNotes.id,
        note: claimNotes.note,
        actionPerformed: claimNotes.actionPerformed,
        createdAt: claimNotes.createdAt,
        userId: claimNotes.userId,
        userName: users.firstName,
        userLastName: users.lastName,
      })
      .from(claimNotes)
      .leftJoin(users, eq(claimNotes.userId, users.id))
      .where(eq(claimNotes.claimId, id))
      .orderBy(desc(claimNotes.createdAt)), [], 'notes');

    // Get status history
    const statusHistory = await safe(() => db
      .select({
        id: claimStatusHistory.id,
        previousStatus: claimStatusHistory.previousStatus,
        newStatus: claimStatusHistory.newStatus,
        reason: claimStatusHistory.reason,
        createdAt: claimStatusHistory.createdAt,
        changedBy: claimStatusHistory.changedBy,
        userName: users.firstName,
        userLastName: users.lastName,
      })
      .from(claimStatusHistory)
      .leftJoin(users, eq(claimStatusHistory.changedBy, users.id))
      .where(eq(claimStatusHistory.claimId, id))
      .orderBy(desc(claimStatusHistory.createdAt)), [], 'status history');

    // Get documents
    const documents = await safe(() => db
      .select({
        id: claimDocuments.id,
        documentType: claimDocuments.documentType,
        fileName: claimDocuments.fileName,
        mimeType: claimDocuments.mimeType,
        createdAt: claimDocuments.createdAt,
        uploadedBy: claimDocuments.uploadedBy,
      })
      .from(claimDocuments)
      .where(eq(claimDocuments.claimId, id))
      .orderBy(desc(claimDocuments.createdAt)), [], 'documents');

    // Get denial code if present
    let denialCode = null;
    if (claim.denialCodeId) {
      const codeId: number = claim.denialCodeId;
      const rows = await safe(() => db
        .select()
        .from(denialCodes)
        .where(eq(denialCodes.id, codeId))
        .limit(1), [] as Array<typeof denialCodes.$inferSelect>, 'denial code');
      denialCode = rows[0] ?? null;
    }

    return NextResponse.json({
      claim: {
        ...claim,
        assignee,
        reviewer,
        denialCode,
      },
      notes: notes.map(n => ({
        ...n,
        userName: n.userName && n.userLastName ? `${n.userName} ${n.userLastName}` : 'Unknown',
      })),
      statusHistory: statusHistory.map(h => ({
        ...h,
        userName: h.userName && h.userLastName ? `${h.userName} ${h.userLastName}` : 'Unknown',
      })),
      documents,
    });
  } catch (error) {
    console.error('Get claim error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claim', detail: safeErrorDetail(error), hint: 'Check /api/health for database/schema status.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const [existingClaim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, id))
      .limit(1);

    if (!existingClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Check access
    if (user.role === 'ar_executive' && existingClaim.assignedTo !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updateData: Partial<typeof claims.$inferInsert> = {};

    // Update allowed fields
    if (body.patientName !== undefined) updateData.patientName = body.patientName;
    if (body.accountNumber !== undefined) updateData.accountNumber = body.accountNumber;
    if (body.dateOfService !== undefined) updateData.dateOfService = body.dateOfService;
    if (body.cptCodes !== undefined) updateData.cptCodes = body.cptCodes;
    if (body.provider !== undefined) updateData.provider = body.provider;
    if (body.insurance !== undefined) updateData.insurance = body.insurance;
    if (body.payer !== undefined) updateData.payer = body.payer;
    if (body.billedAmount !== undefined) updateData.billedAmount = body.billedAmount;
    if (body.paidAmount !== undefined) updateData.paidAmount = body.paidAmount;
    if (body.balance !== undefined) updateData.balance = body.balance;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.denialCodeId !== undefined) updateData.denialCodeId = body.denialCodeId;
    if (body.denialReason !== undefined) updateData.denialReason = body.denialReason;

    // Status change
    if (body.status && body.status !== existingClaim.status) {
      updateData.status = body.status;

      // Create status history entry
      await db.insert(claimStatusHistory).values({
        claimId: id,
        previousStatus: existingClaim.status,
        newStatus: body.status,
        changedBy: user.id,
        reason: body.statusChangeReason || undefined,
      });

      await createAuditLog({
        userId: user.id,
        action: AUDIT_ACTIONS.CLAIM_STATUS_CHANGED,
        entityType: 'claim',
        entityId: id,
        previousValue: { status: existingClaim.status },
        newValue: { status: body.status },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    updateData.updatedAt = new Date();

    const [updatedClaim] = await db
      .update(claims)
      .set(updateData)
      .where(eq(claims.id, id))
      .returning();

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CLAIM_UPDATED,
      entityType: 'claim',
      entityId: id,
      previousValue: existingClaim,
      newValue: updatedClaim,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ claim: updatedClaim });
  } catch (error) {
    console.error('Update claim error:', error);
    return NextResponse.json(
      { error: 'Failed to update claim' },
      { status: 500 }
    );
  }
}
