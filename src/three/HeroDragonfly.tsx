import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Dragonfly, MODELS, makeRenderer, preload, webglOK } from './dragonflyModel';

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
 * out of the light into the homepage, trailing gold, and stays hovering in the
 * hero, leaning toward the pointer. It drifts away as the visitor scrolls on.
 */
export default function HeroDragonfly({ arriving: arrivingProp }: { arriving: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // how it enters is decided once, when the homepage first appears
  const arriving = useRef(arrivingProp).current;

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
      const resize = () => {
        const host = canvas.parentElement!;
        w = host.clientWidth;
        h = host.clientHeight;
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

      const rest = () => {
        const wide = w >= 900;
        return wide
          ? { x: w * 0.76, y: h * 0.4, s: Math.min(w * 0.17, h * 0.32) }
          : { x: w * 0.5, y: h * 0.13, s: Math.min(w * 0.22, h * 0.12) };
      };
      const start = performance.now();
      const FLY = arriving ? 2600 : 3200;
      let last = start;
      let visible = true;
      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
      io.observe(canvas);

      const frame = (now: number) => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        if (!visible || document.hidden) {
          last = now;
          return;
        }
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = reduce ? 99 : (now - start) / 1000;
        const r = rest();
        const a = reduce ? 1 : ease(clamp((now - start) / FLY));
        // from the heart of the light (arriving) or from beyond the trees (direct visit)
        const fromX = arriving ? w * 0.5 : w * 1.1;
        const fromY = arriving ? h * 0.5 : -h * 0.15;
        pointer.x += (pointer.tx - pointer.x) * 0.03;
        pointer.y += (pointer.ty - pointer.y) * 0.03;
        const hover = a;
        const x = fromX + (r.x - fromX) * a + Math.sin(a * Math.PI) * w * 0.06 + (Math.sin(t * 0.9) * 10 + pointer.x * 18) * hover;
        const scroll = window.scrollY;
        const y = fromY + (r.y - fromY) * a - Math.sin(a * Math.PI) * h * 0.08 + (Math.sin(t * 1.4) * 8 + pointer.y * 10) * hover - scroll * 0.35;
        const s = r.s * (arriving ? 0.35 + 0.65 * a : 0.5 + 0.5 * a);
        df.root.position.set(x - w / 2, h / 2 - y, 0);
        df.root.scale.setScalar(s);
        mat.uniforms.size.value = 22 * Math.min(window.devicePixelRatio || 1, 1.75) * Math.min(1, s / 240);
        const bank = (1 - a) * (arriving ? -0.4 : 0.6);
        df.root.rotation.set(-0.25 + Math.sin(t * 0.8) * 0.05 + pointer.y * 0.08, pointer.x * 0.2 + Math.sin(t * 0.6) * 0.1, bank);
        df.opacity = clamp(1 - scroll / (h * 0.85)) * clamp((now - start) / 300 + (reduce ? 1 : 0));
        df.glow = arriving ? 1.4 * (1 - clamp((now - start) / 2200)) : 0;
        if (!reduce) df.beat(dt, 3.4 + (1 - a) * 2.2, 0.32 + (1 - a) * 0.12);
        else df.beat(0, 0, 0);

        // shed light from the wings while flying, then only now and then
        if (!reduce && Math.random() < (a < 1 ? 0.9 : 0.15)) emit(x - w / 2, h / 2 - y, s * 1.4);
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
        if (reduce && now - start > 1200) cancelAnimationFrame(raf);
      };
      raf = requestAnimationFrame(frame);
      const onScroll = () => reduce && requestAnimationFrame(frame);
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
        renderer.dispose();
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
