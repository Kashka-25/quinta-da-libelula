import { useEffect, useRef, useState } from 'react';
import './breath.css';

const STEPS = [
  { label: 'Breathe in', ms: 4000, cls: 'in' },
  { label: 'Hold', ms: 2000, cls: 'hold' },
  { label: 'And let go', ms: 6000, cls: 'out' },
] as const;

/** A single guided breath: the slowing down, offered as an interaction. */
export default function BreathPause() {
  const [step, setStep] = useState(-1);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clear, []);

  const begin = () => {
    clear();
    let at = 0;
    STEPS.forEach((s, i) => {
      timers.current.push(window.setTimeout(() => setStep(i), at));
      at += s.ms;
    });
    timers.current.push(window.setTimeout(() => setStep(3), at));
  };

  const cur = step >= 0 && step < 3 ? STEPS[step] : null;

  return (
    <section className="breath" aria-label="A pause">
      <svg className="edge edge--top" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 H1440 V40 C 1180 90 980 20 720 50 S 260 90 0 40Z" fill="var(--ivory)" />
      </svg>
      <div className={`breath__orb ${cur ? `is-${cur.cls}` : step === 3 ? 'is-done' : ''}`} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="breath__copy">
        <p className="breath__state" aria-live="polite">
          {cur ? cur.label : step === 3 ? 'Welcome. You are already slowing down.' : 'Before you read on'}
        </p>
        {!cur && (
          <button className="breath__btn" onClick={begin}>
            {step === 3 ? 'Breathe again' : 'Take one breath with us'}
          </button>
        )}
      </div>
      <svg className="edge edge--bottom" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 100 H1440 V50 C 1200 10 1000 80 720 50 S 240 10 0 60Z" fill="var(--cream)" />
      </svg>
    </section>
  );
}
