// Registers the REAL work the boot sequence masks (brief §8 "honest
// loading"). Progress = completed weight / total; the loading beat waits for
// true readiness. Tasks are added here as slices land (ship geometry in 1C,
// hangar in 1D, cockpit compile in 1G).
import { WebGLRenderTarget, HalfFloatType } from 'three';
import { registerTask, whenDone } from '../core/loader';
import { loadDoorAssets } from '../scenes/shared/doors/doorAssets';
import { whenWorldMounted } from '../scenes/sceneBridge';
import { AudioBus } from '../audio/AudioBus';
import { isPersistent } from '../state/storage';

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
      const { gl, scene, camera } = await whenWorldMounted();
      // two frames so every lazily-created material is in the scene graph
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      // the boot beats render only the FX layer: open every layer for the compile
      const mask = camera.layers.mask;
      camera.layers.enableAll();
      await gl.compileAsync(scene, camera);
      camera.layers.mask = mask;
    },
  });

  registerTask({
    id: 'warmup',
    weight: 1,
    run: async () => {
      await whenDone('shaders');
      const { gl, scene, camera } = await whenWorldMounted();
      // one offscreen render under the black cover: uploads every texture and
      // buffer so the first visible hangar frame has no hitch
      const rt = new WebGLRenderTarget(256, 144, { type: HalfFloatType });
      const prev = gl.getRenderTarget();
      const mask = camera.layers.mask;
      camera.layers.enableAll();
      gl.setRenderTarget(rt);
      gl.render(scene, camera);
      gl.setRenderTarget(prev);
      camera.layers.mask = mask;
      rt.dispose();
    },
  });
}
