'use client';
import { useState, Suspense, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MarketingShell, H1 } from '@/components/marketing/Marketing';
import Reveal from '@/components/marketing/fx/Reveal';
import TiltCard from '@/components/marketing/fx/TiltCard';

const inp = 'mt-1 w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-200';
const OPTIONS = [
  { type: 'demo', icon: '🎥', title: 'Book a demo', text: 'See the workspace live and map it to your billing workflow.', meta: '30 min · video call' },
  { type: 'sales', icon: '💼', title: 'Talk to sales', text: 'Plan fit, seats, practices, custom domains and Enterprise pricing.', meta: 'Reply within 1 business day' },
  { type: 'contact', icon: '✉️', title: 'General question', text: 'Anything else about the product, security or onboarding.', meta: 'Reply within 1–2 business days' },
];
type Errors = Partial<Record<'name' | 'email' | 'message', string>>;

function Inner() {
  const sp = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', organization: '', phone: '', message: '', website: '', type: ['demo', 'sales', 'contact'].includes(sp.get('type') || '') ? sp.get('type')! : 'contact', teamSize: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const set = (k: string, v: string) => { setForm({ ...form, [k]: v }); setErrors(e => ({ ...e, [k]: undefined })); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (!form.name.trim()) errs.name = 'Please tell us your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid work email, e.g. you@practice.com.';
    if (!form.message.trim()) errs.message = 'Add a short message so we can route your request.';
    setErrors(errs);
    if (Object.keys(errs).length) { document.getElementById('form-errors')?.focus(); return; }
    setState('sending');
    try {
      const r = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, message: `[${form.type}${form.teamSize ? ` · team ${form.teamSize}` : ''}] ${form.message}` }) });
      setState(r.ok ? 'sent' : 'failed');
    } catch { setState('failed'); }
  };
  const FieldError = ({ id }: { id: keyof Errors }) => errors[id] ? <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-700">{errors[id]}</p> : null;

  return <MarketingShell>
    <section className="mkt-hero-bg"><div className="mx-auto max-w-6xl px-5 py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Contact</p>
      <div className="mt-2 max-w-2xl"><H1>Let&apos;s talk about your AR.</H1></div>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">Pick what you need below — your message goes straight to our team&apos;s inbox in the admin dashboard. Prefer to just try it? <Link href="/register" className="font-semibold text-blue-700 underline">Start the free trial</Link>.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="What can we help with?">
        {OPTIONS.map((o, i) => { const active = form.type === o.type; return (
          <Reveal key={o.type} delay={i * 80}><TiltCard max={4} className="h-full">
            <button type="button" role="radio" aria-checked={active} onClick={() => set('type', o.type)}
              className={`mkt-card-shadow h-full w-full rounded-3xl border bg-white p-5 text-left focus-visible:outline-2 focus-visible:outline-blue-600 ${active ? 'ring-2 ring-blue-600' : ''}`}>
              <span className="text-2xl" aria-hidden="true">{o.icon}</span>
              <span className="mt-2 block font-extrabold text-[#0F2D52]">{o.title}{active && <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">SELECTED</span>}</span>
              <span className="mt-1 block text-sm text-slate-600">{o.text}</span>
              <span className="mt-2 block text-xs font-semibold text-blue-700">{o.meta}</span>
            </button></TiltCard></Reveal>); })}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <Reveal><form onSubmit={submit} noValidate aria-describedby="form-errors" className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-extrabold text-[#0F2D52]">{OPTIONS.find(o => o.type === form.type)?.title}</h2>
          <div id="form-errors" tabIndex={-1} role="alert" className={Object.keys(errors).length ? 'mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 outline-none ring-1 ring-red-200' : 'sr-only'}>
            {Object.keys(errors).length > 0 && <>Please fix: {Object.values(errors).join(' ')}</>}
          </div>
          {state === 'sent' ? (
            <div className="mt-6 rounded-2xl bg-emerald-50 px-5 py-6 text-center ring-1 ring-emerald-200" role="status">
              <p className="text-3xl" aria-hidden="true">✅</p><p className="mt-2 font-extrabold text-emerald-900">Request received — thank you!</p>
              <p className="mt-1 text-sm text-emerald-800">We&apos;ll reply to {form.email} within the timeframe shown above. Want to explore meanwhile?</p>
              <div className="mt-4 flex justify-center gap-3"><Link href="/register" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Start free trial</Link><Link href="/pricing" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">See pricing</Link></div>
            </div>) : <>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div><label className="text-sm font-semibold" htmlFor="name">Your name <span aria-hidden="true" className="text-red-600">*</span></label>
                <input id="name" autoComplete="name" required aria-required="true" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} value={form.name} onChange={e => set('name', e.target.value)} className={inp} placeholder="Jane Smith" /><FieldError id="name" /></div>
              <div><label className="text-sm font-semibold" htmlFor="email">Work email <span aria-hidden="true" className="text-red-600">*</span></label>
                <input id="email" type="email" autoComplete="email" required aria-required="true" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : 'email-hint'} value={form.email} onChange={e => set('email', e.target.value)} className={inp} placeholder="you@practice.com" />
                {errors.email ? <FieldError id="email" /> : <p id="email-hint" className="mt-1 text-xs text-slate-600">We reply here — never shared or used for ads.</p>}</div>
              <div><label className="text-sm font-semibold" htmlFor="organization">Organization / practice</label>
                <input id="organization" autoComplete="organization" value={form.organization} onChange={e => set('organization', e.target.value)} className={inp} placeholder="Sunrise Clinic" /></div>
              <div><label className="text-sm font-semibold" htmlFor="phone">Phone <span className="font-normal text-slate-500">(optional)</span></label>
                <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={inp} placeholder="(555) 010-1234" /></div>
              <div><label className="text-sm font-semibold" htmlFor="teamSize">Team size</label>
                <select id="teamSize" value={form.teamSize} onChange={e => set('teamSize', e.target.value)} className={inp}><option value="">Select…</option>{['1–5', '6–25', '26–100', '100+'].map(x => <option key={x}>{x}</option>)}</select></div>
            </div>
            <div className="mt-4"><label className="text-sm font-semibold" htmlFor="message">How can we help? <span aria-hidden="true" className="text-red-600">*</span></label>
              <textarea id="message" required aria-required="true" aria-invalid={!!errors.message} aria-describedby={errors.message ? 'message-error' : 'message-hint'} rows={5} value={form.message} onChange={e => set('message', e.target.value)} className={inp} placeholder="Tell us about your practice, current AR process, and what you'd like to improve…" />
              {errors.message ? <FieldError id="message" /> : <p id="message-hint" className="mt-1 text-xs text-slate-600">Please don&apos;t include patient information (PHI) in this form.</p>}</div>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={e => set('website', e.target.value)} aria-hidden="true" />
            <button disabled={state === 'sending'} className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 sm:w-auto">
              {state === 'sending' ? 'Sending…' : 'Send request'}</button>
            {state === 'failed' && <p role="alert" className="mt-3 text-sm font-medium text-red-700">Something went wrong sending your request. Please try again, or email us via the address in the footer.</p>}
            <p className="mt-3 text-xs text-slate-600">By submitting, you agree to our <Link href="/legal/privacy" className="text-blue-700 underline">Privacy Policy</Link>. We reply by email; we never sell your details.</p>
          </>}
        </form></Reveal>

        <Reveal delay={120}><aside aria-label="What happens next" className="space-y-4">
          <div className="rounded-3xl bg-[#0F2D52] p-6 text-white"><h2 className="font-extrabold">What happens next?</h2>
            <ol className="mt-3 space-y-3 text-sm">{[['1', 'We read & route it', 'Your request lands in our admin Leads Inbox tagged demo, sales or support.'], ['2', 'You get a human reply', 'Within the timeframe on your selected card — no auto-responder spam.'], ['3', 'Next step, your choice', 'A demo call, plan guidance, or straight into a free trial workspace.']].map(([n, t, d]) => <li key={n} className="flex gap-3"><span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">{n}</span><span><b>{t}.</b> <span className="text-white/75">{d}</span></span></li>)}</ol></div>
          <div className="rounded-3xl border bg-white p-6"><h2 className="font-extrabold text-[#0F2D52]">Rather explore first?</h2>
            <ul className="mt-2 space-y-2 text-sm">{[['/features', 'See every module →'], ['/pricing', 'Compare plans & prices →'], ['/faq', 'Read the FAQ →'], ['/register', 'Start the free trial →']].map(([h, l]) => <li key={h}><Link href={h} className="font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">{l}</Link></li>)}</ul></div>
        </aside></Reveal>
      </div>
    </div></section>
  </MarketingShell>;
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
