// Story bible (brief §4) — canon for all phases. Names are canon; do not
// rename. Mission copy is verbatim (polished only for rhythm). The codex is
// written in the same voice: terse, second person where it addresses you.

export const TAGLINE = 'Beyond the last star, the dark has learned to hunt.';

export const SETTING = {
  year: 2391,
  corridor: 'THE VEIL',
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
  corridor: string;
  sortie: string;
};

export const MISSION_01: Mission = {
  id: 'first-light',
  number: '01',
  title: 'FIRST LIGHT',
  header: 'CLASSIFIED // HALCYON WING // PILOT EYES ONLY',
  salutation: 'Halcyon-7,',
  body: [
    'At 04:12 station time, convoy KESTREL-9 went dark inside the first corridor of the Veil. Four transports. Eleven thousand colonists. No engines. No answer.',
    'The corridor is collapsing. You have nine minutes of road left.',
    'You are the only fighter we can launch in time. The others are gone. Fly the line. Clear the wreckage. Break anything that moves — the Umbra reached the convoy before we did, and they take no prisoners.',
    'If you hear voices in the static, do not answer. Keep flying.',
    'Bring them home, Seven.',
  ],
  signoff: ['— Commander I. Sato', 'ICS Meridian'],
  objectives: ['Reach KESTREL-9', 'Destroy Umbra interceptors', 'Keep hull above zero'],
  threat: 'LOW',
  threatLevel: 0.22,
  reward: 800,
  corridor: '01/12',
  sortie: '001',
};

export type CodexEntry = { id: string; title: string; tag: string; body: string };

/** Four entries, 40-60 words each (brief §4). */
export const CODEX: readonly CodexEntry[] = [
  {
    id: 'veil',
    title: 'THE VEIL',
    tag: 'NAV // CORRIDOR CHAIN',
    body: 'Twelve unstable wormhole corridors, strung end to end. The only road between the Outer Colonies and Earth. Pilots call flying it "riding the line." The walls breathe, the exits drift, and a corridor can fold shut behind you without warning. Nobody maps the Veil. You memorise it, or you stay in it.',
  },
  {
    id: 'umbra',
    title: 'THE UMBRA',
    tag: 'THREAT // CLASS UNKNOWN',
    body: 'A hive intelligence born inside the Veil. It builds warships from salvaged wrecks — ours included — and breeds voidspawn, organic hunters that move like smoke with teeth. It has never answered a hail. Pilots report voices in the radio static: familiar voices, asking you to turn around. Do not answer them.',
  },
  {
    id: 'halcyon-wing',
    title: 'HALCYON WING',
    tag: 'UNIT // 7 PILOTS · 1 ACTIVE',
    body: "The Meridian's last fighter wing. Seven pilots, seven callsigns, one tradition: nobody flies the line alone. That tradition died in corridor four. You are Halcyon-7, the youngest, and the only one left. The spare airframes in Bay 07 still carry the other six names. Nobody has painted over them.",
  },
  {
    id: 'meridian',
    title: 'ICS MERIDIAN',
    tag: 'CARRIER // COLONIAL FLEET',
    body: 'A colonial fleet carrier, older than most of her crew and patched in places she will not admit to. She holds station at the mouth of the Veil, launching fighters down the line and waiting for them to come back. Commander Sato runs the flight deck. The ship runs on coffee and stubbornness.',
  },
];
