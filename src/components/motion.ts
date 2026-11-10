import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const prefersReduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Site-wide scroll motion: `.reveal` elements rise in as they enter,
 * `[data-speed]` elements drift for parallax, `.draw` SVG strokes draw themselves.
 * Nothing runs when reduced motion is asked for.
 */
export function useScrollMotion(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (prefersReduced()) {
      document.documentElement.classList.remove('motion');
      return;
    }
    document.documentElement.classList.add('motion');
    const ctx = gsap.context(() => {
      ScrollTrigger.batch('.reveal', {
        start: 'top 88%',
        once: true,
        onEnter: (els) =>
          els.forEach((el, i) => {
            (el as HTMLElement).style.transitionDelay = `${i * 0.09}s`;
            el.classList.add('is-in');
            window.setTimeout(() => ((el as HTMLElement).style.transitionDelay = ''), 1800);
          }),
      });
      gsap.utils.toArray<HTMLElement>('[data-speed]').forEach((el) => {
        const speed = parseFloat(el.dataset.speed || '0');
        gsap.fromTo(
          el,
          { yPercent: -speed * 50 },
          {
            yPercent: speed * 50,
            ease: 'none',
            scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });
      gsap.utils.toArray<SVGPathElement>('.draw path').forEach((p) => {
        const len = p.getTotalLength();
        gsap.fromTo(
          p,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: p.closest('svg'), start: 'top 85%', end: 'bottom 45%', scrub: 1 } },
        );
      });
    });
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 600);
    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, [active]);
}

export { gsap, ScrollTrigger };
