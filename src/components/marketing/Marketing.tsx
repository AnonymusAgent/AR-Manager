import Link from 'next/link';
import { DEFAULT_SITE_CONTENT, type SiteContent } from '@/lib/site-content-shared';
export function MarketingShell({ children, content = DEFAULT_SITE_CONTENT }: { children: React.ReactNode; content?: SiteContent }) {
  return <div className="min-h-screen bg-white text-slate-900">
    {content.announcementEnabled && content.announcementText && <div className="bg-blue-600 text-white text-center text-sm px-4 py-2">{content.announcementLink ? <Link href={content.announcementLink} className="underline font-medium">{content.announcementText}</Link> : content.announcementText}</div>}
    <header className="sticky top-0 bg-white/90 backdrop-blur border-b z-10"><nav className="max-w-6xl mx-auto flex items-center justify-between px-5 py-4" aria-label="Main">
      <Link href="/" className="font-extrabold text-xl text-[#0F2D52]">{content.brandName}</Link>
      <div className="hidden md:flex gap-6 text-sm font-medium">{[['/features','Features'],['/pricing','Pricing'],['/about','About'],['/faq','FAQ'],['/contact','Contact']].map(([h,l])=><Link key={h} href={h} className="hover:text-blue-600">{l}</Link>)}</div>
      <div className="flex gap-2"><Link href="/login" className="px-4 py-2 text-sm font-semibold">Sign In</Link><Link href="/register" className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg">Start Free Trial</Link></div>
    </nav></header><main>{children}</main>
    <footer className="border-t mt-16"><div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-4 gap-8 text-sm text-slate-600">
      <div><b className="text-[#0F2D52]">{content.brandName}</b><p className="mt-2">{content.tagline}</p>{content.supportEmail && <p className="mt-2">Support: <a className="text-blue-600" href={`mailto:${content.supportEmail}`}>{content.supportEmail}</a></p>}{content.supportPhone && <p>{content.supportPhone}</p>}</div>
      <div><b>Product</b><ul className="mt-2 space-y-1"><li><Link href="/features">Features</Link></li><li><Link href="/pricing">Pricing</Link></li></ul></div>
      <div><b>Company</b><ul className="mt-2 space-y-1"><li><Link href="/about">About</Link></li><li><Link href="/contact">Contact & Demo</Link></li><li><Link href="/faq">FAQ</Link></li></ul></div>
      <div><b>Legal</b><ul className="mt-2 space-y-1">{Object.entries(content.legal).map(([slug,doc])=><li key={slug}><Link href={`/legal/${slug}`}>{doc.title.replace(/ \(template\)$/,'')}</Link></li>)}</ul></div>
    </div><p className="text-center text-xs text-slate-400 pb-6">© {new Date().getFullYear()} {content.brandName}. {content.footerText}</p></footer></div>;
}
export const H1 = ({children}:{children:React.ReactNode}) => <h1 className="text-4xl md:text-5xl font-extrabold text-[#0F2D52] leading-tight">{children}</h1>;
