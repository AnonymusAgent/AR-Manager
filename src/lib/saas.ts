import crypto from 'crypto';
import { db } from '@/db';
import { plans, subscriptions, organizations, organizationDomains } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const RESERVED_SLUGS = new Set(['www','app','api','admin','login','register','pricing','features','about','contact','faq','dashboard','support','billing','mail','vercel','ar-manager']);
export function slugify(input: string) { return input.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60); }
export function validateSlug(slug: string) { return /^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug); }
export function makeToken() { return crypto.randomBytes(32).toString('hex'); }
export function hashToken(t: string) { return crypto.createHash('sha256').update(t).digest('hex'); }
export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/,'');
export const rootDomain = () => process.env.NEXT_PUBLIC_ROOT_DOMAIN || ''; // e.g. ar-manager-ten.vercel.app

export const DEFAULT_PLANS = [
 { slug:'starter', name:'Starter', description:'For small practices getting AR under control.', monthlyPriceCents:9900, annualPriceCents:95000, trialDays:14, sortOrder:1, features:['Claims management & work queues','AR aging dashboard','Denial code library (272 codes)','Up to 5 seats','Email support'], limits:{seats:5, claimsPerMonth:1000} },
 { slug:'professional', name:'Professional', description:'For billing teams that need automation, review workflows and reporting.', monthlyPriceCents:24900, annualPriceCents:239000, trialDays:14, sortOrder:2, features:['Everything in Starter','Review & approval workflows','Authorizations, coding queue & tasks','Advanced reports & exports','Custom subdomain','Up to 25 seats','Priority support'], limits:{seats:25, claimsPerMonth:10000} },
 { slug:'enterprise', name:'Enterprise', description:'For billing companies managing many practices, with custom domains and API access.', monthlyPriceCents:0, annualPriceCents:0, trialDays:30, sortOrder:3, features:['Everything in Professional','Custom domain (billing.yourpractice.com)','External API & API keys','Unlimited seats (fair use)','Dedicated onboarding','Contact sales for pricing'], limits:{seats:9999, claimsPerMonth:100000} },
];
export async function ensureDefaultPlans() {
  const existing = await db.select().from(plans);
  if (existing.length) return existing;
  await db.insert(plans).values(DEFAULT_PLANS.map(p=>({...p, features:p.features, limits:p.limits})));
  return db.select().from(plans);
}
/** Central entitlement check — server-side only. Never trust plan names from the client. */
export async function getEntitlements(organizationId: string) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).limit(1);
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return null;
  let plan = null as null | typeof plans.$inferSelect;
  if (sub?.planId) { const [p] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1); plan = p ?? null; }
  const status = sub?.status ?? org.status;
  const active = ['trialing','active','past_due'].includes(status) && org.status !== 'suspended';
  const grace = status === 'past_due'; // grace period: keep data, warn, don't delete
  return { org, subscription: sub ?? null, plan, active, grace, limits: (plan?.limits as {seats?:number;claimsPerMonth?:number}) ?? {seats:5}, features: (plan?.features as string[]) ?? [] };
}
/** Resolve tenant from a hostname: verified custom domain, or <slug>.<rootDomain>. Slug alone is never authorization. */
export async function resolveTenantByHostname(hostname: string) {
  const host = hostname.split(':')[0].toLowerCase();
  const [domain] = await db.select().from(organizationDomains).where(eq(organizationDomains.hostname, host)).limit(1);
  if (domain) {
    if (domain.verificationStatus !== 'verified') return { error: 'domain_not_verified' as const };
    const [org] = await db.select().from(organizations).where(eq(organizations.id, domain.organizationId)).limit(1);
    return org && org.status !== 'suspended' ? { org, domain } : { error: 'org_inactive' as const };
  }
  const root = rootDomain();
  if (root && host.endsWith('.' + root)) {
    const slug = host.slice(0, -(root.length + 1));
    if (slug && !slug.includes('.')) {
      const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
      if (org) return org.status !== 'suspended' ? { org } : { error: 'org_inactive' as const };
    }
  }
  return { error: 'unknown_host' as const };
}
