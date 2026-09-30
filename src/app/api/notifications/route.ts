import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    const conditions = [eq(notifications.userId, user.id)];
    
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const result = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    // Get unread count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, user.id),
        eq(notifications.isRead, false)
      ));

    return NextResponse.json({
      notifications: result,
      unreadCount: count,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
