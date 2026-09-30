import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { claims, claimStatusHistory, claimNotes, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser, isSupervisorOrAbove } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const { action, claimInsuranceStatus, subStatus, remarks, reworkReason, followUpDate, denialCodeId, denialReason } = await request.json();

    if (!action) return NextResponse.json({ error: 'Action is required' }, { status: 400 });

    const [claim] = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

    const now = new Date();
    const update: Record<string, unknown> = { updatedAt: now };
    let auditAction = '';
    let noteText = '';
    let notifyUserId: string | null = null;
    let notifyTitle = '';
    let notifyMessage = '';

    switch (action) {
      case 'start_working': {
        // User picks up claim from Unworked
        update.workflowStatus = 'working';
        update.workedBy = user.id;
        update.workedDate = now;
        update.status = 'in_progress';
        auditAction = 'claim_work_started';
        noteText = 'Started working on claim';
        break;
      }

      case 'submit_for_approval': {
        // User submits claim for supervisor review
        if (claim.workflowStatus !== 'working' && claim.workflowStatus !== 'rework') {
          return NextResponse.json({ error: 'Claim must be in working or rework status to submit' }, { status: 400 });
        }
        update.workflowStatus = 'pending_approval';
        update.submittedForApprovalAt = now;
        update.status = 'submitted_for_review';
        if (claimInsuranceStatus) update.claimInsuranceStatus = claimInsuranceStatus;
        if (subStatus) update.subStatus = subStatus;
        if (followUpDate) update.followUpDate = followUpDate;
        if (denialCodeId) update.denialCodeId = denialCodeId;
        if (denialReason) update.denialReason = denialReason;
        auditAction = 'claim_submitted_for_approval';
        noteText = remarks || 'Submitted for supervisor approval';

        // Notify supervisors/team leads
        const leads = await db.select({ id: users.id }).from(users)
          .where(eq(users.isActive, true));
        // Notify the first supervisor found
        for (const lead of leads) {
          const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, lead.id)).limit(1);
          if (u && ['administrator', 'supervisor', 'manager', 'team_lead'].includes(u.role)) {
            notifyUserId = lead.id;
            notifyTitle = 'Claim Submitted for Approval';
            notifyMessage = `${user.firstName} ${user.lastName} submitted claim ${claim.claimNumber} for review`;
            break;
          }
        }
        break;
      }

      case 'approve': {
        // Supervisor approves claim
        if (!isSupervisorOrAbove(user.role) && user.role !== 'team_lead') {
          return NextResponse.json({ error: 'Only supervisors can approve claims' }, { status: 403 });
        }
        if (claim.workflowStatus !== 'pending_approval') {
          return NextResponse.json({ error: 'Claim must be pending approval' }, { status: 400 });
        }
        // Prevent self-approval
        if (claim.workedBy === user.id) {
          return NextResponse.json({ error: 'You cannot approve your own work' }, { status: 403 });
        }
        update.workflowStatus = 'approved';
        update.approvedBy = user.id;
        update.approvedAt = now;
        update.status = 'approved';
        if (claimInsuranceStatus) update.claimInsuranceStatus = claimInsuranceStatus;
        auditAction = 'claim_approved_by_supervisor';
        noteText = remarks || 'Claim approved by supervisor';

        // Notify the worker
        if (claim.workedBy) {
          notifyUserId = claim.workedBy;
          notifyTitle = 'Claim Approved';
          notifyMessage = `Your work on claim ${claim.claimNumber} has been approved by ${user.firstName} ${user.lastName}`;
        }
        break;
      }

      case 'send_back_rework': {
        // Supervisor sends back for rework
        if (!isSupervisorOrAbove(user.role) && user.role !== 'team_lead') {
          return NextResponse.json({ error: 'Only supervisors can send claims back' }, { status: 403 });
        }
        if (!reworkReason || reworkReason.trim().length === 0) {
          return NextResponse.json({ error: 'Rework reason is mandatory' }, { status: 400 });
        }
        if (claim.workflowStatus !== 'pending_approval') {
          return NextResponse.json({ error: 'Claim must be pending approval' }, { status: 400 });
        }
        update.workflowStatus = 'rework';
        update.reworkReason = reworkReason;
        update.reworkCount = ((claim.reworkCount as number) || 0) + 1;
        update.status = 'rework_required';
        auditAction = 'claim_sent_back_for_rework';
        noteText = `Sent back for rework: ${reworkReason}`;

        // Notify the worker
        if (claim.workedBy || claim.assignedTo) {
          notifyUserId = (claim.workedBy || claim.assignedTo) as string;
          notifyTitle = 'Claim Returned for Rework';
          notifyMessage = `Claim ${claim.claimNumber} was sent back by ${user.firstName} ${user.lastName}: ${reworkReason}`;
        }
        break;
      }

      case 'mark_dead': {
        update.workflowStatus = 'dead';
        update.status = 'closed';
        update.claimInsuranceStatus = 'unworkable';
        auditAction = 'claim_marked_dead';
        noteText = remarks || 'Claim marked as dead/unworkable';
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Update claim
    const [updated] = await db.update(claims).set(update).where(eq(claims.id, id)).returning();

    // Create status history
    await db.insert(claimStatusHistory).values({
      claimId: id,
      previousStatus: claim.status,
      newStatus: updated.status,
      changedBy: user.id,
      reason: noteText,
    });

    // Create note
    if (noteText) {
      await db.insert(claimNotes).values({
        claimId: id,
        userId: user.id,
        note: noteText,
        actionPerformed: action.replace(/_/g, ' '),
      });
    }

    // Send notification
    if (notifyUserId) {
      await createNotification({
        userId: notifyUserId,
        type: action === 'approve' ? 'claim_approved' : action === 'send_back_rework' ? 'rework_requested' : 'claim_submitted',
        title: notifyTitle,
        message: notifyMessage,
        relatedClaimId: id,
      });
    }

    // Audit log
    await createAuditLog({
      userId: user.id, action: auditAction, entityType: 'claim', entityId: id,
      previousValue: { workflowStatus: claim.workflowStatus, status: claim.status },
      newValue: { workflowStatus: updated.workflowStatus, status: updated.status },
    });

    return NextResponse.json({ claim: updated });
  } catch (error) {
    console.error('Workflow error:', error);
    return NextResponse.json({ error: 'Failed to process workflow action' }, { status: 500 });
  }
}
