import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { authTokens, users } from '@/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { hashToken } from '@/lib/saas';
export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
  const [row] = await db.select().from(authTokens).where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, 'email_verification'), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1);
  if (!row) return NextResponse.json({ error: 'This verification link is invalid, expired, or already used.' }, { status: 400 });
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  await db.update(users).set({ emailVerifiedAt: new Date(), accountStatus: 'active' }).where(eq(users.id, row.userId));
  return NextResponse.json({ success: true });
}
