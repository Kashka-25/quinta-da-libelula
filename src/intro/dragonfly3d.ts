// Both Meshy dragonflies, rendered live for the intro.
// The canvas engine decides where they are (a Pose in screen pixels); this layer
// draws the real model there, and gives the engine snapshots so the melt starts
// from exactly what the visitor saw, and the pigment re-forms into the reborn.
import * as THREE from 'three';
import { Dragonfly, MODELS, makeRenderer, preload } from '../three/dragonflyModel';
import type { Pose } from './dragonfly';

export type Which = 'original' | 'reborn';

export interface DrawOptions {
  which?: Which;
  glow?: number;
}

export interface DragonflyRenderer {
  readonly canvas: HTMLCanvasElement;
  draw(pose: Pose, alpha: number, dt: number, opts?: DrawOptions): void;
  /** resolves when the reborn dragonfly is ready to draw (false if it failed) */
  reborn(): Promise<boolean>;
  clear(): void;
  dispose(): void;
}

export async function createDragonfly3D(canvas: HTMLCanvasElement, isCancelled: () => boolean = () => false): Promise<DragonflyRenderer | null> {
  const source = await preload(MODELS.original);
  // the intro may have gone (or re-mounted) while the model loaded: never take its canvas
  if (isCancelled()) return null;
  const { renderer, scene } = makeRenderer(canvas, { preserve: true });
  const models: Partial<Record<Which, Dragonfly>> = { original: new Dragonfly(source, { wingAlpha: 0.7 }) };
  scene.add(models.original!.root);
  const FOV = 28;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 20000);
  let w = 0;
  let h = 0;
  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // one world unit = one CSS pixel on the z=0 plane
    camera.position.set(0, 0, h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  // compile the shaders now, so the first frame the visitor sees isn't a stall
  renderer.compile(scene, camera);

  let rebornReady: Promise<boolean> | null = null;
  const reborn = () => {
    if (!rebornReady) {
      rebornReady = preload(MODELS.reborn)
        .then((src) => {
          const df = new Dragonfly(src, { wingAlpha: 0.72 });
          df.opacity = 0;
          models.reborn = df;
          scene.add(df.root);
          renderer.compile(scene, camera);
          return true;
        })
        .catch(() => false);
    }
    return rebornReady;
  };
  reborn();

  return {
    canvas,
    reborn,
    draw(pose, alpha, dt, opts = {}) {
      const which = opts.which ?? 'original';
      for (const [k, m] of Object.entries(models)) if (k !== which && m) m.opacity = 0;
      const df = models[which];
      if (!df) return;
      df.opacity = alpha;
      df.glow = opts.glow ?? 0;
      df.root.position.set(pose.x - w / 2, h / 2 - pose.y, 0);
      df.root.scale.setScalar(pose.s);
      const t = pose.t / 1000;
      df.root.rotation.set(-0.22 + Math.sin(t * 0.9) * 0.05, Math.sin(t * 0.7) * 0.12, -pose.rot);
      // brisk wings while it flies in, a slow shimmering hover once it settles
      const settle = Math.min(1, Math.max(0, (pose.t - 1600) / 1400));
      df.beat(dt, 5.2 - 2.0 * settle, 0.55 - 0.22 * settle);
      renderer.render(scene, camera);
    },
    clear() {
      for (const m of Object.values(models)) if (m) m.opacity = 0;
      renderer.clear();
    },
    dispose() {
      window.removeEventListener('resize', resize);
      for (const m of Object.values(models)) m?.dispose();
      renderer.dispose();
      // browsers cap live WebGL contexts (~16): give this one back now, not at garbage collection
      // only once the canvas has left the page (a dev hot-reload re-runs effects on the same canvas)
      if (!canvas.isConnected) renderer.forceContextLoss();
    },
  };
}
