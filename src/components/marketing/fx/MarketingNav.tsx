'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import A11yToolbar from './A11yToolbar';
import Image from 'next/image';
const LINKS = [['/features', 'Features'], ['/pricing', 'Pricing'], ['/about', 'About'], ['/faq', 'FAQ'], ['/contact', 'Contact']] as const;
export default function MarketingNav({ brandName }: { brandName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const linkCls = (href: string) => `relative rounded-md px-1 py-1 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:bg-blue-600 after:transition-all ${pathname === href ? 'text-blue-700 font-bold after:w-full' : 'after:w-0 hover:after:w-full'}`;
  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4" aria-label="Main navigation">
      <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-blue-600" aria-label={`${brandName} — home`}>
        <Image src="/logo-mark.svg" alt="" width={38} height={38} priority className="drop-shadow-sm" />
        <span className="text-xl font-extrabold leading-none text-[#0F2D52]">{brandName.replace(/\s+/g,' ').split(' ').length > 1 ? <>{brandName.split(' ')[0]}<span className="block text-[13px] font-bold tracking-wide text-blue-600">{brandName.split(' ').slice(1).join(' ')}</span></> : brandName}</span>
      </Link>
      <div className="hidden items-center gap-6 text-sm font-medium md:flex">
        {LINKS.map(([h, l]) => <Link key={h} href={h} aria-current={pathname === h ? 'page' : undefined} className={linkCls(h)}>{l}</Link>)}
      </div>
      <div className="flex items-center gap-1.5">
        <A11yToolbar />
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">Sign In</Link>
        <Link href="/register" className="hidden rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:block">Start Free Trial</Link>
        <button className="rounded-lg px-3 py-2 text-xl leading-none hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 md:hidden"
          aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
      </div>
      {open && <div id="mobile-menu" className="absolute inset-x-4 top-full z-50 rounded-2xl border bg-white p-3 shadow-2xl md:hidden">
        {LINKS.map(([h, l]) => <Link key={h} href={h} aria-current={pathname === h ? 'page' : undefined} onClick={() => setOpen(false)}
          className="block rounded-lg px-3 py-2.5 font-medium hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600">{l}</Link>)}
        <Link href="/register" onClick={() => setOpen(false)} className="mt-1 block rounded-lg bg-blue-600 px-3 py-2.5 text-center font-semibold text-white">Start Free Trial</Link>
      </div>}
    </nav>
  );
}
