import { Fragment, useEffect, useRef } from 'react';
import { gsap, prefersReduced } from '../components/motion';
import HeroDragonfly from '../three/HeroDragonfly';
import { img } from '../content/site';
import './hero.css';

const LINE_1 = 'Some places invite you to visit.';
const LINE_2 = ['Others invite you', 'to return to yourself.'];

function Words({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(' ').map((w, i) => (
        <Fragment key={i}>
          <span className="hero__w">
            <span>{w}</span>
          </span>{' '}
        </Fragment>
      ))}
    </span>
  );
}

export default function SanctuaryHomepage({ arriving: arrivingProp }: { arriving: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const arriving = useRef(arrivingProp).current;

  useEffect(() => {
    const root = ref.current!;
    if (prefersReduced()) {
      root.classList.add('is-in');
      return;
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: arriving ? 1.1 : 0.2 });
      tl.fromTo('.hero__bg', { scale: 1.14, filter: 'blur(10px)' }, { scale: 1.04, filter: 'blur(0px)', duration: 3.2, ease: 'power2.out' }, 0)
        .fromTo('.hero__ridge', { yPercent: 30 }, { yPercent: 0, duration: 2.6, ease: 'expo.out', stagger: 0.12 }, 0.1)
        .fromTo('.hero__eyebrow', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, 0.5)
        .fromTo('.hero__w > span', { yPercent: 110, opacity: 0, rotate: 4 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.06 }, 0.7)
        .fromTo('.hero__after', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out', stagger: 0.15 }, 1.8)
        .add(() => root.classList.add('is-in'));

      // leaving the hero: the land sinks at different depths
      const st = { trigger: root, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.hero__layer', { yPercent: 14, ease: 'none', scrollTrigger: st });
      gsap.to('.hero__ridge--far', { y: () => -window.innerHeight * 0.05, ease: 'none', scrollTrigger: st });
      gsap.to('.hero__ridge--mid', { y: () => -window.innerHeight * 0.1, ease: 'none', scrollTrigger: st });
      gsap.to('.hero__copy', { yPercent: 30, opacity: 0, ease: 'none', scrollTrigger: { ...st, end: '70% top' } });
    }, root);

    // the landscape leans gently toward the pointer
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const x = e.clientX / window.innerWidth - 0.5;
            gsap.to(root.querySelectorAll<HTMLElement>('[data-depth]'), {
        x: (_, el: HTMLElement) => x * parseFloat(el.dataset.depth!) * -40,
        duration: 1.6,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      ctx.revert();
    };
  }, [arriving]);

  return (
    <section id="home" ref={ref} className="hero" aria-label="Welcome">
      <div className="hero__layer" data-depth="0.4">
        <img className="hero__bg" src={img('nature.webp')} alt="Forested mountains folding into a valley near the Quinta" {...{ fetchpriority: 'high' }} />
      </div>
      <div className="hero__sun" aria-hidden="true" />
      <div className="hero__mist hero__mist--1" aria-hidden="true" />

      <svg className="hero__ridge hero__ridge--far" data-depth="0.7" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 260 C 120 200 220 230 330 190 S 520 120 640 170 S 860 250 980 190 S 1200 110 1320 160 S 1420 200 1440 190 V400 H0Z" fill="rgba(52,71,47,0.55)" />
      </svg>
      <svg className="hero__ridge hero__ridge--mid" data-depth="1" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 300 C 160 250 260 300 420 250 S 640 220 760 270 S 980 320 1120 260 S 1340 230 1440 270 V400 H0Z" fill="rgba(31,46,34,0.82)" />
      </svg>
      <div className="hero__mist hero__mist--2" aria-hidden="true" />
      <svg className="hero__ridge hero__ridge--near" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 340 C 200 300 330 350 520 320 S 820 290 980 330 S 1260 360 1440 320 V400 H0Z" fill="var(--ivory)" />
      </svg>

      <HeroDragonfly arriving={arriving} />

      <div className="hero__copy">
        <p className="hero__eyebrow">Eco retreat · Coimbra, Portugal</p>
        <h2 className="hero__title">
          <Words text={LINE_1} className="hero__l1" />
          <Words text={LINE_2[0]} className="hero__l2" />
          <Words text={LINE_2[1]} className="hero__l3" />
        </h2>
        <p className="hero__after hero__sub">Eight hectares where untouched nature meets ancient wisdom.</p>
        <div className="hero__after hero__ctas">
          <a className="hero__cta" href="#sanctuary">
            Step inside <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </section>
  );
}
