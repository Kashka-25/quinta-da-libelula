// Where the reborn dragonfly hovers in the homepage hero (in hero pixels).
// Shared by the intro (which flies it there) and the hero (which keeps it there).
// Desktop: the open sky to the right of the headline. Phones and tablets: the
// valley below the button (the header is shorter on phones; see hero.css).
// vh: the visible height; on landscape phones the hero (min-height) is taller than
// the window, and the valley spot must still be on screen.
export function heroRest(w: number, h: number, vh = h) {
  return w >= 900
    ? { x: w * 0.76, y: h * 0.4, s: Math.min(w * 0.17, h * 0.32) }
    : { x: w * 0.62, y: Math.min(h, vh) * 0.8, s: Math.min(w * 0.2, h * 0.12) };
}
