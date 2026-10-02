// MissionLoader.prepare(levelDef) (brief §14 MISSION PREPARE): runs while the
// player reads the briefing / picks the camera. Builds what the level needs,
// compiles every program in idle slices against the real lights + fog,
// warms the mission post chain off-screen, then creates the sim. Reports
// progress (SYSTEMS SYNC). Idempotent per level; pools persist across retries.
import { runSliced } from '../../core/slicer';
import { compileSteps, uploadSteps } from '../../render/compileSliced';
import { prepareMissionPost } from '../../render/MissionPostFX';
import { ShipFactory } from '../../ships/ShipFactory';
import { clampLivery } from '../../data/liveries';
import { useProfile } from '../../state/profile.store';
import { useSettings } from '../../state/settings.store';
import { Sim } from '../../game/sim';
import { Bot } from '../../game/bot/bot';
import type { LevelDef } from '../../levels/types';
import { whenWorldMounted, cockpitInMission, MIRROR_WORLD_LAYER } from '../sceneBridge';
import { buildTunnelSteps } from '../../render/mission/tunnel/Tunnel';
import { SpeedStreaks } from '../../render/mission/vfx/SpeedStreaks';
import { VeilGate } from '../../render/mission/launch/VeilGate';
import { createLaunchSky } from '../../render/mission/launch/LaunchSky';
import { LAUNCH } from '../../data/mission';
import { mission, type MissionOptions } from './missionRuntime';
import { MissionVfx } from '../../render/mission/vfx/MissionVfx';
import { SPECS } from '../../ships/specs';
import { cannonMuzzles } from './shipMounts';
import { registerDebug } from '../../debug/debugApi';
import { setCockpitEye } from './missionCamera';

let inflight: Promise<void> | null = null;
let inflightLevel = '';

export const MissionLoader = {
  /** A prepare already running for the SAME level is shared; one for another level (a briefing
   *  prewarm vs the launch that follows) runs first, then this one. */
  prepare(level: LevelDef, opts: MissionOptions = {}): Promise<void> {
    if (inflight && inflightLevel === level.id) return inflight;
    const before = inflight ?? Promise.resolve();
    const p: Promise<void> = before
      .catch(() => undefined)
      .then(() => {
        mission.prepared = false;
        mission.progress = 0;
        return run(level, opts);
      })
      .finally(() => {
        if (inflight === p) inflight = null;
      });
    inflight = p;
    inflightLevel = level.id;
    return p;
  },
};

async function run(level: LevelDef, opts: MissionOptions): Promise<void> {
  const world = await whenWorldMounted();
  mission.world = world;
  const { gl, scene, camera } = world;
  if (mission.root.parent !== scene) scene.add(mission.root);
  // three collects a light only for cameras sharing one of its layers: the mission mirrors (no layer 0)
  // must see the same light set as the eye, or every lit material compiles a no-light variant
  scene.traverse(o => void ((o as { isLight?: boolean }).isLight && o.layers.enable(MIRROR_WORLD_LAYER)));
  // the player's ship (rebuilt only when the ship / livery changed)
  const p = useProfile.getState();
  const livery = clampLivery(p.selectedShip, p.liveryByShip[p.selectedShip] ?? 0);
  const key = `${p.selectedShip}:${livery}`;
  if (mission.shipKey !== key) {
    mission.ship?.dispose();
    const ship = ShipFactory.build(p.selectedShip, { livery, lod: 0 });
    ship.group.rotation.y = Math.PI; // ship nose is +z; the mission flies -z
    ship.group.traverse(o => void (o.castShadow = false));
    mission.player.add(ship.group);
    mission.ship = ship;
    mission.shipKey = key;
    if (!mission.vfx) {
      mission.vfx = new MissionVfx();
      mission.vfx.attach(mission.root, mission.player);
      const vfx = mission.vfx;
      registerDebug('vfx', { stats: () => vfx.stats() });
    }
    mission.vfx.setShip(ship.group, SPECS[p.selectedShip]);
    mission.rig.setShipLength(SPECS[p.selectedShip].length);
    setCockpitEye(p.selectedShip);
  }
  mission.progress = 0.15;
  // the wormhole: built once (noise bake sliced), reused across launches
  if (!mission.tunnel) {
    mission.tunnel = await runSliced('mission:tunnel', buildTunnelSteps(level.seed));
    mission.root.add(mission.tunnel.group);
  }
  if (!mission.streaks) {
    mission.streaks = new SpeedStreaks(level.seed ^ 0x51ed);
    mission.root.add(mission.streaks.mesh);
  }
  mission.streaks.setTier(useSettings.getState().graphics.preset);
  mission.vfx?.setTier(useSettings.getState().graphics.preset);
  const t = mission.tunnel;
  t.setTier(useSettings.getState().graphics.preset);
  t.setMood(mission.qa.mood ? { preset: mission.qa.mood, storm: level.mood.storm } : level.mood);
  t.setPath(level.pathParams.amp, level.pathParams.freq);
  t.setRadiusKeys(level.radius ?? []);
  // the Veil Gate (launch set piece): shares the corridor's noise + mood colours
  if (!mission.gate) {
    const u = t.uniforms;
    mission.gate = new VeilGate(u.tNoise.value, { near: u.uNear.value, mid: u.uMid.value, far: u.uFar.value, core: u.uCore.value, fil: u.uFil.value });
  }
  if (!mission.sky) mission.sky = createLaunchSky(LAUNCH.skyRadius);
  mission.progress = 0.3;
  // every program of the mission frame, compiled in <= 4 ms slices (hidden root included)
  const vis = mission.root.visible;
  mission.root.visible = true;
  try {
    await runSliced('mission:compile', compileSteps(gl, [mission.root, mission.gate.group, mission.sky], camera, scene));
  } finally {
    mission.root.visible = vis;
  }
  // every geometry buffer too: the cockpit view frames meshes the launch never drew
  await runSliced('mission:upload', uploadSteps(gl, [mission.root, cockpitInMission.root]));
  mission.progress = 0.8;
  const el = gl.domElement;
  prepareMissionPost(gl, scene, camera, el.clientWidth, el.clientHeight);
  // the sim (fresh per launch; pools inside are allocated once per Sim)
  const pr = useProfile.getState();
  mission.level = level;
  mission.opts = opts;
  mission.sim = new Sim({ level, ship: pr.selectedShip, tiers: pr.upgrades, seed: opts.seed ?? level.seed, aimAssist: useSettings.getState().controls.aimAssist, god: opts.god, muzzles: cannonMuzzles(SPECS[pr.selectedShip]) });
  mission.bot = opts.bot ? new Bot(opts.bot, opts.seed ?? level.seed) : null;
  mission.progress = 1;
  mission.prepared = true;
}
