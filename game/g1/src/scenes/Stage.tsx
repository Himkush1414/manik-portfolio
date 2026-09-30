// Everything inside the canvas: camera director, the post stack, the boot FX
// layer and (once its geometry exists) the World. `stage.world` is a TWEENED
// value (0 = camera sees only the boot-FX layer, 1 = full world) so seeking
// the boot timeline renders the right layer mask without callbacks.
import { useFrame } from '@react-three/fiber';
import { CameraDirector, director, BOOT_FX_POS } from '../render/cameraDirector';
import { PostFX } from '../render/PostFX';
import { BootFX } from './boot/BootFX';
import { BOOT_LAYER, bootFx } from './boot/bootFxParams';
import { World } from './World';
import { useLoader } from '../core/loader';
import { useSettings } from '../state/settings.store';
import { usePerf, resolveQuality } from '../render/perf';

export const stage = { world: 0 };

function LayerMask() {
  useFrame(({ camera }) => {
    if (stage.world >= 0.5) camera.layers.enableAll();
    else camera.layers.set(BOOT_LAYER);
  }, -2);
  return null;
}

export function Stage() {
  const geometryReady = useLoader(s => s.completed.includes('geometry'));
  const graphics = useSettings(s => s.graphics);
  const reduceMotion = useSettings(s => s.accessibility.reduceMotion);
  const degrade = usePerf(s => s.degrade);
  const q = resolveQuality(graphics, degrade);
  return (
    <>
      <LayerMask />
      <CameraDirector />
      <BootFX position={BOOT_FX_POS} particles={q.particles} reduceMotion={reduceMotion} />
      {geometryReady && <World />}
      <PostFX ao dofTarget={director.focus} dofRange={12} />
    </>
  );
}

export function isBootFxLive(): boolean {
  return bootFx.opacity > 0.001;
}
