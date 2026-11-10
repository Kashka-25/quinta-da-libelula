// Draws the living dragonfly in unit space: body length 1, head up, wings out,
// echoing the Quinta da Libélula emblem so the melted dragonfly can reform as it.

export interface Pose {
  x: number;
  y: number;
  /** body length in px */
  s: number;
  rot: number;
  t: number;
}

const FORE = { rootY: -0.3, tipX: 0.62, tipY: -0.4, width: 0.07 };
const HIND = { rootY: -0.24, tipX: 0.58, tipY: -0.15, width: 0.085 };

function wingPath(ctx: CanvasRenderingContext2D, side: number, w: typeof FORE) {
  const { rootY, tipX, tipY, width } = w;
  ctx.beginPath();
  ctx.moveTo(0.02 * side, rootY);
  ctx.bezierCurveTo(side * tipX * 0.35, rootY - width * 1.1, side * tipX * 0.85, tipY - width * 0.9, side * tipX, tipY);
  ctx.bezierCurveTo(side * tipX * 1.04, tipY + width * 0.7, side * tipX * 0.6, rootY + width * 1.25, 0.02 * side, rootY + width * 0.35);
  ctx.closePath();
}

function drawWing(ctx: CanvasRenderingContext2D, side: number, w: typeof FORE, t: number, flap: number, ghost: boolean) {
  ctx.save();
  ctx.translate(0, w.rootY);
  ctx.rotate(side * flap);
  ctx.scale(1, 1 - Math.abs(flap) * 1.6);
  ctx.translate(0, -w.rootY);

  const sh = Math.sin(t * 0.0008) * 25;
  const g = ctx.createLinearGradient(0, w.rootY, side * w.tipX, w.tipY);
  const a = ghost ? 0.35 : 1;
  g.addColorStop(0, `rgba(235,240,222,${0.12 * a})`);
  g.addColorStop(0.35, `hsla(${165 + sh},45%,80%,${0.24 * a})`);
  g.addColorStop(0.7, `hsla(${268 + sh},40%,84%,${0.22 * a})`);
  g.addColorStop(1, `hsla(${42 + sh},70%,80%,${0.3 * a})`);
  wingPath(ctx, side, w);
  ctx.fillStyle = g;
  ctx.fill();

  if (!ghost) {
    ctx.lineWidth = 0.0045;
    ctx.strokeStyle = 'rgba(252,246,226,0.55)';
    ctx.stroke();
    // veins
    ctx.lineWidth = 0.0022;
    ctx.strokeStyle = 'rgba(252,246,226,0.28)';
    for (const k of [-0.45, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(0.02 * side, w.rootY + k * w.width * 0.4);
      ctx.quadraticCurveTo(side * w.tipX * 0.5, w.rootY + (w.tipY - w.rootY) * 0.5 + k * w.width * 0.9, side * w.tipX * 0.94, w.tipY + k * w.width * 0.25);
      ctx.stroke();
    }
    // cross veins
    ctx.strokeStyle = 'rgba(252,246,226,0.12)';
    for (let i = 1; i < 9; i++) {
      const f = i / 9;
      const x = side * w.tipX * f;
      const y = w.rootY + (w.tipY - w.rootY) * f;
      ctx.beginPath();
      ctx.moveTo(x, y - w.width * 0.55 * (1 - f * 0.5));
      ctx.lineTo(x + side * 0.01, y + w.width * 0.6 * (1 - f * 0.4));
      ctx.stroke();
    }
    // pterostigma
    ctx.fillStyle = 'rgba(150,110,48,0.75)';
    ctx.beginPath();
    ctx.ellipse(side * w.tipX * 0.86, w.tipY - w.width * 0.18 + (w.rootY - w.tipY) * 0.06, 0.022, 0.007, -side * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawDragonfly(ctx: CanvasRenderingContext2D, p: Pose, alpha = 1, halo = true) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(p.s, p.s);

  // warm halo (left out when the dragonfly is sampled into pigment)
  if (halo) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -0.25, 0, 0, -0.25, 0.75);
    g.addColorStop(0, 'rgba(255,222,160,0.16)');
    g.addColorStop(1, 'rgba(255,222,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-0.8, -1, 1.6, 1.6);
    ctx.globalCompositeOperation = 'source-over';
  }

  const t = p.t;
  const flap = Math.sin(t * 0.05) * 0.07;
  const flap2 = Math.sin(t * 0.05 + 1.7) * 0.07;
  for (const side of [-1, 1]) {
    drawWing(ctx, side, HIND, t, -flap2, true);
    drawWing(ctx, side, FORE, t, -flap, true);
    drawWing(ctx, side, HIND, t, flap2, false);
    drawWing(ctx, side, FORE, t, flap, false);
  }

  // abdomen
  const n = 11;
  const top = -0.2;
  const bottom = 0.57;
  const seg = (bottom - top) / n;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const y = top + seg * (i + 0.5);
    const rx = 0.027 - 0.014 * f + (i === n - 1 ? -0.003 : 0);
    const g = ctx.createLinearGradient(-rx, 0, rx, 0);
    g.addColorStop(0, '#1b302b');
    g.addColorStop(0.38, i % 2 ? '#5d8a77' : '#7c8f52');
    g.addColorStop(0.5, '#d7e2b2');
    g.addColorStop(0.62, '#4b6f5f');
    g.addColorStop(1, '#16271f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, y, rx, seg * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(214,170,92,0.55)';
    ctx.lineWidth = 0.003;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.9, y + seg * 0.5);
    ctx.lineTo(rx * 0.9, y + seg * 0.5);
    ctx.stroke();
  }

  // legs
  ctx.strokeStyle = 'rgba(30,40,30,0.8)';
  ctx.lineWidth = 0.004;
  for (const side of [-1, 1]) {
    for (const k of [0, 1, 2]) {
      ctx.beginPath();
      ctx.moveTo(side * 0.02, -0.31 + k * 0.025);
      ctx.quadraticCurveTo(side * 0.06, -0.27 + k * 0.03, side * 0.045, -0.22 + k * 0.03);
      ctx.stroke();
    }
  }

  // thorax
  const th = ctx.createLinearGradient(-0.05, 0, 0.05, 0);
  th.addColorStop(0, '#1d332c');
  th.addColorStop(0.45, '#7e9a5a');
  th.addColorStop(0.55, '#e3dfb0');
  th.addColorStop(1, '#1d332c');
  ctx.fillStyle = th;
  ctx.beginPath();
  ctx.ellipse(0, -0.29, 0.048, 0.072, 0, 0, Math.PI * 2);
  ctx.fill();

  // head and eyes
  ctx.fillStyle = '#2a3f33';
  ctx.beginPath();
  ctx.ellipse(0, -0.385, 0.04, 0.026, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    const eg = ctx.createRadialGradient(side * 0.022, -0.425, 0.002, side * 0.028, -0.415, 0.034);
    eg.addColorStop(0, '#e6f4dc');
    eg.addColorStop(0.35, '#69a596');
    eg.addColorStop(1, '#12302b');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(side * 0.027, -0.415, 0.031, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,245,0.9)';
  ctx.beginPath();
  ctx.arc(-0.035, -0.43, 0.006, 0, Math.PI * 2);
  ctx.arc(0.02, -0.43, 0.006, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
