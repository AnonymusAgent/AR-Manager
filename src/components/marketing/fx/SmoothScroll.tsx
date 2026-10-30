'use client';
import { useEffect } from 'react';
/** Lenis-powered buttery scrolling, marketing pages only. Respects reduced-motion and touch. */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0; let lenis: { raf: (t: number) => void; destroy: () => void; scrollTo: (t: string, o?: object) => void } | null = null; let cancelled = false;
    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ duration: 1.15, smoothWheel: true }) as never;
      const loop = (time: number) => { lenis?.raf(time); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      // Smooth in-page anchors (e.g. /#features) through Lenis instead of a jump.
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest('a[href^="#"], a[href^="/#"]') as HTMLAnchorElement | null;
        if (!a) return;
        const id = a.getAttribute('href')?.split('#')[1];
        const el = id && document.getElementById(id);
        if (el) { e.preventDefault(); lenis?.scrollTo(`#${id}`, { offset: -84 }); history.replaceState(null, '', `#${id}`); }
      };
      document.addEventListener('click', onClick);
      (lenis as unknown as { __cleanup?: () => void }).__cleanup = () => document.removeEventListener('click', onClick);
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); (lenis as unknown as { __cleanup?: () => void })?.__cleanup?.(); lenis?.destroy(); };
  }, []);
  return null;
}
