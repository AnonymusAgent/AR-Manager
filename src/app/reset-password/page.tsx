'use client';
import { useState, Suspense } from 'react'; import { useSearchParams } from 'next/navigation'; import Link from 'next/link';
function Inner(){ const token=useSearchParams().get('token'); const [pw,setPw]=useState(''); const [msg,setMsg]=useState('');
 return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-5"><div className="bg-white rounded-2xl shadow p-8 w-full max-w-md"><h1 className="text-2xl font-bold">Reset password</h1>
 {!token ? <p className="text-sm text-red-600 mt-3">This page needs a reset link from your email.</p> : <><label className="text-sm font-medium block mt-5" htmlFor="pw">New password (10+ characters)</label><input id="pw" type="password" value={pw} onChange={e=>setPw(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2"/>
 <button className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold" onClick={async()=>{const r=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:pw})}); const d=await r.json(); setMsg(r.ok?'Password reset. All sessions were signed out — sign in with your new password.':d.error);}}>Reset password</button></>}
 {msg && <p role="status" className="text-sm mt-3">{msg}</p>}<p className="text-sm mt-4"><Link href="/login" className="text-blue-600">Sign in</Link></p></div></main>; }
export default function Page(){return <Suspense><Inner/></Suspense>}
