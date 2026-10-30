import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { plans } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { ensureDefaultPlans } from '@/lib/saas';
export async function GET() { const u = await getCurrentUser(); if (!u?.isPlatformAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); return NextResponse.json({ plans: await ensureDefaultPlans() }); }
export async function PUT(req: NextRequest) {
  const u = await getCurrentUser(); if (!u?.isPlatformAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json(); if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const [p] = await db.update(plans).set({ name: b.name, description: b.description, monthlyPriceCents: b.monthlyPriceCents, annualPriceCents: b.annualPriceCents, trialDays: b.trialDays, features: b.features, limits: b.limits, stripeMonthlyPriceId: b.stripeMonthlyPriceId||null, stripeAnnualPriceId: b.stripeAnnualPriceId||null, isActive: b.isActive }).where(eq(plans.id, b.id)).returning();
  return NextResponse.json({ plan: p });
}
