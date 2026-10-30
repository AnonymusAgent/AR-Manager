import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, desc, ilike, or } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { createAuditLog } from '@/lib/audit';
const guard = requirePlatformAdmin;
export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const base = db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role, isActive: users.isActive, isPlatformAdmin: users.isPlatformAdmin, emailVerifiedAt: users.emailVerifiedAt, accountStatus: users.accountStatus, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt }).from(users);
  const rows = q ? await base.where(or(ilike(users.email, `%${q}%`), ilike(users.firstName, `%${q}%`), ilike(users.lastName, `%${q}%`))).orderBy(desc(users.createdAt)).limit(200)
                 : await base.orderBy(desc(users.createdAt)).limit(200);
  return NextResponse.json({ users: rows });
}
export async function PATCH(req: NextRequest) {
  const admin = await guard(); if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, action } = await req.json();
  if (!userId || userId === admin.id) return NextResponse.json({ error: 'You cannot modify your own platform account here — ask another platform admin.' }, { status: 400 });
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (action === 'activate') await db.update(users).set({ isActive: true, accountStatus: 'active' }).where(eq(users.id, userId));
  else if (action === 'deactivate') { await db.update(users).set({ isActive: false, accountStatus: 'suspended' }).where(eq(users.id, userId)); await db.delete(sessions).where(eq(sessions.userId, userId)); }
  else if (action === 'make_platform_admin') await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, userId));
  else if (action === 'remove_platform_admin') await db.update(users).set({ isPlatformAdmin: false }).where(eq(users.id, userId));
  else if (action === 'revoke_sessions') await db.delete(sessions).where(eq(sessions.userId, userId));
  else if (action === 'mark_verified') await db.update(users).set({ emailVerifiedAt: new Date(), accountStatus: 'active' }).where(eq(users.id, userId));
  else return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  await createAuditLog({ userId: admin.id, action: `platform_user_${action}`, entityType: 'user', entityId: userId, newValue: { email: target.email } });
  return NextResponse.json({ success: true });
}
