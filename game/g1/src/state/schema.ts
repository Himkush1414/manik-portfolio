// Save schema + defaults + pure migrations (unit-tested). Stores import these;
// nothing here imports React or the renderer.
import { SAVE_VERSION } from '../core/constants';
import { DEFAULT_BINDINGS, cloneBindings, type Bindings } from '../input/bindings';
import { ACTION_ORDER } from '../input/actions';
import { isShipId, type ShipId, SHIP_IDS } from '../data/ships';
import { EMPTY_TIERS, TRACK_IDS, MAX_TIER, type UpgradeTiers } from '../data/upgrades';
import { clampLivery } from '../data/liveries';
import { isCameraMode, type CameraMode } from '../render/cameraRig';
import { isPreset, type Preset } from '../render/quality';

export type PilotId = 'onyx' | 'ember';
export const isPilotId = (v: unknown): v is PilotId => v === 'onyx' || v === 'ember';

export type ProfileData = {
  credits: number;
  highestLevelCleared: number;
  bossesDefeated: number[];
  unlockedShips: ShipId[];
  upgrades: UpgradeTiers;
  selectedShip: ShipId;
  liveryByShip: Partial<Record<ShipId, number>>;
  pilot: PilotId;
};

export type HelmetFrame = 'off' | 'subtle' | 'full';

export type SettingsData = {
  controls: { bindings: Bindings; sensitivity: number; invertY: boolean; deadzone: number; smoothing: number };
  camera: { mode: CameraMode; fov: number; shake: number; helmetFrame: HelmetFrame };
  graphics: {
    preset: Preset;
    autoPicked: boolean;
    bloom: boolean;
    chromatic: boolean;
    grain: boolean;
    vignette: boolean;
    dof: boolean;
    ao: boolean;
    reflections: boolean;
    resScale: number;
    fpsCap: 0 | 60 | 30;
    showFps: boolean;
  };
  audio: { master: number; music: number; sfx: number; ui: number; mute: boolean };
  accessibility: { reduceMotion: boolean; reduceFlashing: boolean; uiScale: number };
  bootSeen: boolean;
  /** the briefing typewriter plays on first view only */
  briefingSeen: boolean;
  /** the one-time "use the high-performance GPU" advice was shown (brief §4.10) */
  gpuHintShown: boolean;
};

export type SaveData = { version: number; profile: ProfileData; settings: SettingsData };

export const DEFAULT_PROFILE: ProfileData = {
  credits: 1200,
  highestLevelCleared: 0,
  bossesDefeated: [],
  unlockedShips: ['halcyon'],
  upgrades: { ...EMPTY_TIERS },
  selectedShip: 'halcyon',
  liveryByShip: {},
  pilot: 'onyx',
};

export function defaultSettings(prefersReducedMotion = false): SettingsData {
  return {
    controls: { bindings: cloneBindings(DEFAULT_BINDINGS), sensitivity: 1, invertY: false, deadzone: 0.08, smoothing: 0.35 },
    camera: { mode: 'cockpit', fov: 75, shake: 0.8, helmetFrame: 'subtle' },
    graphics: {
      preset: 'high',
      autoPicked: false,
      bloom: true,
      chromatic: true,
      grain: true,
      vignette: true,
      dof: true,
      ao: true,
      reflections: true,
      resScale: 1,
      fpsCap: 0,
      showFps: false,
    },
    audio: { master: 0.8, music: 0.7, sfx: 0.85, ui: 0.7, mute: false },
    accessibility: { reduceMotion: prefersReducedMotion, reduceFlashing: false, uiScale: 1 },
    bootSeen: false,
    briefingSeen: false,
    gpuHintShown: false,
  };
}

// ---------------------------------------------------------------- sanitising
const num = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
const bool = (v: unknown, dflt: boolean) => (typeof v === 'boolean' ? v : dflt);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function sanitizeProfile(raw: unknown): ProfileData {
  const r = obj(raw);
  const d = DEFAULT_PROFILE;
  const unlocked = Array.isArray(r.unlockedShips) ? r.unlockedShips.filter(isShipId) : [];
  if (!unlocked.includes('halcyon')) unlocked.unshift('halcyon');
  const up = obj(r.upgrades);
  const upgrades = { ...EMPTY_TIERS };
  for (const t of TRACK_IDS) upgrades[t] = Math.round(num(up[t], 0, MAX_TIER, 0));
  const lv = obj(r.liveryByShip);
  const liveryByShip: Partial<Record<ShipId, number>> = {};
  for (const s of SHIP_IDS) if (typeof lv[s] === 'number') liveryByShip[s] = clampLivery(s, lv[s] as number);
  const selected = isShipId(r.selectedShip) ? r.selectedShip : d.selectedShip;
  return {
    credits: Math.round(num(r.credits, 0, 1e9, d.credits)),
    highestLevelCleared: Math.round(num(r.highestLevelCleared, 0, 50, 0)),
    bossesDefeated: Array.isArray(r.bossesDefeated) ? r.bossesDefeated.filter(n => typeof n === 'number') : [],
    unlockedShips: Array.from(new Set(unlocked)),
    upgrades,
    selectedShip: selected,
    liveryByShip,
    pilot: isPilotId(r.pilot) ? r.pilot : d.pilot,
  };
}

function sanitizeSettings(raw: unknown): SettingsData {
  const d = defaultSettings();
  const r = obj(raw);
  const c = obj(r.controls);
  const bindingsRaw = obj(c.bindings);
  const bindings = cloneBindings(DEFAULT_BINDINGS);
  for (const a of ACTION_ORDER) {
    const b = bindingsRaw[a];
    if (Array.isArray(b) && b.length === 2) {
      bindings[a] = [typeof b[0] === 'string' ? b[0] : null, typeof b[1] === 'string' ? b[1] : null];
    }
  }
  const cam = obj(r.camera);
  const g = obj(r.graphics);
  const au = obj(r.audio);
  const ac = obj(r.accessibility);
  const helmet = cam.helmetFrame === 'off' || cam.helmetFrame === 'full' || cam.helmetFrame === 'subtle' ? cam.helmetFrame : 'subtle';
  const fpsCap = g.fpsCap === 30 || g.fpsCap === 60 ? g.fpsCap : 0;
  return {
    controls: {
      bindings,
      sensitivity: num(c.sensitivity, 0.1, 3, d.controls.sensitivity),
      invertY: bool(c.invertY, false),
      deadzone: num(c.deadzone, 0, 0.5, d.controls.deadzone),
      smoothing: num(c.smoothing, 0, 1, d.controls.smoothing),
    },
    camera: {
      mode: isCameraMode(cam.mode) ? cam.mode : d.camera.mode,
      fov: num(cam.fov, 60, 100, d.camera.fov),
      shake: num(cam.shake, 0, 1, d.camera.shake),
      helmetFrame: helmet,
    },
    graphics: {
      preset: isPreset(g.preset) ? g.preset : d.graphics.preset,
      autoPicked: bool(g.autoPicked, false),
      bloom: bool(g.bloom, true),
      chromatic: bool(g.chromatic, true),
      grain: bool(g.grain, true),
      vignette: bool(g.vignette, true),
      dof: bool(g.dof, true),
      ao: bool(g.ao, true),
      reflections: bool(g.reflections, true),
      resScale: num(g.resScale, 0.5, 1, 1),
      fpsCap,
      showFps: bool(g.showFps, false),
    },
    audio: {
      master: num(au.master, 0, 1, d.audio.master),
      music: num(au.music, 0, 1, d.audio.music),
      sfx: num(au.sfx, 0, 1, d.audio.sfx),
      ui: num(au.ui, 0, 1, d.audio.ui),
      mute: bool(au.mute, false),
    },
    accessibility: {
      reduceMotion: bool(ac.reduceMotion, false),
      reduceFlashing: bool(ac.reduceFlashing, false),
      uiScale: num(ac.uiScale, 0.8, 1.3, 1),
    },
    bootSeen: bool(r.bootSeen, false),
    briefingSeen: bool(r.briefingSeen, false),
    gpuHintShown: bool(r.gpuHintShown, false),
  };
}

// ---------------------------------------------------------------- migrations
/**
 * Ordered migrations: MIGRATIONS[n] upgrades a version-n payload to n+1.
 * v0 = the pre-release shape (flat `{ credits, ship, settings }`), kept so the
 * migration path itself is exercised by tests from day one.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  0: raw => ({
    version: 1,
    profile: { credits: raw.credits, selectedShip: raw.ship, unlockedShips: raw.unlockedShips, pilot: raw.pilot },
    settings: raw.settings ?? {},
  }),
};

/** Parse + migrate + sanitise any stored value into a valid current SaveData. */
export function migrateSave(input: unknown, prefersReducedMotion = false): SaveData {
  let raw = obj(input);
  let version = typeof raw.version === 'number' ? raw.version : 0;
  if (!input || (version === 0 && !('credits' in raw) && !('ship' in raw))) {
    return { version: SAVE_VERSION, profile: { ...DEFAULT_PROFILE, upgrades: { ...EMPTY_TIERS } }, settings: defaultSettings(prefersReducedMotion) };
  }
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    raw = step(raw);
    version = typeof raw.version === 'number' ? raw.version : version + 1;
  }
  return { version: SAVE_VERSION, profile: sanitizeProfile(raw.profile), settings: sanitizeSettings(raw.settings) };
}
