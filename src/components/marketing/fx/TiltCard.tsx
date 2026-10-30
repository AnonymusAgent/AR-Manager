'use client';
import { useRef, type ReactNode, type MouseEvent } from 'react';
/** Pointer-tracked 3D tilt with a moving light glare. Falls back gracefully on touch/reduced-motion. */
export default function TiltCard({ children, className = '', max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateY(-4px)`;
    el.style.setProperty('--glare-x', `${(x + 0.5) * 100}%`); el.style.setProperty('--glare-y', `${(y + 0.5) * 100}%`);
  };
  const reset = () => { const el = ref.current; if (el) el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)'; };
  return <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={`mkt-tilt ${className}`}
    style={{ transition: 'transform .35s cubic-bezier(.22,1,.36,1)', transformStyle: 'preserve-3d' }}>{children}</div>;
}
