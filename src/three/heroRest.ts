// Where the reborn dragonfly hovers in the homepage hero (in hero pixels).
// Shared by the intro (which flies it there) and the hero (which keeps it there).
export function heroRest(w: number, h: number) {
  return w >= 900 ? { x: w * 0.76, y: h * 0.4, s: Math.min(w * 0.17, h * 0.32) } : { x: w * 0.5, y: h * 0.13, s: Math.min(w * 0.22, h * 0.12) };
}
