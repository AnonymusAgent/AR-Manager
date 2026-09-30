import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { payerPortals, portalInteractions } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getCurrentUser, isSupervisorOrAbove } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const [portal] = await db.select().from(payerPortals).where(eq(payerPortals.id, id)).limit(1);
    if (!portal) return NextResponse.json({ error: 'Payer portal not found' }, { status: 404 });

    // Get recent interactions
    const interactions = await db.select({
      id: portalInteractions.id, interactionType: portalInteractions.interactionType,
      status: portalInteractions.status, errorMessage: portalInteractions.errorMessage,
      createdAt: portalInteractions.createdAt,
    }).from(portalInteractions).where(eq(portalInteractions.payerPortalId, id)).orderBy(desc(portalInteractions.createdAt)).limit(20);

    return NextResponse.json({
      portal: {
        ...portal,
        credentials: undefined, // NEVER expose credentials
        hasCredentials: portal.authMethod !== 'none' && !!portal.credentials,
      },
      interactions,
    });
  } catch (error) {
    console.error('Get payer portal error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isSupervisorOrAbove(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const { id } = await params;

    const [existing] = await db.select().from(payerPortals).where(eq(payerPortals.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Payer portal not found' }, { status: 404 });

    const body = await request.json();
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (body.payerName !== undefined) update.payerName = body.payerName;
    if (body.payerId !== undefined) update.payerId = body.payerId;
    if (body.portalUrl !== undefined) update.portalUrl = body.portalUrl;
    if (body.apiEndpoint !== undefined) update.apiEndpoint = body.apiEndpoint;
    if (body.authMethod !== undefined) update.authMethod = body.authMethod;
    if (body.credentials !== undefined) update.credentials = body.credentials;
    if (body.isActive !== undefined) update.isActive = body.isActive;
    if (body.supportsEligibility !== undefined) update.supportsEligibility = body.supportsEligibility;
    if (body.supportsClaimStatus !== undefined) update.supportsClaimStatus = body.supportsClaimStatus;
    if (body.supportsEra !== undefined) update.supportsEra = body.supportsEra;
    if (body.supportsAuth !== undefined) update.supportsAuth = body.supportsAuth;
    if (body.notes !== undefined) update.notes = body.notes;

    // Recalculate isConfigured
    const apiEp = body.apiEndpoint ?? existing.apiEndpoint;
    const authM = body.authMethod ?? existing.authMethod;
    update.isConfigured = !!(apiEp && authM && authM !== 'none');

    const [updated] = await db.update(payerPortals).set(update).where(eq(payerPortals.id, id)).returning();

    await createAuditLog({
      userId: user.id, action: 'payer_portal_updated', entityType: 'payerPortal', entityId: id,
      previousValue: { payerName: existing.payerName, isActive: existing.isActive, isConfigured: existing.isConfigured },
      newValue: { payerName: updated.payerName, isActive: updated.isActive, isConfigured: updated.isConfigured },
    });

    return NextResponse.json({ portal: { ...updated, credentials: undefined } });
  } catch (error) {
    console.error('Update payer portal error:', error);
    return NextResponse.json({ error: 'Failed to update payer portal' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'administrator') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const { id } = await params;

    const [existing] = await db.select().from(payerPortals).where(eq(payerPortals.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Payer portal not found' }, { status: 404 });

    // Check for interactions — if any exist, soft-delete (deactivate) instead
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(portalInteractions).where(eq(portalInteractions.payerPortalId, id));

    if (count > 0) {
      await db.update(payerPortals).set({ isActive: false, updatedAt: new Date() }).where(eq(payerPortals.id, id));
      await createAuditLog({ userId: user.id, action: 'payer_portal_deactivated', entityType: 'payerPortal', entityId: id, newValue: { reason: `Deactivated instead of deleted — ${count} interactions exist` } });
      return NextResponse.json({ success: true, message: 'Portal deactivated (has existing interactions)' });
    }

    await db.delete(payerPortals).where(eq(payerPortals.id, id));
    await createAuditLog({ userId: user.id, action: 'payer_portal_deleted', entityType: 'payerPortal', entityId: id, previousValue: { payerName: existing.payerName, payerCode: existing.payerCode } });

    return NextResponse.json({ success: true, message: 'Portal deleted' });
  } catch (error) {
    console.error('Delete payer portal error:', error);
    return NextResponse.json({ error: 'Failed to delete payer portal' }, { status: 500 });
  }
}
