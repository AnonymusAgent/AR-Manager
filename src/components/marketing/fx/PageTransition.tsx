'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
/** Soft fade/slide between marketing pages (re-mounts on route change). */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="mkt-page-enter">{children}</div>;
}
