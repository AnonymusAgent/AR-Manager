import { db } from '@/db';
import { rateLimits } from '@/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';

const LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  login: { maxRequests: 10, windowMs: 15 * 60 * 1000 },      // 10 per 15 min
  api: { maxRequests: 100, windowMs: 60 * 1000 },              // 100 per min
  ai_analysis: { maxRequests: 20, windowMs: 60 * 1000 },       // 20 per min
  file_upload: { maxRequests: 10, windowMs: 5 * 60 * 1000 },   // 10 per 5 min
  era_process: { maxRequests: 5, windowMs: 60 * 1000 },        // 5 per min
};

export async function checkRateLimit(key: string, endpoint: string): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const config = LIMITS[endpoint] || LIMITS.api;
  const now = new Date();

  try {
    // Clean expired entries
    await db.delete(rateLimits).where(and(eq(rateLimits.key, key), eq(rateLimits.endpoint, endpoint), sql`${rateLimits.expiresAt} < ${now}`));

    // Count current window
    const [current] = await db.select({ total: sql<number>`COALESCE(SUM(count), 0)::int` })
      .from(rateLimits).where(and(eq(rateLimits.key, key), eq(rateLimits.endpoint, endpoint), gt(rateLimits.expiresAt, now)));

    const currentCount = current?.total || 0;

    if (currentCount >= config.maxRequests) {
      return { allowed: false, remaining: 0, retryAfterMs: config.windowMs };
    }

    // Increment or create
    const expiresAt = new Date(now.getTime() + config.windowMs);
    await db.insert(rateLimits).values({ key, endpoint, count: 1, windowStart: now, expiresAt });

    return { allowed: true, remaining: config.maxRequests - currentCount - 1, retryAfterMs: 0 };
  } catch {
    // On error, allow request (fail open for availability)
    return { allowed: true, remaining: config.maxRequests, retryAfterMs: 0 };
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
