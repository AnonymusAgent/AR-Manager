import Link from 'next/link';
import SmoothScroll from './fx/SmoothScroll';
import MarketingNav from './fx/MarketingNav';
import PageTransition from './fx/PageTransition';
import { DEFAULT_SITE_CONTENT, type SiteContent } from '@/lib/site-content-shared';
export function MarketingShell({ children, content = DEFAULT_SITE_CONTENT }: { children: React.ReactNode; content?: SiteContent }) {
  return <div className="min-h-screen bg-white text-slate-900"><SmoothScroll />
    {content.announcementEnabled && content.announcementText && <div className="bg-blue-600 text-white text-center text-sm px-4 py-2">{content.announcementLink ? <Link href={content.announcementLink} className="underline font-medium">{content.announcementText}</Link> : content.announcementText}</div>}
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:font-semibold focus:text-white">Skip to main content</a>
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur"><MarketingNav brandName={content.brandName} /></header><main id="main-content" tabIndex={-1} className="outline-none"><PageTransition>{children}</PageTransition></main>
    <footer className="border-t mt-16" aria-label="Site footer"><div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-4 gap-8 text-sm text-slate-600">
      <div><span className="flex items-center gap-2"><img src="/logo-mark.svg" alt="" width="30" height="30" /><b className="text-[#0F2D52]">{content.brandName}</b></span><p className="mt-2">{content.tagline}</p>{content.supportEmail && <p className="mt-2">Support: <a className="text-blue-600" href={`mailto:${content.supportEmail}`}>{content.supportEmail}</a></p>}{content.supportPhone && <p>{content.supportPhone}</p>}</div>
      <div><b>Product</b><ul className="mt-2 space-y-1"><li><Link href="/features">Features</Link></li><li><Link href="/pricing">Pricing</Link></li></ul></div>
      <div><b>Company</b><ul className="mt-2 space-y-1"><li><Link href="/about">About</Link></li><li><Link href="/contact">Contact & Demo</Link></li><li><Link href="/faq">FAQ</Link></li><li><Link href="/accessibility">Accessibility</Link></li></ul></div>
      <div><b>Legal</b><ul className="mt-2 space-y-1">{Object.entries(content.legal).map(([slug,doc])=><li key={slug}><Link href={`/legal/${slug}`}>{doc.title.replace(/ \(template\)$/,'')}</Link></li>)}</ul></div>
    </div><p className="text-center text-xs text-slate-400 pb-6">© {new Date().getFullYear()} {content.brandName}. {content.footerText}</p></footer></div>;
}
export const H1 = ({children}:{children:React.ReactNode}) => <h1 className="text-4xl md:text-5xl font-extrabold text-[#0F2D52] leading-tight">{children}</h1>;
