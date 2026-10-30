import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, users, subscriptions, leads, organizationDomains } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { requirePlatformAdmin } from '@/lib/platform-admin';
// Platform admin is a SEPARATE flag — being an org admin/administrator never grants platform access, and platform access never grants PHI access.
const guard = requirePlatformAdmin;
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt)).limit(100);
  const allUsers = await db.select({ id: users.id }).from(users);
  const subs = await db.select().from(subscriptions);
  const leadRows = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(50);
  const domains = await db.select().from(organizationDomains);
  return NextResponse.json({ integrations: { emailConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS), paymentsConfigured: Boolean(process.env.STRIPE_SECRET_KEY), webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET), rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN || null, appUrl: process.env.NEXT_PUBLIC_APP_URL || null }, domains, metrics: { organizations: orgs.length, users: allUsers.length, trials: subs.filter(s=>s.status==='trialing').length, activeSubscriptions: subs.filter(s=>s.status==='active').length, cancelled: subs.filter(s=>s.status==='cancelled').length, paymentFailures: subs.filter(s=>s.status==='past_due').length, pendingDomains: domains.filter(d=>d.verificationStatus!=='verified').length }, organizations: orgs, leads: leadRows });
}
export async function POST(req: NextRequest) {
  const admin = await guard(); if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { organizationId, action, reason } = await req.json();
  if (!organizationId || !reason) return NextResponse.json({ error: 'organizationId and a recorded reason are required' }, { status: 400 });
  if (action === 'suspend') await db.update(organizations).set({ status: 'suspended', isActive: false }).where(eq(organizations.id, organizationId));
  else if (action === 'reactivate') await db.update(organizations).set({ status: 'active', isActive: true }).where(eq(organizations.id, organizationId));
  else return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  const { createAuditLog } = await import('@/lib/audit');
  await createAuditLog({ userId: admin.id, action: `platform_org_${action}`, entityType: 'organization', entityId: organizationId, newValue: { reason } });
  return NextResponse.json({ success: true });
}
