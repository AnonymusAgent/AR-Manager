import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, authTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { makeToken, hashToken } from '@/lib/saas';
import { sendVerificationEmail } from '@/lib/auth-emails';
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (email) { const [u] = await db.select().from(users).where(eq(users.email, String(email).toLowerCase())).limit(1);
    if (u && !u.emailVerifiedAt) { const t = makeToken(); await db.insert(authTokens).values({ userId: u.id, type: 'email_verification', tokenHash: hashToken(t), expiresAt: new Date(Date.now() + 24*3600e3) }); await sendVerificationEmail(u.email, t); } }
  return NextResponse.json({ success: true, message: 'If that account needs verification, a new link has been sent.' });
}
