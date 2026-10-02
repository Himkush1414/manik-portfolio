// The world a mission flies (Phase 2R §4-§6): flight path, terrain field +
// the sim's deterministic height grid, the streamed terrain ribbon, its
// material, and the sun. One per level, built during MISSION PREPARE; per
// frame it moves mission space to the player, streams / places the tiles in
// the path frame and turns the sun into that frame. The sun is the borrowed
// cockpit-key DirectionalLight (light count never changes).
import { Color, Vector3, type DirectionalLight, type Mesh } from 'three';
import { FlightPath } from '../../game/world/path';
import { HeightGrid, TerrainField } from '../../game/world/terrain';
import type { LevelDef } from '../../levels/types';
import type { WorldDef } from '../../data/worlds/types';
import { TerrainStreamer } from './TerrainStreamer';
import { createTerrainMaterial, type TerrainUniforms } from './terrainMaterial';
import { SkyDome } from './SkyDome';
import { WorldEnvProbe } from './envProbe';
import { CloudBanks } from './clouds';
import { AP_UNIFORMS, setAtmosphere, sunDirection } from './atmosphere';
import { MISSION_ORIGIN } from '../../scenes/sceneBridge';
import { missionSpace } from './missionSpace';
import { lightRig } from '../lightRig';
import { MIRROR_WORLD_LAYER } from '../../scenes/sceneBridge';
import type { Preset } from '../quality';
import { TILE_LEN } from '../../game/world/tiles';

/** per-preset view distance + LOD rings (Phase 2R §14 PRESETS); LOW = LOD bias +1 (no LOD 0) */
export const WORLD_VIEW: Record<Preset, { ahead: number; behind: number; lodDist: readonly [number, number] }> = {
  low: { ahead: 1300, behind: 500, lodDist: [-1, 480] },
  medium: { ahead: 2000, behind: 700, lodDist: [120, 600] },
  high: { ahead: 2600, behind: 800, lodDist: [150, 700] },
  ultra: { ahead: 2600, behind: 800, lodDist: [220, 900] },
};


export class MissionWorld {
  readonly path: FlightPath;
  readonly field: TerrainField;
  readonly grid: HeightGrid;
  readonly streamer: TerrainStreamer;
  readonly uniforms: TerrainUniforms;
  readonly sky = new SkyDome();
  /** the world's sky as the scene environment (captured in prepare, rotated into the path frame) */
  readonly probe = new WorldEnvProbe();
  readonly clouds: CloudBanks;
  /** world sun direction (toward the sun) and the same in mission-local space this frame */
  readonly sunWorld: Vector3;
  readonly sunLocal = new Vector3();
  /** speed-streak tint: the near haze lifted toward white (air streaks, not tunnel filaments) */
  readonly streakColor: Color;
  private readonly place = (m: Mesh, x: number, y: number, z: number) => missionSpace.placeWorld(m, x, y, z);

  constructor(readonly level: LevelDef, readonly def: WorldDef, preset: Preset) {
    this.path = new FlightPath(level.path);
    this.field = new TerrainField(def.terrain, this.path, { seed: level.terrainSeed, widthKeys: level.widthKeys });
    this.grid = new HeightGrid(this.field);
    const { material, uniforms } = createTerrainMaterial(def);
    this.uniforms = uniforms;
    const v = WORLD_VIEW[preset];
    const tiles = (d: number) => Math.max(0, Math.ceil((2 * d) / TILE_LEN));
    const total = Math.ceil((v.ahead + v.behind) / TILE_LEN) + 2;
    const l0 = tiles(v.lodDist[0]) + 2, l1 = tiles(v.lodDist[1]) + 3;
    this.streamer = new TerrainStreamer({ terrain: def.terrain, path: level.path, seed: level.terrainSeed, widthKeys: level.widthKeys, material, lodDist: v.lodDist, ahead: v.ahead, behind: v.behind, pool: [Math.max(1, l0), l1, Math.max(4, total - tiles(v.lodDist[1]) + 4)] });
    // the cockpit mirrors' reduced world pass sees the terrain (MIRROR_WORLD_LAYER)
    for (const m of this.streamer.meshes) m.layers.enable(MIRROR_WORLD_LAYER);
    // geomorph ranges: a tile is fully its coarser LOD by the nearest point a coarser tile can start
    // (centre distance > lodDist -> its near edge > lodDist - TILE_LEN / 2)
    const e0 = v.lodDist[0] - TILE_LEN / 2, e1 = v.lodDist[1] - TILE_LEN / 2;
    uniforms.uMorph.value.set(Math.max(0, e0 - 48), Math.max(1, e0), e1 - 160, e1);
    this.streakColor = new Color(def.atmosphere.hazeNear).lerp(new Color('#ffffff'), 0.55);
    const sun = def.sky.suns[0];
    this.sunWorld = sunDirection(sun.elevation, sun.azimuth);
    missionSpace.bind(this.path);
    // sky dome + aerial perspective for this world (uniforms only)
    this.sky.setWorld(def);
    this.sky.mesh.layers.enable(MIRROR_WORLD_LAYER);
    this.streamer.group.add(this.sky.mesh);
    this.clouds = new CloudBanks(preset);
    this.clouds.setWorld(def, this.path);
    this.streamer.group.add(this.clouds.mesh);
    setAtmosphere(def);
    AP_UNIFORMS.uSunW.value.copy(this.sunWorld);
  }

  init(): Promise<void> {
    return this.streamer.init();
  }

  /** prepare: stream around s0 until every wanted tile is resident (one upload per frame) */
  async prestream(s0: number, timeoutMs = 20000): Promise<boolean> {
    const t0 = performance.now();
    while (performance.now() - t0 < timeoutMs) {
      this.update(s0);
      if (this.streamer.settled()) return true;
      await new Promise(r => requestAnimationFrame(r));
    }
    return false;
  }

  /** per frame, with the player's interpolated rail position */
  private readonly skyAt = new Vector3();
  private lastS = 0;

  update(ps: number): void {
    this.lastS = ps;
    this.uniforms.uViewS.value = ps;
    missionSpace.update(ps);
    this.probe.update();
    this.streamer.update(ps, this.place);
    missionSpace.dirToLocal(this.sunWorld.x, this.sunWorld.y, this.sunWorld.z, this.sunLocal);
  }

  /** after the camera moved this frame (`at` = camera, mission-scene coordinates): the sun light, the
   *  sky dome around the camera, and the aerial-perspective camera position */
  applySun(at: Vector3, time = 0): void {
    this.skyAt.set(at.x - MISSION_ORIGIN[0], at.y - MISSION_ORIGIN[1], at.z - MISSION_ORIGIN[2]);
    this.sky.update(this.skyAt, time);
    this.clouds.update(this.lastS, this.sunLocal, time);
    // camera in world space: world = P + B (scene - O)
    const r = missionSpace.r, L = this.skyAt;
    AP_UNIFORMS.uCamW.value.set(
      missionSpace.px + r[0] * L.x + r[3] * L.y + r[6] * L.z,
      missionSpace.py + r[1] * L.x + r[4] * L.y + r[7] * L.z,
      missionSpace.pz + r[2] * L.x + r[5] * L.y + r[8] * L.z,
    );
    AP_UNIFORMS.uApH0.value = this.path.floorAt(this.lastS);
    const l = lightRig.get<DirectionalLight>('cockpitKey');
    if (!l) return;
    l.position.copy(at).addScaledVector(this.sunLocal, 800);
    l.target.position.copy(at);
    l.target.updateMatrixWorld();
    l.color.set(this.def.lighting.key);
    l.intensity = this.def.lighting.keyIntensity;
  }

  /** deterministic ground world-y at path-relative (s, u) */
  groundY(s: number, u: number): number {
    return this.grid.height(s, u);
  }

  dispose(): void {
    this.sky.dispose();
    this.probe.dispose();
    this.clouds.dispose();
    this.streamer.dispose();
    this.streamer.group.removeFromParent();
  }
}
