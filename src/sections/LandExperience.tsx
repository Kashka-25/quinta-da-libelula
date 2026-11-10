import { useState } from 'react';
import { PLACES, img } from '../content/site';
import './land.css';

const TIMES = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'day', label: 'Day' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'night', label: 'Night' },
] as const;
type Time = (typeof TIMES)[number]['id'];

const FIREFLIES = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 37) % 100,
  y: 30 + ((i * 53) % 60),
  d: (i % 7) * 0.6,
}));

export default function LandExperience() {
  const [time, setTime] = useState<Time>('day');
  const [sel, setSel] = useState(PLACES[0].id);
  const place = PLACES.find((p) => p.id === sel)!;

  return (
    <section id="land" className={`section land land--${time}`}>
      <div className="wrap">
        <header className="land__head">
          <div>
            <p className="eyebrow reveal">The Land</p>
            <h2 className="display reveal">
              Eight hectares to <em>wander</em>.
            </h2>
          </div>
          <div className="land__times reveal" role="radiogroup" aria-label="Time of day">
            {TIMES.map((t) => (
              <button key={t.id} role="radio" aria-checked={time === t.id} className={time === t.id ? 'is-on' : ''} onClick={() => setTime(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </header>

        <div className="land__stage reveal">
          <div className="land__map">
            <svg viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid slice" className="land__svg" aria-hidden="true">
              <defs>
                <linearGradient id="land-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="sky-top" />
                  <stop offset="1" className="sky-bottom" />
                </linearGradient>
              </defs>
              <rect width="1000" height="640" fill="url(#land-sky)" />
              <circle className="land__orb" cx="780" cy="110" r="46" />
              <path className="hill hill--1" d="M0 250 C 140 180 260 210 380 170 S 620 120 760 170 S 920 220 1000 190 V640 H0Z" />
              <path className="hill hill--2" d="M0 330 C 160 280 300 320 460 280 S 760 250 1000 300 V640 H0Z" />
              <path className="hill hill--3" d="M0 430 C 200 390 340 420 520 400 S 820 380 1000 420 V640 H0Z" />
              <path className="terrace" d="M80 470 C 300 440 600 460 940 440 M60 540 C 320 510 620 530 960 505 M100 600 C 360 580 640 600 940 580" />
              {Array.from({ length: 70 }, (_, i) => {
                const x = (i * 97) % 1000;
                const y = 180 + ((i * 61) % 300);
                const s = 8 + (i % 5) * 3;
                return <path key={i} className="tree" d={`M${x} ${y - s * 2} L${x + s} ${y} L${x - s} ${y} Z`} />;
              })}
              <path className="trail" d="M200 200 C 260 300 300 330 340 340 S 460 330 580 260 S 700 380 720 390 S 640 470 620 550 S 470 480 460 475 S 300 450 220 450" />
            </svg>
            <div className="land__fireflies" aria-hidden="true">
              {FIREFLIES.map((f, i) => (
                <i key={i} style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `${f.d}s` }} />
              ))}
            </div>
            {PLACES.map((p) => (
              <button
                key={p.id}
                className={`pin ${sel === p.id ? 'is-on' : ''}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onClick={() => setSel(p.id)}
                aria-pressed={sel === p.id}
              >
                <span className="pin__dot" />
                <span className="pin__label">{p.name}</span>
              </button>
            ))}
            <span className="land__note demo-tag">Illustrative map · not to scale</span>
          </div>

          <aside className="land__card" key={place.id} aria-live="polite">
            <div className="land__card-img">
              {place.image ? <img src={img(`${place.image}-sm.webp`)} alt="" /> : <div className={`land__glow land__glow--${place.id}`} />}
            </div>
            <h3>{place.name}</h3>
            <p>{place.text}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
