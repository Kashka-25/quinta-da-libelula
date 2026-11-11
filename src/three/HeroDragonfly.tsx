import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Dragonfly, MODELS, makeRenderer, preload, webglOK } from './dragonflyModel';
import { heroRest } from './heroRest';
import { bezier, bezierVelocity, isFree, measureSpace, nearestFree, pickFlight, type Flight, type Pt, type Space } from './roam';

export type HeroEntry = 'fly' | 'handoff' | 'direct';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function dot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,236,190,1)');
  r.addColorStop(0.3, 'rgba(255,214,140,0.6)');
  r.addColorStop(1, 'rgba(255,214,140,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * The reborn Prismatic Lotus Dragonfly. After "Enter the Experience" it flies
 * out of the light into the homepage, trailing gold. Then it roams the header's
 * open sky and valley: it hovers, chooses an open spot, and flies a curved path
 * there, never over the nav, the headline or the button. It leans toward the
 * pointer, and drifts away as the visitor scrolls on.
 */
export default function HeroDragonfly({ entry: entryProp, ready = true }: { entry: HeroEntry; ready?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // how it enters is decided once, when the homepage first appears
  const entry = useRef(entryProp).current;
  const arriving = entry === 'fly';
  const handoff = entry === 'handoff';
  // in a handoff it stays hidden until the intro's dragonfly reaches the same spot
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !webglOK()) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    preload(MODELS.reborn).then((source) => {
      if (disposed) return;
      const { renderer, scene } = makeRenderer(canvas);
      const df = new Dragonfly(source, { wingAlpha: 0.72 });
      scene.add(df.root);
      const FOV = 28;
      const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 20000);
      let w = 0;
      let h = 0;
      // free flight through the header's open space (see roam.ts)
      const hero = canvas.parentElement!;
      const PAD = 22; // room for the hover wobble and the lean toward the pointer
      let space: Space | null = null;
      // the visible height (stable while a phone's address bar slides, unlike innerHeight)
      const visibleH = () => document.documentElement.clientHeight || window.innerHeight;
      const measure = () => {
        // the words are measured while the hero is at the top (they move with scroll)
        if (window.scrollY < 40 && w && h) space = measureSpace(hero, w, h, visibleH());
        return space;
      };
      // scrolling: above the words it rises away; in the valley it sinks away (never into the words)
      let driftDir = 0;
      let roam: { mode: 'hover' | 'fly'; base: Pt; until: number; flight: Flight | null; t0: number; dur: number } | null = null;
      let bank = 0;
      const resize = () => {
        const host = canvas.parentElement!;
        const ow = w;
        const oh = h;
        w = host.clientWidth;
        h = host.clientHeight;
        if (w === ow && h === oh) {
          // e.g. a phone's address bar: nothing to redo, unless the visible height itself changed
          const vh = Math.min(h, visibleH());
          if (space && space.h !== vh) {
            space.h = vh;
            if (roam && roam.mode === 'hover') roam.until = 0;
          }
          return;
        }
        // keep its place in proportion; the words are re-measured before the next move
        space = null;
        if (roam && ow && oh) {
          roam.base = { x: (roam.base.x * w) / ow, y: (roam.base.y * h) / oh };
          roam.mode = 'hover';
          roam.flight = null;
          roam.until = 0; // re-check at once: off the words, and on screen
        }
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.position.set(0, 0, h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener('resize', resize);

      // a trail of light shed while it flies
      const N = 220;
      const pos = new Float32Array(N * 3);
      const vel = new Float32Array(N * 3);
      const life = new Float32Array(N);
      const alpha = new Float32Array(N);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { map: { value: dot() }, size: { value: 22 * Math.min(window.devicePixelRatio || 1, 1.75) } },
        vertexShader: `attribute float alpha; varying float vA; uniform float size;
          void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * alpha; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform sampler2D map; varying float vA;
          void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb, c.a * vA); }`,
      });
      const trail = new THREE.Points(geo, mat);
      trail.frustumCulled = false;
      scene.add(trail);
      let next = 0;
      const emit = (x: number, y: number, spread: number) => {
        const i = next++ % N;
        pos[i * 3] = x + (Math.random() - 0.5) * spread;
        pos[i * 3 + 1] = y + (Math.random() - 0.5) * spread * 0.4;
        pos[i * 3 + 2] = 0;
        vel[i * 3] = (Math.random() - 0.5) * 30;
        vel[i * 3 + 1] = -10 - Math.random() * 30;
        life[i] = 1;
      };

      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('pointermove', onMove);

      const rest = () => heroRest(w, h, visibleH());
      let start = performance.now();
      let shownAt = handoff ? 0 : start;
      const FLY = arriving ? 2600 : 3200;
      let last = start;
      let visible = true;
      const redraw = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      };
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (reduce && visible) redraw();
      });
      io.observe(canvas);

      const frame = (now: number) => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        if (!visible || document.hidden) {
          last = now;
          if (reduce) cancelAnimationFrame(raf); // a still frame needs no loop while hidden
          return;
        }
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!shownAt) {
          if (!readyRef.current) {
            renderer.clear();
            return;
          }
          shownAt = start = now;
        }
        const t = reduce ? 99 : (now - start) / 1000;
        const r = rest();
        const a = reduce || handoff ? 1 : ease(clamp((now - start) / FLY));
        // from the heart of the light (arriving) or from beyond the trees (direct visit)
        const fromX = arriving ? w * 0.5 : w * 1.1;
        // (direct visits to a valley home come up from below the ridge, never across the words)
        const fromY = arriving ? h * 0.5 : r.y > h * 0.6 ? h * 1.05 : -h * 0.15;
        pointer.x += (pointer.tx - pointer.x) * 0.03;
        pointer.y += (pointer.ty - pointer.y) * 0.03;

        // where it is: arriving along its entry path, then roaming the open space
        let bx: number;
        let by: number;
        let vx = 0; // horizontal speed while roaming, px/s (for banking)
        let flying = 0; // 0 hovering .. 1 mid-flight
        const scroll = window.scrollY;
        const held = scroll >= 1; // the drift direction is fixed while scrolled: stay on its side of the words
        const ctaLine = space?.ctaBottom ?? h * 0.6;
        if (a < 1 || reduce) {
          bx = fromX + (r.x - fromX) * a + Math.sin(a * Math.PI) * w * 0.06;
          by = fromY + (r.y - fromY) * a - Math.sin(a * Math.PI) * h * 0.08;
        } else {
          if (!roam) {
            // hover for a moment first, unless the home spot sits on the words (an unusual screen)
            const sp = measure();
            const ok = !sp || isFree({ x: r.x, y: r.y }, r.s, sp, PAD);
            roam = { mode: 'hover', base: { x: r.x, y: r.y }, until: ok ? now + 2600 + Math.random() * 1800 : now, flight: null, t0: 0, dur: 0 };
          }
          if (roam.mode === 'hover' && now >= roam.until && !held) {
            const sp = measure();
            let f: Flight | null = null;
            if (sp) {
              if (isFree(roam.base, r.s, sp, PAD)) f = pickFlight(roam.base, r.s, sp, PAD);
              else {
                // its spot sits on the words (an unusual screen): move to the nearest open space
                const q = nearestFree(roam.base, r.s, sp, PAD);
                if (q) f = { from: roam.base, ctrl: { x: (roam.base.x + q.x) / 2, y: (roam.base.y + q.y) / 2 }, to: q };
              }
            }
            if (f) {
              const len = Math.hypot(f.ctrl.x - f.from.x, f.ctrl.y - f.from.y) + Math.hypot(f.to.x - f.ctrl.x, f.to.y - f.ctrl.y);
              const speed = Math.min(w, h) * 0.32; // px per second: unhurried
              roam.mode = 'fly';
              roam.flight = f;
              roam.t0 = now;
              roam.dur = clamp((len / speed) * 1000, 1500, 4200);
            } else roam.until = now + 1500;
          }
          if (roam.mode === 'fly' && roam.flight && held && (roam.flight.to.y > ctaLine ? 1 : -1) !== driftDir) {
            // scrolled mid-flight toward the other side of the words: settle where it is
            roam.mode = 'hover';
            roam.flight = null;
            roam.until = now;
          }
          if (roam.mode === 'fly' && roam.flight) {
            const f = roam.flight;
            const u = clamp((now - roam.t0) / roam.dur);
            const e = 0.5 - 0.5 * Math.cos(Math.PI * u); // eases out of the hover and back into it
            roam.base = bezier(f.from, f.ctrl, f.to, e);
            const v = bezierVelocity(f.from, f.ctrl, f.to, e);
            vx = v.x * ((0.5 * Math.PI * Math.sin(Math.PI * u)) / (roam.dur / 1000));
            flying = Math.sin(Math.PI * u);
            if (u >= 1) {
              roam.mode = 'hover';
              roam.flight = null;
              roam.until = now + 1800 + Math.random() * 2600;
            }
          }
          bx = roam.base.x;
          by = roam.base.y;
        }
        // a hovering wobble and a lean toward the pointer (kept inside PAD), calmer in flight
        const hover = a * (1 - 0.6 * flying);
        const x = bx + (Math.sin(t * 0.9) * 8 + pointer.x * 12) * hover;
        if (scroll < 1 || !driftDir) driftDir = (a < 1 ? r.y : by) > ctaLine ? 1 : -1;
        const y = by + (Math.sin(t * 1.4) * 6 + pointer.y * 7) * hover + driftDir * scroll * 0.35;
        const s = r.s * (arriving ? 0.35 + 0.65 * a : 0.5 + 0.5 * a);
        df.root.position.set(x - w / 2, h / 2 - y, 0);
        df.root.scale.setScalar(s);
        // dev only: lets the roaming test check every frame against the words
        if (import.meta.env.DEV) (window as unknown as { __heroRoam?: unknown }).__heroRoam = { x, y: y - driftDir * scroll * 0.35, drawnY: y, s, a, w, h, mode: roam?.mode ?? 'entry' };
        mat.uniforms.size.value = 22 * Math.min(window.devicePixelRatio || 1, 1.75) * Math.min(1, s / 240);
        // bank into the turns while roaming; the entry has its own swoop
        bank += (clamp(-vx / 600, -0.15, 0.15) - bank) * 0.08;
        const entryBank = (1 - a) * (arriving ? -0.4 : 0.6);
        df.root.rotation.set(
          -0.25 + Math.sin(t * 0.8) * 0.05 + pointer.y * 0.08,
          pointer.x * 0.2 + Math.sin(t * 0.6) * 0.1 + clamp(vx / 900, -0.1, 0.1),
          entryBank + bank,
        );
        df.opacity = clamp(1 - scroll / (h * 0.85)) * clamp((now - shownAt) / (handoff ? 550 : 300) + (reduce ? 1 : 0));
        df.glow = arriving && !reduce ? 1.4 * (1 - clamp((now - start) / 2200)) : 0;
        const effort = Math.max(1 - a, flying);
        if (!reduce) df.beat(dt, 3.4 + effort * 2.2, 0.32 + effort * 0.12);
        else df.beat(0, 0, 0);

        // shed light from the wings while flying, then only now and then
        const shed = a < 1 ? 0.9 : flying > 0.05 ? 0.3 + 0.4 * flying : handoff ? 0.08 : 0.15;
        if (!reduce && Math.random() < shed) emit(x - w / 2, h / 2 - y, s * 1.4);
        for (let i = 0; i < N; i++) {
          if (life[i] <= 0) {
            alpha[i] = 0;
            continue;
          }
          life[i] -= dt / 1.6;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          alpha[i] = Math.max(0, Math.sin(Math.PI * life[i])) * (df.root.visible ? 1 : 0);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.alpha.needsUpdate = true;
        renderer.render(scene, camera);
        // reduced motion: a still dragonfly, drawn for a moment (layout can still settle), then on resize or scroll only
        if (reduce && now - shownAt > 1200) cancelAnimationFrame(raf);
      };
      raf = requestAnimationFrame(frame);
      // reduced motion: redraw the still frame only when something changed (one loop at most)
      const onScroll = () => {
        if (reduce) redraw();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);

      cleanup = () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        io.disconnect();
        df.dispose();
        geo.dispose();
        mat.dispose();
        (mat.uniforms.map.value as THREE.Texture).dispose();
        renderer.dispose();
        // only once the canvas has left the page (a dev hot-reload re-runs effects on the same canvas)
      if (!canvas.isConnected) renderer.forceContextLoss();
      };
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [arriving]);

  return <canvas ref={ref} className="hero__dragonfly" aria-hidden="true" />;
}
