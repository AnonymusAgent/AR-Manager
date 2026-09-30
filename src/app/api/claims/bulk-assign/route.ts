import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { claims, users, claimStatusHistory } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getCurrentUser, canAssignClaims } from '@/lib/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit';
import { createNotification, NOTIFICATION_TEMPLATES } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAssignClaims(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { claimIds, assigneeId } = await request.json();

    if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
      return NextResponse.json({ error: 'Claim IDs are required' }, { status: 400 });
    }

    if (!assigneeId) {
      return NextResponse.json({ error: 'Assignee ID is required' }, { status: 400 });
    }

    const [assignee] = await db
      .select()
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);

    if (!assignee) {
      return NextResponse.json({ error: 'Assignee not found' }, { status: 404 });
    }

    // Get existing claims
    const existingClaims = await db
      .select()
      .from(claims)
      .where(inArray(claims.id, claimIds));

    // Update all claims
    await db
      .update(claims)
      .set({
        assignedTo: assigneeId,
        assignedBy: user.id,
        assignedAt: new Date(),
        status: 'assigned',
        updatedAt: new Date(),
      })
      .where(inArray(claims.id, claimIds));

    // Create status history for each claim
    for (const claim of existingClaims) {
      if (claim.status !== 'assigned') {
        await db.insert(claimStatusHistory).values({
          claimId: claim.id,
          previousStatus: claim.status,
          newStatus: 'assigned',
          changedBy: user.id,
          reason: `Bulk assigned to ${assignee.firstName} ${assignee.lastName}`,
        });
      }
    }

    // Create notification for assignee
    const template = NOTIFICATION_TEMPLATES.newAssignment(`${claimIds.length} claims`);
    await createNotification({
      userId: assigneeId,
      type: template.type,
      title: 'New Claims Assigned',
      message: `You have been assigned ${claimIds.length} new claims`,
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CLAIM_ASSIGNED,
      entityType: 'claim',
      entityId: claimIds.join(','),
      newValue: { assignedTo: assigneeId, claimCount: claimIds.length },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      assignedCount: claimIds.length,
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    return NextResponse.json(
      { error: 'Failed to assign claims' },
      { status: 500 }
    );
  }
}
