// The persistent 3D world content: the hangar (bay, deck, pad, ship), the
// bay's pressure doors at the entrance, the launch bulkhead (camera-attached)
// and the cockpit (mounted during hangar idle). Camera/post live in <Stage/>.
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { StudioEnvironment } from '../render/env/StudioEnvironment';
import { StudioLights } from '../render/env/StudioLights';
import { BlastDoors } from './shared/BlastDoors';
import { LookdevContent } from './LookdevContent';
import { Hangar } from './hangar/Hangar';
import { Bulkhead } from './cockpit/Bulkhead';
import { Cockpit, CockpitLights } from './cockpit/Cockpit';
import { MissionDriver } from './mission/MissionDriver';
import { MissionHudDriver } from './mission/MissionHudDriver';
import { WorldLab } from './worldlab/WorldLab';
import { useUi } from '../state/ui.store';
import { useProfile } from '../state/profile.store';
import { QUERY, DEBUG } from '../core/constants';
import { isShipId } from '../data/ships';
import { bootDoors, DOOR_Z, markWorldMounted, markContentReady, cockpitMount } from './sceneBridge';
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
  // ?debug=1&ship=<id>: QA display override — the real ship even if locked,
  // never written to the save (plain ?ship= is a deep link, see startParams)
  const forced = DEBUG ? QUERY.get('ship') : null;
  const shipId = forced && isShipId(forced) ? forced : (viewed ?? selected);
  const q = resolveQuality(graphics, degrade);
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const lookdev = QUERY.get('screen') === 'lookdev';
  // Phase 2R look-dev: a world on its own (no hangar / cockpit / mission)
  const worldlab = QUERY.get('screen') === 'worldlab';
  const [cockpitOn, setCockpitOn] = useState(cockpitMount.wanted);
  useEffect(() => cockpitMount.subscribe(() => setCockpitOn(true)), []);
  useEffect(() => {
    performance.mark('world:mounted');
    markWorldMounted({ gl, scene, camera });
    if (lookdev || worldlab) markContentReady(); // no staged hangar there
    registerDebug('world', { scene: () => scene });
  }, [gl, scene, camera, lookdev, worldlab]);
  if (worldlab)
    return (
      <>
        <StudioLights shadowMapSize={q.shadowMap} />
        <CockpitLights />
        <WorldLab />
      </>
    );
  return (
    <>
      <StudioEnvironment />
      <StudioLights shadowMapSize={q.shadowMap} />
      <CockpitLights />
      {lookdev ? <LookdevContent /> : <Hangar shipId={shipId} forceUnlocked={!!forced} q={q} reduceMotion={reduceMotion} reduceFlashing={reduceFlashing} />}
      <BlastDoors controller={bootDoors} position={[0, 0, DOOR_Z]} particles={q.particles} reduceFlashing={reduceFlashing} reduceMotion={reduceMotion} />
      {!lookdev && <Bulkhead reduceMotion={reduceMotion} />}
      {!lookdev && cockpitOn && <Cockpit reduceMotion={reduceMotion} />}
      {!lookdev && <MissionDriver />}
      {!lookdev && <MissionHudDriver />}
      <fog attach="fog" args={['#04050A', 40, 110]} />
    </>
  );
}
