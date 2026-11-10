import { useEffect, useRef, useState } from 'react';
import { RETREATS, img, type Retreat } from '../content/site';
import './retreats.css';

function Card({ r, i, onOpen }: { r: Retreat; i: number; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  // a soft tilt and a light that follows the pointer
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current!;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width;
    const y = (e.clientY - b.top) / b.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--rx', `${(0.5 - y) * 6}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 8}deg`);
  };
  const onLeave = () => {
    const el = ref.current!;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return (
    <div className="rcard-wrap reveal">
    <button ref={ref} className="rcard" style={{ ['--hue' as string]: r.hue, ['--i' as string]: i }} onClick={onOpen} onPointerMove={onMove} onPointerLeave={onLeave}>
      <span className="rcard__media">
        <img src={img(`${r.image}-sm.webp`)} alt="" loading="lazy" />
      </span>
      <span className="rcard__shine" aria-hidden="true" />
      <span className="rcard__body">
        <span className="rcard__meta">
          {r.length} · {r.theme}
        </span>
        <span className="rcard__name">{r.name}</span>
        <span className="rcard__dates">{r.dates}</span>
        <span className="rcard__more">
          Explore <span aria-hidden="true">→</span>
        </span>
      </span>
    </button>
    </div>
  );
}

export default function RetreatExplorer({ onEnquire }: { onEnquire: (topic: string) => void }) {
  const [open, setOpen] = useState<Retreat | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('is-locked');
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('is-locked');
      window.removeEventListener('keydown', onKey);
      lastFocus.current?.focus();
    };
  }, [open]);

  return (
    <section id="retreats" className="section retreats">
      <div className="wrap">
        <header className="retreats__head">
          <div>
            <p className="eyebrow reveal">The Retreats</p>
            <h2 className="display reveal">
              Come for a few days. <em>Leave changed.</em>
            </h2>
          </div>
          <p className="retreats__note reveal">
            <span className="demo-tag">Example retreats</span>
            These cards show how retreats could be presented. Names and dates are placeholders built around the
            practices the Quinta offers; real programmes would come from the team.
          </p>
        </header>

        <div className="retreats__grid">
          {RETREATS.map((r, i) => (
            <Card
              key={r.id}
              r={r}
              i={i}
              onOpen={() => {
                lastFocus.current = document.activeElement as HTMLElement;
                setOpen(r);
              }}
            />
          ))}
        </div>
      </div>

      {open && (
        <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onClick={() => setOpen(null)}>
          <article className="drawer__panel" style={{ ['--hue' as string]: open.hue }} onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} className="drawer__close" onClick={() => setOpen(null)}>
              <span className="sr-only">Close</span>×
            </button>
            <div className="drawer__media">
              <img src={img(`${open.image}.webp`)} alt="" />
            </div>
            <div className="drawer__body">
              <span className="demo-tag">Example retreat</span>
              <h3 id="drawer-title">{open.name}</h3>
              <p className="drawer__meta">
                {open.length} · {open.dates}
              </p>
              <p className="drawer__blurb">{open.blurb}</p>
              <h4>A day might hold</h4>
              <ol className="drawer__day">
                {open.day.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ol>
              <h4>Every stay includes</h4>
              <ul className="drawer__incl">
                <li>A dome or teepee tent on the land</li>
                <li>Predominantly vegetarian meals</li>
                <li>The natural stone pool, hammocks and shade</li>
              </ul>
              <button
                className="btn btn--solid"
                onClick={() => {
                  setOpen(null);
                  onEnquire(open.name);
                }}
              >
                Enquire about this retreat <span className="arrow">→</span>
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
