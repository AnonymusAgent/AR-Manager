import { MarketingShell, H1 } from '@/components/marketing/Marketing';
import { getSiteContent } from '@/lib/site-content';
export const dynamic = 'force-dynamic';
export default async function Page(){ const c=await getSiteContent(); return <MarketingShell content={c}><section className="max-w-3xl mx-auto px-5 py-14"><H1>About {c.brandName}</H1><p className="mt-5 text-slate-600">{c.aboutText}</p><h2 className="font-bold mt-8">Roadmap direction</h2><p className="text-slate-600 mt-2">{c.roadmapText}</p></section></MarketingShell>}
