// ?screen=worldlab (Phase 2R §17 look-dev): a world on its own — streamed
// terrain along a level path, the world's sun on the borrowed directional
// light (light count never changes), fog + haze, the mission post chain.
// Camera: on the path (s, u, altitude above the path, yaw / pitch relative
// to the path tangent), flown along at cruise speed or parked for beauty
// shots. Keys: W/S fly, A/D strafe, R/F altitude, arrows look, SPACE
// pause/resume flight. QA: __G1__.worldlab.{set, fly, stats, settled, mode}.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Euler, Group, Quaternion, Vector3, type DirectionalLight, type Fog, type HemisphereLight, type Light, type PerspectiveCamera } from 'three';
import { FlightPath, createFrame } from '../../game/world/path';
import { TerrainStreamer } from '../../render/world/TerrainStreamer';
import { createTerrainMaterial, type TerrainUniforms } from '../../render/world/terrainMaterial';
import { ARDEN } from '../../data/worlds/arden';
import { ARDEN_01_PATH, ARDEN_01_WIDTH } from '../../levels/paths/arden01';
import { lightRig } from '../../render/lightRig';
import { director } from '../../render/cameraDirector';
import { stage } from '../Stage';
import { MISSION_ORIGIN } from '../sceneBridge';
import { prepareMissionPost } from '../../render/MissionPostFX';
import { registerDebug } from '../../debug/debugApi';
import type { WorldDef } from '../../data/worlds/types';

const DEG = Math.PI / 180;
/** world sun direction from elevation / azimuth (deg; azimuth clockwise from -z toward +x) */
export function sunDirection(el: number, az: number, out = new Vector3()): Vector3 {
  return out.set(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG));
}

type Cam = { s: number; u: number; alt: number; yaw: number; pitch: number; fov: number; speed: number; flying: boolean };

export function WorldLab() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera) as PerspectiveCamera;
  const ref = useRef<{ streamer: TerrainStreamer; path: FlightPath; root: Group; world: WorldDef; sun: Vector3; uniforms: TerrainUniforms } | null>(null);
  const cam = useRef<Cam>({ s: 200, u: 0, alt: 0, yaw: 0, pitch: -4, fov: 70, speed: 58, flying: true });
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const world = ARDEN;
    const sky = world.sky, atm = world.atmosphere;
    lightRig.borrow();
    for (const r of ['key', 'rimA', 'rimB', 'cockpitDash'] as const) {
      const l = lightRig.get<Light>(r);
      if (l) l.intensity = 0;
    }
    const hemi = lightRig.get<HemisphereLight>('hemi');
    if (hemi) {
      hemi.color.set(world.lighting.fillSky);
      hemi.groundColor.set(world.lighting.fillGround);
      hemi.intensity = world.lighting.fillIntensity;
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
    const { material, uniforms } = createTerrainMaterial(world);
    const path = new FlightPath(ARDEN_01_PATH);
    const streamer = new TerrainStreamer({ terrain: world.terrain, path: ARDEN_01_PATH, seed: 101, widthKeys: ARDEN_01_WIDTH, material, lodDist: [150, 700], ahead: 2600, behind: 800, pool: [5, 14, 26] });
    root.add(streamer.group);
    const sun = sunDirection(sky.suns[0].elevation, sky.suns[0].azimuth);
    ref.current = { streamer, path, root, world, sun, uniforms };
    void streamer.init();

    const c = cam.current;
    registerDebug('worldlab', {
      set: (p: Partial<Cam>) => Object.assign(c, p),
      fly: (on = true, speed?: number) => {
        c.flying = on;
        if (speed !== undefined) c.speed = speed;
      },
      cam: () => ({ ...c }),
      stats: () => ({ ...streamer.stats, pathLength: path.length }),
      settled: () => streamer.stats.pending === 0 && streamer.stats.lateTiles === 0 && streamer.stats.resident > 0,

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
      streamer.dispose();
      material.dispose();
      scene.remove(root);
      scene.background = prevBg;
      stage.mission = 0;
      lightRig.restore();
      director.quat = null;
    };
  }, [gl, scene, camera]);

  const _f = useRef(createFrame());
  const _q = useRef(new Quaternion());
  const _e = useRef(new Euler(0, 0, 0, 'YXZ'));
  const _v = useRef(new Vector3());
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
    c.s = Math.max(0, Math.min(r.path.length - 1, c.s));
    const f = r.path.frameAt(c.s, _f.current);
    // floating origin = the path point under the camera
    const origin = { x: f.px, y: f.py, z: f.pz };
    // camera at the path point + lateral u + altitude (world up)
    const O = MISSION_ORIGIN;
    director.pos.set(O[0] + f.rx * c.u, O[1] + c.alt, O[2] + f.rz * c.u);
    // orientation: path heading + yaw, pitch
    const heading = Math.atan2(-f.tx, -f.tz);
    _e.current.set(c.pitch * DEG, heading + c.yaw * DEG, 0, 'YXZ');
    director.quat = _q.current.setFromEuler(_e.current);
    director.look.set(0, 0, -10).applyQuaternion(_q.current).add(director.pos);
    director.focus.copy(director.look);
    director.fov = c.fov;
    director.roll = 0;
    r.streamer.update(c.s, origin);
    // world-space shading needs the floating-origin offset (scene units -> world units)
    r.uniforms.uOrigin.value.set(origin.x - MISSION_ORIGIN[0], origin.y - MISSION_ORIGIN[1], origin.z - MISSION_ORIGIN[2]);
    // sun: the borrowed directional light, placed along the sun direction from the camera
    const sun = lightRig.get<DirectionalLight>('cockpitKey');
    if (sun) {
      sun.position.copy(director.pos).addScaledVector(r.sun, 600);
      sun.target.position.copy(director.pos);
      sun.target.updateMatrixWorld();
      sun.color.set(r.world.lighting.key);
      sun.intensity = r.world.lighting.keyIntensity;
    }
    void _v;
  }, -2);
  return null;
}
