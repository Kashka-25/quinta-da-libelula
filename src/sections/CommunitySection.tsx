import { useEffect, useState } from 'react';
import { TESTIMONIALS, img } from '../content/site';
import { prefersReduced } from '../components/motion';
import './community.css';

const MOMENTS = [
  { src: 'moment-3', alt: 'Cooking together around an outdoor stone oven' },
  { src: 'moment-2', alt: 'Resting in hammocks among the trees' },
  { src: 'moment-7', alt: 'Playing a handpan outdoors' },
  { src: 'moment-6', alt: 'A cold dip in the natural pool' },
  { src: 'practice-1', alt: 'Healing touch in the forest' },
];

export default function CommunitySection() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReduced()) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % TESTIMONIALS.length), 6500);
    return () => window.clearInterval(t);
  }, [paused]);

  const t = TESTIMONIALS[i];

  return (
    <section id="community" className="section community">
      <div className="wrap">
        <p className="eyebrow reveal">The Community</p>
        <h2 className="display reveal community__title">
          The people make it <em>home</em>.
        </h2>

        <div className="voices reveal" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)}>
          <figure className="voice" key={i}>
            <blockquote>
              <p>“{t.quote}”</p>
            </blockquote>
            <figcaption>
              <strong>{t.who}</strong> — {t.note}
            </figcaption>
          </figure>
          <div className="voices__nav">
            {TESTIMONIALS.map((v, k) => (
              <button key={v.who} className={k === i ? 'is-on' : ''} onClick={() => setI(k)} aria-label={`Words from ${v.who}`} aria-pressed={k === i} />
            ))}
          </div>
          <p className="voices__src">Guest words, from quintadalibelula.center</p>
        </div>
      </div>

      <div className="moments" aria-label="Moments at the Quinta">
        {MOMENTS.map((m, k) => (
          <figure key={m.src} className={`moment moment--${k} reveal`}>
            <img src={img(`${m.src}-sm.webp`)} alt={m.alt} loading="lazy" />
          </figure>
        ))}
      </div>
    </section>
  );
}
