import { useEffect, useRef } from 'react';
import { PRACTICES, img } from '../content/site';
import { gsap, prefersReduced } from '../components/motion';
import './practices.css';

/**
 * The practices as a slow walk sideways: on wide screens the section pins and
 * scroll carries you along a path of panels; on phones it is a simple stack.
 */
export default function PracticesSection() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReduced()) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      const el = track.current!;
      const distance = () => el.scrollWidth - window.innerWidth;
      const tween = gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });
      el.querySelectorAll<HTMLElement>('.prac__img img').forEach((im) => {
        gsap.fromTo(
          im,
          { xPercent: -8 },
          { xPercent: 8, ease: 'none', scrollTrigger: { trigger: im.closest('.prac'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } },
        );
      });
      el.querySelectorAll<HTMLElement>('.prac').forEach((p) => {
        gsap.fromTo(
          p.querySelector('.prac__img'),
          { clipPath: 'inset(18% 18% 18% 18% round 200px)' },
          {
            clipPath: 'inset(0% 0% 0% 0% round 200px)',
            ease: 'none',
            scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left 95%', end: 'left 40%', scrub: true },
          },
        );
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="practices" ref={root} className="practices" aria-label="The Practices">
      <div ref={track} className="practices__track">
        <div className="practices__intro">
          <p className="eyebrow">The Practices</p>
          <h2 className="display">
            Ancient wisdom, <em>lived</em> in untouched nature.
          </h2>
          <p className="lede">Himalayan Yoga, Tantric practices, healing circles and moments of stillness. Scroll to walk the path.</p>
          <svg className="practices__path" viewBox="0 0 300 60" aria-hidden="true">
            <path d="M0 30 C 60 0 100 60 160 30 S 260 0 300 30" />
          </svg>
        </div>
        {PRACTICES.map((p, i) => (
          <article key={p.name} className={`prac prac--${i % 2 ? 'low' : 'high'}`}>
            <div className="prac__img">
              {p.image ? <img src={img(`${p.image}.webp`)} alt="" loading="lazy" /> : <div className="prac__paint" aria-hidden="true" />}
            </div>
            <div className="prac__text">
              <span className="prac__no">{String(i + 1).padStart(2, '0')}</span>
              <h3>{p.name}</h3>
              <p>{p.line}</p>
            </div>
          </article>
        ))}
        <div className="practices__end" aria-hidden="true">
          <img src={img('Logo_QLL-Libelula.png')} alt="" />
        </div>
      </div>
    </section>
  );
}
