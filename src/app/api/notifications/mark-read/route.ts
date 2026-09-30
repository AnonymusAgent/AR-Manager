import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notificationIds, markAll } = await request.json();

    if (markAll) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, user.id));
    } else if (notificationIds && Array.isArray(notificationIds)) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, user.id),
            inArray(notifications.id, notificationIds)
          )
        );
    } else {
      return NextResponse.json(
        { error: 'Notification IDs or markAll flag is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
