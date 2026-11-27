// The Games library (/games): every game, its copy and its assets. Edit here, nowhere else.
//
// Facts were checked on 2026-11-27 against:
//  - Mindtier: the midas-engine README, brand/logo-mark.svg (volt #D7FF3A on ink #0F0D0B) and the live
//    site (midas-engine.vercel.app). The site sends `X-Frame-Options: DENY`, so `embeddable: false`:
//    Play opens the game in a new tab. The Google Play listing (app.mindtier) is not live yet (404).
//  - Space game: game/g1 (title from src/core/constants.ts, palette from src/ui/tokens.css, flow from
//    src/app/flow.ts). The library plays it with ?demo=eject: launch up to the catapult ejection only.
import mindtierLandAvif from './assets/covers/mindtier-land.avif';
import mindtierLandWebp from './assets/covers/mindtier-land.webp';
import mindtierPortAvif from './assets/covers/mindtier-port.avif';
import mindtierPortWebp from './assets/covers/mindtier-port.webp';
import mindtierThumbAvif from './assets/covers/mindtier-thumb.avif';
import mindtierThumbWebp from './assets/covers/mindtier-thumb.webp';
import spaceLandAvif from './assets/covers/space-land.avif';
import spaceLandWebp from './assets/covers/space-land.webp';
import spacePortAvif from './assets/covers/space-port.avif';
import spacePortWebp from './assets/covers/space-port.webp';
import spaceThumbAvif from './assets/covers/space-thumb.avif';
import spaceThumbWebp from './assets/covers/space-thumb.webp';

export type GameStatus = 'live' | 'early-build';
export type Spec = { label: string; value: string };
export type Cover = {
  /** 1920x1200 (desktop / tablet) */
  land: { avif: string; webp: string };
  /** 1080x1350 (phones) */
  port: { avif: string; webp: string };
  /** 640x400 (selector cards) */
  thumb: { avif: string; webp: string };
  alt: string;
};

type GameBase = {
  slug: string;
  title: string;
  /** short name for the selector card */
  shortTitle: string;
  tagline: string;
  status: GameStatus;
  /** the game's own colour: Play button, tags, selection, glow */
  accent: string;
  /** text colour on top of the accent (Play button label) */
  onAccent: string;
  cover: Cover;
  orientation: 'portrait' | 'landscape';
  tags: string[];
  specs: Spec[];
  description: string[];
};

export type ExternalGame = GameBase & {
  kind: 'external';
  playUrl: string;
  siteUrl: string;
  /** the play URL without the scheme, printed under the QR code */
  playUrlLabel: string;
  /** set once the store listing is live: the Android block then shows a Play Store QR */
  playStoreUrl: string | null;
  /** true only if the site allows framing from this domain (see the header check above) */
  embeddable: boolean;
  disclaimer: string;
};

export type LocalGame = GameBase & {
  kind: 'local';
  /** same-origin page loaded into the player (the game's own build) */
  src: string;
  /** where the library's playable slice stops */
  demoEndsAt: 'ship-ejects';
  devNote: string;
};

export type Game = ExternalGame | LocalGame;

export const GAMES: Game[] = [
  {
    kind: 'external',
    slug: 'mindtier',
    title: 'Mindtier',
    shortTitle: 'Mindtier',
    tagline: 'Ranked brain games. Find your tier, then climb.',
    status: 'live',
    accent: '#D7FF3A', // brand volt (brand/logo-mark.svg); the brief's #C6F135 was an estimate
    onAccent: '#0F0D0B',
    cover: {
      land: { avif: mindtierLandAvif, webp: mindtierLandWebp },
      port: { avif: mindtierPortAvif, webp: mindtierPortWebp },
      thumb: { avif: mindtierThumbAvif, webp: mindtierThumbWebp },
      alt: 'Three Mindtier phone screens on black and volt green: a Platinum II tier reveal, a 1605 rating, and a results screen with rating gains per skill.',
    },
    playUrl: 'https://midas-engine.vercel.app/play',
    siteUrl: 'https://midas-engine.vercel.app/',
    playUrlLabel: 'midas-engine.vercel.app/play',
    playStoreUrl: null,
    embeddable: false,
    orientation: 'portrait',
    tags: ['Brain training', 'Ranked', 'No ads'],
    specs: [
      { label: 'Genre', value: 'Brain training, ranked' },
      { label: 'Platform', value: 'Web (live), Android (soon)' },
      { label: 'Games', value: '15 adaptive' },
      { label: 'Ranking', value: 'Iron → Grandmaster' },
      { label: 'Modes', value: 'Ranked, Daily Challenge, Duels, Weekly league' },
      { label: 'Ads', value: 'None' },
      { label: 'Session', value: '≈ 4 min' },
    ],
    description: [
      'Mindtier turns brain games into a ranked ladder. Six short placement games (Memory, Focus, Speed, Logic, Math and Language) give you a starting tier from Iron to Grandmaster. Every ranked session after that moves your rating up or down.',
      'Puzzles adapt to your level. The Daily Challenge hands everyone the same puzzles, Duels let you beat a friend’s score, and the weekly league puts you in a table with players at your tier.',
    ],
    disclaimer: 'Ranks compare your skill at these games with other players. They are not an IQ test or a medical assessment.',
  },
  {
    kind: 'local',
    slug: 'space-game',
    title: 'Space War: Dark Edition',
    shortTitle: 'Space War',
    tagline: 'Strap in, seal the bay, and ride the catapult out into the dark.',
    status: 'early-build',
    accent: '#FF5A1F', // --ignition, game/g1/src/ui/tokens.css
    onAccent: '#0A0A0A',
    cover: {
      land: { avif: spaceLandAvif, webp: spaceLandWebp },
      port: { avif: spacePortAvif, webp: spacePortWebp },
      thumb: { avif: spaceThumbAvif, webp: spaceThumbWebp },
      alt: 'A delta-wing fighter seen from behind, engines glowing orange, the moment it leaves the launch bay into deep blue space.',
    },
    src: '/game/g1/?demo=eject',
    demoEndsAt: 'ship-ejects',
    orientation: 'landscape',
    tags: ['Space combat', '3D', 'Early build'],
    specs: [
      { label: 'Genre', value: 'Space combat flight, 3D' },
      { label: 'Engine', value: 'Three.js + React Three Fiber (WebGL 2)' },
      { label: 'Platform', value: 'Web browser (WebGL 2), landscape' },
      { label: 'Controls', value: 'Mouse and keyboard; taps work in the hangar and launch' },
      { label: 'In this slice', value: 'Boot, hangar, cockpit briefing, catapult launch' },
      { label: 'Audio', value: 'Synthesised live (Web Audio)' },
      { label: 'Build', value: 'Early build (playable slice)' },
    ],
    description: [
      'Six craft in the hangar (one unlocked to start) and two pilots. Pick your ship and livery, seal the bay, take the briefing in the cockpit, choose a camera and ride the catapult out of the launch tunnel.',
      'Everything you see is real-time 3D in the browser, and every sound is synthesised live.',
    ],
    devNote: 'The developer is still working on this game, so you’ll only play a small part of it: from launch until the ship ejects.',
  },
];

/** The footer's Navigate links: the real pages, as reached from /games. (The page has no floating nav.) */
export const GAMES_NAV = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/#projects' },
  { label: 'Skills', href: '/#skills' },
  { label: 'About', href: '/about' },
  { label: 'Games', href: '/games' },
  { label: 'Contact', href: '/#contact' },
] as const;

export const LIBRARY_COPY = {
  eyebrow: 'Library',
  heading: 'Games',
  intro: 'Things I build for fun, and to learn how games really work.',
  moreLine: 'More games are on the way. I’m building them one at a time.',
  comingSoon: 'More games coming soon',
};

export const DEFAULT_GAME = 'mindtier';
