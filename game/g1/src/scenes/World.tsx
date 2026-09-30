// The persistent 3D world content: the hangar (bay, deck, pad, ship) + the
// bay's pressure doors at the entrance. Camera/post live in <Stage/>.
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { StudioEnvironment } from '../render/env/StudioEnvironment';
import { StudioLights } from '../render/env/StudioLights';
import { BlastDoors } from './shared/BlastDoors';
import { LookdevContent } from './LookdevContent';
import { Hangar } from './hangar/Hangar';
import { useUi } from '../state/ui.store';
import { useProfile } from '../state/profile.store';
import { QUERY, DEBUG } from '../core/constants';
import { isShipId } from '../data/ships';
import { bootDoors, DOOR_Z, markWorldMounted, markContentReady } from './sceneBridge';
import { useSettings } from '../state/settings.store';
import { usePerf, resolveQuality } from '../render/perf';
import { registerDebug } from '../debug/debugApi';

export function World() {
  const graphics = useSettings(s => s.graphics);
  const reduceFlashing = useSettings(s => s.accessibility.reduceFlashing);
  const reduceMotion = useSettings(s => s.accessibility.reduceMotion);
  const degrade = usePerf(s => s.degrade);
  const selected = useProfile(s => s.selectedShip);
  const viewed = useUi(s => s.viewedShip);
  // ?debug=1&ship=<id>: QA display override (never written to the save)
  const forced = DEBUG ? QUERY.get('ship') : null;
  const shipId = forced && isShipId(forced) ? forced : (viewed ?? selected);
  const q = resolveQuality(graphics, degrade);
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  useEffect(() => {
    performance.mark('world:mounted');
    markWorldMounted({ gl, scene, camera });
    if (QUERY.get('screen') === 'lookdev') markContentReady(); // no staged hangar there
    registerDebug('world', { scene: () => scene });
  }, [gl, scene, camera]);
  return (
    <>
      <StudioEnvironment />
      <StudioLights shadowMapSize={q.shadowMap} />
      {QUERY.get('screen') === 'lookdev' ? <LookdevContent /> : <Hangar shipId={shipId} q={q} reduceMotion={reduceMotion} />}
      <BlastDoors controller={bootDoors} position={[0, 0, DOOR_Z]} particles={q.particles} reduceFlashing={reduceFlashing} reduceMotion={reduceMotion} />
      <fog attach="fog" args={['#04050A', 40, 110]} />
    </>
  );
}
