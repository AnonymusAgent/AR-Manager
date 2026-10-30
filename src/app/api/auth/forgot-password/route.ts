import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, authTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { makeToken, hashToken } from '@/lib/saas';
import { sendPasswordResetEmail } from '@/lib/auth-emails';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), 'forgot_password');
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const { email } = await req.json();
  // Always generic response — never reveal whether an account exists.
  if (email) { const [u] = await db.select().from(users).where(eq(users.email, String(email).toLowerCase())).limit(1);
    if (u) { const t = makeToken(); await db.insert(authTokens).values({ userId: u.id, type: 'password_reset', tokenHash: hashToken(t), expiresAt: new Date(Date.now() + 3600e3) }); await sendPasswordResetEmail(u.email, t); } }
  return NextResponse.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
}
