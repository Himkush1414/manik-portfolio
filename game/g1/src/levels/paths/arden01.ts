// Level 1 FIRST LIGHT — ARDEN, MARROW VALLEY: the authored flight path and
// valley width profile (Phase 2R §4 / §12). ~9.3 km at 58 u/s (~2:40).
// Beat map (s in metres at 58 u/s):
//      0  cloud-break dive ends, level out ~35 u above the river (vista)
//    700  SKIM zone: 12 u over the river (spray + wake), the first wow
//   1160  forested slopes, AIM + FIRE prompt, waterfall on the left wall
//   2610  REAVERs over the treetops, stone-arch bridge
//   3190  vista: ORRIN over the ridge (climb)
//   4060  limestone gorge narrows (half-width 60-90), rockfall, ROLL prompt
//   5220  the DAM (dive under the spillway), checkpoint
//   5510  burning colony village + farmland, skitterling flock, STATIC
//   6380  vista: ORRIN rises over the ridge (climb)
//   7250  valley opens into dawn light, KESTREL-9 ahead
//   8410  weave through the transports
//   9300  landing basin — complete
// Bends obey the curvature rule (radius >= 1125 u): lateral swings of
// ~150-200 u over ~3 km; the river and walls meander inside the valley.
import type { PathDef, PathWaypoint } from '../../game/world/pathDef';
import { ENVELOPES, type EnvelopeArchetype } from '../../data/mission';

// envelope per landscape archetype (Creative Bible AC2.4; C1 replaces these with authored chapters)
const w = (x: number, z: number, clearance: number, floor: number, kind: EnvelopeArchetype, bank = 0): PathWaypoint => ({ x, z, clearance, envA: ENVELOPES[kind].a, envB: ENVELOPES[kind].b, bank, floor });

export const ARDEN_01_PATH: PathDef = {
  datum: 60,
  waypoints: [
    // straight lead-in (the dive levels out over it)
    w(0, 600, 45, 64, 'plains'),
    w(0, 0, 36, 62, 'plains'),
    w(60, -700, 22, 60, 'river'),
    w(120, -1300, 12, 58, 'river'), // SKIM
    w(150, -2000, 34, 55, 'foothills'),
    w(100, -2800, 42, 52, 'forest'),
    w(0, -3500, 120, 50, 'pass'), // vista climb: ORRIN over the ridge
    w(-110, -4200, 34, 47, 'gorge'),
    w(-150, -4900, 30, 44, 'gorge'), // gorge
    w(-120, -5550, 26, 40, 'gorge'), // dam + spillway
    w(-30, -6250, 38, 32, 'river'),
    w(70, -6950, 140, 28, 'pass'), // vista climb over the village ridge
    w(130, -7650, 40, 24, 'plains'),
    w(110, -8350, 32, 20, 'plains'),
    w(40, -9050, 30, 16, 'arena'),
    // straight lead-out over the landing basin
    w(0, -9600, 34, 14, 'arena'),
    w(0, -10100, 40, 14, 'arena'),
  ],
};

/** valley floor half-width keys [s, halfWidth] (gorge 60-90, open valley 200-260, basin 300) */
export const ARDEN_01_WIDTH: readonly (readonly [number, number])[] = [
  [0, 230], [900, 200], [1500, 170], [2700, 180], [3600, 160], [4100, 95], [4400, 72], [5000, 66], [5400, 80], [5700, 170], [6500, 200], [7300, 250], [8300, 270], [9200, 300], [11000, 300],
];
