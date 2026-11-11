// The melting dragonfly, as a small canvas engine with no React in it, so the
// sequence can be refined (or reused) on its own.
//
// arrival   the dragonfly hovers in a sunlit forest
// melt      wings turn fluid, the body runs into pigment, petals and nectar
// gather    the pigment travels through the air and settles into the emblem
// reveal    the real emblem appears; the page shows "Enter the Experience"

import { drawDragonfly, type Pose } from './dragonfly';
import type { DragonflyRenderer } from './dragonfly3d';
import { heroRest } from '../three/heroRest';
import { buildStatic, drawAtmosphere, glowSprite, makeMotes, PAD, seeded, type Mist, type Mote } from './scene';

export type Phase = 'arrival' | 'melt' | 'gather' | 'reveal';

/** The longest the forest waits for the 3D model before the story starts without it. */
export const HOLD_MAX = 10000;

export const TIMELINE = { melt: 5400, gather: 10600, reveal: 14200 } as const;

const PIGMENTS: [number, number, number][] = [
  [159, 181, 138], // sage
  [217, 160, 91], // amber
  [185, 163, 208], // lavender
  [201, 120, 90], // terracotta
  [232, 217, 168], // cream
  [127, 167, 154], // eucalyptus
];
const IVORY: [number, number, number] = [240, 233, 218];
const GOLD: [number, number, number] = [240, 196, 112];

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  hasTarget: boolean;
  c0: [number, number, number];
  pg: [number, number, number];
  c: [number, number, number];
  size: number;
  delay: number;
  gd: number;
  swirl: number;
  nectar: boolean;
  wing: boolean;
}

export interface RebirthCallbacks {
  /** the reborn has formed and starts to fly: show the homepage beneath */
  onDepart: () => void;
  /** it has reached its place in the hero: hand over to the homepage */
  onDone: () => void;
}

/** Rebirth timeline, in ms after "Enter the Experience". */
export const REBIRTH = { reform: 1400, formed: 3100, emerge: 3500, depart: 4500, done: 6800 } as const;

interface Bloom {
  x: number;
  y: number;
  r: number;
  born: number;
  c: [number, number, number];
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  born: number;
  c: [number, number, number];
}

export interface EngineOptions {
  emblemSrc: string;
  onPhase: (p: Phase) => void;
  /** fewer particles for small or low-memory devices */
  lite?: boolean;
  /** the live 3D dragonfly, once it has loaded (null until then, or if WebGL is unavailable) */
  renderer?: () => DragonflyRenderer | null;
  /** hold the story at its first moment until this settles (the 3D model loading); never longer than HOLD_MAX */
  ready?: Promise<unknown>;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export class IntroEngine {
  private bg: CanvasRenderingContext2D;
  private fx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private still!: HTMLCanvasElement;
  private sprite = glowSprite('255,226,160');
  private nectarSprite = glowSprite('255,200,110');
  private motes: Mote[] = [];
  private mist: Mist[] = [];
  private particles: P[] = [];
  private blooms: Bloom[] = [];
  private petals: Petal[] = [];
  private start = 0;
  private last = 0;
  private raf = 0;
  private phase: Phase | null = null;
  private pose: Pose = { x: 0, y: 0, s: 100, rot: 0, t: 0 };
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private emblem: HTMLImageElement | null = null;
  private emblemRect = { x: 0, y: 0, w: 0, h: 0 };
  private meltReady = false;
  private gatherReady = false;
  private offset = 0; // added to elapsed when skipping
  private destroyed = false;
  private holding = false;
  private cleared3d = false;
  private reb: { start: number; cb: RebirthCallbacks; targets: boolean; departed: boolean; done: boolean; t0: number } | null = null;

  constructor(private bgCanvas: HTMLCanvasElement, private fxCanvas: HTMLCanvasElement, private opts: EngineOptions) {
    this.bg = bgCanvas.getContext('2d')!;
    this.fx = fxCanvas.getContext('2d')!;
    if (!this.bg || !this.fx) throw new Error('no canvas');
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => (this.emblem = img);
    img.src = opts.emblemSrc;
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onPointer);
    this.start = this.last = performance.now();
    if (opts.ready) {
      this.holding = true;
      const release = () => {
        if (this.holding) {
          this.holding = false;
          this.start = performance.now() - this.offset;
          this.offset = 0;
        }
      };
      opts.ready.then(release, release);
      window.setTimeout(release, HOLD_MAX);
    }
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointer);
  }

  /** Jump straight to the emblem. */
  skip() {
    if (this.reb) return; // the rebirth is already past the emblem
    const now = performance.now() - this.start + this.offset;
    if (now < TIMELINE.reveal) this.offset += TIMELINE.reveal + 1600 - now;
    this.particles = [];
    this.blooms = [];
    this.petals = [];
    this.meltReady = this.gatherReady = true;
    this.holding = false;
    this.clear3d();
  }

  /** True when the live 3D reborn dragonfly can take over (WebGL and the model are there). */
  canRebirth() {
    return !!this.r3d();
  }

  /**
   * "Enter the Experience": the emblem melts back into pigment, the pigment
   * re-forms as the reborn Prismatic Lotus Dragonfly, which then flies to its
   * place in the homepage hero.
   */
  rebirth(cb: RebirthCallbacks) {
    if (this.reb) return;
    this.skip();
    this.reb = { start: performance.now(), cb, targets: false, departed: false, done: false, t0: performance.now() - this.start };
    this.r3d()?.reborn();
    // the emblem's own pixels become the pigment
    const pts = this.emblemTargets();
    const max = this.opts.lite ? 1300 : 2600;
    const rnd = Math.random;
    this.particles = pts.slice(0, max).map((p) => {
      const nectar = rnd() < 0.1;
      const c0: [number, number, number] = nectar ? [...GOLD] : [...IVORY];
      return {
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        sx: p.x,
        sy: p.y,
        tx: p.x,
        ty: p.y,
        hasTarget: false,
        c0,
        c: [...c0] as [number, number, number],
        pg: nectar ? GOLD : PIGMENTS[Math.floor(rnd() * PIGMENTS.length)],
        size: 1.1 + rnd() * 0.9,
        delay: rnd() * 500,
        gd: rnd() * 500,
        swirl: (rnd() - 0.5) * Math.min(this.w, this.h) * 0.18,
        nectar,
        wing: false,
      };
    });
  }

  /** The pose of the reborn as it forms at the centre. */
  private rebornCentre(t: number): Pose {
    // the lotus wings reach further than the original's: keep them on narrow screens
    const s = Math.min(this.bodyLength(), this.w * 0.42);
    return { x: this.w / 2, y: this.h * 0.45 + s * 0.12, s, rot: 0, t };
  }

  private frameRebirth(now: number, t: number, dt: number, dtMs: number) {
    const reb = this.reb!;
    const R = now - reb.start;
    const fx = this.fx;
    const r3d = this.r3d();
    const tt = 4000 + R; // keeps the wings in their settled hover rhythm
    this.drawBackground(t, dt, 1);

    if (R < REBIRTH.depart) {
      fx.save();
      fx.globalCompositeOperation = 'destination-out';
      fx.fillStyle = `rgba(0,0,0,${R < REBIRTH.reform ? 0.07 : R < REBIRTH.formed ? 0.16 : 0.5})`;
      fx.fillRect(0, 0, this.w, this.h);
      fx.restore();
    } else fx.clearRect(0, 0, this.w, this.h);

    // the emblem lets go
    if (R < 700 && this.emblem) {
      const e = this.emblemRect;
      fx.globalAlpha = 0.35 * (1 - R / 700);
      fx.drawImage(this.emblem, e.x, e.y, e.w, e.h);
      fx.globalAlpha = 1;
    }

    // as the pigment flows, read the reborn's shape and colours to re-form into
    if (!reb.targets && R > REBIRTH.reform - 250 && r3d) {
      reb.targets = true;
      const off = document.createElement('canvas');
      off.width = this.w;
      off.height = this.h;
      const octx = off.getContext('2d', { willReadFrequently: true })!;
      r3d.draw(this.rebornCentre(tt), 1, 0, { which: 'reborn' });
      octx.drawImage(r3d.canvas, 0, 0, this.w, this.h);
      r3d.clear();
      const data = octx.getImageData(0, 0, this.w, this.h).data;
      const pts: { x: number; y: number; c: [number, number, number] }[] = [];
      for (let y = 0; y < this.h; y += 2) {
        for (let x = 0; x < this.w; x += 2) {
          const i = (y * this.w + x) * 4;
          if (data[i + 3] > 90) pts.push({ x, y, c: [data[i], data[i + 1], data[i + 2]] });
        }
      }
      for (let i = pts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pts[i], pts[j]] = [pts[j], pts[i]];
      }
      if (import.meta.env.DEV) console.debug('[rebirth] reborn shape points', pts.length);
      this.particles.forEach((p, i) => {
        const tg = pts[i % Math.max(1, pts.length)];
        p.hasTarget = !!tg;
        if (tg) {
          p.tx = tg.x;
          p.ty = tg.y;
          p.pg = tg.c;
        }
      });
    }

    if (R < REBIRTH.reform) {
      // flowing pigment
      for (const p of this.particles) {
        const k = (R - p.delay) / 1000;
        if (k > 0) {
          const a = this.flow(p.x, p.y, t);
          p.vx += (Math.cos(a) * 0.09 + (p.x - this.w / 2) * 0.0002) * dt;
          p.vy += (Math.sin(a) * 0.09 + 0.012) * dt;
          p.vx *= 0.975;
          p.vy *= 0.975;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        p.sx = p.x;
        p.sy = p.y;
        this.dot(p, 0.6, p.size + clamp(k) * 1.6);
      }
    } else if (R < REBIRTH.depart) {
      // gathering into the reborn
      const fade = 1 - clamp((R - REBIRTH.emerge - 300) / 700);
      for (const p of this.particles) {
        const e = ease(clamp((R - REBIRTH.reform - p.gd * 0.6) / (REBIRTH.formed - REBIRTH.reform - 300)));
        const dx = p.tx - p.sx;
        const dy = p.ty - p.sy;
        const len = Math.hypot(dx, dy) || 1;
        const bow = Math.sin(e * Math.PI) * p.swirl;
        p.x = mix(p.sx, p.tx, e) + (-dy / len) * bow;
        p.y = mix(p.sy, p.ty, e) + (dx / len) * bow;
        p.c = [mix(p.c[0], p.pg[0], 0.08), mix(p.c[1], p.pg[1], 0.08), mix(p.c[2], p.pg[2], 0.08)];
        // once formed, the pigment shimmers in place as the real dragonfly resolves out of it
        const tw = e >= 1 ? 0.75 + 0.25 * Math.sin(now * 0.012 + p.gd) : 1;
        if (fade > 0) this.dot(p, 0.9 * fade * tw, mix(2.2, 1.25, e));
      }
    }

    if (r3d && R >= REBIRTH.emerge) {
      const centre = this.rebornCentre(tt);
      if (R < REBIRTH.depart) {
        const a = ease(clamp((R - REBIRTH.emerge) / (REBIRTH.depart - REBIRTH.emerge)));
        r3d.draw(centre, a, dtMs / 1000, { which: 'reborn', glow: 1.3 * (1 - a) + 0.25 });
      } else {
        if (!reb.departed) {
          reb.departed = true;
          reb.cb.onDepart();
        }
        const u = ease(clamp((R - REBIRTH.depart) / (REBIRTH.done - REBIRTH.depart)));
        const box = document.getElementById('home')?.getBoundingClientRect();
        // (fallback before #home is laid out: the hero is 70svh, min 520px, on phones; 100svh, min 600px, elsewhere)
        const vh = document.documentElement.clientHeight || this.h; // as HeroDragonfly reads it
        const hr = box ? heroRest(box.width, box.height, vh) : heroRest(this.w, this.w <= 700 ? Math.max(this.h * 0.7, 520) : Math.max(this.h, 600), vh);
        const rest = box ? { x: box.left + hr.x, y: box.top + hr.y, s: hr.s } : hr;
        const pose: Pose = {
          x: mix(centre.x, rest.x, u),
          y: mix(centre.y, rest.y, u) - Math.sin(u * Math.PI) * this.h * 0.07,
          s: mix(centre.s, rest.s, u),
          rot: Math.sin(u * Math.PI) * -0.25,
          t: tt,
        };
        r3d.draw(pose, 1, dtMs / 1000, { which: 'reborn', glow: 0.25 * (1 - u) });
        // a few sparks shed as it flies
        if (u < 1) {
          fx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) {
            const s = 6 + Math.random() * 10;
            fx.globalAlpha = 0.6 * (1 - u);
            fx.drawImage(this.nectarSprite, pose.x + (Math.random() - 0.5) * pose.s * 1.4 - s / 2, pose.y + (Math.random() - 0.3) * pose.s * 0.6 - s / 2, s, s);
          }
          fx.globalAlpha = 1;
          fx.globalCompositeOperation = 'source-over';
        }
        if (R >= REBIRTH.done && !reb.done) {
          reb.done = true;
          reb.cb.onDone();
        }
      }
    }
    // without the reborn model, still finish the journey
    if (!r3d && R >= REBIRTH.depart && !reb.departed) {
      reb.departed = true;
      reb.cb.onDepart();
    }
    if (!r3d && R >= REBIRTH.done && !reb.done) {
      reb.done = true;
      reb.cb.onDone();
    }
  }

  private dot(p: P, alpha: number, size: number) {
    const fx = this.fx;
    if (p.nectar) {
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = alpha * 0.5;
      const s = size * 5;
      fx.drawImage(this.nectarSprite, p.x - s / 2, p.y - s / 2, s, s);
      fx.globalCompositeOperation = 'source-over';
    } else {
      fx.globalAlpha = alpha;
      fx.fillStyle = `rgb(${p.c[0] | 0},${p.c[1] | 0},${p.c[2] | 0})`;
      fx.beginPath();
      fx.arc(p.x, p.y, size, 0, Math.PI * 2);
      fx.fill();
    }
    fx.globalAlpha = 1;
  }

  private r3d() {
    return this.opts.renderer?.() ?? null;
  }

  private clear3d() {
    if (this.cleared3d) return;
    this.cleared3d = true;
    this.r3d()?.clear();
  }

  /** Centre of the emblem's dragonfly, for the page transition. */
  get focus() {
    return { x: this.emblemRect.x + this.emblemRect.w / 2, y: this.emblemRect.y + this.emblemRect.h * 0.5 };
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.tx = (e.clientX / this.w - 0.5) * 2;
    this.pointer.ty = (e.clientY / this.h - 0.5) * 2;
  };

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    for (const c of [this.bgCanvas, this.fxCanvas]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
    }
    this.bg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const scaleX = w / (this.w || w);
    const scaleY = h / (this.h || h);
    for (const p of this.particles) {
      p.x *= scaleX;
      p.y *= scaleY;
    }
    this.w = w;
    this.h = h;
    this.still = buildStatic(w, h);
    const rnd = seeded(7);
    const count = this.opts.lite ? 70 : 150;
    this.motes = makeMotes(count, w, h, rnd);
    this.mist = Array.from({ length: 7 }, () => ({
      x: rnd() * w,
      y: h * (0.35 + rnd() * 0.6),
      r: Math.max(w, h) * (0.18 + rnd() * 0.2),
      v: (rnd() - 0.5) * 0.02,
    }));
    const E = Math.min(w * 0.9, h * 0.6, 540);
    const EH = (E * 436) / 446;
    this.emblemRect = { x: w / 2 - E / 2, y: h * 0.45 - EH / 2, w: E, h: EH };
    if (this.reb) {
      for (const p of this.particles) {
        p.sx *= scaleX;
        p.sy *= scaleY;
      }
      if (performance.now() - this.reb.start < REBIRTH.depart) this.reb.targets = false;
    } else if (this.gatherReady && this.particles.length) this.assignTargets(false);
  };

  private bodyLength() {
    return Math.min(this.w * 0.6, this.h * 0.42, 380);
  }

  private setPhase(p: Phase) {
    if (this.phase === p) return;
    this.phase = p;
    this.opts.onPhase(p);
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    const dtMs = Math.min(50, now - this.last);
    this.last = now;
    const dt = dtMs / 16.67;
    if (this.holding) this.start = now - this.offset;
    const t = now - this.start + this.offset;

    const phase: Phase = t < TIMELINE.melt ? 'arrival' : t < TIMELINE.gather ? 'melt' : t < TIMELINE.reveal ? 'gather' : 'reveal';
    if (phase !== 'arrival' && !this.meltReady) this.beginMelt(t);
    if ((phase === 'gather' || phase === 'reveal') && !this.gatherReady) this.beginGather();
    this.setPhase(phase);

    this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.04;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.04;

    if (this.reb) {
      this.frameRebirth(now, t, dt, dtMs);
      this.raf = requestAnimationFrame(this.frame);
      return;
    }

    const warmth = phase === 'reveal' ? clamp((t - TIMELINE.reveal) / 2000) : phase === 'gather' ? 0.4 * clamp((t - TIMELINE.gather) / 3000) : 0;
    this.drawBackground(t, dt, warmth);

    // fx layer: full clear while the dragonfly is whole, watercolour trails afterwards
    const fx = this.fx;
    if (phase === 'arrival' || phase === 'reveal') {
      fx.clearRect(0, 0, this.w, this.h);
    } else {
      fx.save();
      fx.globalCompositeOperation = 'destination-out';
      fx.fillStyle = `rgba(0,0,0,${phase === 'melt' ? 0.06 : 0.13})`;
      fx.fillRect(0, 0, this.w, this.h);
      fx.restore();
    }

    const r3d = this.r3d();
    if (phase === 'arrival') {
      this.updatePose(t);
      if (r3d) r3d.draw(this.pose, clamp(t / 900), dtMs / 1000);
      else drawDragonfly(fx, this.pose, clamp(t / 1800));
    } else if (phase === 'melt') {
      const m = t - TIMELINE.melt;
      if (m < 1000) {
        fx.clearRect(0, 0, this.w, this.h);
        this.updatePose(t);
        if (r3d) r3d.draw(this.pose, 1 - m / 1000, dtMs / 1000);
        else drawDragonfly(fx, this.pose, 1 - m / 1000);
      } else this.clear3d();
      this.updateMelt(m, t, dt);
    } else if (phase === 'gather') {
      this.clear3d();
      this.updateGather(t - TIMELINE.gather, t);
    } else {
      this.clear3d();
      this.drawReveal(t - TIMELINE.reveal, t);
    }

    this.raf = requestAnimationFrame(this.frame);
  };

  private updatePose(t: number) {
    const s = this.bodyLength();
    const hx = this.w / 2 + Math.sin(t * 0.00071) * this.w * 0.025 + this.pointer.x * 14;
    const hy = this.h * 0.45 + Math.sin(t * 0.0013) * this.h * 0.014 + this.pointer.y * 10 + s * 0.12;
    // it flies in from the upper right, swooping down, banking, then settles to hover
    const a = ease(clamp(t / 2800));
    this.pose = {
      x: mix(this.w * 1.05, hx, a),
      y: mix(-this.h * 0.12, hy, a) + Math.sin(a * Math.PI) * this.h * 0.1,
      s: s * (0.4 + 0.6 * a),
      rot: Math.sin(t * 0.0009) * 0.035 + this.pointer.x * 0.04 + (1 - a) * 0.6,
      t,
    };
  }

  private drawBackground(t: number, dt: number, warmth: number) {
    const bg = this.bg;
    bg.globalCompositeOperation = 'source-over';
    bg.globalAlpha = 1;
    bg.drawImage(this.still, -PAD - this.pointer.x * PAD * 0.7, -PAD - this.pointer.y * PAD * 0.5, this.w + PAD * 2, this.h + PAD * 2);
    drawAtmosphere(bg, this.w, this.h, t, dt, this.motes, this.mist, this.sprite, warmth);

    // watercolour blooms
    for (const b of this.blooms) {
      const age = (t - b.born) / 4200;
      if (age < 0 || age > 1) continue;
      const r = b.r * easeOut(clamp(age * 1.6));
      const a = Math.sin(Math.PI * age) * 0.11;
      const g = bg.createRadialGradient(b.x, b.y, r * 0.1, b.x, b.y, r);
      g.addColorStop(0, `rgba(${b.c},${a * 0.5})`);
      g.addColorStop(0.82, `rgba(${b.c},${a * 0.8})`);
      g.addColorStop(0.92, `rgba(${b.c},${a})`);
      g.addColorStop(1, `rgba(${b.c},0)`);
      bg.fillStyle = g;
      bg.beginPath();
      bg.arc(b.x, b.y, r, 0, Math.PI * 2);
      bg.fill();
    }

    // ripples of light at the moment of surrender
    const m = t - TIMELINE.melt;
    if (m > 0 && m < 4200) {
      bg.save();
      bg.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const k = (m - i * 650) / 3200;
        if (k <= 0 || k >= 1) continue;
        bg.strokeStyle = `hsla(${40 + i * 90},60%,80%,${(1 - k) * 0.28})`;
        bg.lineWidth = 1.5 + (1 - k) * 3;
        bg.beginPath();
        bg.ellipse(this.pose.x, this.pose.y - this.pose.s * 0.25, k * this.w * 0.55, k * this.w * 0.4, 0, 0, Math.PI * 2);
        bg.stroke();
      }
      bg.restore();
    }

    // petals
    for (const p of this.petals) {
      const age = (t - p.born) / 5200;
      if (age < 0 || age > 1) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 0.004 * dt;
      p.rot += p.vr * dt;
      const s = p.size * easeOut(clamp(age * 3));
      bg.save();
      bg.translate(p.x, p.y);
      bg.rotate(p.rot);
      bg.globalAlpha = Math.sin(Math.PI * age) * 0.75;
      const g = bg.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, `rgba(${p.c},0.9)`);
      g.addColorStop(1, 'rgba(255,240,215,0.5)');
      bg.fillStyle = g;
      bg.beginPath();
      bg.moveTo(0, -s);
      bg.bezierCurveTo(s * 0.7, -s * 0.5, s * 0.55, s * 0.6, 0, s);
      bg.bezierCurveTo(-s * 0.55, s * 0.6, -s * 0.7, -s * 0.5, 0, -s);
      bg.fill();
      bg.restore();
    }
  }

  /** Sample the dragonfly as it is right now into pigment particles. */
  private beginMelt(t: number) {
    this.meltReady = true;
    this.updatePose(Math.min(t, TIMELINE.melt));
    const off = document.createElement('canvas');
    off.width = this.w;
    off.height = this.h;
    const octx = off.getContext('2d', { willReadFrequently: true })!;
    const r3d = this.r3d();
    if (r3d) {
      // melt exactly what the visitor sees: a snapshot of the live 3D dragonfly
      r3d.draw(this.pose, 1, 0);
      octx.drawImage(r3d.canvas, 0, 0, this.w, this.h);
    } else drawDragonfly(octx, this.pose, 1, false);
    const data = octx.getImageData(0, 0, this.w, this.h).data;
    const max = this.opts.lite ? 1300 : 2800;
    const step = Math.max(2, Math.round(this.pose.s / 110));
    const pts: P[] = [];
    const rnd = Math.random;
    const { x: cx, y: cy, s } = this.pose;
    for (let y = 0; y < this.h; y += step) {
      for (let x = 0; x < this.w; x += step) {
        const i = (y * this.w + x) * 4;
        if (data[i + 3] < 22) continue;
        const dx = Math.abs(x - cx) / (s * 0.62);
        const wing = dx > 0.075;
        const yn = clamp((y - (cy - 0.45 * s)) / s);
        const nectar = rnd() < 0.08;
        const c0: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
        pts.push({
          x,
          y,
          vx: 0,
          vy: 0,
          sx: x,
          sy: y,
          tx: x,
          ty: y,
          hasTarget: false,
          c0,
          c: [...c0],
          pg: nectar ? GOLD : PIGMENTS[Math.floor(rnd() * PIGMENTS.length)],
          size: wing ? 0.9 + rnd() * 0.8 : 1.2 + rnd(),
          delay: wing ? 300 + (1 - dx) * 1500 + rnd() * 500 : 1500 + (1 - yn) * 1300 + rnd() * 300,
          gd: rnd() * 900,
          swirl: (rnd() - 0.5) * Math.min(this.w, this.h) * 0.5,
          nectar,
          wing,
        });
      }
    }
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    this.particles = pts.slice(0, max);

    const born = TIMELINE.melt;
    this.blooms = Array.from({ length: this.opts.lite ? 8 : 14 }, (_, k) => {
      return {
        x: cx + (rnd() - 0.5) * s * 1.7,
        y: cy - s * 0.2 + (rnd() - 0.35) * s * 1.1,
        r: s * (0.14 + rnd() * 0.3),
        born: born + 600 + k * 260,
        c: PIGMENTS[k % PIGMENTS.length],
      };
    });
    this.petals = Array.from({ length: this.opts.lite ? 18 : 36 }, (_, k) => {
      const p = this.particles[Math.floor(rnd() * this.particles.length)] ?? { x: cx, y: cy };
      return {
        x: p.x,
        y: p.y,
        vx: (rnd() - 0.5) * 1.2,
        vy: (rnd() - 0.3) * 0.8,
        rot: rnd() * Math.PI * 2,
        vr: (rnd() - 0.5) * 0.03,
        size: 8 + rnd() * 14,
        born: born + 1200 + k * 70,
        c: PIGMENTS[Math.floor(rnd() * PIGMENTS.length)],
      };
    });
  }

  private flow(x: number, y: number, t: number) {
    return Math.sin(x * 0.0042 + t * 0.00031) * Math.cos(y * 0.0051 - t * 0.00023) * Math.PI * 2 + Math.sin((x + y) * 0.0013) * 1.4;
  }

  private updateMelt(m: number, t: number, dt: number) {
    const fx = this.fx;
    const cx = this.pose.x;
    const appear = clamp(m / 700);
    for (const p of this.particles) {
      const k = (m - p.delay) / 1000;
      if (k > 0) {
        const a = this.flow(p.x, p.y, t);
        const strength = clamp(k * 0.6) * 0.11;
        p.vx += (Math.cos(a) * strength + (p.x - cx) * 0.00025) * dt;
        p.vy += (Math.sin(a) * strength + (p.wing ? 0.012 : 0.03) * clamp(k)) * dt;
        p.vx *= 0.982;
        p.vy *= 0.982;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const cm = clamp(k / 2.2);
        p.c[0] = mix(p.c0[0], p.pg[0], cm);
        p.c[1] = mix(p.c0[1], p.pg[1], cm);
        p.c[2] = mix(p.c0[2], p.pg[2], cm);
      } else {
        p.x += Math.sin(t * 0.03 + p.sy) * 0.15;
      }
      const size = p.size + clamp(k * 0.5) * (p.nectar ? 1.4 : 3.4);
      if (p.nectar) {
        fx.globalCompositeOperation = 'lighter';
        fx.globalAlpha = 0.22 * appear;
        const s = size * 5;
        fx.drawImage(this.nectarSprite, p.x - s / 2, p.y - s / 2, s, s);
        fx.globalCompositeOperation = 'source-over';
      } else {
        fx.globalAlpha = (k > 0 ? 0.3 : 0.8) * appear;
        fx.fillStyle = `rgb(${p.c[0] | 0},${p.c[1] | 0},${p.c[2] | 0})`;
        fx.beginPath();
        fx.arc(p.x, p.y, size, 0, Math.PI * 2);
        fx.fill();
      }
    }
    fx.globalAlpha = 1;
  }

  private emblemTargets(): { x: number; y: number }[] {
    const off = document.createElement('canvas');
    off.width = this.w;
    off.height = this.h;
    const octx = off.getContext('2d', { willReadFrequently: true })!;
    const r = this.emblemRect;
    if (this.emblem) {
      octx.drawImage(this.emblem, r.x, r.y, r.w, r.h);
    } else {
      octx.fillStyle = '#fff';
      octx.textAlign = 'center';
      octx.font = `italic ${Math.round(r.w * 0.11)}px Georgia, serif`;
      octx.fillText('Quinta da Libélula', this.w / 2, this.h / 2);
    }
    const data = octx.getImageData(0, 0, this.w, this.h).data;
    const pts: { x: number; y: number }[] = [];
    for (let y = 0; y < this.h; y += 2) {
      for (let x = 0; x < this.w; x += 2) {
        if (data[(y * this.w + x) * 4 + 3] > 120) pts.push({ x, y });
      }
    }
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  private assignTargets(capture: boolean) {
    const targets = this.emblemTargets();
    this.particles.forEach((p, i) => {
      if (capture) {
        p.sx = p.x;
        p.sy = p.y;
      }
      const tgt = targets[i];
      p.hasTarget = !!tgt;
      if (tgt) {
        p.tx = tgt.x;
        p.ty = tgt.y;
      }
    });
  }

  private beginGather() {
    this.gatherReady = true;
    this.assignTargets(true);
  }

  private updateGather(g: number, t: number) {
    const fx = this.fx;
    for (const p of this.particles) {
      const prog = clamp((g - p.gd) / 2500);
      const e = ease(prog);
      if (p.hasTarget) {
        const dx = p.tx - p.sx;
        const dy = p.ty - p.sy;
        const len = Math.hypot(dx, dy) || 1;
        const bow = Math.sin(e * Math.PI) * p.swirl;
        p.x = mix(p.sx, p.tx, e) + (-dy / len) * bow;
        p.y = mix(p.sy, p.ty, e) + (dx / len) * bow;
      } else {
        p.x += Math.cos(this.flow(p.x, p.y, t)) * 0.6;
        p.y -= 0.3;
      }
      const target = p.nectar ? GOLD : IVORY;
      const c0 = p.c;
      const r = mix(c0[0], target[0], e * 0.12);
      const gg = mix(c0[1], target[1], e * 0.12);
      const b = mix(c0[2], target[2], e * 0.12);
      p.c = [r, gg, b];
      const alpha = p.hasTarget ? 0.75 : 0.5 * (1 - e);
      const size = mix(2.4, 1.15, e);
      if (p.nectar) {
        fx.globalCompositeOperation = 'lighter';
        fx.globalAlpha = alpha * 0.8;
        const s = size * 5;
        fx.drawImage(this.nectarSprite, p.x - s / 2, p.y - s / 2, s, s);
        fx.globalCompositeOperation = 'source-over';
      } else {
        fx.globalAlpha = alpha;
        fx.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
        fx.beginPath();
        fx.arc(p.x, p.y, size, 0, Math.PI * 2);
        fx.fill();
      }
    }
    fx.globalAlpha = 1;
  }

  private drawReveal(r: number, t: number) {
    const fx = this.fx;
    const e = this.emblemRect;
    const fade = clamp(1 - r / 1700);
    if (fade > 0) {
      for (const p of this.particles) {
        if (!p.hasTarget) continue;
        const tw = 0.6 + 0.4 * Math.sin(t * 0.01 + p.gd);
        fx.globalAlpha = fade * tw * 0.8;
        fx.fillStyle = p.nectar ? 'rgb(240,196,112)' : 'rgb(240,233,218)';
        fx.fillRect(p.tx - 0.7, p.ty - 0.7, 1.4, 1.4);
      }
    }
    const a = easeOut(clamp(r / 1400));
    if (this.emblem) {
      const breathe = 1 + Math.sin(t * 0.0012) * 0.006;
      const w = e.w * breathe;
      const h = e.h * breathe;
      fx.globalAlpha = a;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      fx.drawImage(this.emblem, cx - w / 2, cy - h / 2, w, h);
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = a * (0.12 + 0.08 * Math.sin(t * 0.0015));
      fx.drawImage(this.emblem, cx - w / 2, cy - h / 2, w, h);
      fx.globalCompositeOperation = 'source-over';
    }
    fx.globalAlpha = 1;
  }
}
