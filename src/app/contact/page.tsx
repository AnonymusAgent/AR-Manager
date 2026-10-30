'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MarketingShell, H1 } from '@/components/marketing/Marketing';
function Inner(){ const sp=useSearchParams(); const [form,setForm]=useState({name:'',email:'',organization:'',phone:'',message:'',website:'',type:sp.get('type')||'contact'}); const [state,setState]=useState('');
 const submit=async(e:React.FormEvent)=>{e.preventDefault(); setState('Sending…'); const r=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}); const d=await r.json(); setState(r.ok?'Thanks — your request was received. We will reply by email.':(d.error||'Submission failed. Please try again.'));};
 return <MarketingShell><section className="max-w-2xl mx-auto px-5 py-14"><H1>Contact & sales</H1><p className="mt-3 text-slate-600">Questions, sales inquiries and demo requests — stored securely for our team.</p>
 <form onSubmit={submit} className="mt-8 space-y-4">{([['name','Your name','text',true],['email','Work email','email',true],['organization','Organization','text',false],['phone','Phone','tel',false]] as const).map(([k,l,t,req])=><div key={k}><label className="text-sm font-medium" htmlFor={k}>{l}</label><input id={k} required={req} type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></div>)}
 <div><label className="text-sm font-medium" htmlFor="type">Request type</label><select id="type" value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"><option value="contact">General contact</option><option value="sales">Sales inquiry</option><option value="demo">Book a demo</option></select></div>
 <div><label className="text-sm font-medium" htmlFor="message">Message</label><textarea id="message" rows={5} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></div>
 <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} aria-hidden="true"/>
 <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold">Send request</button>{state && <p role="status" className="text-sm">{state}</p>}</form></section></MarketingShell>; }
export default function Page(){return <Suspense><Inner/></Suspense>}
