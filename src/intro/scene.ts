// The forest the dragonfly arrives in: a static painted layer (trunks, canopy, ferns)
// built once per size, plus light shafts, mist and pollen animated every frame.

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PAD = 24; // static layer is oversized so it can drift with the pointer

function drawFern(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string, rnd: () => number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, len * 0.008);
  const bend = (rnd() - 0.5) * 0.6 + 0.35;
  const pt = (f: number) => ({ x: Math.sin(f * 1.6) * len * 0.22 * bend, y: -f * len });
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const p = pt(i / 30);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  const leaflets = 22;
  for (let i = 1; i < leaflets; i++) {
    const f = i / leaflets;
    const p = pt(f);
    const l = len * 0.2 * Math.sin(Math.PI * Math.min(1, f * 1.25)) * (1 - f * 0.55);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(side * (1.1 - f * 0.3));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(l * 0.15, -l * 0.5, 0, -l);
      ctx.quadraticCurveTo(-l * 0.15, -l * 0.5, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

export function buildStatic(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const W = w + PAD * 2;
  const H = h + PAD * 2;
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = seeded(1987);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#46512f');
  g.addColorStop(0.4, '#26341f');
  g.addColorStop(1, '#0e1711');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const sun = ctx.createRadialGradient(W * 0.7, -H * 0.08, 0, W * 0.7, -H * 0.08, Math.max(W, H) * 0.95);
  sun.addColorStop(0, 'rgba(255,220,158,0.62)');
  sun.addColorStop(0.35, 'rgba(226,190,120,0.22)');
  sun.addColorStop(1, 'rgba(226,190,120,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  const layers = [
    { n: 7, col: 'rgba(150,160,120,0.22)', blur: 6, wid: 0.012 },
    { n: 5, col: 'rgba(52,66,42,0.55)', blur: 2, wid: 0.02 },
    { n: 3, col: 'rgba(14,22,15,0.92)', blur: 0, wid: 0.034 },
  ];
  for (const L of layers) {
    ctx.filter = L.blur ? `blur(${L.blur}px)` : 'none';
    ctx.fillStyle = L.col;
    for (let i = 0; i < L.n; i++) {
      let x = rnd() * W;
      // keep the centre open for the dragonfly
      if (Math.abs(x - W / 2) < W * 0.18) x += (x < W / 2 ? -1 : 1) * W * 0.2;
      const tw = W * L.wid * (0.7 + rnd() * 0.7);
      const lean = (rnd() - 0.5) * W * 0.06;
      ctx.beginPath();
      ctx.moveTo(x - tw, H + 10);
      ctx.quadraticCurveTo(x - tw * 0.6 + lean, H * 0.5, x - tw * 0.4 + lean * 1.5, -10);
      ctx.lineTo(x + tw * 0.4 + lean * 1.5, -10);
      ctx.quadraticCurveTo(x + tw * 0.6 + lean, H * 0.5, x + tw, H + 10);
      ctx.fill();
    }
  }

  // canopy: dark leaf clusters along the top, a gap where the sun comes through
  ctx.filter = 'blur(3px)';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    const y = Math.pow(rnd(), 2.2) * H * 0.32 - 20;
    if (Math.hypot(x - W * 0.7, y) < W * 0.22) continue;
    ctx.fillStyle = `rgba(${14 + rnd() * 20},${24 + rnd() * 22},${14 + rnd() * 10},${0.35 + rnd() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + rnd() * 40, 6 + rnd() * 18, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // ground haze
  ctx.filter = 'none';
  const haze = ctx.createLinearGradient(0, H * 0.62, 0, H);
  haze.addColorStop(0, 'rgba(210,214,186,0)');
  haze.addColorStop(0.5, 'rgba(210,214,186,0.08)');
  haze.addColorStop(1, 'rgba(10,16,12,0.6)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  // ferns in the corners, one rim-lit
  const size = Math.min(W, H);
  ctx.filter = 'blur(1px)';
  drawFern(ctx, W * 0.04, H + 10, size * 0.55, 0.5, 'rgba(36,52,30,0.85)', rnd);
  drawFern(ctx, W * 0.96, H + 10, size * 0.6, -0.55, 'rgba(36,52,30,0.85)', rnd);
  ctx.filter = 'none';
  drawFern(ctx, -W * 0.02, H + 20, size * 0.48, 0.85, 'rgba(10,17,11,0.97)', rnd);
  drawFern(ctx, W * 1.02, H + 20, size * 0.5, -0.9, 'rgba(10,17,11,0.97)', rnd);
  drawFern(ctx, W * 0.9, H + 30, size * 0.36, -0.3, 'rgba(98,112,60,0.55)', rnd);
  drawFern(ctx, W * 0.12, H + 30, size * 0.32, 0.25, 'rgba(10,17,11,0.97)', rnd);

  // grass blades and tiny flowers
  for (let i = 0; i < 120; i++) {
    const x = rnd() * W;
    const hgt = 20 + rnd() * size * 0.12;
    ctx.strokeStyle = `rgba(12,20,13,${0.6 + rnd() * 0.4})`;
    ctx.lineWidth = 1 + rnd() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, H + 4);
    ctx.quadraticCurveTo(x + (rnd() - 0.5) * 20, H - hgt * 0.5, x + (rnd() - 0.5) * 30, H - hgt);
    ctx.stroke();
    if (rnd() < 0.12) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(232,214,160,0.75)' : 'rgba(196,176,220,0.7)';
      ctx.beginPath();
      ctx.arc(x + (rnd() - 0.5) * 30, H - hgt, 2 + rnd() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

export function glowSprite(rgb: string, size = 32): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.25, `rgba(${rgb},0.55)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ph: number;
}

export function makeMotes(n: number, w: number, h: number, rnd = Math.random): Mote[] {
  return Array.from({ length: n }, () => ({
    x: rnd() * w,
    y: rnd() * h,
    vx: (rnd() - 0.5) * 0.08,
    vy: -0.02 - rnd() * 0.08,
    r: 0.6 + Math.pow(rnd(), 3) * 3,
    ph: rnd() * Math.PI * 2,
  }));
}

export interface Mist {
  x: number;
  y: number;
  r: number;
  v: number;
}

export function drawAtmosphere(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  dt: number,
  motes: Mote[],
  mist: Mist[],
  sprite: HTMLCanvasElement,
  warmth: number,
) {
  // light shafts from the canopy gap
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const sx = w * 0.7;
  for (let i = 0; i < 6; i++) {
    const base = 1.95 + i * 0.13 + Math.sin(t * 0.00021 + i * 1.3) * 0.03;
    const len = Math.hypot(w, h) * 1.1;
    const spread = 0.025 + (i % 3) * 0.012;
    const a = (0.035 + 0.025 * Math.sin(t * 0.0005 + i * 2.1)) * (1 + warmth * 0.8);
    const g = ctx.createLinearGradient(sx, 0, sx + Math.cos(base) * len, Math.sin(base) * len);
    g.addColorStop(0, `rgba(255,228,170,${a})`);
    g.addColorStop(0.6, `rgba(255,228,170,${a * 0.35})`);
    g.addColorStop(1, 'rgba(255,228,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx, -20);
    ctx.lineTo(sx + Math.cos(base - spread) * len, Math.sin(base - spread) * len);
    ctx.lineTo(sx + Math.cos(base + spread) * len, Math.sin(base + spread) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // mist
  for (const m of mist) {
    m.x += m.v * dt;
    if (m.x - m.r > w) m.x = -m.r;
    if (m.x + m.r < 0) m.x = w + m.r;
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    g.addColorStop(0, 'rgba(222,226,204,0.075)');
    g.addColorStop(1, 'rgba(222,226,204,0)');
    ctx.fillStyle = g;
    ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
  }

  // pollen
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of motes) {
    p.x += (p.vx + Math.sin(t * 0.0006 + p.ph) * 0.03) * dt;
    p.y += p.vy * dt;
    if (p.y < -10) {
      p.y = h + 10;
      p.x = Math.random() * w;
    }
    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;
    const tw = 0.45 + 0.55 * Math.sin(t * 0.002 + p.ph * 3);
    ctx.globalAlpha = Math.max(0, tw) * (0.5 + warmth * 0.3);
    const s = p.r * 6;
    ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.restore();
}
