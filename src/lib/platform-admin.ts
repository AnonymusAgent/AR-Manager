import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

type UserLike = { id: string; email: string; isPlatformAdmin?: boolean | null };

/**
 * Platform-admin authorization — two server-side sources, neither hardcoded in source:
 *  1. users.is_platform_admin = true (granted from Platform Admin -> Users, or bootstrap script)
 *  2. PLATFORM_ADMIN_EMAILS env var (comma-separated allowlist set in hosting env, never committed)
 * An allowlisted user is lazily promoted so the DB flag becomes the durable record.
 * Secrets/emails are never shipped to the browser beyond the signed-in user's own flag.
 */
export function platformAdminEmails(): Set<string> {
  return new Set((process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}
export function isPlatformAdminUser(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isPlatformAdmin) || platformAdminEmails().has(user.email.toLowerCase());
}
export async function requirePlatformAdmin(): Promise<UserLike | null> {
  const user = await getCurrentUser() as UserLike | null;
  if (!user || !isPlatformAdminUser(user)) return null;
  if (!user.isPlatformAdmin) {
    // Lazily persist the env-allowlist grant (fire-and-forget safe: flag is durable source next time).
    try { await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, user.id)); } catch { /* env check still authorizes */ }
    return { ...user, isPlatformAdmin: true };
  }
  return user;
}
