import { useEffect, useRef, useState } from 'react';
import { HOLD_MAX, IntroEngine, TIMELINE, type Phase } from './engine';
import { createDragonfly3D, type DragonflyRenderer } from './dragonfly3d';
import { webglOK } from '../three/dragonflyModel';
import { lowPower } from './introChoice';
import './intro.css';

export interface DragonflyIntroProps {
  /** light emblem artwork the particles gather into */
  emblemSrc: string;
  /** the intro is finished. `handoff` means the reborn dragonfly is already in the hero. */
  onEnter: (origin: { x: number; y: number }, handoff?: boolean) => void;
  /** the reborn has formed and starts flying: mount the homepage beneath */
  onReveal?: () => void;
  /** the reborn has reached the hero: the homepage's own dragonfly takes over */
  onHandoff?: () => void;
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
export default function DragonflyIntro({ emblemSrc, onEnter, onReveal, onHandoff, still }: DragonflyIntroProps) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<IntroEngine | null>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const [isStill, setStill] = useState(() => still || wantsStill());
  const [phase, setPhase] = useState<Phase>(isStill ? 'reveal' : 'arrival');
  const [ready, setReady] = useState(isStill);
  const [stage, setStage] = useState<'intro' | 'rebirth' | 'departing' | 'handoff'>('intro');
  const r3dRef = useRef<DragonflyRenderer | null>(null);
  // a model that missed the hold is built only at Enter, so the rebirth still plays
  const lateRef = useRef<(() => Promise<void>) | null>(null);
  const entering = useRef(false);

  useEffect(() => {
    if (isStill || !bgRef.current || !fxRef.current) return;
    let engine: IntroEngine;
    let r3d: DragonflyRenderer | null = null;
    let cancelled = false;
    let released = false;
    const gl = glRef.current;
    const use3d = !!gl && webglOK() && !lowPower();
    // if the story starts without it (HOLD_MAX passed), don't build a renderer mid-flight:
    // createDragonfly3D bails out before touching the GPU, and Enter builds it instead
    const loading = use3d
      ? createDragonfly3D(gl, () => cancelled || released).then((r) => {
          if (!r) return;
          if (cancelled) r.dispose();
          else r3d = r3dRef.current = r;
        })
      : Promise.resolve();
    lateRef.current = async () => {
      if (r3d || cancelled || !use3d) return;
      const r = await createDragonfly3D(gl, () => cancelled).catch(() => null);
      if (!r) return;
      if (cancelled) r.dispose();
      else r3d = r3dRef.current = r;
    };
    // the story starts when the model is ready, or after HOLD_MAX at the latest
    const hold = Promise.race([loading.catch(() => {}), new Promise<void>((r) => window.setTimeout(r, HOLD_MAX))]);
    // once revealed, the phase never steps back (the engine may still report its own timeline)
    const onPhase = (p: Phase) => setPhase((cur) => (cur === 'reveal' ? cur : p));
    try {
      engine = new IntroEngine(bgRef.current, fxRef.current, { emblemSrc, onPhase, lite: isLite(), renderer: () => r3d, ready: hold });
    } catch {
      cancelled = true; // the 3D layer must not be built for an intro that can't run
      setStill(true);
      setPhase('reveal');
      setReady(true);
      return;
    }
    engineRef.current = engine;
    // safety net: the invitation always appears, even if frames stall, counted from when the story starts
    let t = 0;
    hold.then(() => {
      released = true;
      if (!cancelled) t = window.setTimeout(() => setPhase('reveal'), TIMELINE.reveal + 4000);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      engine.destroy();
      r3d?.dispose();
      r3dRef.current = null;
      lateRef.current = null;
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

  const origin = () => engineRef.current?.focus ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Enter: the emblem melts and re-forms as the reborn dragonfly, which flies
  // into the homepage. Without WebGL or the model, the light bloom opens instead.
  const enter = async () => {
    if (stage !== 'intro' || entering.current) return;
    entering.current = true;
    const engine = engineRef.current;
    if (engine && onReveal && !r3dRef.current && lateRef.current) {
      setStage('rebirth');
      await lateRef.current();
    }
    const r3d = r3dRef.current;
    if (!engine || !r3d || !engine.canRebirth() || !onReveal) return onEnter(origin());
    setStage('rebirth');
    const ok = await Promise.race([r3d.reborn(), new Promise<boolean>((r) => window.setTimeout(() => r(false), 2500))]);
    if (!ok) return onEnter(origin());
    engine.rebirth({
      onDepart: () => {
        setStage('departing');
        onReveal();
      },
      onDone: () => {
        setStage('handoff');
        onHandoff?.();
        window.setTimeout(() => onEnter(origin(), true), 650);
      },
    });
  };

  return (
    <div className={`dfi ${isStill ? 'dfi--still' : ''} is-${stage}`} role="dialog" aria-modal="true" aria-label="Welcome to Quinta da Libélula">
      {isStill ? (
        <div className="dfi__still" aria-hidden="true">
          <img className="dfi__still-emblem" src={emblemSrc} alt="" />
        </div>
      ) : (
        <>
          <canvas ref={bgRef} className="dfi__canvas dfi__bg" aria-hidden="true" />
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

      {phase !== 'reveal' && stage === 'intro' && (
        <button className="dfi__skip" onClick={skip}>
          Skip intro
        </button>
      )}
    </div>
  );
}
