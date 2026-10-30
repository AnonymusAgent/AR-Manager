import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { eq, desc, gt, and, ne } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
export async function GET() {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const current = (await cookies()).get('session')?.value;
  const rows = await db.select({ id: sessions.id, expiresAt: sessions.expiresAt, createdAt: sessions.createdAt, token: sessions.token }).from(sessions)
    .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, new Date()))).orderBy(desc(sessions.createdAt));
  // Never return tokens — only whether it's the current session.
  return NextResponse.json({ sessions: rows.map(r => ({ id: r.id, createdAt: r.createdAt, expiresAt: r.expiresAt, current: r.token === current })) });
}
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { sessionId, all } = await req.json().catch(() => ({}));
  const current = (await cookies()).get('session')?.value;
  if (all) {
    const rows = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    for (const r of rows) if (r.token !== current) await db.delete(sessions).where(eq(sessions.id, r.id));
    return NextResponse.json({ success: true, message: 'All other sessions signed out.' });
  }
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  const [row] = await db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id))).limit(1);
  if (!row) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  return NextResponse.json({ success: true, wasCurrent: row.token === current });
}
