// Which welcome a visitor gets, and remembering that they've had it.
//
//   canvas  the melting dragonfly: the live 3D Meshy dragonfly melting into the emblem (default)
//   film    the Blender film (opt in with ?intro=film)
//   still   a still, illustrated welcome (reduced motion)
//   none    straight to the sanctuary (seen recently, or ?skip / a #section link)
//
// ?intro=film | canvas | still forces one, and always plays.

export type IntroKind = 'film' | 'canvas' | 'still' | 'none';

const KEY = 'qdl-intro-seen';
const REMEMBER_DAYS = 7;

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* private mode: just play it again next time */
  }
}

function seenRecently() {
  try {
    const t = Number(localStorage.getItem(KEY));
    return t > 0 && Date.now() - t < REMEMBER_DAYS * 864e5;
  } catch {
    return false;
  }
}

export function lowPower() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || !!nav.connection?.saveData;
}

export function chooseIntro(): IntroKind {
  const q = new URLSearchParams(window.location.search);
  const forced = q.get('intro');
  if (forced === 'film' || forced === 'canvas' || forced === 'still') return forced;
  if (q.has('skip') || window.location.hash.length > 1) return 'none';
  if (seenRecently()) return 'none';
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
  } catch {
    /* ignore */
  }
  return 'canvas';
}
