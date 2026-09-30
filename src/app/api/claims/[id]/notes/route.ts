import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { claims, claimNotes, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit';

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
      .orderBy(desc(claimNotes.createdAt));

    return NextResponse.json({
      notes: notes.map(n => ({
        ...n,
        userName: n.userName && n.userLastName ? `${n.userName} ${n.userLastName}` : 'Unknown',
      })),
    });
  } catch (error) {
    console.error('Get notes error:', error);
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
    const { note, actionPerformed } = await request.json();

    if (!note) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, id))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Check access for AR executives
    if (user.role === 'ar_executive' && claim.assignedTo !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const [newNote] = await db
      .insert(claimNotes)
      .values({
        claimId: id,
        userId: user.id,
        note,
        actionPerformed: actionPerformed || undefined,
      })
      .returning();

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CLAIM_NOTE_ADDED,
      entityType: 'claimNote',
      entityId: newNote.id,
      newValue: { claimId: id, note, actionPerformed },
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
    console.error('Create note error:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
