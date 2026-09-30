// Pilot bust renderer core (brief §13). DOM-free: runs inside bust.worker.ts
// on an OffscreenCanvas (preferred — its context creation, shader compile and
// 30 fps rendering never touch the main thread) or on the main thread as a
// fallback. Two scenes, each with its own lights; drawn into the two card
// slots with viewport + scissor. State arrives through `update()`.
import { AgXToneMapping, Color, DirectionalLight, HemisphereLight, PMREMGenerator, PerspectiveCamera, Scene, SpotLight, SRGBColorSpace, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildBust, type Bust } from './buildBust';
import { PILOT_SPECS } from './specs';

export type PilotId = 'onyx' | 'ember';
export type Rect = { x: number; y: number; w: number; h: number }; // canvas-local CSS px, y from top
export type BustState = {
  width: number;
  height: number;
  dpr: number;
  selected: PilotId;
  reduceMotion: boolean;
  pointer: { x: number; y: number } | null; // canvas-local CSS px
  rects: Partial<Record<PilotId, Rect>>;
  visible: boolean;
};

type Rig = { id: PilotId; bust: Bust; scene: Scene; cam: PerspectiveCamera; key: SpotLight; rim: DirectionalLight; hemi: HemisphereLight; yaw: number; pitch: number; lit: number };

const DEG = Math.PI / 180;
const IGNITION_KEY = new Color('#ffb080');
const NEUTRAL_KEY = new Color('#dfe6ff');

export type BustRenderer = { update(s: Partial<BustState>): void; frame(dtMs: number): void; tris(): Record<PilotId, number>; dispose(): void; ready: Promise<void> };

export function createBustRenderer(canvas: HTMLCanvasElement | OffscreenCanvas, initial: BustState): BustRenderer {
  const state: BustState = { ...initial };
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = AgXToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setScissorTest(true);
  const size = () => {
    renderer.setPixelRatio(state.dpr);
    renderer.setSize(state.width, state.height, false);
  };
  size();
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const rigs: Rig[] = (['onyx', 'ember'] as const).map(id => {
    const bust = buildBust(PILOT_SPECS[id]);
    const scene = new Scene();
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    scene.add(bust.root);
    bust.root.position.y = -0.02;
    const cam = new PerspectiveCamera(22, 1, 0.05, 20);
    // head + shoulders: crown ~12 % below the slot top, pauldrons in frame
    cam.position.set(0, 0.24, 2.3);
    cam.lookAt(0, 0.1, 0);
    const key = new SpotLight('#ffffff', 6, 0, 0.5, 0.7, 0);
    key.position.set(-0.9, 1.1, 1.3);
    key.target.position.set(0, 0.1, 0);
    const rim = new DirectionalLight('#7fd1ff', 1.6);
    rim.position.set(1.2, 0.6, -1.2);
    const hemi = new HemisphereLight('#2a3268', '#050608', 0.6);
    scene.add(key, key.target, rim, hemi);
    return { id, bust, scene, cam, key, rim, hemi, yaw: 0, pitch: 0, lit: 1 };
  });

  // parallel (KHR) compile before the first draw: no synchronous links
  let compiled = false;
  const ready = Promise.all(rigs.map(r => renderer.compileAsync(r.scene, r.cam))).then(() => {
    compiled = true;
  });

  let t = 0, acc = 0;
  return {
    ready,
    update(s) {
      const resized = (s.width !== undefined && s.width !== state.width) || (s.height !== undefined && s.height !== state.height) || (s.dpr !== undefined && s.dpr !== state.dpr);
      Object.assign(state, s);
      if (resized) size();
    },
    frame(dtMs) {
      acc += dtMs;
      if (acc < 33) return; // ~30 fps
      const dt = Math.min(acc / 1000, 0.1);
      acc = 0;
      t += dt;
      if (!compiled || !state.visible) return;
      const still = state.reduceMotion;
      for (const r of rigs) {
        const sr = state.rects[r.id];
        if (!sr || sr.w < 2 || sr.h < 2) continue;
        const sel = state.selected === r.id;
        // lighting: Ignition key on the selected pilot, the other at ~35 %
        r.lit += ((sel ? 1 : 0.35) - r.lit) * Math.min(1, dt * 6);
        r.key.color.copy(sel ? IGNITION_KEY : NEUTRAL_KEY);
        r.key.intensity = 6 * r.lit;
        r.rim.intensity = 1.6 * (0.4 + 0.6 * r.lit);
        r.hemi.intensity = 0.6 * r.lit;
        r.scene.environmentIntensity = 0.35 * r.lit;
        r.bust.visorMat.emissiveIntensity = sel ? 0.45 : 0;
        if (sel && !still) r.bust.hudTex.offset.y = (t * 0.06) % 1;
        // head: micro turns + pointer tracking (+-12 deg) on hover + face the camera when selected
        const p = state.pointer;
        const hover = !!p && p.x >= sr.x && p.x <= sr.x + sr.w && p.y >= sr.y && p.y <= sr.y + sr.h;
        let ty = sel ? 0 : r.id === 'onyx' ? -0.28 : 0.28;
        let tp = sel ? 0 : 0.06;
        if (hover && p && !still) {
          ty = ((p.x - (sr.x + sr.w / 2)) / (sr.w / 2)) * 12 * DEG;
          tp = ((p.y - (sr.y + sr.h / 2)) / (sr.h / 2)) * 12 * DEG;
        }
        if (!still) {
          ty += Math.sin(t * 0.43 + (r.id === 'onyx' ? 0 : 2)) * 2.2 * DEG + Math.sin(t * 1.1) * 0.6 * DEG;
          tp += Math.sin(t * 0.57 + 1) * 1.4 * DEG;
        }
        const k = Math.min(1, dt * 5);
        r.yaw += (ty - r.yaw) * k;
        r.pitch += (tp - r.pitch) * k;
        r.bust.head.rotation.set(r.pitch, r.yaw, 0);
        r.bust.torso.rotation.y = r.yaw * 0.25;
        // breathing: chest +-0.6 % @ 0.25 Hz
        const b = still ? 1 : 1 + Math.sin(t * Math.PI * 2 * 0.25) * 0.006;
        const [bx, by, bz] = (r.bust.torso.userData.base as number[]) ?? [1, 1, 1];
        r.bust.torso.scale.set(bx * b, by * b, bz * b);
        r.bust.head.position.y = 0.32 + (b - 1) * 0.8;
        // viewport = the slot rect (GL origin bottom-left)
        const x = sr.x, y = state.height - sr.y - sr.h;
        renderer.setViewport(x, y, sr.w, sr.h);
        renderer.setScissor(x, y, sr.w, sr.h);
        r.cam.aspect = sr.w / sr.h;
        r.cam.updateProjectionMatrix();
        renderer.render(r.scene, r.cam);
      }
    },
    tris: () => ({ onyx: rigs[0].bust.tris, ember: rigs[1].bust.tris }),
    dispose() {
      rigs.forEach(r => r.bust.dispose());
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
