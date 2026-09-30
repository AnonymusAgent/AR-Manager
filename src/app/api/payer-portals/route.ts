import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { payerPortals, portalInteractions } from '@/db/schema';
import { eq, desc, sql, and, ilike, or } from 'drizzle-orm';
import { getCurrentUser, isSupervisorOrAbove } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const includeInactive = sp.get('includeInactive') === 'true';
    const search = sp.get('search');

    const conditions = [];
    if (!includeInactive) conditions.push(eq(payerPortals.isActive, true));
    if (search) conditions.push(or(ilike(payerPortals.payerName, `%${search}%`), ilike(payerPortals.payerCode, `%${search}%`)));

    const portals = await db
      .select({
        id: payerPortals.id,
        payerName: payerPortals.payerName,
        payerCode: payerPortals.payerCode,
        payerId: payerPortals.payerId,
        portalUrl: payerPortals.portalUrl,
        apiEndpoint: payerPortals.apiEndpoint,
        authMethod: payerPortals.authMethod,
        isActive: payerPortals.isActive,
        isConfigured: payerPortals.isConfigured,
        supportsEligibility: payerPortals.supportsEligibility,
        supportsClaimStatus: payerPortals.supportsClaimStatus,
        supportsEra: payerPortals.supportsEra,
        supportsAuth: payerPortals.supportsAuth,
        lastTestedAt: payerPortals.lastTestedAt,
        lastTestStatus: payerPortals.lastTestStatus,
        notes: payerPortals.notes,
        createdAt: payerPortals.createdAt,
        updatedAt: payerPortals.updatedAt,
      })
      .from(payerPortals)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(payerPortals.payerName);

    // Get interaction counts per portal
    const withStats = await Promise.all(portals.map(async (p) => {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(portalInteractions).where(eq(portalInteractions.payerPortalId, p.id));
      const [lastInteraction] = await db.select({ createdAt: portalInteractions.createdAt, status: portalInteractions.status })
        .from(portalInteractions).where(eq(portalInteractions.payerPortalId, p.id)).orderBy(desc(portalInteractions.createdAt)).limit(1);
      return {
        ...p,
        // Never expose credentials to the client
        hasCredentials: !!(p as Record<string, unknown>).authMethod && (p as Record<string, unknown>).authMethod !== 'none',
        totalInteractions: count,
        lastInteractionAt: lastInteraction?.createdAt || null,
        lastInteractionStatus: lastInteraction?.status || null,
      };
    }));

    return NextResponse.json({ portals: withStats });
  } catch (error) {
    console.error('Get payer portals error:', error);
    return NextResponse.json({ error: 'Failed to retrieve payer portals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isSupervisorOrAbove(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const body = await request.json();
    const { payerName, payerCode, payerId, portalUrl, apiEndpoint, authMethod, credentials,
      supportsEligibility, supportsClaimStatus, supportsEra, supportsAuth, notes } = body;

    if (!payerName || !payerCode) return NextResponse.json({ error: 'Payer name and code are required' }, { status: 400 });

    // Check for duplicate code
    const [existing] = await db.select().from(payerPortals).where(eq(payerPortals.payerCode, payerCode.toUpperCase())).limit(1);
    if (existing) return NextResponse.json({ error: `Payer code "${payerCode}" already exists` }, { status: 400 });

    const isConfigured = !!(apiEndpoint && authMethod && authMethod !== 'none');

    const [portal] = await db.insert(payerPortals).values({
      payerName, payerCode: payerCode.toUpperCase(), payerId, portalUrl, apiEndpoint,
      authMethod: authMethod || 'none', credentials: credentials || null,
      isConfigured, supportsEligibility: supportsEligibility || false,
      supportsClaimStatus: supportsClaimStatus || false, supportsEra: supportsEra || false,
      supportsAuth: supportsAuth || false, notes,
    }).returning();

    await createAuditLog({
      userId: user.id, action: 'payer_portal_created', entityType: 'payerPortal', entityId: portal.id,
      newValue: { payerName, payerCode: payerCode.toUpperCase(), isConfigured },
    });

    return NextResponse.json({ portal });
  } catch (error) {
    console.error('Create payer portal error:', error);
    return NextResponse.json({ error: 'Failed to create payer portal' }, { status: 500 });
  }
}
