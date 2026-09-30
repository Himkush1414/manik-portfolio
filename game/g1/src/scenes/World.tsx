// The persistent 3D world content: bay (lookdev stand-in until 1D) + the
// bay's pressure doors at the entrance. Camera/post live in <Stage/>.
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { StudioEnvironment } from '../render/env/StudioEnvironment';
import { StudioLights } from '../render/env/StudioLights';
import { BlastDoors } from './shared/BlastDoors';
import { LookdevContent } from './LookdevContent';
import { ShipDisplay } from './hangar/ShipDisplay';
import { useProfile } from '../state/profile.store';
import { QUERY } from '../core/constants';
import { bootDoors, DOOR_Z, markWorldMounted } from './sceneBridge';
import { useSettings } from '../state/settings.store';
import { usePerf, resolveQuality } from '../render/perf';
import { registerDebug } from '../debug/debugApi';

export function World() {
  const graphics = useSettings(s => s.graphics);
  const reduceFlashing = useSettings(s => s.accessibility.reduceFlashing);
  const reduceMotion = useSettings(s => s.accessibility.reduceMotion);
  const degrade = usePerf(s => s.degrade);
  const q = resolveQuality(graphics, degrade);
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  useEffect(() => {
    performance.mark('world:mounted');
    markWorldMounted({ gl, scene, camera });
    registerDebug('world', { scene: () => scene });
  }, [gl, scene, camera]);
  return (
    <>
      <StudioEnvironment />
      <StudioLights shadowMapSize={q.shadowMap} />
      {QUERY.get('screen') === 'lookdev' ? <LookdevContent /> : <ShipStage />}
      <BlastDoors controller={bootDoors} position={[0, 0, DOOR_Z]} particles={q.particles} reduceFlashing={reduceFlashing} reduceMotion={reduceMotion} />
      <fog attach="fog" args={['#04050A', 30, 90]} />
    </>
  );
}

/** Temporary bay floor + pad ring until the hangar lands (1D). */
function ShipStage() {
  const shipId = useProfile(s => s.selectedShip);
  return (
    <>
      <ShipDisplay shipId={shipId} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[60, 96]} />
        <meshPhysicalMaterial color="#06080d" metalness={0.1} roughness={0.78} />
      </mesh>
    </>
  );
}
