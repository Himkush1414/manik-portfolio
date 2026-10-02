// Story bible (brief §4; Phase 2R §2 canon) — canon for all phases. Names
// are canon; do not rename. Mission copy is verbatim (dashes typeset as em
// dashes). The codex is written in the same voice: terse, second person
// where it addresses you. Phase 2R: the Veil is a chain of twelve GATES,
// each opening above a WORLD; sorties launch from the Meridian's bay down
// into the atmosphere. Nobody flies inside the Veil.
import type { CommLine } from '../levels/types';

export const TAGLINE = 'Beyond the last star, the dark has learned to hunt.';

export const SETTING = {
  year: 2391,
  gates: 'THE VEIL',
  carrier: 'ICS MERIDIAN',
  wing: 'HALCYON WING',
  callsign: 'HALCYON-7',
} as const;

export type PilotLore = { id: 'onyx' | 'ember'; name: string; rank: string; callsign: string; quote: string; trait: string };

export const PILOTS: Record<'onyx' | 'ember', PilotLore> = {
  onyx: {
    id: 'onyx',
    name: 'Dario Reyes',
    rank: 'Lt.',
    callsign: 'ONYX',
    quote: 'Steady hands. No chatter.',
    trait: 'Heavy rig · angular crest',
  },
  ember: {
    id: 'ember',
    name: 'Ines Kovac',
    rank: 'Lt.',
    callsign: 'EMBER',
    quote: "I don't fly the line. I burn it.",
    trait: 'Light rig · rear fin',
  },
};

export type Mission = {
  id: string;
  number: string;
  title: string;
  header: string;
  salutation: string;
  body: string[];
  signoff: string[];
  objectives: string[];
  threat: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  threatLevel: number; // 0..1 for the gauge
  reward: number;
  /** world number of twelve, e.g. '01/12' */
  world: string;
  /** "ARDEN - MARROW VALLEY" */
  worldName: string;
  sortie: string;
};

export const MISSION_01: Mission = {
  id: 'first-light',
  number: '01',
  title: 'FIRST LIGHT',
  header: 'CLASSIFIED // HALCYON WING // PILOT EYES ONLY',
  salutation: 'Halcyon-7,',
  body: [
    'At 04:12 station time, convoy KESTREL-9 lost its engines over the Arden highlands. Four transports. Eleven thousand colonists. They are gliding down the Marrow valley on momentum alone — and the Umbra are already in the trees.',
    'The valley is the only road to the landing basin. You have nine minutes of altitude left.',
    'You are the only fighter we can launch in time. The others are gone. Skim the river. Clear the ridgelines. Break anything that moves — they take no prisoners.',
    'If you hear voices in the static, do not answer. Keep flying.',
    'Bring them home, Seven.',
  ],
  signoff: ['— Commander I. Sato', 'ICS Meridian'],
  objectives: ['Reach KESTREL-9', 'Escort the convoy to the landing basin', 'Keep hull above zero'],
  threat: 'LOW',
  threatLevel: 0.22,
  reward: 800,
  world: '01/12',
  worldName: 'ARDEN — MARROW VALLEY',
  sortie: '001',
};

/** Sortie 010 (brief §2): the Warden holds the Great Cut on KHARAN. */
export const MISSION_10: Mission = {
  id: 'the-warden',
  number: '10',
  title: 'THE WARDEN',
  header: 'CLASSIFIED // HALCYON WING // PILOT EYES ONLY',
  salutation: 'Halcyon-7,',
  body: [
    'The fleet has reached the third gate, and the third gate opens over Kharan.',
    'Every canal on this world runs to one place: the Great Cut, a mile-wide sandstone canyon with an ancient dam at its throat. The only open gate hangs above it. So does the Warden.',
    'It is an Umbra dreadnought, Seven. It has held that canyon for nine days, and nothing we have sent has come back.',
    'Run the canals. Thread the colonnade. Keep your speed over the dunes — something lives under them.',
    'Kill the Warden, or the Meridian does not pass.',
  ],
  signoff: ['— Commander I. Sato', 'ICS Meridian'],
  objectives: ['Reach the Great Cut', 'Destroy THE WARDEN', 'Keep hull above zero'],
  threat: 'HIGH',
  threatLevel: 0.72,
  reward: 2400,
  world: '03/12',
  worldName: 'KHARAN — THE GREAT CUT',
  sortie: '010',
};

/** Sortie 022 (brief §2): STORMFRONT on STORMWARD (renamed from DEEP CORRIDOR). */
export const MISSION_22: Mission = {
  id: 'stormfront',
  number: '22',
  title: 'STORMFRONT',
  header: 'CLASSIFIED // HALCYON WING // PILOT EYES ONLY',
  salutation: 'Halcyon-7,',
  body: [
    'Stormward has not seen its sun in eleven years. The storm is the weather now.',
    'At the end of the Long Fjord a relay beacon stands on a dead headland. Reach it, and the fleet can cross the sixth gate on its signal. Miss it, and the storm cell closes the pass for a month.',
    'The fjord is flooded to the cliffs. Fly low, fly fast, and watch the water — voidspawn are rising from the sea, and something large is waiting in the narrows.',
    'Lightning does not care whose side you are on.',
    'Reach the beacon, Seven.',
  ],
  signoff: ['— Commander I. Sato', 'ICS Meridian'],
  objectives: ['Reach the relay beacon', 'Break the Bulwark at the fjord split', 'Keep hull above zero'],
  threat: 'HIGH',
  threatLevel: 0.82,
  reward: 3200,
  world: '06/12',
  worldName: 'STORMWARD — THE LONG FJORD',
  sortie: '022',
};

export const MISSIONS: Readonly<Record<string, Mission>> = { l01: MISSION_01, l10: MISSION_10, l22: MISSION_22 };

export type CodexEntry = { id: string; title: string; tag: string; body: string };

/** Four entries, 40-60 words each (brief §4). */
export const CODEX: readonly CodexEntry[] = [
  {
    id: 'veil',
    title: 'THE VEIL',
    tag: 'NAV // GATE CHAIN',
    body: 'Twelve gates, strung across the dark. Each one opens above a different world, and the only road home runs through all twelve. The Meridian arrives in orbit, holds the gate, and sends fighters down into the atmosphere to clear the way. The gates drift. Some close. Nobody flies inside the Veil and comes out the same.',
  },
  {
    id: 'umbra',
    title: 'THE UMBRA',
    tag: 'THREAT // CLASS UNKNOWN',
    body: 'A hive intelligence that came through the Veil before we did. It seeds each world with hive-spires and nests, turns the native wildlife, and lets the infestation creep outward from the spires. It builds warships from wrecks — ours included. Pilots report familiar voices in the radio static, asking you to turn around. Do not answer them.',
  },
  {
    id: 'halcyon-wing',
    title: 'HALCYON WING',
    tag: 'UNIT // 7 PILOTS · 1 ACTIVE',
    body: "The Meridian's last fighter wing. Seven pilots, seven callsigns, one tradition: nobody flies a world alone. That tradition died over the fourth gate. You are Halcyon-7, the youngest, and the only one left. The spare airframes in Bay 07 still carry the other six names. Nobody has painted over them.",
  },
  {
    id: 'meridian',
    title: 'ICS MERIDIAN',
    tag: 'CARRIER // COLONIAL FLEET',
    body: 'A colonial fleet carrier, older than most of her crew and patched in places she will not admit to. She holds orbit above each gate world and drops her fighters straight down the well, then waits for them to climb back. Commander Sato runs the flight deck. The ship runs on coffee and stubbornness.',
  },
];

/** Mission comms scripts (Phase 2R §2): Sato + STATIC whispers, by rail position (m). Timed from the
 *  §12 beat sheets at each level's cruise speed; the level timelines (W6-W8) reference them. */
export const COMMS: Readonly<Record<string, readonly CommLine[]>> = {
  l01: [
    { atM: 120, speaker: 'SATO', text: "You're under the cloud deck. That's Arden. Drop to the river and follow it." },
    { atM: 870, speaker: 'SATO', text: "Low over the water. Their comms are dead, but the valley only goes one way." },
    { atM: 1450, speaker: 'SATO', text: 'Rocks in the river. Guns are live — clear them.' },
    { atM: 2610, speaker: 'SATO', text: 'Contact over the treeline. Umbra interceptor. Break it.' },
    { atM: 4180, speaker: 'SATO', text: 'Gorge ahead, and it narrows. Roll through the gaps.' },
    { atM: 5220, speaker: 'SATO', text: "Checkpoint logged. The dam's spillway is open — go under it." },
    { atM: 5920, speaker: 'STATIC', text: "...turn around, Seven. They're already gone...", static: true },
    { atM: 6380, speaker: 'SATO', text: "Ignore that. Orrin's rising over the ridge. That's your bearing." },
    { atM: 7250, speaker: 'SATO', text: 'There. KESTREL-9. Four transports, still gliding. Get between them and the swarm.' },
    { atM: 8700, speaker: 'SATO', text: 'Lead transport is on final. Ten more seconds, Seven.' },
    { atM: 9170, speaker: 'SATO', text: "Touchdown. They're down. They're down." },
  ],
  l10: [
    { atM: 160, speaker: 'SATO', text: 'Kharan. Twin suns at your back — keep them there.' },
    { atM: 960, speaker: 'SATO', text: 'Canal canyon. Stay on the waterline.' },
    { atM: 1760, speaker: 'SATO', text: 'Colonnade ahead. The gaps are tighter than they look.' },
    { atM: 2560, speaker: 'STATIC', text: '...the sand is breathing, Seven...', static: true },
    { atM: 2720, speaker: 'SATO', text: 'Ground contact under the dunes — climb!' },
    { atM: 3600, speaker: 'SATO', text: "The Great Cut. There she is. That's the Warden." },
    { atM: 4200, speaker: 'SATO', text: 'Its shields cycle. Hit it when the plates open.' },
    { atM: 5400, speaker: 'STATIC', text: '...it was guarding you, Seven. It was keeping you out...', static: true },
  ],
  l22: [
    { atM: 190, speaker: 'SATO', text: 'Stormward. Get under the cloud and stay there.' },
    { atM: 1960, speaker: 'SATO', text: "Lightning's close. It shows you where they are before they shoot." },
    { atM: 4410, speaker: 'SATO', text: "Eels in the rain. Don't chase them — make them come to you." },
    { atM: 8620, speaker: 'SATO', text: 'Narrows. Something big is moving under the water.' },
    { atM: 9800, speaker: 'STATIC', text: "...it's cold down here, Seven. Come and see...", static: true },
    { atM: 11760, speaker: 'SATO', text: "Bulwark at the fjord split. It's grown into the rock. Shields first." },
    { atM: 13720, speaker: 'SATO', text: 'Mantas off the cliffs.' },
    { atM: 16660, speaker: 'SATO', text: 'Second contact in the narrows. Keep moving.' },
    { atM: 20580, speaker: 'SATO', text: "Beacon's lit. The pass is open. Bring her home." },
  ],
};

/** Launch comms (brief §14 LAUNCH SEQUENCE: countdown with Sato). */
export const LAUNCH_LINES = {
  count: 'Catapult armed. Clear in three.',
  release: 'Clamps away. Good hunting, Seven.',
  gate: 'Atmosphere in five. Hold her steady.',
  retry: 'Back in the air. Again.',
} as const;
