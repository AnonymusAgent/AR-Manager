import { db } from '@/db';
import { organizationMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
/** Deny-by-default membership check. Never infer membership from email domain or client-supplied org id alone. */
export async function requireMembership(userId: string, organizationId: string, roles?: string[]) {
  const [m] = await db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId))).limit(1);
  if (!m) return null;
  if (roles && !roles.includes(m.orgRole)) return null;
  return m;
}
export async function userOrgIds(userId: string) {
  const rows = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));
  return rows.map(r => r.organizationId);
}
