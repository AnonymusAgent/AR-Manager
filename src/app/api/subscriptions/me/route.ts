import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireMembership } from '@/lib/tenant';
import { getEntitlements } from '@/lib/saas';
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = req.nextUrl.searchParams.get('organizationId'); if (!orgId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
  if (!await requireMembership(user.id, orgId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ entitlements: await getEntitlements(orgId), paymentsConfigured: Boolean(process.env.STRIPE_SECRET_KEY) });
}
