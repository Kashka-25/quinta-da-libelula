import { useEffect, useRef } from 'react';
import { prefersReduced } from './motion';

/** A few golden motes drifting over the whole site. Pauses when the tab is hidden. */
export default function Pollen({ count = 34 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (prefersReduced()) return;
    const c = ref.current!;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const motes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.8 + Math.random() * 1.8,
      v: 0.08 + Math.random() * 0.25,
      ph: Math.random() * 6.28,
    }));
    let lastY = window.scrollY;
    let raf = 0;
    const frame = (t: number) => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.v + dy * 0.12 * m.r * 0.5;
        m.x += Math.sin(t * 0.0005 + m.ph) * 0.25;
        if (m.y < -10) m.y = h + 10;
        if (m.y > h + 10) m.y = -10;
        const a = 0.35 + 0.35 * Math.sin(t * 0.0015 + m.ph);
        ctx.fillStyle = `rgba(217,160,91,${a})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [count]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 40 }} />;
}
