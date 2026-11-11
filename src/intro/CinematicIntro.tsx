import { useEffect, useRef, useState } from 'react';
import './cinematic.css';

export interface CinematicSources {
  webm: string;
  mp4: string;
  /** a lighter cut for phones and slow connections */
  webmSmall?: string;
  mp4Small?: string;
}

interface Props {
  sources: CinematicSources;
  /** the logo shown on the ivory at the end */
  logoSrc: string;
  onEnter: (origin: { x: number; y: number }) => void;
  /** the video can't play here (blocked, missing, too slow): use the canvas intro instead */
  onFallback: () => void;
}

const START_TIMEOUT = 4500; // if nothing has played by now, don't keep the visitor waiting
const IVORY_LEAD = 0.9; // seconds before the end when the ivory veil starts

function wantsSmall() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return window.innerWidth < 900 || !!c?.saveData || /(^|-)2g|3g/.test(c?.effectiveType ?? '');
}

/**
 * The Blender film of the dragonfly's transformation, played full screen.
 * Muted so it may autoplay; every wait has a timeout; Escape or "Skip intro"
 * goes straight to the sanctuary.
 */
export default function CinematicIntro({ sources, logoSrc, onEnter, onFallback }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [veil, setVeil] = useState(false);
  const [doorway, setDoorway] = useState(false);
  const done = useRef(false);
  const playing = useRef(false);
  const small = useRef(wantsSmall());

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onEnter({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  };

  // the end: ivory, then the logo for a breath, then the sanctuary
  const toDoorway = () => {
    if (doorway) return;
    setVeil(true);
    setDoorway(true);
    window.setTimeout(finish, 1900);
  };

  useEffect(() => {
    const v = video.current!;
    const fail = () => {
      if (!done.current && !playing.current) {
        done.current = true;
        onFallback();
      }
    };
    const timer = window.setTimeout(() => {
      if (v.currentTime === 0) fail();
    }, START_TIMEOUT);
    const onPlaying = () => {
      playing.current = true;
      setStarted(true);
    };
    const onTime = () => {
      if (v.duration && v.currentTime > v.duration - IVORY_LEAD) setVeil(true);
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', toDoorway);
    v.addEventListener('error', fail);
    // with <source> children, a missing file errors on the last source, not the video
    const lastSource = v.querySelector('source:last-of-type');
    lastSource?.addEventListener('error', fail);
    v.play().catch(fail);
    return () => {
      window.clearTimeout(timer);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', toDoorway);
      v.removeEventListener('error', fail);
      lastSource?.removeEventListener('error', fail);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const webm = small.current && sources.webmSmall ? sources.webmSmall : sources.webm;
  const mp4 = small.current && sources.mp4Small ? sources.mp4Small : sources.mp4;

  return (
    <div className={`cin ${started ? 'is-playing' : ''}`} role="dialog" aria-modal="true" aria-label="Welcome to Quinta da Libélula">
      <video ref={video} className="cin__video" muted playsInline autoPlay preload="auto" aria-hidden="true">
        {/* H.264 first: every current browser plays it, and Blender's encoder makes it the smaller file */}
        <source src={mp4} type="video/mp4" />
        <source src={webm} type="video/webm" />
      </video>
      <p className="sr-only">
        A short film: a dragonfly flies into a forest clearing, melts into iridescent liquid that becomes a glowing chrysalis, and is
        reborn as a radiant golden dragonfly that flies toward you in a wave of light.
      </p>
      <div className={`cin__veil ${veil ? 'is-on' : ''}`} aria-hidden="true" />
      <div className={`cin__door ${doorway ? 'is-on' : ''}`}>
        <img src={logoSrc} alt="Quinta da Libélula" />
      </div>
      {!doorway && (
        <button className="cin__skip" onClick={finish}>
          Skip intro
        </button>
      )}
    </div>
  );
}
