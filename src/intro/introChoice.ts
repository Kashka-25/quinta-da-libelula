// Which welcome a visitor gets, and remembering that they've had it.
//
//   canvas  the melting dragonfly: the live 3D Meshy dragonfly melting into the emblem (default)
//   film    the Blender film (opt in with ?intro=film)
//   still   a still, illustrated welcome (reduced motion)
//   none    straight to the sanctuary (already seen in this tab, or ?skip / a #section link)
//
// ?intro=film | canvas | still forces one, and always plays.
//
// The memory lasts for one browser tab only (sessionStorage): anyone who opens the
// link fresh, from an email, a message or a new tab, always lands on the welcome
// screen, and a refresh partway through a visit doesn't replay it.

export type IntroKind = 'film' | 'canvas' | 'still' | 'none';

const KEY = 'qdl-intro-seen';

export function markIntroSeen() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* storage blocked: just play it again next time */
  }
}

function seenInThisTab() {
  try {
    return sessionStorage.getItem(KEY) === '1';
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
  if (seenInThisTab()) return 'none';
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
  } catch {
    /* ignore */
  }
  return 'canvas';
}
