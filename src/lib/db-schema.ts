import { db } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * Self-healing additive schema guard.
 * Migrations 0003/0004 only ADD columns/tables, but if they were never applied to a
 * deployment, Drizzle selects referencing those columns crash login/seed with a
 * generic 500. These statements are idempotent and additive-only (safe to run on
 * every cold start; never drops or alters existing data). If the BASE tables
 * themselves are missing we report that instead — creating the whole schema is
 * what `npm run db:migrate` is for.
 */
const STATEMENTS = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_platform_admin" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_status" varchar(20) NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "org_type" varchar(50)`,
  `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" varchar(100)`,
  `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "timezone" varchar(100)`,
  `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "owner_user_id" uuid`,
  `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_step" integer NOT NULL DEFAULT 0`,
  `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_complete" boolean NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS "site_settings" ("key" varchar(100) PRIMARY KEY, "value" jsonb NOT NULL, "updated_by" uuid, "updated_at" timestamp NOT NULL DEFAULT now())`,
];

let cached: Promise<{ ok: boolean; missingTables: string[] }> | null = null;

export function ensureSaaSColumns() {
  if (!cached) {
    cached = (async () => {
      const missingTables: string[] = [];
      try {
        const rows = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','organizations','denial_codes')`);
        const present = new Set((rows.rows as { table_name: string }[]).map(r => r.table_name));
        for (const t of ['users', 'organizations', 'denial_codes']) if (!present.has(t)) missingTables.push(t);
      } catch { return { ok: false, missingTables: ['<database unreachable>'] }; }
      if (missingTables.includes('users')) return { ok: false, missingTables };
      for (const stmt of STATEMENTS) {
        try { await db.execute(sql.raw(stmt)); } catch { /* table missing (reported above) or already fine */ }
      }
      return { ok: missingTables.length === 0, missingTables };
    })();
    // Don't cache failures forever — allow retry after the operator fixes the DB.
    cached.then(r => { if (!r.ok) setTimeout(() => { cached = null; }, 30_000); });
  }
  return cached;
}

export function schemaHint(missing: string[]) {
  return `Database schema is not ready (missing: ${missing.join(', ')}). Run the migrations against this database — locally: set DATABASE_URL and run "npm run db:migrate", or apply the SQL files in the drizzle/ folder in order in your database console — then try again. See docs/SAAS_SETUP.md.`;
}

/** Never leak connection strings or internals in an error shown to a client. */
export function safeErrorDetail(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.replace(/postgres(ql)?:\/\/\S+/gi, '[database-url]').slice(0, 300);
}
