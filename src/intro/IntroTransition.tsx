import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  origin: { x: number; y: number };
  /** the screen is fully covered: swap the intro for the site underneath */
  onCovered: () => void;
  onDone: () => void;
}

/**
 * A bloom of warm light opens from the emblem's dragonfly, covers the forest,
 * then thins away to reveal the sanctuary. Always finishes within 2.4 s.
 */
export default function IntroTransition({ origin, onCovered, onDone }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const r = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
    let covered = false;
    const cover = () => {
      if (covered) return;
      covered = true;
      onCovered();
    };
    const safety = window.setTimeout(() => {
      cover();
      onDone();
    }, 2600);

    if (reduce) {
      gsap.set(el, { opacity: 1 });
      cover();
      const tl = gsap.to(el, { opacity: 0, duration: 0.4, delay: 0.1, onComplete: onDone });
      return () => {
        tl.kill();
        window.clearTimeout(safety);
      };
    }

    const bloom = el.querySelector<HTMLElement>('.xt__bloom')!;
    gsap.set(bloom, { left: origin.x, top: origin.y, width: r * 2.4, height: r * 2.4, xPercent: -50, yPercent: -50, scale: 0 });
    const tl = gsap
      .timeline({ onComplete: onDone })
      .to(bloom, { scale: 1, duration: 1.05, ease: 'power2.in' })
      .add(cover)
      .to(el, { opacity: 0, duration: 1.1, ease: 'power1.out' }, '+=0.12');
    return () => {
      tl.kill();
      window.clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="xt" aria-hidden="true">
      <div className="xt__bloom" />
      <style>{`
        .xt { position: fixed; inset: 0; z-index: 120; pointer-events: none; }
        .xt__bloom {
          position: absolute; border-radius: 50%;
          background: radial-gradient(circle, #fffaf0 0%, #f6f1e6 38%, #efe3c4 52%, #e3d5ec 62%, #cfe3d6 70%, rgba(246,241,230,0) 74%);
        }
      `}</style>
    </div>
  );
}
