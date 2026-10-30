import { MarketingShell, H1 } from '@/components/marketing/Marketing';
import { getSiteContent } from '@/lib/site-content';
export const dynamic = 'force-dynamic';
export default async function Page(){ const c=await getSiteContent(); return <MarketingShell content={c}><section className="max-w-3xl mx-auto px-5 py-14"><H1>Frequently asked questions</H1>{c.faqs.map(f=><details key={f.question} className="border rounded-lg p-4 mt-3"><summary className="font-semibold cursor-pointer">{f.question}</summary><p className="text-slate-600 mt-2 text-sm">{f.answer}</p></details>)}</section></MarketingShell>}
