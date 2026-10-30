import Link from 'next/link';
import { MarketingShell, H1 } from '@/components/marketing/Marketing';
import { getSiteContent } from '@/lib/site-content';
import Reveal from '@/components/marketing/fx/Reveal';
import TiltCard from '@/components/marketing/fx/TiltCard';
import HeroDashboard from '@/components/marketing/fx/HeroDashboard';
import HeroScene from '@/components/marketing/fx/HeroScene';
export const dynamic = 'force-dynamic';
export default async function Home() { const c = await getSiteContent(); return <MarketingShell content={c}>
  <section className="mkt-hero-bg relative overflow-hidden">
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] opacity-70 lg:block" aria-hidden="true"><HeroScene /></div>
    <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
      <Reveal><div><p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">✦ Medical billing & AR workspace</p>
      <div className="mt-5"><H1><span className="mkt-gradient-text">{c.heroHeadline}</span></H1></div>
      <p className="mt-5 text-lg text-slate-600">{c.heroSubtext}</p>
      <div className="mt-7 flex flex-wrap gap-3"><Link href="/register" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-xl shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700">{c.heroPrimaryCta}</Link><Link href="/contact?type=demo" className="px-6 py-3 border rounded-xl font-semibold bg-white/70 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg">{c.heroSecondaryCta}</Link></div>
      <p className="mt-3 text-xs text-slate-500">No card required to start a trial where a trial plan is selected. Your organization gets its own isolated workspace.</p></div></Reveal>
      <Reveal delay={150}><HeroDashboard /></Reveal>
    </div>
  </section>
  <section id="features" className="max-w-6xl mx-auto px-5 py-14 scroll-mt-24"><Reveal><h2 className="text-3xl font-extrabold text-[#0F2D52]">{c.featuresHeading}</h2><p className="mt-2 text-slate-600">Hover a card — everything below is a real module in the application.</p></Reveal>
    <div className="grid md:grid-cols-3 gap-5 mt-8">{c.features.map((f, i) => <Reveal key={f.title} delay={i * 80}><TiltCard className="h-full"><article className="mkt-card-shadow h-full border rounded-2xl bg-white p-6 transition-shadow" style={{ transform: 'translateZ(24px)' }}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-lg" aria-hidden="true">{['🧾','🔎','🛡️','📊','✅','💬'][i % 6]}</div><h3 className="font-bold mt-3">{f.title}</h3><p className="text-sm text-slate-600 mt-2">{f.description}</p></article></TiltCard></Reveal>)}</div></section>
  <section className="mx-auto max-w-6xl px-5 py-8">
    <Reveal><div className="mkt-scene overflow-hidden rounded-3xl bg-[#0F2D52] px-6 py-10 text-white md:px-10"><div className="mkt-preserve grid items-center gap-8 md:grid-cols-3">
      {[['Work queue','unworked → working → approved, with reviewer sign-off'],['Denial routing','denied claims flow to coding with documents attached'],['ERA posting','835 files matched & posted to claims']].map(([t, d], i) => <div key={t} className="rounded-2xl bg-white/[.07] p-5 ring-1 ring-white/10" style={{ transform: `translateZ(${30 + i * 18}px)` }}><p className="text-sm font-bold text-sky-300">0{i + 1}</p><h3 className="mt-1 font-bold">{t}</h3><p className="mt-1 text-sm text-white/70">{d}</p></div>)}
    </div></div></Reveal>
  </section>
  <section className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-2 gap-6">
    <Reveal><TiltCard max={4} className="h-full"><div className="bg-slate-50 rounded-2xl p-6 h-full"><h2 className="font-bold text-lg">Security & privacy</h2><p className="text-sm text-slate-600 mt-2">Hashed passwords, secure HTTP-only sessions, organization-scoped data, audit logs, verified custom domains and rate-limited authentication. We describe safeguards factually and do not claim HIPAA compliance solely from technical features — see our DPA/BAA templates and have them reviewed for your relationship.</p></div></TiltCard></Reveal>
    <Reveal delay={100}><TiltCard max={4} className="h-full"><div className="bg-slate-50 rounded-2xl p-6 h-full"><h2 className="font-bold text-lg">Plans for every team</h2><p className="text-sm text-slate-600 mt-2">Starter, Professional and Enterprise with monthly/annual billing and trials. Prices are managed by the platform operator and shown live on the pricing page.</p><Link href="/pricing" className="text-blue-600 font-semibold text-sm">Compare plans →</Link></div></TiltCard></Reveal>
  </section>
  <section className="max-w-6xl mx-auto px-5 py-12 text-center"><Reveal><h2 className="text-3xl font-extrabold text-[#0F2D52]">Ready to take control of your AR?</h2><div className="mt-6 flex justify-center gap-3"><Link href="/register" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-xl shadow-blue-600/25 transition hover:-translate-y-0.5">{c.heroPrimaryCta}</Link><Link href="/pricing" className="px-6 py-3 border rounded-xl font-semibold transition hover:-translate-y-0.5 hover:shadow-lg">See pricing</Link></div></Reveal></section>
</MarketingShell>; }
