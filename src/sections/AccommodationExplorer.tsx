import { useState } from 'react';
import { STAYS, img } from '../content/site';
import './stay.css';

const DOME_GLOWS = ['#c9785a', '#d9a05b', '#e3c76b', '#9fb58a', '#7fa7b8', '#b9a3d0'];

function Teepee() {
  return (
    <svg className="teepee" viewBox="0 0 600 600" role="img" aria-label="Illustration of a teepee tent at dusk">
      <defs>
        <linearGradient id="tp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b3a4a" />
          <stop offset="0.55" stopColor="#8a6f8f" />
          <stop offset="1" stopColor="#e6b483" />
        </linearGradient>
        <linearGradient id="tp-canvas" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9ccb0" />
          <stop offset="0.5" stopColor="#f3ead6" />
          <stop offset="1" stopColor="#c8b994" />
        </linearGradient>
        <radialGradient id="tp-glow" cx="0.5" cy="0.85" r="0.5">
          <stop offset="0" stopColor="#ffd28a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="600" fill="url(#tp-sky)" />
      {[[80, 90], [150, 60], [470, 80], [530, 140], [400, 40], [260, 70]].map(([x, y], i) => (
        <circle key={i} className="teepee__star" cx={x} cy={y} r={1.6} fill="#fff7e2" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <path d="M0 420 C 120 380 200 400 300 370 S 480 350 600 390 V600 H0Z" fill="#33452f" />
      <path d="M0 470 C 150 450 260 470 380 450 S 540 440 600 455 V600 H0Z" fill="#1f2e22" />
      <g>
        <path d="M300 130 L 300 130 L 440 500 L 160 500 Z" fill="url(#tp-canvas)" />
        <path d="M300 130 L 330 500 L 270 500 Z" fill="#000" opacity="0.06" />
        <path d="M190 420 L 410 420" stroke="#c9785a" strokeWidth="6" opacity="0.7" />
        <path d="M200 440 L 400 440" stroke="#9fb58a" strokeWidth="4" opacity="0.7" />
        <path d="M262 500 L 300 360 L 338 500 Z" fill="#3b2a1e" />
        <path d="M262 500 L 300 360 L 338 500 Z" fill="url(#tp-glow)" className="teepee__door" />
        <g stroke="#6b5233" strokeWidth="5" strokeLinecap="round">
          <line x1="300" y1="140" x2="270" y2="70" />
          <line x1="300" y1="140" x2="330" y2="68" />
          <line x1="300" y1="140" x2="300" y2="60" />
        </g>
      </g>
      <ellipse cx="300" cy="505" rx="200" ry="16" fill="#000" opacity="0.25" />
      <circle cx="470" cy="500" r="40" fill="url(#tp-glow)" opacity="0.5" className="teepee__fire" />
      <path d="M462 505 q 8 -26 8 -30 q 6 14 10 30 Z" fill="#f2b45c" className="teepee__flame" />
    </svg>
  );
}

export default function AccommodationExplorer({ onEnquire }: { onEnquire: (topic: string) => void }) {
  const [sel, setSel] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const stay = STAYS[sel];

  return (
    <section id="stay" className="section stay">
      <svg className="edge edge--top" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 H1440 V60 C 1180 20 1000 90 720 60 S 240 20 0 70Z" fill="var(--cream)" />
      </svg>
      <div className="wrap">
        <header className="stay__head">
          <p className="eyebrow reveal">Stay with us</p>
          <h2 className="display reveal">
            Sleep inside the <em>landscape</em>.
          </h2>
          <p className="lede reveal">Six unique domes, each inspired by the Chakra system, and teepee tents close to the earth.</p>
        </header>

        <div className="domes reveal" onMouseLeave={() => setLit(null)}>
          <svg viewBox="0 0 1200 260" className="domes__svg" aria-hidden="true">
            <path d="M0 230 C 200 170 400 150 600 160 S 1000 190 1200 150" fill="none" stroke="rgba(27,36,24,0.18)" strokeDasharray="3 6" />
          </svg>
          <ol className="domes__row">
            {DOME_GLOWS.map((c, i) => (
              <li key={i} style={{ ['--glow' as string]: c, ['--y' as string]: `${[52, 30, 18, 16, 22, 10][i]}px` }}>
                <button
                  className={`dome ${lit === i ? 'is-lit' : ''}`}
                  onMouseEnter={() => setLit(i)}
                  onFocus={() => setLit(i)}
                  onClick={() => setLit(i)}
                  aria-label={`Dome ${i + 1} of 6`}
                >
                  <svg viewBox="0 0 120 80" aria-hidden="true">
                    <path d="M8 74 A 52 52 0 0 1 112 74 Z" className="dome__shell" />
                    <path d="M60 22 L 30 74 M60 22 L 90 74 M22 50 L 98 50 M34 32 L 86 32" className="dome__lines" />
                    <path d="M52 74 V 58 A 8 8 0 0 1 68 58 V 74Z" className="dome__door" />
                  </svg>
                  <span className="dome__aura" />
                </button>
              </li>
            ))}
          </ol>
          <p className="domes__caption" aria-live="polite">
            {lit === null ? 'Six domes along the hillside. Hover or tap one to light it.' : `Dome ${lit + 1} — its chakra and its story, told by the Quinta.`}
            <span className="demo-tag">Colours illustrative</span>
          </p>
        </div>

        <div className="stay__explorer">
          <div className="stay__tabs" role="tablist" aria-label="Ways to stay">
            {STAYS.map((s, i) => (
              <button key={s.id} role="tab" aria-selected={i === sel} aria-controls="stay-panel" className={`stay__tab ${i === sel ? 'is-on' : ''}`} onClick={() => setSel(i)}>
                <span className="stay__tab-name">{s.name}</span>
                <span className="stay__sleeps" aria-label={s.sleeps ? `Sleeps ${s.sleeps}` : 'Tent'}>
                  {s.sleeps ? Array.from({ length: s.sleeps }, (_, k) => <i key={k} />) : <b>△</b>}
                </span>
              </button>
            ))}
          </div>

          <div id="stay-panel" role="tabpanel" className="stay__stage" key={stay.id}>
            <div className="stay__visual">
              {stay.image ? <img src={img(`${stay.image}.webp`)} alt={stay.id === 'dome-4' ? 'The domes on the hillside walkway' : 'Inside a wooden dome, a bed by the window'} /> : <Teepee />}
            </div>
            <div className="stay__info">
              <h3>{stay.name}</h3>
              <ul>
                {stay.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="stay__shared">Around the camp: shaded spots, hammocks and seating, the natural stone pool, and a Wi-Fi hotspot in the lower camp for when you need it.</p>
              <button className="btn" onClick={() => onEnquire(`Stay: ${stay.name}`)}>
                Ask about this stay <span className="arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
