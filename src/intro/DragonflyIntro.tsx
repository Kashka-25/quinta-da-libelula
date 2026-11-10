import { useEffect, useRef, useState } from 'react';
import { IntroEngine, TIMELINE, type Phase } from './engine';
import { createDragonfly3D, type DragonflyRenderer } from './dragonfly3d';
import { webglOK } from '../three/dragonflyModel';
import { lowPower } from './introChoice';
import './intro.css';

export interface DragonflyIntroProps {
  /** light emblem artwork the particles gather into */
  emblemSrc: string;
  /** called with the screen point the experience should open from */
  onEnter: (origin: { x: number; y: number }) => void;
  /** force the still, illustrated version */
  still?: boolean;
}

const WHISPERS: Partial<Record<Phase, string>> = {
  arrival: 'In the green hills of Coimbra, something is listening.',
  melt: 'Let go of the shape you arrived in.',
  gather: '… and become part of the land.',
};

function wantsStill() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isLite() {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (mem !== undefined && mem <= 2) || window.innerWidth < 640;
}

/**
 * The melting dragonfly. Self-contained: give it the emblem and a callback.
 * Every beat is time-boxed, Escape or "Skip intro" jumps to the invitation,
 * and reduced motion (or no canvas) gets a still, illustrated welcome.
 */
export default function DragonflyIntro({ emblemSrc, onEnter, still }: DragonflyIntroProps) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<IntroEngine | null>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const [isStill, setStill] = useState(() => still || wantsStill());
  const [phase, setPhase] = useState<Phase>(isStill ? 'reveal' : 'arrival');
  const [ready, setReady] = useState(isStill);

  useEffect(() => {
    if (isStill || !bgRef.current || !fxRef.current) return;
    let engine: IntroEngine;
    let r3d: DragonflyRenderer | null = null;
    let cancelled = false;
    const ready = glRef.current && webglOK() && !lowPower()
      ? createDragonfly3D(glRef.current).then((r) => {
          if (cancelled) r.dispose();
          else r3d = r;
        })
      : Promise.resolve();
    try {
      engine = new IntroEngine(bgRef.current, fxRef.current, { emblemSrc, onPhase: setPhase, lite: isLite(), renderer: () => r3d, ready });
    } catch {
      setStill(true);
      setPhase('reveal');
      setReady(true);
      return;
    }
    engineRef.current = engine;
    // safety net: the invitation always appears, even if frames stall
    const t = window.setTimeout(() => setPhase('reveal'), TIMELINE.reveal + 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      engine.destroy();
      r3d?.dispose();
      engineRef.current = null;
    };
  }, [isStill, emblemSrc]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    const t = window.setTimeout(() => setReady(true), isStill ? 0 : 1300);
    return () => window.clearTimeout(t);
  }, [phase, isStill]);

  useEffect(() => {
    if (ready) enterRef.current?.focus({ preventScroll: true });
  }, [ready]);

  const skip = () => {
    engineRef.current?.skip();
    setPhase('reveal');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const enter = () => onEnter(engineRef.current?.focus ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 });

  return (
    <div className={`dfi ${isStill ? 'dfi--still' : ''}`} role="dialog" aria-modal="true" aria-label="Welcome to Quinta da Libélula">
      {isStill ? (
        <div className="dfi__still" aria-hidden="true">
          <img className="dfi__still-emblem" src={emblemSrc} alt="" />
        </div>
      ) : (
        <>
          <canvas ref={bgRef} className="dfi__canvas" aria-hidden="true" />
          <canvas ref={glRef} className="dfi__canvas" aria-hidden="true" />
          <canvas ref={fxRef} className="dfi__canvas" aria-hidden="true" />
        </>
      )}
      <div className="dfi__vignette" aria-hidden="true" />

      <p className="dfi__whisper" aria-live="polite">
        {Object.entries(WHISPERS).map(([k, text]) => (
          <span key={k} className={phase === k ? 'is-on' : ''}>
            {text}
          </span>
        ))}
      </p>

      <div className={`dfi__invite ${ready ? 'is-on' : ''}`}>
        <h1 className="sr-only">Quinta da Libélula Retreats</h1>
        <p className="dfi__line">An eco retreat in the hills of Coimbra, Portugal</p>
        <button ref={enterRef} className="dfi__enter" onClick={enter} tabIndex={ready ? 0 : -1}>
          <span>Enter the Experience</span>
        </button>
      </div>

      {phase !== 'reveal' && (
        <button className="dfi__skip" onClick={skip}>
          Skip intro
        </button>
      )}
    </div>
  );
}
