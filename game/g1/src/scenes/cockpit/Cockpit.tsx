// The cockpit (brief §15): interior + launch tunnel + the own ship (mirror
// layer only) + three live mirrors, at COCKPIT_ORIGIN. Mounted during hangar
// idle and pre-compiled (compileAsync, HDR target) so the reveal never
// hitches; visible only while stage.cockpit is on (the swap happens behind
// the sealed bulkhead). While visible it owns the camera: the pilot's eyes,
// breathing + tiny head-bob noise, FOV from Settings > Camera.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DirectionalLight, Fog, Object3D, PointLight, Vector3, type Group } from 'three';
import { buildCockpit } from './buildCockpit';
import { createDisplays, cockpitFx } from './displays';
import { LaunchTunnel } from './LaunchTunnel';
import { Mirrors } from './Mirrors';
import { bulkhead } from './Bulkhead';
import { EYE_PITCH } from './cockpitSpec';
import { ShipFactory } from '../../ships/ShipFactory';
import { SPECS } from '../../ships/specs';
import { SHIPS } from '../../data/ships';
import { liveriesFor, clampLivery } from '../../data/liveries';
import { useProfile } from '../../state/profile.store';
import { useSettings } from '../../state/settings.store';
import { COCKPIT_ORIGIN, MIRROR_LAYER, cockpitMount } from '../sceneBridge';
import { stage } from '../Stage';
import { director } from '../../render/cameraDirector';
import { compileSteps } from '../../render/compileSliced';
import { runSliced } from '../../core/slicer';
import { peekCockpit, releaseCockpit } from './cockpitPrebuild';
import { registerDebug } from '../../debug/debugApi';
import { QUALITY } from '../../render/quality';

const ORIGIN = new Vector3(...COCKPIT_ORIGIN);
const FOG_HANGAR = [40, 110] as const;
const FOG_COCKPIT = [30, 300] as const;
const tmp = new Vector3();

export function Cockpit({ reduceMotion }: { reduceMotion: boolean }) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const shipId = useProfile(p => p.selectedShip);
  const pilot = useProfile(p => p.pilot);
  const livery = useProfile(p => clampLivery(p.selectedShip, p.liveryByShip[p.selectedShip] ?? 0));
  const mirrorQ = QUALITY[useSettings(s => s.graphics.preset)].mirror;
  const root = useRef<Group | null>(null);
  const [rootObj, setRootObj] = useState<Group | null>(null);
  // stable ref callback: an inline one is re-called (null, el) on every render,
  // which flipped rootObj and re-ran everything parented to it
  const setRoot = useCallback((el: Group | null) => {
    root.current = el;
    setRootObj(el);
  }, []);

  const variant = SHIPS[shipId].cockpit;
  // the hangar pre-warm builds these in idle slices (cockpitPrebuild.ts);
  // building them here, inside the mount commit, was a ~60 ms task
  const pre = peekCockpit(variant);
  const displays = useMemo(() => pre?.displays ?? createDisplays(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => displays.dispose(), [displays]);
  const built = useMemo(() => {
    const p = peekCockpit(variant);
    return p && p.displays === displays ? p.built : buildCockpit(variant, displays);
  }, [variant, displays]);
  useEffect(() => {
    releaseCockpit(peekCockpit(variant));
    return () => built.dispose();
  }, [built, variant]);

  // the flown ship around the pilot, visible ONLY in the mirrors (tail fins,
  // engine glow): its canopy centre sits on the eye
  const own = useMemo(() => {
    const s = ShipFactory.build(shipId, { livery, lod: 0 });
    s.group.traverse(o => o.layers.set(MIRROR_LAYER));
    const c = SPECS[shipId].canopy;
    const ey = c.y + c.h * 0.55, ez = (c.z0 + c.z1) / 2;
    s.group.rotation.y = Math.PI; // ship nose is +z; cockpit forward is -z
    s.group.position.set(0, -ey, ez);
    s.setEngineLevel(0.3);
    return s;
  }, [shipId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => own.dispose(), [own]);
  useEffect(() => {
    own.setLivery(livery, false);
    built.setAccent(liveriesFor(shipId)[livery].accent);
  }, [own, built, livery, shipId]);
  useEffect(() => {
    displays.setShip(SPECS[shipId]);
    cockpitFx.shipName = SHIPS[shipId].name;
  }, [displays, shipId]);
  useEffect(() => built.setGloveTrim(pilot === 'ember' ? '#ff5a1f' : '#8c9ac0'), [built, pilot]);

  // pre-warm: compile every cockpit program + upload its textures in idle
  // slices (render/compileSliced.ts; one compileHdr was a ~45 ms task), then
  // report ready
  useEffect(() => {
    let live = true;
    const r = root.current;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!live || !r) return;
        void runSliced('cockpit:compile', compileSteps(gl, [r], camera, scene)).then(
          () => live && cockpitMount.markReady(),
          () => live && cockpitMount.markReady(), // failure logged by the slicer; never block the launch
        );
      }),
    );
    registerDebug('cockpit', { tris: () => built.tris, variant: () => variant });
    return () => {
      live = false;
    };
  }, [gl, scene, camera, built, variant]);

  useFrame(state => {
    const g = root.current;
    if (!g) return;
    const on = stage.cockpit >= 0.5;
    g.visible = on;
    const fog = scene.fog as Fog | null;
    if (fog) {
      fog.near = on ? FOG_COCKPIT[0] : FOG_HANGAR[0];
      fog.far = on ? FOG_COCKPIT[1] : FOG_HANGAR[1];
    }
    if (!on) return;
    const t = state.clock.elapsedTime;
    displays.update(t);
    const P = cockpitFx.power;
    built.screenMats[0].color.setScalar(1.35 * P.mfdL);
    built.screenMats[1].color.setScalar(1.35 * P.mfdC);
    built.screenMats[2].color.setScalar(1.35 * P.mfdR);
    built.hudMat.color.setScalar(0.95 * P.hud); // under the bloom threshold: text stays crisp
    built.stencilMat.color.setScalar(1.4 * P.dash);
    built.ledMat.emissiveIntensity = 3.5 * P.dash;
    built.ledAmberMat.emissiveIntensity = 3.5 * P.dash * (0.7 + 0.3 * Math.sin(t * 2.2));
    built.needles[0].rotation.z = -2.1 + P.dash * (1.4 + Math.sin(t * 0.7) * 0.05);
    built.needles[1].rotation.z = -2.1 + P.dash * 0.9;
    own.update(t);
    // the pilot's eyes: breathing + a whisper of head-bob
    const still = reduceMotion;
    const bx = still ? 0 : Math.sin(t * 0.9) * 0.0018 + Math.sin(t * 2.3 + 1) * 0.0008;
    const by = still ? 0 : Math.sin(t * Math.PI * 2 * 0.25) * 0.004 + Math.sin(t * 1.7) * 0.001;
    director.pos.copy(ORIGIN).add(tmp.set(bx, by, 0));
    director.look.copy(director.pos).add(tmp.set(0, Math.sin(EYE_PITCH), -Math.cos(EYE_PITCH)));
    // focus on the combiner (HUD text sharp; the tunnel softens with depth); the bulkhead holds focus while it is up
    if (!bulkhead.active) director.focus.copy(director.pos).add(tmp.set(0, -0.05, -0.64));
    director.fov = useSettings.getState().camera.fov;
    director.roll = 0;
  });

  return (
    <group
      ref={setRoot}
      position={COCKPIT_ORIGIN}
      visible={false}
      name="cockpit-root"
    >
      <primitive object={built.group} />
      <primitive object={own.group} />
      <LaunchTunnel reduceMotion={reduceMotion} />
      <Mirrors parent={rootObj} quality={mirrorQ} />
    </group>
  );
}

/** Cockpit lights: mounted with the World from boot (constant light count =
 *  no program recompiles), dark until the cockpit is on. */
export function CockpitLights() {
  const key = useRef<DirectionalLight>(null);
  const dash = useRef<PointLight>(null);
  const target = useMemo(() => {
    const o = new Object3D();
    o.position.set(COCKPIT_ORIGIN[0], COCKPIT_ORIGIN[1] - 0.4, COCKPIT_ORIGIN[2] - 1);
    // key from above-behind the pilot (a directional light: only its direction counts)
    return o;
  }, []);
  useEffect(() => {
    if (key.current) key.current.target = target;
  }, [target]);
  useFrame(() => {
    const on = stage.cockpit >= 0.5 ? 1 : 0;
    const P = cockpitFx.power.dash;
    // also lights the bulkhead while it fills the view (hangar or cockpit)
    if (key.current) key.current.intensity = Math.max(1.1 * on, bulkhead.active ? 0.8 : 0);
    if (dash.current) dash.current.intensity = (0.15 + 0.3 * P) * on;
  });
  return (
    <>
      <directionalLight ref={key} position={[COCKPIT_ORIGIN[0] - 1.2, COCKPIT_ORIGIN[1] + 4.5, COCKPIT_ORIGIN[2] + 3]} color="#dfe6ff" intensity={0} />
      <primitive object={target} />
      <pointLight ref={dash} position={[COCKPIT_ORIGIN[0], COCKPIT_ORIGIN[1] - 0.12, COCKPIT_ORIGIN[2] - 0.7]} color="#ffb07a" distance={1.4} decay={2} intensity={0} />
    </>
  );
}
