// Free flight for the hero's dragonfly: it wanders the header's open space
// (sky and valley) on curved paths, and never over the nav, the headline or
// the button. All coordinates are hero pixels (0,0 = the hero's top-left).

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Pt {
  x: number;
  y: number;
}

/**
 * The dragonfly's footprint at a position and size (s = body length in px).
 * The models are about 2 body-lengths wide; the tail reaches ~0.6s below the pivot.
 * Above it, a forewing tip lifted by the bank, yaw, pitch and flap of flight reaches
 * ~0.7s (measured on the reborn mesh with the angles HeroDragonfly allows). `pad` adds room for the hover
 * wobble and the lean toward the pointer, which move it after a path is chosen.
 */
export function footprint(p: Pt, s: number, pad = 0): Rect {
  return { x0: p.x - 1.06 * s - pad, x1: p.x + 1.06 * s + pad, y0: p.y - 0.7 * s - pad, y1: p.y + 0.64 * s + pad };
}

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** The words to keep clear of, measured from the page, in hero pixels. */
export function measureObstacles(hero: HTMLElement, margin = 14): Rect[] {
  const box = hero.getBoundingClientRect();
  const out: Rect[] = [];
  const add = (el: Element | null, fullWidth = false) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    out.push({
      x0: (fullWidth ? 0 : r.left - box.left) - margin,
      x1: (fullWidth ? box.width : r.right - box.left) + margin,
      y0: r.top - box.top - margin,
      y1: r.bottom - box.top + margin,
    });
  };
  // the nav is fixed to the top of the window, which is the top of the hero while it's in view
  const nav = document.querySelector('.nav');
  if (nav) {
    const r = nav.getBoundingClientRect();
    out.push({ x0: -margin, x1: box.width + margin, y0: -margin, y1: r.height + margin });
  }
  // the words themselves (the headline's lines are full-width blocks, so measure each word)
  hero.querySelectorAll('.hero__title .hero__w').forEach((el) => add(el));
  add(hero.querySelector('.hero__cta'));
  return out;
}

/** The hero's open space as it stands now. */
export function measureSpace(hero: HTMLElement, w: number, h: number, visibleH: number): Space {
  const cta = hero.querySelector('.hero__cta');
  const box = hero.getBoundingClientRect();
  return {
    w,
    h: Math.min(h, visibleH),
    obstacles: measureObstacles(hero),
    ctaBottom: cta ? cta.getBoundingClientRect().bottom - box.top : h * 0.6,
  };
}

export interface Space {
  w: number;
  /** the usable height: the hero's, or the visible window's if the hero is taller (landscape phones) */
  h: number;
  obstacles: Rect[];
  /** bottom of the button, in hero pixels: below it is the valley */
  ctaBottom: number;
}

/** Is the whole dragonfly inside the header and clear of every obstacle here? */
export function isFree(p: Pt, s: number, space: Space, pad: number): boolean {
  const f = footprint(p, s, pad);
  if (f.x0 < 0 || f.x1 > space.w || f.y0 < 0 || f.y1 > space.h * 0.95) return false;
  return !space.obstacles.some((o) => overlaps(f, o));
}

export function bezier(a: Pt, c: Pt, b: Pt, u: number): Pt {
  const v = 1 - u;
  return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y };
}

export function bezierVelocity(a: Pt, c: Pt, b: Pt, u: number): Pt {
  return { x: 2 * (1 - u) * (c.x - a.x) + 2 * u * (b.x - c.x), y: 2 * (1 - u) * (c.y - a.y) + 2 * u * (b.y - c.y) };
}

/** Is every point along the curve free? (Sampled densely enough for a body-length step.) */
export function pathFree(a: Pt, c: Pt, b: Pt, s: number, space: Space, pad: number): boolean {
  const len = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
  const steps = Math.max(8, Math.ceil(len / (s * 0.35)));
  for (let i = 1; i <= steps; i++) if (!isFree(bezier(a, c, b, i / steps), s, space, pad)) return false;
  return true;
}

export interface Flight {
  from: Pt;
  ctrl: Pt;
  to: Pt;
}

/**
 * Choose the next open spot and a gently curving path to it that stays clear of
 * the words. Prefers trips of a fair length; returns null if nowhere is reachable
 * (it then simply keeps hovering).
 */
export function pickFlight(from: Pt, s: number, space: Space, pad: number, rnd = Math.random): Flight | null {
  const { w, h } = space;
  let best: Flight | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 60; i++) {
    const to = { x: 1.06 * s + pad + rnd() * Math.max(1, w - 2 * (1.06 * s + pad)), y: 0.7 * s + pad + rnd() * Math.max(1, h * 0.95 - 1.34 * s - 2 * pad) };
    if (!isFree(to, s, space, pad)) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d < s * 0.8) continue;
    // a soft arc to one side or the other
    const bend = (rnd() - 0.5) * 0.7 * d;
    const ctrl = { x: (from.x + to.x) / 2 + (-dy / d) * bend, y: (from.y + to.y) / 2 + (dx / d) * bend };
    let path: Flight = { from, ctrl, to };
    if (!pathFree(from, ctrl, to, s, space, pad)) {
      const straight = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      if (!pathFree(from, straight, to, s, space, pad)) continue;
      path = { from, ctrl: straight, to };
    }
    // a fair distance, not always the longest: some variety
    const ideal = Math.min(w, h) * 0.45;
    const score = -Math.abs(d - ideal) + rnd() * ideal * 0.6;
    if (score > bestScore) {
      bestScore = score;
      best = path;
    }
  }
  return best;
}

/** The nearest open spot to p (used when the landing spot happens to sit on the words). */
export function nearestFree(p: Pt, s: number, space: Space, pad: number): Pt | null {
  for (let r = 0; r < Math.max(space.w, space.h); r += 12) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
      if (isFree(q, s, space, pad)) return q;
    }
  }
  return null;
}
