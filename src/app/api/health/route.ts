import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSaaSColumns } from "@/lib/db-schema";

export const dynamic = "force-dynamic";

/** Diagnostics without secrets: DB reachability + whether the SaaS schema is applied. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const schema = await ensureSaaSColumns();
    const cols = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('email_verified_at','is_platform_admin','account_status')`);
    const present = (cols.rows as { column_name: string }[]).map(r => r.column_name);
    return Response.json({
      ok: schema.ok, database: 'reachable',
      schema: { ready: present.length === 3, usersColumnsPresent: present, missingTables: schema.missingTables },
      hint: schema.ok ? undefined : 'Run "npm run db:migrate" with DATABASE_URL set (or apply drizzle/*.sql in order), then re-check.',
    }, { status: schema.ok ? 200 : 503 });
  } catch {
    return Response.json({ ok: false, database: 'unreachable', hint: 'Check DATABASE_URL/NEON_DATABASE_URL in the hosting environment and that the database is running, then redeploy.' }, { status: 500 });
  }
}
