// The original Meshy dragonfly, rendered live for the melting intro.
// The canvas engine decides where it is (a Pose in screen pixels); this layer
// draws the real model there, and gives the engine a snapshot of itself so the
// melt starts from exactly what the visitor saw.
import * as THREE from 'three';
import { Dragonfly, MODELS, makeRenderer, preload } from '../three/dragonflyModel';
import type { Pose } from './dragonfly';

export interface DragonflyRenderer {
  readonly canvas: HTMLCanvasElement;
  draw(pose: Pose, alpha: number, dt: number): void;
  clear(): void;
  dispose(): void;
}

export async function createDragonfly3D(canvas: HTMLCanvasElement): Promise<DragonflyRenderer> {
  const source = await preload(MODELS.original);
  const { renderer, scene } = makeRenderer(canvas, { preserve: true });
  const df = new Dragonfly(source, { wingAlpha: 0.7 });
  scene.add(df.root);
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

  return {
    canvas,
    draw(pose, alpha, dt) {
      df.opacity = alpha;
      df.root.position.set(pose.x - w / 2, h / 2 - pose.y, 0);
      df.root.scale.setScalar(pose.s);
      const t = pose.t / 1000;
      df.root.rotation.set(-0.22 + Math.sin(t * 0.9) * 0.05, Math.sin(t * 0.7) * 0.12, -pose.rot);
      // brisk wings while it flies in, a slow shimmering hover once it settles
      const settle = Math.min(1, Math.max(0, (pose.t - 1600) / 1400));
      df.beat(dt, 5.2 - 2.2 * settle, 0.55 - 0.2 * settle);
      renderer.render(scene, camera);
    },
    clear() {
      renderer.clear();
    },
    dispose() {
      window.removeEventListener('resize', resize);
      df.dispose();
      renderer.dispose();
    },
  };
}
