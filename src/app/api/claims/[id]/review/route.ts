import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { claims, claimStatusHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser, canReviewClaims } from '@/lib/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit';
import { createNotification, NOTIFICATION_TEMPLATES } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canReviewClaims(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { action, comments } = await request.json();

    if (!action || !['approve', 'reject', 'rework'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action is required (approve, reject, or rework)' },
        { status: 400 }
      );
    }

    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, id))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    if (claim.status !== 'submitted_for_review') {
      return NextResponse.json(
        { error: 'Claim is not pending review' },
        { status: 400 }
      );
    }

    let newStatus: 'approved' | 'denied' | 'rework_required';
    let auditAction: string;
    let notificationTemplate;

    switch (action) {
      case 'approve':
        newStatus = 'approved';
        auditAction = AUDIT_ACTIONS.CLAIM_APPROVED;
        notificationTemplate = NOTIFICATION_TEMPLATES.claimApproved(claim.claimNumber);
        break;
      case 'reject':
        newStatus = 'denied';
        auditAction = AUDIT_ACTIONS.CLAIM_REJECTED;
        notificationTemplate = NOTIFICATION_TEMPLATES.claimRejected(claim.claimNumber, comments);
        break;
      case 'rework':
        newStatus = 'rework_required';
        auditAction = AUDIT_ACTIONS.CLAIM_REWORK_REQUESTED;
        notificationTemplate = NOTIFICATION_TEMPLATES.reworkRequested(claim.claimNumber, comments);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const [updatedClaim] = await db
      .update(claims)
      .set({
        status: newStatus,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewComments: comments || null,
        updatedAt: new Date(),
      })
      .where(eq(claims.id, id))
      .returning();

    // Create status history
    await db.insert(claimStatusHistory).values({
      claimId: id,
      previousStatus: claim.status,
      newStatus,
      changedBy: user.id,
      reason: comments || `Review action: ${action}`,
    });

    // Notify the assignee
    if (claim.assignedTo) {
      await createNotification({
        userId: claim.assignedTo,
        type: notificationTemplate.type,
        title: notificationTemplate.title,
        message: notificationTemplate.message,
        relatedClaimId: id,
      });
    }

    await createAuditLog({
      userId: user.id,
      action: auditAction,
      entityType: 'claim',
      entityId: id,
      previousValue: { status: claim.status },
      newValue: { status: newStatus, reviewComments: comments },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ claim: updatedClaim });
  } catch (error) {
    console.error('Review claim error:', error);
    return NextResponse.json(
      { error: 'Failed to review claim' },
      { status: 500 }
    );
  }
}
