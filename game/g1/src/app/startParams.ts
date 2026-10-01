// Query-param entry points (QA harness + dev). Idempotent.
//   ?boot=0          skip the boot sequence, land in the hangar
//   ?screen=doors    park the camera on the bay doors (seek via __G1__.doors)
//   ?ship=<id>       deep link: that ship on the pad (+ debug=1: shown unlocked)
//   ?livery=<0-4|5>  livery of that ship        ?pilot=onyx|ember
//   ?screen=upgrades|settings              open that modal once the hangar is up
//   ?screen=briefing|camera|cockpit        run the real launch flow (sped up) to it
//   ?unlock=all  ?credits=<n>              save edits: only with ?debug=1
// Default: the full boot sequence (flow stays in boot.black until it starts).
import { QUERY } from '../core/constants';
import { flow } from './flow';
import { setView, VIEWS } from '../render/cameraDirector';
import { bootDoors, launchDoors } from '../scenes/sceneBridge';
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
import { enterMission, pauseMission, resumeMission, missionToHangar, retryMission } from './mission/missionFlow';
import { isBotSkill } from '../data/bot';
import { mission } from '../scenes/mission/missionRuntime';

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
      return enterMission(levelId, { bot: isBotSkill(opts.bot) ? opts.bot : null, god: opts.god, seed: opts.seed });
    },
    pause: () => pauseMission(),
    resume: () => resumeMission(),
    retry: () => retryMission(),
    hangar: () => missionToHangar(),
    state: () => ({ flow: flow.state, prepared: mission.prepared, progress: mission.progress, level: mission.level?.id ?? null }),
  });
  registerDebug('sim', {
    state: () => {
      const s = mission.sim;
      if (!s) return null;
      const p = s.player;
      return { tick: s.tick, s: p.s, x: p.x, y: p.y, speed: p.speed, hull: p.hull, shield: p.shield, alive: p.alive, score: s.score, kills: s.kills, shots: p.shotsFired, hits: p.shotsHit, enemies: s.enemies.aliveCount, done: s.done, dropped: mission.stepper.dropped };
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
  const mood = QUERY.get('mood');
  if (mood === 'l1' || mood === 'l22' || mood === 'l10') mission.qa.mood = mood;
  if (QUERY.has('storm')) mission.qa.storm = Math.max(0, Math.min(1, Number(QUERY.get('storm')) || 0));
  flow.force('launch.standby');
  await enterMission(level, { bot: isBotSkill(bot) ? bot : null, god: QUERY.get('god') === '1', seed: Number(QUERY.get('seed')) || undefined });
}

/** Waits for the hangar (content + loader), then opens a modal or runs the launch flow. */
async function openScreen(screen: 'upgrades' | 'settings' | LaunchJump): Promise<void> {
  await whenContentReady();
  if (!useLoader.getState().finished) await new Promise<void>(r => { const u = useLoader.subscribe(s => s.finished && (u(), r())); });
  await new Promise(r => setTimeout(r, 1200)); // hangar UI entrance
  if (screen === 'upgrades' || screen === 'settings') openModal(screen);
  else await jumpTo(screen);
}
