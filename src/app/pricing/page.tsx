'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { MarketingShell, H1 } from '@/components/marketing/Marketing';
type Plan={id:string;slug:string;name:string;description:string;monthlyPriceCents:number;annualPriceCents:number;trialDays:number;features:string[]};
function Inner(){ const [plans,setPlans]=useState<Plan[]>([]); const [annual,setAnnual]=useState(false); const [err,setErr]=useState('');
 useEffect(()=>{fetch('/api/plans').then(r=>r.json()).then(d=>setPlans(d.plans||[])).catch(()=>setErr('Could not load live pricing. Please try again.'))},[]);
 return <MarketingShell><section className="max-w-6xl mx-auto px-5 py-14"><H1>Pricing</H1><p className="mt-3 text-slate-600">Plans are configured by the platform operator — what you see here is loaded live, not hardcoded.</p>
 <div className="mt-6 flex gap-2" role="group" aria-label="Billing interval"><button onClick={()=>setAnnual(false)} className={`px-4 py-2 rounded-lg border ${!annual?'bg-blue-600 text-white':''}`}>Monthly</button><button onClick={()=>setAnnual(true)} className={`px-4 py-2 rounded-lg border ${annual?'bg-blue-600 text-white':''}`}>Annual</button></div>
 {err && <p className="mt-4 text-red-600">{err}</p>}
 <div className="grid md:grid-cols-3 gap-5 mt-8">{plans.map(p=>{const cents=annual?p.annualPriceCents:p.monthlyPriceCents;return <article key={p.id} className="border rounded-2xl p-6 flex flex-col"><h2 className="font-bold text-xl">{p.name}</h2><p className="text-sm text-slate-600 mt-1">{p.description}</p>
 <p className="mt-4 text-3xl font-extrabold">{cents? `$${(cents/100).toLocaleString()}${annual?'/yr':'/mo'}` : 'Contact sales'}</p><p className="text-xs text-slate-500">{p.trialDays}-day free trial</p>
 <ul className="mt-4 space-y-1 text-sm text-slate-600 flex-1">{(p.features||[]).map(f=><li key={f}>✓ {f}</li>)}</ul>
 {p.slug==='enterprise'?<Link href="/contact?type=sales" className="mt-6 text-center px-4 py-2.5 border rounded-lg font-semibold">Contact Sales</Link>:<Link href={`/register?plan=${p.slug}`} className="mt-6 text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold">Start Trial</Link>}</article>})}</div>
 <p className="mt-8 text-sm text-slate-600">You can upgrade, downgrade or cancel from Billing settings. Cancelling stops future renewals; your data is retained per the Subscription & Cancellation Policy — payment failure never deletes your data automatically.</p></section></MarketingShell>; }
export default function Page(){return <Suspense><Inner/></Suspense>}
