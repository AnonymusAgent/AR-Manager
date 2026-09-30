import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { claims, users, claimStatusHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser, canAssignClaims } from '@/lib/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit';
import { createNotification, NOTIFICATION_TEMPLATES } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAssignClaims(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { assigneeId } = await request.json();

    if (!assigneeId) {
      return NextResponse.json({ error: 'Assignee ID is required' }, { status: 400 });
    }

    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, id))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const [assignee] = await db
      .select()
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);

    if (!assignee) {
      return NextResponse.json({ error: 'Assignee not found' }, { status: 404 });
    }

    const previousAssignee = claim.assignedTo;

    const [updatedClaim] = await db
      .update(claims)
      .set({
        assignedTo: assigneeId,
        assignedBy: user.id,
        assignedAt: new Date(),
        status: 'assigned',
        updatedAt: new Date(),
      })
      .where(eq(claims.id, id))
      .returning();

    // Create status history
    if (claim.status !== 'assigned') {
      await db.insert(claimStatusHistory).values({
        claimId: id,
        previousStatus: claim.status,
        newStatus: 'assigned',
        changedBy: user.id,
        reason: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
      });
    }

    // Create notification for assignee
    const template = NOTIFICATION_TEMPLATES.newAssignment(claim.claimNumber);
    await createNotification({
      userId: assigneeId,
      type: template.type,
      title: template.title,
      message: template.message,
      relatedClaimId: id,
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CLAIM_ASSIGNED,
      entityType: 'claim',
      entityId: id,
      previousValue: { assignedTo: previousAssignee },
      newValue: { assignedTo: assigneeId },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ claim: updatedClaim });
  } catch (error) {
    console.error('Assign claim error:', error);
    return NextResponse.json(
      { error: 'Failed to assign claim' },
      { status: 500 }
    );
  }
}
