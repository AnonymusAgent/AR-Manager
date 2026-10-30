'use client';
import { useEffect, useRef } from 'react';
/** Real-time Three.js hero backdrop: floating wireframe geometry + orbiting claim "cards".
    Transparent, DPR-capped, pauses off-screen, renders one static frame for reduced-motion. */
export default function HeroScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    let cleanup = () => {};
    import('three').then((THREE) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100); camera.position.set(0, 0.4, 9);
      scene.add(new THREE.AmbientLight(0x88aaff, 1.2));
      const key = new THREE.PointLight(0x3b82f6, 60); key.position.set(5, 4, 6); scene.add(key);
      const group = new THREE.Group(); scene.add(group);
      const navy = new THREE.MeshStandardMaterial({ color: 0x14467c, roughness: 0.35, metalness: 0.35, transparent: true, opacity: 0.92 });
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.05, 0)), new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85 }));
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), navy);
      group.add(wire, core);
      const cards: InstanceType<typeof THREE.Mesh>[] = [];
      const cardGeo = new THREE.BoxGeometry(1.15, 0.72, 0.08);
      const cardMats = [0x2563eb, 0x0ea5e9, 0x22c55e, 0xf59e0b].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.95 }));
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(cardGeo, cardMats[i % cardMats.length]);
        const angle = (i / 7) * Math.PI * 2;
        m.userData = { angle, radius: 3.15 + (i % 3) * 0.35, speed: 0.14 + i * 0.012, y: (i % 3 - 1) * 0.8, phase: i * 1.3 };
        group.add(m); cards.push(m);
      }
      const resize = () => { const w = canvas.clientWidth || 600, h = canvas.clientHeight || 480; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);
      let mx = 0, my = 0, visible = true, raf = 0;
      const onMouse = (e: PointerEvent) => { mx = (e.clientX / window.innerWidth - 0.5); my = (e.clientY / window.innerHeight - 0.5); };
      window.addEventListener('pointermove', onMouse, { passive: true });
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 }); io.observe(canvas);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const clock = new THREE.Clock();
      const tick = () => {
        const t = clock.getElapsedTime();
        group.rotation.y += ((mx * 0.6 + t * 0.06) - group.rotation.y) * 0.04;
        group.rotation.x += ((my * 0.35) - group.rotation.x) * 0.04;
        wire.rotation.y = t * 0.12; wire.rotation.x = t * 0.07; core.rotation.y = -t * 0.08;
        cards.forEach(c => { const u = c.userData; const a = u.angle + t * u.speed; c.position.set(Math.cos(a) * u.radius, u.y + Math.sin(t * 0.9 + u.phase) * 0.22, Math.sin(a) * u.radius); c.lookAt(0, c.position.y * 0.4, 0); });
        renderer.render(scene, camera);
        if (!reduced) raf = requestAnimationFrame(() => { if (visible) tick(); else raf = requestAnimationFrame(tick); });
      };
      tick();
      cleanup = () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMouse); renderer.dispose(); scene.traverse(o => { const m = o as InstanceType<typeof THREE.Mesh>; m.geometry?.dispose?.(); }); };
    });
    return () => cleanup();
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="h-full w-full" style={{ minHeight: 380 }} />;
}
