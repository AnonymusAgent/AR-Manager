import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { billingTasks, users, taskStatusHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser, canAssignTasks } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAssignTasks(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { assigneeId } = await request.json();

    if (!assigneeId) {
      return NextResponse.json({ error: 'Assignee ID is required' }, { status: 400 });
    }

    const [task] = await db
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, id))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const [assignee] = await db
      .select()
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);

    if (!assignee) {
      return NextResponse.json({ error: 'Assignee not found' }, { status: 404 });
    }

    const previousAssignee = task.assignedTo;

    const [updatedTask] = await db
      .update(billingTasks)
      .set({
        assignedTo: assigneeId,
        assignedBy: user.id,
        assignedAt: new Date(),
        status: 'assigned',
        updatedAt: new Date(),
      })
      .where(eq(billingTasks.id, id))
      .returning();

    // Create status history if status changed
    if (task.status !== 'assigned') {
      await db.insert(taskStatusHistory).values({
        taskId: id,
        previousStatus: task.status,
        newStatus: 'assigned',
        changedBy: user.id,
        reason: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
      });
    }

    // Create notification for assignee
    await createNotification({
      userId: assigneeId,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `You have been assigned: ${task.title}`,
    });

    await createAuditLog({
      userId: user.id,
      action: 'task_assigned',
      entityType: 'billingTask',
      entityId: id,
      previousValue: { assignedTo: previousAssignee },
      newValue: { assignedTo: assigneeId },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Assign task error:', error);
    return NextResponse.json(
      { error: 'Failed to assign task' },
      { status: 500 }
    );
  }
}
