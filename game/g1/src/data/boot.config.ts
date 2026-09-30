// Boot sequence timings (brief §8). Every beat time lives here; the master
// timeline (ui/screens/boot/bootTimeline.ts) reads nothing else. Seconds.

export const BOOT = {
  ignite: { at: 0.35 },
  streak: { start: 0.4, grow: 0.4 },
  title: { start: 0.65, charStagger: 0.035, dur: 1.35, scaleFrom: 1.28, blurFrom: 18, splitPx: 3, splitDur: 0.6 },
  edition: { start: 1.35, dur: 0.65, tracking: 0.6 },
  signature: { start: 1.8, dur: 0.7 },
  glint: { start: 2.0, dur: 0.8 },
  embers: { start: 0.8, end: 4.0 },
  hold: { start: 2.5, end: 4.0, pushIn: 1.04 },
  logoOut: { start: 4.0, dur: 0.6 },
  credit: { start: 4.35, in: 0.5, hold: 0.7, out: 0.5 },
  tagline: { start: 5.85, in: 0.7, hold: 0.8, out: 0.5, wordStagger: 0.08 },
  letterbox: { start: 5.85, dur: 0.6 },
  loading: { start: 7.65, minHold: 1.0, nominalHold: 0.3 },
  doors: { domFade: 0.3, beacons: 0.4, open: 1.65 },
  hangarUi: { dur: 1.0 },
  skip: { hintAt: 2.0, hintAtSeen: 0.5, unlockAt: 2.0, dissolve: 0.3, doorRate: 1.25 },
  dissolve: {
    out: { blur: 28, scale: 1.05, dur: 0.6 },
    in: { blur: 18, scale: 0.96, dur: 0.6 },
    overlap: 0.25,
  },
  reduced: { fade: 0.25, logoHold: 1.2, creditHold: 0.6, taglineHold: 0.7 },
} as const;

export { TAGLINE } from './lore'; // canon copy lives in lore.ts

/** Loader status lines (brief §4) mapped to real loader tasks. */
export const STATUS_LINES = {
  geometry: 'MOUNTING HANGAR BAY 07',
  audio: 'CALIBRATING SHIELD ARRAYS',
  shaders: 'COMPILING SHADER LATTICE',
  save: 'SYNCING PILOT PROFILE',
  warmup: 'PRESSURISING BAY',
  fonts: 'LOADING TYPE SYSTEMS',
} as const;
