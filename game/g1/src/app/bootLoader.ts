// Registers the REAL work the boot sequence masks (brief §8 "honest
// loading"). Progress = completed weight / total; the loading beat waits for
// true readiness. Tasks are added here as slices land (ship geometry in 1C,
// hangar in 1D, cockpit compile in 1G).
import { WebGLRenderTarget, HalfFloatType, type WebGLRenderer, type Scene, type Camera } from 'three';
import { registerTask, whenDone } from '../core/loader';
import { loadDoorAssets } from '../scenes/shared/doors/doorAssets';
import { preloadShipGeometry } from '../ships/ShipFactory';
import { hasSpec } from '../ships/specs';
import { SHIP_IDS } from '../data/ships';
import { useProfile } from '../state/profile.store';
import { whenWorldMounted, whenContentReady } from '../scenes/sceneBridge';
import { AudioBus } from '../audio/AudioBus';
import { isPersistent } from '../state/storage';
import { useFlow, isBoot } from './flow';
import { stage } from '../scenes/Stage';
import { postfx } from '../render/fxController';

const FACES = [
  '900 64px "Big Shoulders Display"',
  '700 64px "Big Shoulders Display"',
  '500 16px "Oxanium"',
  '600 16px "Oxanium"',
  '700 16px "Oxanium"',
  '400 16px "JetBrains Mono"',
  '500 16px "JetBrains Mono"',
  '400 16px "IBM Plex Sans"',
  '500 16px "IBM Plex Sans"',
  '400 32px "Mr Dafoe"',
];

let registered = false;

export function registerBootTasks(): void {
  if (registered) return;
  registered = true;

  registerTask({
    id: 'fonts',
    weight: 1,
    run: async () => {
      await Promise.all(FACES.map(f => document.fonts.load(f)));
      await document.fonts.ready;
    },
  });

  registerTask({
    id: 'geometry',
    weight: 4,
    run: async () => {
      await whenDone('fonts'); // decal atlas renders stencil text
      await loadDoorAssets();
      // the selected ship (both LODs) gates the loader; the other five are
      // built after the boot sequence has handed over to the hangar, one per
      // idle slot, so their main-thread upload never lands in the door beat
      // (measured: 260 + 170 ms long tasks at 9.2 s when run after warm-up)
      const selected = useProfile.getState().selectedShip;
      await Promise.all([preloadShipGeometry(selected, 0), preloadShipGeometry(selected, 1)]);
      void whenHangar().then(async () => {
        for (const id of SHIP_IDS) {
          if (id === selected || !hasSpec(id)) continue;
          for (const lod of [0, 1] as const) {
            await idle();
            await preloadShipGeometry(id, lod);
          }
        }
      });
    },
  });

  registerTask({
    id: 'audio',
    weight: 1,
    run: async () => {
      AudioBus.init();
    },
  });

  registerTask({
    id: 'save',
    weight: 0.5,
    run: async () => {
      // save was hydrated synchronously before first render; this confirms
      // storage health for the SYS.CHECK row (in-memory fallback still = OK)
      void isPersistent();
    },
  });

  registerTask({
    id: 'shaders',
    weight: 3,
    run: async () => {
      await whenDone('geometry');
      // the hangar mounts in stages: wait for all of it, then two frames so
      // every lazily-created material is in the scene graph
      const { gl, scene, camera } = await whenContentReady();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await compileHdr(gl, scene, camera);
    },
  });

  registerTask({
    id: 'warmup',
    weight: 1,
    run: async () => {
      await whenDone('shaders');
      const { gl, scene, camera } = await whenWorldMounted();
      // 2) the real post chain (N8AO, DOF, shadow + instancing variants) sees
      //    the world for a few frames at exposure 0 — invisible under the
      //    black loading beat — so nothing compiles at the door reveal.
      // the floor switched to its reflector when 'shaders' finished: compile
      // that material (and anything else mounted since) off the main thread
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await compileHdr(gl, scene, camera);
      await new Promise<void>(resolve => {
        const ready = (s: string) => !isBoot(s as never) || s === 'boot.loading' || s === 'boot.doors';
        if (ready(useFlow.getState().state)) return resolve();
        const unsub = useFlow.subscribe(st => {
          if (ready(st.state)) {
            unsub();
            resolve();
          }
        });
      });
      // 1) one offscreen render: uploads every texture/buffer + shadow variants
      const rt = new WebGLRenderTarget(256, 144, { type: HalfFloatType });
      const prev = gl.getRenderTarget();
      const mask = camera.layers.mask;
      camera.layers.enableAll();
      gl.setRenderTarget(rt);
      gl.render(scene, camera);
      gl.setRenderTarget(prev);
      camera.layers.mask = mask;
      rt.dispose();
      if (isBoot(useFlow.getState().state) && stage.world < 0.5) {
        const exp = postfx.exposure;
        stage.world = 1;
        postfx.exposure = 0;
        for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
        stage.world = 0;
        postfx.exposure = exp;
      }
    },
  });
}

function whenHangar(): Promise<void> {
  return new Promise(resolve => {
    if (!isBoot(useFlow.getState().state)) return resolve();
    const unsub = useFlow.subscribe(st => {
      if (!isBoot(st.state)) {
        unsub();
        resolve();
      }
    });
  });
}

const idle = () =>
  new Promise<void>(resolve => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 1500 });
    else setTimeout(resolve, 200);
  });

/**
 * Parallel (KHR) compile of every layer's programs against an HDR target:
 * variants are keyed on the output colour space, and the world always renders
 * into the composer's linear HalfFloat buffer — compiling for the screen
 * (sRGB) produced the wrong variants and a 3.3 s synchronous recompile later.
 */
async function compileHdr(gl: WebGLRenderer, scene: Scene, camera: Camera): Promise<void> {
  const mask = camera.layers.mask;
  camera.layers.enableAll();
  const probe = new WebGLRenderTarget(4, 4, { type: HalfFloatType });
  const prevTarget = gl.getRenderTarget();
  gl.setRenderTarget(probe);
  const done = gl.compileAsync(scene, camera);
  gl.setRenderTarget(prevTarget);
  camera.layers.mask = mask;
  await done;
  probe.dispose();
}
