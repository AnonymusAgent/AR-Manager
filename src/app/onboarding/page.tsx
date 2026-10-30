'use client';
import { useEffect, useState } from 'react'; import Link from 'next/link';
export default function Page(){ const [org,setOrg]=useState<any>(null); const [msg,setMsg]=useState('');
 useEffect(()=>{fetch('/api/organizations').then(r=>r.json()).then(d=>setOrg(d.organizations?.[0]))},[]);
 const steps=['Organization details confirmed','Choose plan / start trial (done at registration)','Invite your team','Add a custom domain (optional)','Import or create your first claims'];
 return <main className="min-h-screen bg-slate-100 p-6"><div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-8"><h1 className="text-2xl font-bold">Welcome{org?` to ${org.name}`:''} — onboarding</h1><p className="text-sm text-slate-600 mt-2">Your workspace: <b>{org?.slug}</b>. Progress is your organization record; resume anytime.</p>
 <ol className="mt-6 space-y-3">{steps.map((s,i)=><li key={s} className="flex gap-3 border rounded-lg p-4"><span className="font-bold text-blue-600">{i+1}</span><span>{s}</span></li>)}</ol>
 <div className="flex flex-wrap gap-3 mt-6"><Link href="/settings/organization" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">Organization settings & team</Link><Link href="/settings/billing" className="px-4 py-2 border rounded-lg font-semibold">Billing & plan</Link><Link href="/dashboard" className="px-4 py-2 border rounded-lg font-semibold">Go to dashboard</Link></div>{msg&&<p className="text-sm mt-3">{msg}</p>}</div></main>; }
