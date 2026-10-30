import { MarketingShell } from '@/components/marketing/Marketing';
import { getSiteContent } from '@/lib/site-content';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Page({params}:{params:Promise<{slug:string}>}){ const {slug}=await params; const c=await getSiteContent(); const doc=c.legal[slug]; if(!doc) notFound();
 return <MarketingShell content={c}><section className="max-w-3xl mx-auto px-5 py-14"><h1 className="text-3xl font-extrabold text-[#0F2D52]">{doc.title}</h1>{doc.body.map(p=><p key={p.slice(0,24)} className="mt-4 text-slate-600">{p}</p>)}</section></MarketingShell>; }
