// ?screen=worldlab (Phase 2R §17 look-dev): a world on its own — streamed
// terrain along a level path, the world's sun on the borrowed directional
// light (light count never changes), fog + haze, the mission post chain.
// Camera: on the path (s, u, altitude above the path, yaw / pitch relative
// to the path tangent), flown along at cruise speed or parked for beauty
// shots. Keys: W/S fly, A/D strafe, R/F altitude, arrows look, SPACE
// pause/resume flight. QA: __G1__.worldlab.{set, fly, stats, settled, mode}.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Euler, Group, Quaternion, type Fog, type HemisphereLight, type Light, type PerspectiveCamera } from 'three';
import { MissionWorld } from '../../render/world/MissionWorld';
import { ARDEN } from '../../data/worlds/arden';
import { LEVEL_01 } from '../../levels/level01';
import { lightRig } from '../../render/lightRig';
import { director } from '../../render/cameraDirector';
import { stage } from '../Stage';
import { MISSION_ORIGIN } from '../sceneBridge';
import { prepareMissionPost } from '../../render/MissionPostFX';
import { registerDebug } from '../../debug/debugApi';
import { useSettings } from '../../state/settings.store';

const DEG = Math.PI / 180;

type Cam = { s: number; u: number; alt: number; yaw: number; pitch: number; fov: number; speed: number; flying: boolean };

export function WorldLab() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera) as PerspectiveCamera;
  const ref = useRef<{ world: MissionWorld; root: Group } | null>(null);
  const cam = useRef<Cam>({ s: 200, u: 0, alt: 0, yaw: 0, pitch: -4, fov: 70, speed: 58, flying: true });
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const def = ARDEN;
    const sky = def.sky, atm = def.atmosphere;
    lightRig.borrow();
    for (const r of ['key', 'rimA', 'rimB', 'cockpitDash'] as const) {
      const l = lightRig.get<Light>(r);
      if (l) l.intensity = 0;
    }
    const hemi = lightRig.get<HemisphereLight>('hemi');
    if (hemi) {
      hemi.color.set(def.lighting.fillSky);
      hemi.groundColor.set(def.lighting.fillGround);
      hemi.intensity = def.lighting.fillIntensity;
    }
    const fog = scene.fog as Fog | null;
    if (fog) {
      fog.color.set(atm.hazeFar);
      fog.near = 500;
      fog.far = 5200;
    }
    const prevBg = scene.background;
    scene.background = new Color(sky.horizon);
    camera.near = 0.5;
    camera.far = 7000;
    camera.updateProjectionMatrix();
    stage.mission = 1;
    const el = gl.domElement;
    prepareMissionPost(gl, scene, camera, el.clientWidth, el.clientHeight);

    const root = new Group();
    root.name = 'worldlab-root';
    root.position.set(...MISSION_ORIGIN);
    scene.add(root);
    const world = new MissionWorld(LEVEL_01, def, useSettings.getState().graphics.preset);
    root.add(world.streamer.group);
    ref.current = { world, root };
    void world.init();

    const c = cam.current;
    const st = world.streamer;
    registerDebug('worldlab', {
      set: (p: Partial<Cam>) => Object.assign(c, p),
      fly: (on = true, speed?: number) => {
        c.flying = on;
        if (speed !== undefined) c.speed = speed;
      },
      cam: () => ({ ...c }),
      stats: () => ({ ...st.stats, pathLength: world.path.length }),
      settled: () => st.settled(),
    });
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (e.code === 'Space') c.flying = !c.flying;
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      world.dispose();
      scene.remove(root);
      scene.background = prevBg;
      stage.mission = 0;
      lightRig.restore();
      director.quat = null;
    };
  }, [gl, scene, camera]);

  const _q = useRef(new Quaternion());
  const _e = useRef(new Euler(0, 0, 0, 'YXZ'));
  useFrame((_, dt) => {
    const r = ref.current;
    if (!r) return;
    const c = cam.current, k = keys.current;
    const step = Math.min(dt, 0.1);
    if (c.flying) c.s += c.speed * step;
    if (k.has('KeyW')) c.s += 200 * step;
    if (k.has('KeyS')) c.s -= 200 * step;
    if (k.has('KeyA')) c.u -= 120 * step;
    if (k.has('KeyD')) c.u += 120 * step;
    if (k.has('KeyR')) c.alt += 80 * step;
    if (k.has('KeyF')) c.alt -= 80 * step;
    if (k.has('ArrowLeft')) c.yaw += 60 * step;
    if (k.has('ArrowRight')) c.yaw -= 60 * step;
    if (k.has('ArrowUp')) c.pitch += 40 * step;
    if (k.has('ArrowDown')) c.pitch -= 40 * step;
    c.s = Math.max(0, Math.min(r.world.path.length - 1, c.s));
    // the world moves into the path frame at the camera's s; the camera sits at a local offset
    r.world.update(c.s);
    const O = MISSION_ORIGIN;
    director.pos.set(O[0] + c.u, O[1] + c.alt, O[2]);
    _e.current.set(c.pitch * DEG, c.yaw * DEG, 0, 'YXZ');
    director.quat = _q.current.setFromEuler(_e.current);
    director.look.set(0, 0, -10).applyQuaternion(_q.current).add(director.pos);
    director.focus.copy(director.look);
    director.fov = c.fov;
    director.roll = 0;
    r.world.applySun(director.pos);
  }, -2);
  return null;
}
