import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { authTokens, users, sessions } from '@/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { hashToken } from '@/lib/saas';
import { hashPassword } from '@/lib/auth';
export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password || String(password).length < 10) return NextResponse.json({ error: 'A valid token and a password of at least 10 characters are required' }, { status: 400 });
  const [row] = await db.select().from(authTokens).where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, 'password_reset'), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1);
  if (!row) return NextResponse.json({ error: 'This reset link is invalid, expired, or already used.' }, { status: 400 });
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.userId));
  await db.delete(sessions).where(eq(sessions.userId, row.userId)); // revoke all sessions on password reset
  return NextResponse.json({ success: true });
}
