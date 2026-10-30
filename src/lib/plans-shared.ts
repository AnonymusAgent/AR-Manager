/** Client-safe plan catalog. DB plans (edited by platform admin) win when available;
    this catalog is the guaranteed fallback so /pricing always shows real prices. */
export interface PlanCatalogItem {
  slug: string; name: string; description: string; bestFor: string;
  monthlyPriceCents: number; annualPriceCents: number; trialDays: number;
  features: string[]; limits: { seats: number; claimsPerMonth: number };
  highlight?: boolean; cta: string;
}
export const DEFAULT_PLAN_CATALOG: PlanCatalogItem[] = [
  { slug: 'starter', name: 'Starter', description: 'For small practices getting AR under control.', bestFor: 'Solo & small practices (1–5 billers)',
    monthlyPriceCents: 9900, annualPriceCents: 95000, trialDays: 14, highlight: false, cta: 'Start 14-day free trial',
    features: ['Claims management & AR work queues', 'AR aging dashboard (0–30 / 31–60 / 61–90 / 90+)', 'Denial code library — 272 CARC/RARC codes', 'Claim notes, documents & follow-up dates', 'Excel/CSV claim import', 'Email support'],
    limits: { seats: 5, claimsPerMonth: 1000 } },
  { slug: 'professional', name: 'Professional', description: 'For billing teams that need automation, review workflows and reporting.', bestFor: 'Growing billing teams & multi-provider practices',
    monthlyPriceCents: 24900, annualPriceCents: 239000, trialDays: 14, highlight: true, cta: 'Start 14-day free trial',
    features: ['Everything in Starter, plus:', 'Review & approval workflows (approve / rework)', 'Authorizations, referrals & coding queue', 'Billing tasks, sign-offs & supervisor panel', 'AI denial analysis & OCR document intake', 'Payments & ERA/835 posting', 'Advanced reports & CSV/Excel exports', 'Team chat, notifications & e-signatures', 'Custom workspace subdomain', 'Priority support'],
    limits: { seats: 25, claimsPerMonth: 10000 } },
  { slug: 'enterprise', name: 'Enterprise', description: 'For billing companies managing many practices, with custom domains and API access.', bestFor: 'Billing companies & healthcare organizations',
    monthlyPriceCents: 0, annualPriceCents: 0, trialDays: 30, highlight: false, cta: 'Talk to sales',
    features: ['Everything in Professional, plus:', 'Custom domain (e.g. billing.yourpractice.com)', 'External API & API keys for integrations', 'Higher seat & claim limits (fair use)', 'Dedicated onboarding & migration help', 'Platform usage & audit reporting'],
    limits: { seats: 9999, claimsPerMonth: 100000 } },
];
export const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;
export const annualSavingsPct = (p: PlanCatalogItem) => p.monthlyPriceCents ? Math.max(0, Math.round((1 - p.annualPriceCents / (p.monthlyPriceCents * 12)) * 100)) : 0;
export const INCLUDED_IN_EVERY_PLAN = ['Your own isolated organization workspace', 'Secure sign-in with email verification & password recovery', 'Role-based access for your whole team', 'Complete audit trail of billing activity', 'No credit card required to start the trial', 'Cancel anytime — your data is retained per policy, never deleted for a failed payment'];
