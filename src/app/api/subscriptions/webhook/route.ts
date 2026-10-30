import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { subscriptions, processedWebhooks } from '@/db/schema';
import { eq } from 'drizzle-orm';
// Stripe webhook: verify signature (HMAC), idempotent via processed_webhooks. Subscription is
// activated ONLY here / via provider API — never from a browser success redirect.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  const raw = await req.text(); const sig = req.headers.get('stripe-signature') || '';
  const parts = Object.fromEntries(sig.split(',').map(p => p.split('=') as [string,string]));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
  if (!parts.t || !parts.v1 || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  const event = JSON.parse(raw);
  const [seen] = await db.select().from(processedWebhooks).where(eq(processedWebhooks.id, event.id)).limit(1);
  if (seen) return NextResponse.json({ received: true, duplicate: true });
  await db.insert(processedWebhooks).values({ id: event.id, provider: 'stripe', type: event.type });
  const obj = event.data?.object || {};
  const orgId = obj.metadata?.organizationId; const planId = obj.metadata?.planId;
  if (orgId && ['checkout.session.completed','customer.subscription.created','customer.subscription.updated'].includes(event.type)) {
    const status = obj.status || 'active';
    const [ex] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).limit(1);
    const vals = { planId: planId || ex?.planId || null, billingProvider: 'stripe', externalCustomerId: obj.customer || ex?.externalCustomerId || null, externalSubscriptionId: obj.subscription || obj.id || ex?.externalSubscriptionId || null, status, currentPeriodEnd: obj.current_period_end ? new Date(obj.current_period_end*1000) : ex?.currentPeriodEnd || null };
    if (ex) await db.update(subscriptions).set(vals).where(eq(subscriptions.id, ex.id)); else await db.insert(subscriptions).values({ organizationId: orgId, ...vals });
  }
  if (orgId && event.type === 'customer.subscription.deleted') await db.update(subscriptions).set({ status: 'cancelled' }).where(eq(subscriptions.organizationId, orgId));
  if (orgId && event.type === 'invoice.payment_failed') await db.update(subscriptions).set({ status: 'past_due' }).where(eq(subscriptions.organizationId, orgId));
  return NextResponse.json({ received: true });
}
