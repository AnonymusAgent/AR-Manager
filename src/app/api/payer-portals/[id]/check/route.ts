import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { payerPortals, portalInteractions, claims } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

/**
 * Attempt a real payer portal interaction.
 * If the portal has a configured API endpoint and credentials, this will
 * attempt an actual HTTP call. Otherwise it returns a clear "not configured" message.
 */
async function executePortalRequest(
  portal: typeof payerPortals.$inferSelect,
  interactionType: string,
  requestPayload: Record<string, unknown>
): Promise<{ success: boolean; data: Record<string, unknown> | null; error: string | null }> {
  // Check if portal is configured
  if (!portal.isConfigured || !portal.apiEndpoint) {
    return {
      success: false,
      data: null,
      error: `Integration not configured. Portal "${portal.payerName}" does not have an API endpoint or credentials set up. Please configure the portal integration in Settings before attempting a check.`,
    };
  }

  if (portal.authMethod !== 'none' && !portal.credentials) {
    return {
      success: false,
      data: null,
      error: `Authentication credentials are missing for "${portal.payerName}". Please update the portal configuration with valid credentials.`,
    };
  }

  if (!portal.isActive) {
    return {
      success: false,
      data: null,
      error: `Portal "${portal.payerName}" is currently disabled. Enable the portal before performing checks.`,
    };
  }

  // Validate capability for the requested interaction type
  if (interactionType === 'eligibility' && !portal.supportsEligibility) {
    return { success: false, data: null, error: `Eligibility check is not supported by "${portal.payerName}".` };
  }
  if (interactionType === 'claim_status' && !portal.supportsClaimStatus) {
    return { success: false, data: null, error: `Claim status check is not supported by "${portal.payerName}".` };
  }
  if (interactionType === 'era' && !portal.supportsEra) {
    return { success: false, data: null, error: `ERA retrieval is not supported by "${portal.payerName}".` };
  }
  if (interactionType === 'authorization' && !portal.supportsAuth) {
    return { success: false, data: null, error: `Authorization check is not supported by "${portal.payerName}".` };
  }

  // Attempt real API call
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const credentials = portal.credentials as Record<string, string> | null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add auth headers based on method
    if (portal.authMethod === 'bearer' && credentials?.token) {
      headers['Authorization'] = `Bearer ${credentials.token}`;
    } else if (portal.authMethod === 'basic' && credentials?.username && credentials?.password) {
      headers['Authorization'] = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
    } else if (portal.authMethod === 'api_key' && credentials?.apiKey) {
      headers['X-API-Key'] = credentials.apiKey;
    }

    const response = await fetch(portal.apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: interactionType, ...requestPayload }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 401 || response.status === 403) {
        return { success: false, data: null, error: `Authentication failed for "${portal.payerName}". Invalid or expired credentials. HTTP ${response.status}.` };
      }
      return { success: false, data: null, error: `Payer API returned error. HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json();
    return { success: true, data, error: null };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      return { success: false, data: null, error: `Connection to "${portal.payerName}" timed out after 15 seconds. The payer API may be unavailable.` };
    }
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return { success: false, data: null, error: `Unable to connect to "${portal.payerName}" portal. The payer API endpoint may be incorrect or the service is unavailable.` };
    }
    return { success: false, data: null, error: `Connection error: ${error.message || 'Unknown error'}. Please verify the portal configuration.` };
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const body = await request.json();
    const { interactionType, claimId, memberId, dateOfService, subscriberId } = body;

    if (!interactionType) return NextResponse.json({ error: 'Interaction type is required' }, { status: 400 });

    const [portal] = await db.select().from(payerPortals).where(eq(payerPortals.id, id)).limit(1);
    if (!portal) return NextResponse.json({ error: 'Payer portal not found' }, { status: 404 });

    // Build request payload
    const requestPayload: Record<string, unknown> = { interactionType };
    if (claimId) {
      const [claim] = await db.select().from(claims).where(eq(claims.id, claimId)).limit(1);
      if (claim) {
        requestPayload.claimNumber = claim.claimNumber;
        requestPayload.patientName = claim.patientName;
        requestPayload.dateOfService = claim.dateOfService;
        requestPayload.billedAmount = claim.billedAmount;
      }
    }
    if (memberId) requestPayload.memberId = memberId;
    if (dateOfService) requestPayload.dateOfService = dateOfService;
    if (subscriberId) requestPayload.subscriberId = subscriberId;

    // Execute the real portal request
    const result = await executePortalRequest(portal, interactionType, requestPayload);

    // Log the interaction regardless of success/failure
    const [interaction] = await db.insert(portalInteractions).values({
      payerPortalId: id,
      interactionType,
      claimId: claimId || null,
      requestData: requestPayload,
      responseData: result.data,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      performedBy: user.id,
    }).returning();

    // Update portal's last test status
    await db.update(payerPortals).set({
      lastTestedAt: new Date(),
      lastTestStatus: result.success ? 'success' : 'failed',
      updatedAt: new Date(),
    }).where(eq(payerPortals.id, id));

    await createAuditLog({
      userId: user.id, action: 'portal_interaction', entityType: 'portalInteraction', entityId: interaction.id,
      newValue: { portalName: portal.payerName, interactionType, status: result.success ? 'success' : 'failed' },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        interaction,
        data: result.data,
        source: 'live',
        retrievedAt: new Date().toISOString(),
        message: `Live data retrieved from ${portal.payerName}`,
      });
    } else {
      return NextResponse.json({
        success: false,
        interaction,
        data: null,
        source: 'unavailable',
        error: result.error,
        message: result.error,
      }, { status: 422 });
    }
  } catch (error) {
    console.error('Portal check error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred while communicating with the payer portal.' }, { status: 500 });
  }
}
