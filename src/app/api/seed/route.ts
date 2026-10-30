import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, denialCodes } from '@/db/schema';
import { hashPassword } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { ALL_DENIAL_CODES } from '@/lib/denial-codes-data';
import { ensureSaaSColumns, schemaHint, safeErrorDetail } from '@/lib/db-schema';

const SEED_USERS: [string, string, string, string, string][] = [
  ['ali.mukhtar@medicalbilling.com', 'Ali@2026!', 'Ali', 'Mukhtar', 'administrator'],
  ['admin@medicalbilling.com', 'Admin@123', 'System', 'Administrator', 'administrator'],
  ['supervisor@medicalbilling.com', 'Supervisor@123', 'Jane', 'Supervisor', 'supervisor'],
  ['manager@medicalbilling.com', 'Manager@123', 'John', 'Manager', 'manager'],
  ['teamlead@medicalbilling.com', 'TeamLead@123', 'Sarah', 'Lead', 'team_lead'],
  ['executive@medicalbilling.com', 'Executive@123', 'Mike', 'Executive', 'ar_executive'],
  ['billing@medicalbilling.com', 'Billing@123', 'Tom', 'Billing', 'billing_user'],
];

/** Idempotent: existing accounts are reactivated but their passwords are never reset. */
async function ensureUser(email: string, password: string, firstName: string, lastName: string, role: string, teamLeadId?: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existing) {
    const hash = await hashPassword(password);
    const [created] = await db.insert(users).values({
      email, passwordHash: hash, firstName, lastName, role: role as 'administrator', isActive: true, teamLeadId,
    }).returning();
    return { user: created, created: true };
  }
  if (!existing.isActive) {
    await db.update(users).set({ isActive: true, accountStatus: 'active' }).where(eq(users.id, existing.id));
  }
  return { user: existing, created: false };
}

export async function POST() {
  try {
    // Self-heal additive SaaS columns first (the usual cause of seed 500s on older DBs).
    const schema = await ensureSaaSColumns();
    if (schema.missingTables.includes('users') || schema.missingTables.includes('denial_codes')) {
      return NextResponse.json({
        error: 'Failed to seed database', code: 'SCHEMA_NOT_READY',
        detail: schemaHint(schema.missingTables),
      }, { status: 503 });
    }

    let usersCreated = 0, usersExisting = 0;
    let teamLeadId: string | undefined;
    for (const [email, password, firstName, lastName, role] of SEED_USERS) {
      const needsLead = email.startsWith('executive@') || email.startsWith('billing@');
      const { user, created } = await ensureUser(email, password, firstName, lastName, role, needsLead ? teamLeadId : undefined);
      if (email.startsWith('teamlead@')) teamLeadId = user.id;
      if (created) usersCreated++; else usersExisting++;
    }

    // Denial codes: one bad row must not abort the whole seed.
    let insertedCount = 0, skippedCount = 0, failedCount = 0;
    const seen = new Set<string>();
    for (const codeData of ALL_DENIAL_CODES) {
      if (seen.has(codeData.code)) { skippedCount++; continue; }
      seen.add(codeData.code);
      try {
        const [existing] = await db.select().from(denialCodes).where(eq(denialCodes.code, codeData.code)).limit(1);
        if (existing) { skippedCount++; continue; }
        await db.insert(denialCodes).values({ code: codeData.code, codeType: codeData.codeType, description: codeData.description, category: codeData.category });
        insertedCount++;
      } catch (e) {
        failedCount++;
        console.error(`Seed: denial code ${codeData.code} failed:`, safeErrorDetail(e));
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      users: { created: usersCreated, existing: usersExisting },
      denialCodes: { total: ALL_DENIAL_CODES.length, inserted: insertedCount, skipped: skippedCount, failed: failedCount },
      defaultCredentials: Object.fromEntries(SEED_USERS.map(([email, password, , , role]) => [email, { password, role }])),
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({
      error: 'Failed to seed database',
      detail: safeErrorDetail(error),
      hint: 'Check /api/health for database/schema status. Usually the migrations have not been applied: run "npm run db:migrate" with DATABASE_URL set, or apply drizzle/*.sql in order in your database console. See docs/SAAS_SETUP.md.',
    }, { status: 500 });
  }
}
