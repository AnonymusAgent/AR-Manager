import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers, users } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'administrator') {
      // Regular users: only see their orgs
      const memberships = await db.select({ organizationId: organizationMembers.organizationId }).from(organizationMembers).where(eq(organizationMembers.userId, user.id));
      const orgIds = memberships.map(m => m.organizationId);
      if (orgIds.length === 0) return NextResponse.json({ organizations: [] });

      const orgs = await db.select().from(organizations).where(sql`${organizations.id} = ANY(${orgIds})`).orderBy(organizations.name);
      return NextResponse.json({ organizations: orgs });
    }

    // Admins see all
    const orgs = await db.select().from(organizations).orderBy(organizations.name);

    const withCounts = await Promise.all(orgs.map(async (org) => {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(organizationMembers).where(eq(organizationMembers.organizationId, org.id));
      return { ...org, memberCount: count };
    }));

    return NextResponse.json({ organizations: withCounts });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'administrator') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const body = await request.json();
    const { name, slug, address, phone, email, taxId, npi, primaryColor, subscriptionTier } = body;

    if (!name || !slug) return NextResponse.json({ error: 'Name and slug required' }, { status: 400 });

    const [existing] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });

    const [org] = await db.insert(organizations).values({ name, slug, address, phone, email, taxId, npi, primaryColor, subscriptionTier }).returning();

    // Add creator as super_admin
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: user.id, orgRole: 'super_admin' });

    await createAuditLog({ userId: user.id, action: 'organization_created', entityType: 'organization', entityId: org.id, newValue: { name, slug } });

    return NextResponse.json({ organization: org });
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
