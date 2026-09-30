import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, denialCodes } from '@/db/schema';
import { hashPassword } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { ALL_DENIAL_CODES } from '@/lib/denial-codes-data';

async function ensureUser(email: string, password: string, firstName: string, lastName: string, role: string, teamLeadId?: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existing) {
    const hash = await hashPassword(password);
    const [created] = await db.insert(users).values({
      email, passwordHash: hash, firstName, lastName, role: role as 'administrator', isActive: true, teamLeadId,
    }).returning();
    return created;
  }
  return existing;
}

export async function POST() {
  try {
    // ===== USERS =====
    // Ali Mukhtar — primary administrator
    await ensureUser('ali.mukhtar@medicalbilling.com', 'Ali@2026!', 'Ali', 'Mukhtar', 'administrator');

    // System admin
    await ensureUser('admin@medicalbilling.com', 'Admin@123', 'System', 'Administrator', 'administrator');

    // Supervisor
    await ensureUser('supervisor@medicalbilling.com', 'Supervisor@123', 'Jane', 'Supervisor', 'supervisor');

    // Manager
    await ensureUser('manager@medicalbilling.com', 'Manager@123', 'John', 'Manager', 'manager');

    // Team Lead
    const teamLead = await ensureUser('teamlead@medicalbilling.com', 'TeamLead@123', 'Sarah', 'Lead', 'team_lead');

    // AR Executive
    await ensureUser('executive@medicalbilling.com', 'Executive@123', 'Mike', 'Executive', 'ar_executive', teamLead.id);

    // Billing User
    await ensureUser('billing@medicalbilling.com', 'Billing@123', 'Tom', 'Billing', 'billing_user', teamLead.id);

    // ===== DENIAL CODES =====
    let insertedCount = 0;
    let skippedCount = 0;
    const seen = new Set<string>();

    for (const codeData of ALL_DENIAL_CODES) {
      const key = `${codeData.codeType}-${codeData.code}`;
      if (seen.has(key)) { skippedCount++; continue; }
      seen.add(key);

      const [existing] = await db.select().from(denialCodes).where(eq(denialCodes.code, codeData.code)).limit(1);
      if (!existing) {
        await db.insert(denialCodes).values({ code: codeData.code, codeType: codeData.codeType, description: codeData.description, category: codeData.category });
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      denialCodes: { total: ALL_DENIAL_CODES.length, inserted: insertedCount, skipped: skippedCount },
      defaultCredentials: {
        aliMukhtar: { email: 'ali.mukhtar@medicalbilling.com', password: 'Ali@2026!', role: 'Administrator' },
        admin: { email: 'admin@medicalbilling.com', password: 'Admin@123', role: 'Administrator' },
        supervisor: { email: 'supervisor@medicalbilling.com', password: 'Supervisor@123', role: 'Supervisor' },
        manager: { email: 'manager@medicalbilling.com', password: 'Manager@123', role: 'Manager' },
        teamLead: { email: 'teamlead@medicalbilling.com', password: 'TeamLead@123', role: 'Team Lead' },
        executive: { email: 'executive@medicalbilling.com', password: 'Executive@123', role: 'AR Executive' },
        billing: { email: 'billing@medicalbilling.com', password: 'Billing@123', role: 'Billing User' },
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
