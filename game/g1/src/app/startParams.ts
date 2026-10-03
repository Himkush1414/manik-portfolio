// Query-param entry points (QA harness + dev). Idempotent.
//   ?boot=0          skip the boot sequence, land in the hangar
//   ?screen=doors    park the camera on the bay doors (seek via __G1__.doors)
//   ?ship=<id>       deep link: that ship on the pad (+ debug=1: shown unlocked)
//   ?livery=<0-4|5>  livery of that ship        ?pilot=onyx|ember
//   ?screen=upgrades|settings              open that modal once the hangar is up
//   ?screen=briefing|camera|cockpit        run the real launch flow (sped up) to it
//   ?unlock=all  ?credits=<n>              save edits: only with ?debug=1
// Default: the full boot sequence (flow stays in boot.black until it starts).
import { missionSpace } from '../render/world/missionSpace';
import { cockpitFx } from '../scenes/cockpit/displays';
import { fd as hudFd } from '../scenes/mission/MissionHudDriver';
import { heading, localToWorldDir } from '../render/mission/flightAttitude';
import { reticleCanvas } from '../ui/screens/mission/reticleCanvas';
import { QUERY } from '../core/constants';
import { flow } from './flow';
import { setView, VIEWS } from '../render/cameraDirector';
import { bootDoors, launchDoors, cockpitInMission } from '../scenes/sceneBridge';
import { bulkhead } from '../scenes/cockpit/Bulkhead';
import { stage } from '../scenes/Stage';
import { bootFx } from '../scenes/boot/bootFxParams';
import { registerDebug, registerDebugFn } from '../debug/debugApi';
import { shipThumbnail, type ThumbOptions } from '../render/thumbnails';
import { isShipId, type ShipId } from '../data/ships';
import { TRACK_IDS } from '../data/upgrades';
import { useUi } from '../state/ui.store';
import { useProfile } from '../state/profile.store';
import { unlockState } from '../data/unlocks';
import { hangarCam } from '../scenes/hangar/hangarCamera';
import { turntable } from '../scenes/hangar/turntable';
import { whenContentReady } from '../scenes/sceneBridge';
import { useLoader } from '../core/loader';
import { DEBUG } from '../core/constants';
import gsap from 'gsap';
import { jumpTo, returnToHangar, type LaunchJump } from './choreo/launchTimeline';
import { openModal, closeModal, viewShip } from '../ui/screens/hangar/hangarActions';
import { enterMission, prewarmMission, pauseMission, resumeMission, missionToHangar, retryMission } from './mission/missionFlow';
import { isBotSkill } from '../data/bot';
import { Ev } from '../game/core/events';
import { autoLaunch } from './mission/autoLaunch';
import { PLAYER, INPUT } from '../data/mission';
import { settingsSnapshot } from '../state/settings.store';
import { mission } from '../scenes/mission/missionRuntime';
import { InputManager } from '../input/InputManager';
import { rigCamera, rigFlight } from '../render/rigs/rigState';
import { hudDom } from '../ui/screens/mission/hudDom';
import { Euler, Vector3, type PerspectiveCamera } from 'three';
import { useSettings } from '../state/settings.store';
import type { EventReader } from '../game/core/events';

let applied = false;

export type StartMode = 'boot' | 'hangar' | 'doors';

export function startMode(): StartMode {
  const screen = QUERY.get('screen');
  if (screen === 'doors') return 'doors';
  if (QUERY.get('boot') === '0' || (screen && screen !== 'boot') || (DEBUG && QUERY.get('level'))) return 'hangar';
  return 'boot';
}

export function applyStartParams(): void {
  if (applied) return;
  applied = true;
  registerDebug('doors', {
    seek: (t: number, mode: 'open' | 'close' = 'open') => bootDoors.seek(t, mode),
    open: (d?: number) => bootDoors.open(d),
    close: (d?: number) => bootDoors.close(d),
    state: () => ({ progress: bootDoors.progress, state: bootDoors.state }),
    view: (name: keyof typeof VIEWS) => setView(VIEWS[name]),
  });
  registerDebug('camera', {
    // QA angles own the camera and hold the turntable at yaw 0 (nose +z)
    view: (name: keyof typeof VIEWS) => {
      hangarCam.manual = true;
      Object.assign(turntable, { frozen: true, yaw: 0, pitch: 0, vel: 0 });
      setView(VIEWS[name]);
    },
    hangar: () => {
      hangarCam.manual = false;
      turntable.frozen = false;
    },
    turntable: (patch: Partial<typeof turntable>) => Object.assign(turntable, patch),
    turntableState: () => ({ yaw: turntable.yaw, pitch: turntable.pitch, zoom: turntable.zoom, zoomTarget: turntable.zoomTarget, vel: turntable.vel, enabled: turntable.enabled }),
  });
  registerDebug('flowState', { get: () => flow.state });
  // Phase 2 (brief §21): mission + sim QA surface
  registerDebug('mission', {
    start: (levelId: string, opts: { bot?: string; god?: boolean; seed?: number } = {}) => {
      flow.force('launch.standby');
      return enterMission(levelId, { bot: isBotSkill(opts.bot) ? opts.bot : null, god: opts.god, seed: opts.seed }, true);
    },
    pause: () => pauseMission(),
    resume: () => resumeMission(),
    retry: () => retryMission(),
    /** warp the sim to rail position m (QA: set pieces, late beats) */
    jump: (m: number) => {
      mission.sim?.reset(m);
      mission.stepper.resync();
      return mission.sim?.player.s ?? null;
    },
    hangar: () => missionToHangar(),
    state: () => ({ flow: flow.state, prepared: mission.prepared, progress: mission.progress, level: mission.level?.id ?? null }),
    /** camera rig: active mode, blend in progress, cockpit interior shown */
    rig: () => ({ mode: mission.rig.mode, blending: mission.rig.blending, interior: cockpitInMission.on }),
  });
  /** the live (migrated) settings (tools/qa-settings-p2.mjs) */
  registerDebug('settings', { get: () => settingsSnapshot() });
  // Control / Camera / Boundary addendum (tools/qa-freedom.mjs): drive the REAL reticle (as the mouse
  // would) and read back where the ship centre and the HUD reticle land on screen (NDC, y up)
  const _w = new Vector3();
  const _eu = new Euler(0, 0, 0, 'YXZ');
  const counts = { scrape: 0, impact: 0, splash: 0, close: 0 };
  let evSim: unknown = null, evReader: EventReader | null = null;
  registerDebug('flight', {
    cursor: (x: number, y: number) => {
      const E = INPUT.reticleEdge;
      InputManager.state.cx = Math.max(-E, Math.min(E, x));
      InputManager.state.cy = Math.max(-E, Math.min(E, y));
    },
    /** live settings change (QA): e.g. ('camera', { attachment: 'steady' }) */
    settings: (section: 'camera' | 'controls' | 'hud', patch: Record<string, unknown>) => useSettings.getState().patch(section, patch as never),
    /** terrain-contact / water / close-call events since the last call */
    events: () => {
      const sim = mission.sim;
      if (!sim) return null;
      if (evSim !== sim) {
        evSim = sim;
        evReader = sim.events.reader();
      }
      const E = sim.events;
      evReader?.drain(i => {
        const t = E.type[i];
        if (t === Ev.GroundScrape) counts[E.b[i] === 1 ? 'impact' : 'scrape']++;
        else if (t === Ev.Splash) counts.splash++;
        else if (t === Ev.CloseCall) counts.close++;
      });
      const out = { ...counts };
      counts.scrape = counts.impact = counts.splash = counts.close = 0;
      return out;
    },
    probe: () => {
      const cam = rigCamera.cam, s = mission.sim;
      if (!cam || !s) return null;
      mission.player.getWorldPosition(_w).project(cam);
      const ship = { x: _w.x, y: _w.y, z: _w.z };
      const r = (hudDom.reticle as HTMLElement | null)?.getBoundingClientRect();
      const W = window.innerWidth, H = window.innerHeight;
      const p = s.player, O = mission.root.position, c = cam.position;
      _eu.setFromQuaternion(cam.quaternion, 'YXZ');
      const lx = c.x - O.x, ly = c.y - O.y, lz = c.z - O.z;
      return {
        ship,
        reticle: r ? { x: ((r.left + r.width / 2) / W) * 2 - 1, y: 1 - ((r.top + r.height / 2) / H) * 2 } : null,
        input: { cx: InputManager.state.cx, cy: InputManager.state.cy, yaw: InputManager.state.yaw, pitch: InputManager.state.pitch },
        sim: { s: p.s, x: p.x, y: p.y, contact: p.contact, freeL: p.freeL, freeR: p.freeR, freeUp: p.freeUp, ceilY: p.ceilY, highT: p.highT, freeDown: p.freeDown, clampEvents: p.clampEvents, closeCalls: p.closeCalls, skim: p.skimTime, wall: p.wallTime, hull: p.hull, shield: p.shield, lat: p.latMax },
        att: { bank: mission.attitude.bank, roll: mission.attitude.roll, attach: rigFlight.attach, strength: rigFlight.rollStrength, interiorRoll: rigFlight.interiorRoll },
        mode: mission.rig.mode,
        blending: mission.rig.blending,
        cam: { local: [lx, ly, lz], roll: _eu.z, pitch: _eu.x, yaw: _eu.y, clearance: rigFlight.clearAt ? rigFlight.clearAt(lx, ly, lz) : null, fov: (cam as PerspectiveCamera).fov },
        shipLocal: [mission.player.position.x, mission.player.position.y, mission.player.position.z],
        reticleOffset: { az: reticleCanvas.offset.az, el: reticleCanvas.offset.el, total: reticleCanvas.offset.total },
        flightData: { heading: hudFd.heading, bank: hudFd.bank, pathHeading: heading(localToWorldDir(missionSpace.r, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 })), combiner: { pitch: cockpitFx.mission.pitch, alt: cockpitFx.mission.alt, clr: cockpitFx.mission.clr } },
      };
    },
  });
  registerDebug('sim', {
    state: () => {
      const s = mission.sim;
      if (!s) return null;
      const p = s.player;
      return { tick: s.tick, s: p.s, x: p.x, y: p.y, speed: p.speed, hull: p.hull, shield: p.shield, alive: p.alive, score: s.score, kills: s.kills, shots: p.shotsFired, hits: p.shotsHit, enemies: s.enemies.aliveCount, done: s.done, dropped: mission.stepper.dropped };
    },
    /** force input fields on top of the pilot (QA: boost, fire, roll...); null clears */
    force: (patch: Record<string, unknown> | null) => void (mission.qaForce = patch as never),
    /** QA: set player vitals (fractions of max) — HUD danger states without a damage source */
    vitals: (v: { hull?: number; shield?: number; energy?: number }) => {
      const s = mission.sim;
      if (!s) return;
      if (v.hull !== undefined) s.player.hull = v.hull * s.stats.maxHull;
      if (v.shield !== undefined) s.player.shield = v.shield * s.stats.maxShield;
      if (v.energy !== undefined) s.player.energy = v.energy * PLAYER.boost.energy;
    },
    /** QA: a HUD threat chevron (until 2E's AI writes them) */
    threat: (i: number, t: { active: boolean; angle?: number; urgency?: number } ) => {
      const h = mission.sim?.hud.threats[i];
      if (h) Object.assign(h, t);
    },
    /** QA: emit a hit (1) or kill (2) event at the player (HUD markers) */
    event: (kind: 1 | 2) => {
      const s = mission.sim;
      if (s) s.emit(kind === 1 ? Ev.Hit : Ev.Kill, -1, s.player.x, s.player.y, s.player.s + 100, 0, 0);
    },
    /** advance N fixed steps immediately with the current input (QA) */
    step: (n = 1) => {
      const s = mission.sim;
      if (!s) return 0;
      for (let i = 0; i < n; i++) s.step(mission.input);
      return s.tick;
    },
  });
  registerDebug('launch', {
    stage: () => stage,
    bulkhead: (patch?: Partial<typeof bulkhead>) => (patch ? Object.assign(bulkhead, patch) : bulkhead),
    doors: (p: 0 | 1) => launchDoors.set(p),
    doorsP: () => launchDoors.progress,
    // QA: drive the real flow (soak tests); rate = GSAP global time scale
    jump: (target: LaunchJump) => jumpTo(target),
    back: () => returnToHangar(),
    rate: (r: number) => void gsap.globalTimeline.timeScale(r),
    /** QA: STANDBY stays a resting state (no automatic LAUNCH) */
    holdStandby: (on = true) => void (autoLaunch.hold = on),
    hide: (name: string, on = true) => {
      const root = (window as unknown as { __G1__: { world: { scene(): import('three').Scene } } }).__G1__.world.scene();
      root.traverse(o => void (o.name === name && (o.visible = !on)));
    },
  });
  // brief §18 contract, top level: __G1__.setShip('vesper'), openScreen('cockpit'), ...
  registerDebugFn('setShip', (id: ShipId) => viewShip(id));
  registerDebugFn('setLivery', (i: number) => useProfile.getState().setLivery(useUi.getState().viewedShip ?? useProfile.getState().selectedShip, i));
  registerDebugFn('setPilot', (p: 'onyx' | 'ember') => useProfile.getState().setPilot(p));
  registerDebugFn('grantCredits', (n: number) => useProfile.getState().grantCredits(n));
  registerDebugFn('unlockAll', () => useProfile.getState().unlockAll());
  registerDebugFn('openScreen', (name: 'hangar' | 'upgrades' | 'settings' | LaunchJump) => {
    if (name === 'hangar') return closeModal();
    if (name === 'upgrades' || name === 'settings') return openModal(name);
    return jumpTo(name);
  });
  // DEV CHEATS (brief §14; only exist with ?debug=1)
  registerDebug('cheats', {
    credits: (n = 10000) => useProfile.getState().grantCredits(n),
    level: (n: number) => useProfile.getState().setLevelCleared(n),
    unlockAll: () => useProfile.getState().unlockAll(),
    // every track to tier 5 through the REAL atomic purchase (QA: "maxed" state)
    maxUpgrades: () => {
      const pr = useProfile.getState();
      pr.grantCredits(100000);
      for (let tier = 0; tier < 5; tier++) for (const t of TRACK_IDS) useProfile.getState().purchaseUpgrade(t);
    },
    reset: () => useProfile.getState().reset(),
  });
  registerDebug('thumbs', {
    // resolves to a data URL so the QA harness can save it
    make: async (id: ShipId, opts: ThumbOptions = {}) => {
      const blob = await (await fetch(await shipThumbnail(id, opts))).blob();
      return await new Promise<string>(res => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(blob);
      });
    },
  });
  // save edits first, so ?ship=<id>&unlock=all selects that ship
  const profile = useProfile.getState();
  if (DEBUG && QUERY.get('unlock') === 'all') profile.unlockAll();
  const credits = Number(QUERY.get('credits'));
  if (DEBUG && QUERY.has('credits') && Number.isFinite(credits)) profile.grantCredits(credits - profile.credits);
  // ?ship=<id>: deep link — that ship on the pad (locked ones as holograms);
  // an unlocked one also becomes the selected ship
  const linked = QUERY.get('ship');
  if (isShipId(linked)) {
    useUi.getState().setViewedShip(linked);
    if (unlockState(linked, useProfile.getState()).unlocked) profile.selectShip(linked);
  }
  const pilot = QUERY.get('pilot');
  if (pilot === 'onyx' || pilot === 'ember') profile.setPilot(pilot);
  const liv = Number(QUERY.get('livery'));
  if (QUERY.has('livery') && Number.isInteger(liv)) profile.setLivery(useUi.getState().viewedShip ?? useProfile.getState().selectedShip, liv);
  const mode = startMode();
  if (mode === 'boot') return; // the boot timeline sets up its own initial state
  stage.world = 1;
  bootFx.opacity = 0;
  if (mode === 'doors') {
    setView(VIEWS.bootGate);
    bootDoors.set(0);
  } else {
    setView(VIEWS.hangar);
    bootDoors.set(1);
  }
  // the door view is the boot's door beat: in hangar.* the hangar camera rig and
  // UI take over (this regressed once 1D/1E landed: ?screen=doors showed the hangar)
  flow.force(mode === 'doors' ? 'boot.doors' : 'hangar.idle');
  const screen = QUERY.get('screen');
  if (screen === 'upgrades' || screen === 'settings' || screen === 'briefing' || screen === 'camera' || screen === 'cockpit') void openScreen(screen);
  // Phase 2 QA (brief §21): ?level=<id>&debug=1 [&bot=novice|mid|expert &god=1 &seed=n] — straight into a mission
  const level = QUERY.get('level');
  if (DEBUG && level) void startLevel(level);
}

async function startLevel(level: string): Promise<void> {
  await whenContentReady();
  if (!useLoader.getState().finished) await new Promise<void>(r => { const u = useLoader.subscribe(s => s.finished && (u(), r())); });
  const bot = QUERY.get('bot');
  const opts = { bot: isBotSkill(bot) ? bot : null, god: QUERY.get('god') === '1', seed: Number(QUERY.get('seed')) || undefined };
  // the REAL path: hangar -> bulkhead -> cockpit -> briefing (prepare starts here) -> camera -> standby -> LAUNCH
  prewarmMission(level, opts);
  await jumpTo('cockpit');
  await enterMission(level, opts, QUERY.get('launch') === 'skip');
}

/** Waits for the hangar (content + loader), then opens a modal or runs the launch flow. */
async function openScreen(screen: 'upgrades' | 'settings' | LaunchJump): Promise<void> {
  await whenContentReady();
  if (!useLoader.getState().finished) await new Promise<void>(r => { const u = useLoader.subscribe(s => s.finished && (u(), r())); });
  await new Promise(r => setTimeout(r, 1200)); // hangar UI entrance
  if (screen === 'upgrades' || screen === 'settings') openModal(screen);
  else await jumpTo(screen);
}
