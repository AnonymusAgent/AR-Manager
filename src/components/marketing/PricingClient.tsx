'use client';
import { useState } from 'react';
import Link from 'next/link';
import Reveal from './fx/Reveal';
import TiltCard from './fx/TiltCard';
import { money, annualSavingsPct, INCLUDED_IN_EVERY_PLAN, type PlanCatalogItem } from '@/lib/plans-shared';

const ROWS: { label: string; values: (p: PlanCatalogItem) => string }[] = [
  { label: 'Team seats included', values: p => p.limits.seats >= 9999 ? 'Custom (fair use)' : `Up to ${p.limits.seats}` },
  { label: 'Claims per month', values: p => p.limits.claimsPerMonth.toLocaleString() },
  { label: 'AR work queues & aging', values: () => '✓ Included' },
  { label: 'Denial library & coding queue', values: p => p.slug === 'starter' ? 'Library only' : '✓ Included' },
  { label: 'Review & approval workflows', values: p => p.slug === 'starter' ? '—' : '✓ Included' },
  { label: 'AI denial analysis & OCR', values: p => p.slug === 'starter' ? '—' : '✓ Included' },
  { label: 'Payments & ERA/835 posting', values: p => p.slug === 'starter' ? '—' : '✓ Included' },
  { label: 'Custom domain', values: p => p.slug === 'enterprise' ? '✓ Your domain' : p.slug === 'professional' ? 'Subdomain' : '—' },
  { label: 'External API & API keys', values: p => p.slug === 'enterprise' ? '✓ Included' : '—' },
  { label: 'Support', values: p => p.slug === 'starter' ? 'Email' : p.slug === 'professional' ? 'Priority' : 'Dedicated onboarding' },
];
const FAQS = [
  ['What do I get when I buy?', 'Instant access to your own organization workspace: claims & AR work queues, aging dashboards, denial management, team roles, audit trail and reports — the exact modules listed on the Features page. Your trial converts to the plan you pick; nothing is re-installed.'],
  ['Is there a free trial?', 'Yes — start any self-serve plan without a card. Paid status only activates after our payment provider confirms payment; returning from checkout alone never charges you.'],
  ['Can I change or cancel later?', 'Upgrade, downgrade or cancel anytime from Settings → Billing. Cancelling stops future renewals and access continues to the end of the paid period.'],
  ['What happens if a payment fails?', 'You enter a grace period with reminders — we never delete your billing data because a payment failed.'],
  ['Do prices include my whole team?', 'Each plan includes the seats shown above. Invite your team during onboarding; seat limits are checked when you invite.'],
];

export default function PricingClient({ plans, source }: { plans: PlanCatalogItem[]; source: 'live' | 'catalog' }) {
  const [annual, setAnnual] = useState(false);
  return <div>
    <div className="mt-8 inline-flex rounded-full border bg-white p-1 shadow-sm" role="group" aria-label="Billing period">
      {([['Monthly', false], ['Annual', true]] as const).map(([label, val]) => (
        <button key={label} onClick={() => setAnnual(val)} aria-pressed={annual === val}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-blue-600 ${annual === val ? 'bg-blue-600 text-white shadow' : 'text-slate-700 hover:bg-slate-100'}`}>
          {label}{val && <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">save ~20%</span>}
        </button>))}
    </div>
    {source === 'catalog' && <p className="mt-3 text-xs text-slate-600" role="note">Showing standard plan pricing. Live plan configuration will replace this automatically once connected.</p>}

    <div className="mt-8 grid gap-5 md:grid-cols-3" style={{ perspective: '1200px' }}>
      {plans.map((p, i) => { const cents = annual ? p.annualPriceCents : p.monthlyPriceCents; const perMonth = annual && cents ? Math.round(cents / 12) : cents; const save = annualSavingsPct(p);
        return <Reveal key={p.slug} delay={i * 90}><TiltCard max={4} className="h-full">
          <article aria-label={`${p.name} plan`} className={`mkt-card-shadow relative flex h-full flex-col rounded-3xl border bg-white p-6 ${p.highlight ? 'ring-2 ring-blue-600 md:-translate-y-3' : ''}`}>
            {p.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white shadow">MOST POPULAR</span>}
            <h2 className="text-xl font-extrabold text-[#0F2D52]">{p.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{p.description}</p>
            <p className="mt-1 text-xs font-semibold text-blue-700">{p.bestFor}</p>
            <div className="mt-5" aria-live="polite">
              {cents ? <>
                <p><span className="text-4xl font-extrabold text-[#0F2D52]">{money(perMonth)}</span><span className="text-sm text-slate-600"> / month</span></p>
                <p className="mt-1 text-xs text-slate-600">{annual ? `${money(cents)} billed once a year${save ? ` · save ${save}% vs monthly` : ''}` : `${money(cents)} billed monthly · switch to annual to save ${save}%`}</p>
              </> : <><p className="text-4xl font-extrabold text-[#0F2D52]">Custom</p><p className="mt-1 text-xs text-slate-600">Volume pricing based on seats, practices & claims</p></>}
              <p className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">{p.trialDays}-day free trial · no card required</p>
            </div>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">What you get</h3>
            <ul className="mt-2 flex-1 space-y-1.5 text-sm text-slate-700">{p.features.map(f => <li key={f} className="flex gap-2"><span aria-hidden="true" className="text-emerald-600">✓</span><span>{f}</span></li>)}</ul>
            <Link href={p.slug === 'enterprise' ? '/contact?type=sales' : `/register?plan=${p.slug}`}
              className={`mt-6 rounded-xl px-4 py-3 text-center font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${p.highlight ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700' : 'border hover:shadow-md'}`}>{p.cta}</Link>
          </article></TiltCard></Reveal>; })}
    </div>

    <Reveal><section aria-labelledby="compare-h" className="mt-14 overflow-x-auto rounded-3xl border bg-white shadow-sm">
      <h2 id="compare-h" className="px-6 pt-6 text-xl font-extrabold text-[#0F2D52]">Compare what&apos;s included</h2>
      <table className="mt-4 w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Feature comparison across Starter, Professional and Enterprise plans</caption>
        <thead><tr className="border-y bg-slate-50 text-slate-700"><th scope="col" className="px-6 py-3">Feature</th>{plans.map(p => <th key={p.slug} scope="col" className="px-4 py-3">{p.name}</th>)}</tr></thead>
        <tbody>{ROWS.map(r => <tr key={r.label} className="border-b last:border-0"><th scope="row" className="px-6 py-3 font-medium text-slate-700">{r.label}</th>{plans.map(p => <td key={p.slug} className="px-4 py-3 text-slate-700">{r.values(p)}</td>)}</tr>)}</tbody>
      </table>
    </section></Reveal>

    <Reveal><section aria-labelledby="included-h" className="mt-10 rounded-3xl bg-[#0F2D52] p-6 text-white md:p-8">
      <h2 id="included-h" className="text-xl font-extrabold">Included in every plan</h2>
      <ul className="mt-4 grid gap-3 text-sm md:grid-cols-2">{INCLUDED_IN_EVERY_PLAN.map(x => <li key={x} className="flex gap-2"><span aria-hidden="true" className="text-emerald-300">✓</span>{x}</li>)}</ul>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/register" className="rounded-xl bg-white px-5 py-2.5 font-semibold text-[#0F2D52] transition hover:-translate-y-0.5">Start free trial</Link><Link href="/features" className="rounded-xl border border-white/40 px-5 py-2.5 font-semibold transition hover:bg-white/10">Explore features</Link></div>
    </section></Reveal>

    <section aria-labelledby="pricing-faq-h" className="mt-12"><h2 id="pricing-faq-h" className="text-2xl font-extrabold text-[#0F2D52]">Pricing questions</h2>
      <div className="mt-4 space-y-3">{FAQS.map(([q, a]) => <details key={q} className="group rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-semibold marker:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">{q}</summary><p className="mt-2 text-sm text-slate-600">{a}</p></details>)}</div>
    </section>
    <p className="mt-8 text-sm text-slate-600">Prices in USD. You can upgrade, downgrade or cancel from Billing settings — see the <Link className="text-blue-700 underline" href="/legal/subscription">Subscription &amp; Cancellation Policy</Link>. Payment failure never deletes your data.</p>
  </div>;
}
