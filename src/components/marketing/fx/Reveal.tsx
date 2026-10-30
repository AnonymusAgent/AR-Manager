'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
/** Scroll-triggered reveal with a gentle 3D lift (rotateX + rise). Add once, replays never. */
export default function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={className} style={{
    opacity: shown ? 1 : 0,
    transform: shown ? 'perspective(900px) rotateX(0deg) translateY(0)' : 'perspective(900px) rotateX(7deg) translateY(26px)',
    transformOrigin: 'center top',
    transition: `opacity .8s cubic-bezier(.22,1,.36,1) ${delay}ms, transform .8s cubic-bezier(.22,1,.36,1) ${delay}ms`,
    willChange: 'opacity, transform',
  }}>{children}</div>;
}
