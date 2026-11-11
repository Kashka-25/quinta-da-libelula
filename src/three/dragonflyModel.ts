// The Meshy dragonflies, live in the browser.
//
// The GLBs are made by blender/scripts/export_web_models.py: decimated, Draco
// compressed, with the film's auto-rig (wing_F/H.L/R, abdomen, head) and a
// `_wing` mask (0 body .. 1 wing). Exported Y-up: head toward +Y, wings along X,
// the back facing +Z (toward a default camera).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL;
export const MODELS = {
  original: `${BASE}models/dragonfly-original.glb`,
  reborn: `${BASE}models/dragonfly-reborn.glb`,
};

let loader: GLTFLoader | null = null;
const cache = new Map<string, Promise<THREE.Group>>();

function getLoader() {
  if (!loader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${BASE}draco/`);
    draco.setDecoderConfig({ type: 'wasm' });
    draco.preload(); // fetch and compile the decoder while the model downloads
    loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
  }
  return loader;
}

/** Start fetching early (the intro calls this so the reborn is ready by the homepage). */
export function preload(url: string) {
  if (!cache.has(url)) {
    cache.set(
      url,
      getLoader()
        .loadAsync(url)
        .then((g) => g.scene),
    );
  }
  return cache.get(url)!;
}

const WINGS = ['wingFL', 'wingFR', 'wingHL', 'wingHR'] as const;
type WingName = (typeof WINGS)[number];
const key = (n: string) => n.replace(/[^a-z]/gi, '');

export interface WingPose {
  /** flap angle in radians (already multiplied by the beat) */
  flap: number;
  /** 0 open .. 1 folded close along the body */
  fold: number;
}

export class Dragonfly {
  /** pivot: body length 1, head 0.42 above the origin (matches the 2D intro's dragonfly) */
  readonly root = new THREE.Group();
  private wings = new Map<WingName, { bone: THREE.Bone; q0: THREE.Quaternion; qm: THREE.Quaternion; side: number; hind: boolean }>();
  private materials: THREE.MeshPhysicalMaterial[] = [];
  private uniforms = { uWingAlpha: { value: 0.6 }, uOpacity: { value: 1 } };
  private phase: Record<WingName, number> = { wingFL: -Math.PI / 2, wingFR: -Math.PI / 2 + 0.2, wingHL: 0, wingHR: 0.15 };

  constructor(source: THREE.Group, opts: { wingAlpha?: number } = {}) {
    // skinned meshes must be cloned with their skeleton, or they stay bound to the original bones
    const model = cloneSkinned(source) as THREE.Group;
    this.uniforms.uWingAlpha.value = opts.wingAlpha ?? 0.62;
    // normalise: Meshy models are ~0.94 long from tail to head
    const box = new THREE.Box3().setFromObject(model);
    const len = box.max.y - box.min.y;
    const s = 1 / len;
    model.scale.setScalar(s);
    model.position.y = 0.42 - box.max.y * s;
    this.root.add(model);
    this.root.updateMatrixWorld(true);

    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        const k = key(o.name) as WingName;
        if ((WINGS as readonly string[]).includes(k)) {
          const bone = o as THREE.Bone;
          const qm = new THREE.Quaternion();
          bone.getWorldQuaternion(qm);
          this.wings.set(k, { bone, q0: bone.quaternion.clone(), qm, side: k.endsWith('L') ? -1 : 1, hind: k.startsWith('wingH') });
        }
      }
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = false;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const m = new THREE.MeshPhysicalMaterial({
          map: src.map,
          normalMap: src.normalMap,
          metalnessMap: src.metalnessMap,
          roughnessMap: src.roughnessMap,
          metalness: src.metalness,
          roughness: src.roughness,
          side: THREE.DoubleSide,
          transparent: true,
          iridescence: 0.9,
          iridescenceIOR: 1.38,
          iridescenceThicknessRange: [240, 620],
          clearcoat: 0.5,
          clearcoatRoughness: 0.15,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: src.map,
          emissiveIntensity: 0.08,
          envMapIntensity: 1.1,
        });
        const u = this.uniforms;
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uWingAlpha = u.uWingAlpha;
          sh.uniforms.uOpacity = u.uOpacity;
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float _wing;\nvarying float vWing;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWing = _wing;');
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vWing;\nuniform float uWingAlpha;\nuniform float uOpacity;')
            .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\ndiffuseColor.a *= mix(1.0, uWingAlpha, vWing) * uOpacity;');
        };
        mesh.material = m;
        this.materials.push(m);
      }
    });
  }

  set opacity(v: number) {
    this.uniforms.uOpacity.value = v;
    this.root.visible = v > 0.001;
  }

  /** inner light: 0 is the texture as made, higher glows (used for the reborn's arrival) */
  set glow(v: number) {
    for (const m of this.materials) m.emissiveIntensity = 0.08 + v;
  }

  /** advance the four wings; hind wings lead the fore wings by a quarter beat */
  beat(dt: number, freq: number, amp: number, fold = 0, foldBack = 0) {
    const axisFlap = new THREE.Vector3(0, 1, 0);
    const axisBack = new THREE.Vector3(0, 0, 1);
    const axisIn = new THREE.Vector3(0, 1, 0);
    for (const [name, w] of this.wings) {
      this.phase[name] += Math.PI * 2 * freq * dt * (w.hind ? 1 : 1.02);
      const flap = Math.sin(this.phase[name]) * amp;
      const a = new THREE.Quaternion().setFromAxisAngle(axisFlap, w.side * flap - w.side * fold * (w.hind ? 0.5 : 0.65));
      const b = new THREE.Quaternion().setFromAxisAngle(axisBack, w.side * foldBack * (w.hind ? 1.2 : 1.0));
      const c = new THREE.Quaternion().setFromAxisAngle(axisIn, 0);
      const A = b.multiply(a).multiply(c);
      // local = q0 * qm^-1 * A * qm  (rotate about model-space axes through the wing root)
      const q = w.q0.clone().multiply(w.qm.clone().invert()).multiply(A).multiply(w.qm);
      w.bone.quaternion.copy(q);
    }
  }

  dispose() {
    for (const m of this.materials) m.dispose();
  }
}

/** A renderer with soft studio reflections and morning light that suits the iridescence. */
export function makeRenderer(canvas: HTMLCanvasElement, opts: { preserve?: boolean } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffe2b8, 2.2);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0x9fe3e6, 1.6);
  rim.position.set(-3, 1.5, -2);
  const fill = new THREE.HemisphereLight(0xe8dcff, 0x1f2e22, 0.6);
  scene.add(key, rim, fill);
  return { renderer, scene };
}

let glProbe: boolean | null = null;

/** Is WebGL 2 usable here? (Probed once; the probe's context is released straight away.) */
export function webglOK() {
  if (glProbe !== null) return glProbe;
  try {
    const c = document.createElement('canvas');
    // three r170 renders with WebGL 2 only
    const gl = c.getContext('webgl2');
    glProbe = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    glProbe = false;
  }
  return glProbe;
}
