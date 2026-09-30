import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { billingTasks, taskNotes, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser, isSupervisorOrAbove } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

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

    const notes = await db
      .select({
        id: taskNotes.id,
        note: taskNotes.note,
        isSupervisorComment: taskNotes.isSupervisorComment,
        createdAt: taskNotes.createdAt,
        userId: taskNotes.userId,
        userName: users.firstName,
        userLastName: users.lastName,
      })
      .from(taskNotes)
      .leftJoin(users, eq(taskNotes.userId, users.id))
      .where(eq(taskNotes.taskId, id))
      .orderBy(desc(taskNotes.createdAt));

    return NextResponse.json({
      notes: notes.map(n => ({
        ...n,
        userName: n.userName && n.userLastName ? `${n.userName} ${n.userLastName}` : 'Unknown',
      })),
    });
  } catch (error) {
    console.error('Get task notes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { note, isSupervisorComment } = await request.json();

    if (!note) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    const [task] = await db
      .select()
      .from(billingTasks)
      .where(eq(billingTasks.id, id))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check access
    if (!isSupervisorOrAbove(user.role) && task.assignedTo !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const [newNote] = await db
      .insert(taskNotes)
      .values({
        taskId: id,
        userId: user.id,
        note,
        isSupervisorComment: isSupervisorOrAbove(user.role) && isSupervisorComment,
      })
      .returning();

    // Notify assignee if supervisor comment
    if (isSupervisorOrAbove(user.role) && isSupervisorComment && task.assignedTo && task.assignedTo !== user.id) {
      await createNotification({
        userId: task.assignedTo,
        type: 'supervisor_comment',
        title: 'Supervisor Comment',
        message: `Supervisor added a comment on task: ${task.title}`,
      });
    }

    await createAuditLog({
      userId: user.id,
      action: 'task_note_added',
      entityType: 'taskNote',
      entityId: newNote.id,
      newValue: { taskId: id, note, isSupervisorComment },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      note: {
        ...newNote,
        userName: `${user.firstName} ${user.lastName}`,
      },
    });
  } catch (error) {
    console.error('Create task note error:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
