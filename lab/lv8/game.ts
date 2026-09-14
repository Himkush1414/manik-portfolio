// /lab/lv8 — "Wormhole Run": a rail-shooter down a Three.js particle
// tunnel, flown from the cockpit by default (third-person chase kept as a
// selectable alternate — see setViewpoint). Dynamically imported by
// main.ts only when "PLAY" is pressed, so none of this (or the three.js
// it pulls in) ever loads for the hub page itself, let alone any other
// route on the site.
//
// Everything performance-sensitive here follows the same rules:
//   1. Fixed-size object pools (particles, projectiles, enemies, engine-
//      trail beads, hyperspace streaks, burst shards) allocated once up
//      front — nothing is created or destroyed during play, only toggled
//      active/inactive and repositioned.
//   2. The tunnel itself is one THREE.Points cloud (PARTICLE_COUNT fixed
//      points recycled to the far end once they pass the camera — same
//      "reposition, never regrow" rule as everything else) rather than
//      solid wall geometry. That's also what fixes the earlier "visible
//      boundary" problem: a finite-radius solid cylinder always has an
//      edge the camera can see past at some angle; a dense radial particle
//      field plus a soft vanishing-point glow sprite behind it has none —
//      there is no boundary to see past, only more (sparser, dimmer)
//      particles receding into the fog.
import * as THREE from 'three';
// Bloom/glow via three.js's own bundled postprocessing addons — no new npm
// dependency needed (these ship inside the already-installed `three`
// package, typed via the already-installed `@types/three`), and since
// this whole module is only ever dynamically imported from main.ts, the
// composer/passes stay just as isolated to lv8's own chunk as everything
// else here.
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface WormholeGameCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void; // 3-heart system, levels 10+ (and always shown 0-3 at start)
  onHealthChange: (health: number) => void; // 0-100 bar, levels 1-9 only
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number, level: number) => void;
  onHit: () => void; // player took damage — main.ts pulses the screen-flash overlay
  onCrash: () => void; // obstacle collision specifically — instant, harder feedback than a miss
  onBonus: (kind: 'life' | 'frenzy') => void; // secret target found
  onPortal: (level: number, bonus: number) => void; // the level-10 scripted checkpoint — game is already paused when this fires
  onMilestone: (level: number, bonus: number) => void; // levels 20/30/40 — lighter, non-blocking achievement notice
  onSpeedChange: (speed: number) => void; // HUD readout — throttled, not fired every frame
}

export type ControlScheme = 'keyboard' | 'mouse';
export interface KeyBindings {
  left: string;
  right: string;
  up: string;
  down: string;
}
export interface GameSettings {
  controlScheme: ControlScheme;
  keyBindings: KeyBindings;
  sensitivity: number; // multiplies movement responsiveness
}
export const DEFAULT_KEY_BINDINGS: KeyBindings = { left: 'a', right: 'd', up: 'w', down: 's' };
export const DEFAULT_SETTINGS: GameSettings = {
  controlScheme: 'keyboard',
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
  sensitivity: 1,
};

export interface WormholeGameOptions {
  viewpoint?: Viewpoint;
  settings?: Partial<GameSettings>;
}

// ---- tunable constants -----------------------------------------------
const TUNNEL_RADIUS = 9;
const SHIP_MOVE_RADIUS = 6.6; // ship is kept within this — always short of the walls
const SHIP_Z = 6; // ship's fixed z (world scrolls past it, it never moves in z)

// ---- particle vortex (replaces the old solid-cylinder tunnel — see
// buildParticleField) ---------------------------------------------------
const PARTICLE_COUNT = 4000;
// a real minimum keeps a clear flight corridor down the tunnel's own axis
// — too small (particles allowed near r=0) and the ones at close range
// pile up directly in front of the camera into an unreadable bright blob
// instead of reading as walls around an open path
const PARTICLE_MIN_R = TUNNEL_RADIUS * 0.42;
const PARTICLE_MAX_R = TUNNEL_RADIUS * 1.15;
const PARTICLE_Z_FAR = -190;
const PARTICLE_Z_NEAR = SHIP_Z + 9; // recycle once a particle passes this
const PARTICLE_SPARK_CHANCE = 0.08; // rare hotter-gold flecks among the base amber field
const SHIP_EASE = 6.5; // higher = snappier glide toward target
const FIRE_COOLDOWN = 0.16; // seconds between shots
const PROJECTILE_SPEED = 95;
const PROJECTILE_MAX_POOL = 24;
const ENEMY_MAX_POOL = 18;
const ENEMY_SPAWN_Z = -150;
const HIT_RADIUS = 2.4;
const TRAIL_LENGTH = 18;
const STREAK_POOL = 8;
const START_LIVES = 3;
const BURST_POOL_SIZE = 64; // shards per burst (8) * up to 8 concurrent kills
const BURST_SHARDS = 8;
const BURST_LIFE = 0.45;

// ---- levels / dual fail conditions -------------------------------------
const LEVEL_DURATION = 26; // seconds of survival per level
const HEARTS_FROM_LEVEL = 10; // "Level 10 onward" per the brief
const HEALTH_MAX = 100;
const HEALTH_LOSS_PER_MISS = 22;

// ---- Phase 4 (revised): 50-level procedural difficulty ramp ------------
// One function still maps level -> every difficulty knob — a real
// parameter curve, not hand-authored per-level layouts — but the curve
// itself is now a small set of hand-picked (level, progress) keyframes
// with a smoothstep ease between each pair, not a single exponential.
// That's what makes "levels 1-5 are a genuine on-ramp, escalation kicks
// in at 5, escalates further at 10, keeps climbing to 50" an exact,
// checkable property of the curve instead of an approximation: progress
// barely moves across 1-5, jumps hard across 5-10, then keeps climbing.
const LEVEL_CAP = 50;
const MILESTONE_LEVELS = [10, 20, 30, 40];
const MILESTONE_BONUS_SCORE = 500;

const PROGRESS_KEYFRAMES: [level: number, progress: number][] = [
  [1, 0.0],
  [5, 0.08], // on-ramp: levels 1-5 stay near baseline, deliberately easy
  [10, 0.4], // escalation clearly kicks in right after level 5
  [20, 0.78], // escalates further from level 10
  [30, 0.9],
  [40, 0.96],
  [50, 1.0], // continues increasing all the way to level 50
];

function smoothstep(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

function levelProgress(level: number): number {
  const lvl = Math.min(Math.max(level, 1), LEVEL_CAP);
  for (let i = 0; i < PROGRESS_KEYFRAMES.length - 1; i++) {
    const [l0, p0] = PROGRESS_KEYFRAMES[i];
    const [l1, p1] = PROGRESS_KEYFRAMES[i + 1];
    if (lvl <= l1) {
      const t = (lvl - l0) / (l1 - l0);
      return p0 + (p1 - p0) * smoothstep(t);
    }
  }
  return 1;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
interface LevelParams {
  enemySpawnInterval: number;
  enemySpeedMin: number;
  enemySpeedMax: number;
  enemyWeaveAmp: number;
  obstacleInterval: number;
  obstacleSafeRadius: number;
  obstacleSpeed: number;
  debrisRockRadius: number;
  tunnelSpeedMultiplier: number; // how fast the world streams past — its own on-ramp, not just a difficulty knob
}
function getLevelParams(level: number): LevelParams {
  const p = levelProgress(level);
  return {
    enemySpawnInterval: lerp(1.6, 0.3, p),
    enemySpeedMin: lerp(24, 52, p),
    enemySpeedMax: lerp(32, 68, p),
    enemyWeaveAmp: lerp(1.2, 3.4, p),
    obstacleInterval: lerp(8.5, 1.7, p),
    obstacleSafeRadius: lerp(2.9, 0.85, p),
    obstacleSpeed: lerp(26, 60, p),
    debrisRockRadius: lerp(0.9, 1.7, p),
    tunnelSpeedMultiplier: lerp(0.55, 1.2, p),
  };
}

// ---- obstacles (terrain/debris — instant destruction on contact,
// independent of the miss-based health/hearts systems above) -----------
const OBSTACLE_MAX_POOL = 6; // set pieces, not a swarm — only a couple active at once
const OBSTACLE_SPAWN_Z = -170;
const OBSTACLE_HIT_Z_WINDOW = 1.4; // how close to SHIP_Z counts as "reached the ship" for a hit test
type ObstacleType = 'ring' | 'split' | 'debris';

// ---- secret bonus targets — rare, deliberately easy to miss -----------
const SECRET_MAX_POOL = 2;
const SECRET_CHECK_INTERVAL = 20; // roll for a spawn at most this often
const SECRET_SPAWN_CHANCE = 0.35; // per roll — genuinely uncommon, not a guaranteed per-level pickup
const FRENZY_DURATION = 9;

// ---- HUD speed readout ---------------------------------------------------
const SPEED_READOUT_INTERVAL = 0.15; // throttled — no need to touch the DOM every frame for one stat
const SPEED_BASE = 220;
const SPEED_RANGE = 260;

type Enemy = {
  active: boolean;
  group: THREE.Group;
  z: number;
  baseX: number;
  baseY: number;
  weaveAmp: number;
  weaveFreq: number;
  phase: number;
  speed: number;
  spawnTime: number;
};

type Projectile = {
  active: boolean;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

type Streak = {
  active: boolean;
  mesh: THREE.Mesh;
  z: number;
  speed: number;
};

type BurstShard = {
  active: boolean;
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
};

// A single obstacle "set piece". `group` holds every visual part; the
// actual hit-test geometry is described separately (gapX/gapY/gapRadius
// pairs, or rock offsets+radii for debris) since it needs to run as plain
// math against the ship's own (x,y), not a mesh-vs-mesh check — obstacles
// pass the ship at speed and are only ever tested for a brief window
// around z === SHIP_Z (see checkObstacleCollision).
type Obstacle = {
  active: boolean;
  type: ObstacleType;
  group: THREE.Group;
  z: number;
  speed: number;
  tested: boolean; // hit-tested once per pass, not every frame it's near SHIP_Z
  gaps: { x: number; y: number; r: number }[]; // safe zones (ring/split) OR solid rocks (debris — inverted test)
};

type Secret = {
  active: boolean;
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  speed: number;
};

// 'third' = classic distant chase camera; 'second' = the same chase
// framing pulled in much closer ("second-person" per the brief — not a
// standard camera term, translated here as a tighter/more intimate chase
// variant; see the chat reply). Cockpit kept as a third option alongside
// both, per the brief's default assumption.
export type Viewpoint = 'cockpit' | 'third' | 'second';
const CHASE_OFFSETS: Record<'third' | 'second', { y: number; z: number; fov: number }> = {
  third: { y: 3.4, z: 7, fov: 62 },
  second: { y: 2.1, z: 3.4, fov: 70 },
};

export class WormholeGame {
  private container: HTMLElement;
  private callbacks: WormholeGameCallbacks;

  private renderer: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private viewpoint: Viewpoint = 'cockpit';

  private ship: THREE.Group;
  private shipX = 0;
  private shipY = 0;
  private targetX = 0;
  private targetY = 0;
  private prevX = 0;
  private prevY = 0;

  private trailBeads: THREE.Mesh[] = [];
  private trailHistory: { x: number; y: number }[] = [];

  private particles!: THREE.Points;
  private particlePos!: Float32Array;
  private particleColor!: Float32Array;
  private particleBaseColor!: Float32Array; // un-brightened colour, re-scaled into particleColor per frame
  private particleSize!: Float32Array; // per-particle base size variance (bigger = reads as "nearer layer")
  private particleZ!: Float32Array;
  private particleSpeed!: Float32Array;
  private vanishingGlow!: THREE.Sprite;
  private tunnelHaze!: THREE.Mesh;
  // referenced directly for disposal — it lives inside the particle
  // ShaderMaterial's custom uniforms, which the generic scene.traverse()
  // disposal pass in dispose() has no way to reach on its own (unlike a
  // built-in material's .map, which that pass already handles)
  private particleDotTexture!: THREE.CanvasTexture;
  // warm palette only (the strip-field/Bento correction pass explicitly
  // retired every cyan/violet accent site-wide) — a common amber base
  // fleck plus a rarer hotter pale-gold spark for sparkle variety, no
  // second hue family
  private readonly particleAmber = new THREE.Color(0xff8a3d);
  private readonly particleSpark = new THREE.Color(0xffe9a8);

  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private streaks: Streak[] = [];
  private burstShards: BurstShard[] = [];
  private obstacles: Obstacle[] = [];
  private secrets: Secret[] = [];

  private keys = new Set<string>();
  private lastFireTime = -Infinity;
  private settings: GameSettings = { ...DEFAULT_SETTINGS, keyBindings: { ...DEFAULT_KEY_BINDINGS } };

  // mouse aim (Keyboard + Mouse control scheme only — movement stays on
  // keys either way, see updateInput). Tracked unconditionally (cheap);
  // only acted on while settings.controlScheme === 'mouse'.
  private mouseNdcX = 0;
  private mouseNdcY = 0;
  private mouseDown = false;

  private score = 0;
  private lives = START_LIVES;
  private health = HEALTH_MAX;
  private level = 1;
  private elapsed = 0;
  private nextSpawnAt = 1.2;
  private nextStreakAt = 2;
  private nextObstacleAt = 5;
  private nextSecretCheckAt = SECRET_CHECK_INTERVAL;
  private frenzyUntil = -Infinity;
  private nextSpeedReadoutAt = 0;
  private lastDisplaySpeed = -1;
  private running = false;
  private gameOver = false;
  private paused = false;
  private rafId: number | null = null;
  private lastFrameTime = 0;

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const kb = this.settings.keyBindings;
    if ([kb.left, kb.right, kb.up, kb.down, ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
    }
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onResize = () => this.handleResize();
  private onMouseMove = (e: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouseNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (this.settings.controlScheme === 'mouse' && this.reticleEl) {
      this.reticleEl.style.left = `${e.clientX}px`;
      this.reticleEl.style.top = `${e.clientY}px`;
    }
  };
  private onMouseDown = () => {
    this.mouseDown = true;
  };
  private onMouseUp = () => {
    this.mouseDown = false;
  };
  private cockpitFrameEl = document.getElementById('lv8-cockpit');
  private reticleEl = document.getElementById('lv8-reticle');

  constructor(
    container: HTMLElement,
    callbacks: WormholeGameCallbacks,
    options: WormholeGameOptions = {}
  ) {
    this.container = container;
    this.callbacks = callbacks;
    if (options.settings) this.applySettings(options.settings);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x15100d, 0.021);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    this.camera.position.set(0, 3.4, SHIP_Z + 7);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x15100d, 1);
    // RenderPass bakes the renderer's sRGB output encoding into every
    // fragment it draws regardless of which target it's rendering into —
    // including EffectComposer's own offscreen intermediate buffer, which
    // is meant to stay in LINEAR space until the final OutputPass encodes
    // it once for the actual screen. Leaving outputColorSpace at its
    // default (sRGB) here meant that encode happened TWICE — once baked
    // into the offscreen render, once again in OutputPass — which is what
    // was blowing every dark background into a flat, washed-out grey no
    // matter how bloom itself was tuned. Forcing linear here and letting
    // OutputPass (below) do the one real sRGB encode fixes it.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Bloom pass: the only thing that turns additive particles/emissive
    // materials into an actual soft glow instead of hard flat colour —
    // threshold kept high enough that only genuinely bright pixels (the
    // particle field, engine/projectile embers, enemy eyes) bleed light,
    // not the whole dim scene.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.4, 0.62);
    this.composer.addPass(this.bloomPass);
    // required as the last pass: applies the one real sRGB encode for the
    // actual screen output (see the outputColorSpace note above).
    this.composer.addPass(new OutputPass());

    this.addLights();
    this.buildParticleField();
    this.buildTunnelHaze();
    this.ship = this.buildShip();
    this.scene.add(this.ship);
    this.buildTrail();
    this.buildProjectilePool();
    this.buildEnemyPool();
    this.buildStreakPool();
    this.buildBurstPool();
    this.buildObstaclePool();
    this.buildSecretPool();
    this.setViewpoint(options.viewpoint ?? 'cockpit');
    this.reticleEl?.classList.toggle('is-active', this.settings.controlScheme === 'mouse');
    this.container.classList.toggle('lv8-hide-cursor', this.settings.controlScheme === 'mouse');

    this.handleResize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  // ---- setup -----------------------------------------------------------

  private addLights() {
    const hemi = new THREE.HemisphereLight(0xa8492f, 0x0a0605, 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffcf9e, 0.6);
    key.position.set(2, 4, 6);
    this.scene.add(key);
  }

  // a small offscreen-canvas radial-gradient texture — used both as the
  // particles' own sprite (a soft glowing dot instead of a hard square)
  // and, scaled way up, as the distant vanishing-point haze. Generated
  // once, not loaded as a binary asset — keeps this file self-contained.
  private makeRadialTexture(inner: string, outer: string, size = 64): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // The tunnel itself: a single custom-shader THREE.Points cloud of
  // particles streaming outward along radial lines toward the camera,
  // backed by a soft haze cylinder (buildTunnelHaze) and a vanishing-point
  // glow sprite. This is what replaces the old solid-cylinder tunnel — a
  // finite-radius solid wall always has an edge the camera can see past at
  // some angle (the "visible boundary" complaint); a dense particle field
  // with no hard edge of its own has nothing to see past.
  //
  // A plain PointsMaterial only offers ONE uniform size for every particle
  // — sizeAttenuation makes near ones bigger too, but the effect reads as
  // subtle at normal sizes. A small custom ShaderMaterial gives each
  // particle its own base size (aSize) that then ALSO attenuates with
  // distance in the vertex shader, compounding into a size difference
  // that's obvious at a glance, not just technically present.
  private buildParticleField() {
    const dotTex = this.makeRadialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.particleDotTexture = dotTex;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    this.particleZ = new Float32Array(PARTICLE_COUNT);
    this.particleSpeed = new Float32Array(PARTICLE_COUNT);
    this.particleSize = sizes;
    this.particleBaseColor = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.resetParticle(i, positions, true);
    }
    colors.set(this.particleBaseColor);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.particlePos = positions;
    this.particleColor = colors;

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: dotTex } },
      vertexShader: `
        attribute float aSize;
        attribute vec3 aColor;
        varying vec3 vColor;
        void main() {
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 1.0);
          gl_PointSize = min(aSize * (190.0 / dist), 42.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying vec3 vColor;
        uniform sampler2D uMap;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor, 1.0) * tex;
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);

    // dark vanishing point the particles stream out of/toward — a big
    // soft sprite far down the tunnel, additive so it reads as a glow,
    // not a flat disc
    const glowTex = this.makeRadialTexture('rgba(255,138,61,0.48)', 'rgba(21,16,13,0)');
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.vanishingGlow = new THREE.Sprite(glowMat);
    this.vanishingGlow.scale.set(58, 58, 1);
    this.vanishingGlow.position.set(0, 0, PARTICLE_Z_FAR + 10);
    this.scene.add(this.vanishingGlow);
  }

  // A soft, dark-to-warm cylindrical haze wall the camera sits inside of —
  // the "volumetric" base layer underneath the particles, and the thing
  // that makes the tunnel legibly read as an enclosing tube (not just a
  // field of dots floating in a void). Built once and never moved: the
  // ship's z position is fixed and the world scrolls past it, so a static
  // mesh spanning the same z-range as the particle field costs nothing
  // per frame. Additive + BackSide (we're always inside it, looking at its
  // inner face) with vertex colours that go fully black at the far end —
  // additive black contributes nothing, so it fades out for free with no
  // per-vertex alpha needed.
  private buildTunnelHaze() {
    const length = PARTICLE_Z_NEAR - PARTICLE_Z_FAR + 30;
    const radialSegments = 28;
    const heightSegments = 22;
    const geo = new THREE.CylinderGeometry(TUNNEL_RADIUS * 1.03, TUNNEL_RADIUS * 1.03, length, radialSegments, heightSegments, true);

    const dark = new THREE.Color(0x15100d);
    const warm = new THREE.Color(0xa83421);
    const posAttr = geo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i); // -length/2 (far) .. +length/2 (near, toward camera)
      const t = smoothstep((y + length / 2) / length);
      const bright = t * t; // concentrate the glow near the ship, not spread evenly
      // faint vertical ribs (angle-based) so the wall reads as structured
      // panelling, not a smooth featureless gradient — subtle, stays under
      // the particle layer rather than competing with it
      const angle = Math.atan2(posAttr.getZ(i), posAttr.getX(i));
      const rib = 0.85 + 0.15 * Math.sin(angle * 14);
      const r = dark.r + (warm.r - dark.r) * bright * rib;
      const g = dark.g + (warm.g - dark.g) * bright * rib;
      const b = dark.b + (warm.b - dark.b) * bright * rib;
      colors[i * 3] = r * bright; // additive-black-at-far trick: scale by
      colors[i * 3 + 1] = g * bright; // brightness again so the far end
      colors[i * 3 + 2] = b * bright; // truly goes to (near) zero, not dark red
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
      fog: false,
    });
    this.tunnelHaze = new THREE.Mesh(geo, mat);
    this.tunnelHaze.rotation.x = Math.PI / 2; // cylinder's local Y (height) becomes world Z (tunnel length)
    this.tunnelHaze.position.z = (PARTICLE_Z_FAR + PARTICLE_Z_NEAR) / 2;
    this.scene.add(this.tunnelHaze);
  }

  private resetParticle(i: number, positions: Float32Array, initialSpread: boolean) {
    const angle = Math.random() * Math.PI * 2;
    // sqrt-distributed radius so particles don't bunch up near the centre
    const r = PARTICLE_MIN_R + (PARTICLE_MAX_R - PARTICLE_MIN_R) * Math.sqrt(Math.random());
    const z = initialSpread ? PARTICLE_Z_FAR + Math.random() * (PARTICLE_Z_NEAR - PARTICLE_Z_FAR) : PARTICLE_Z_FAR - Math.random() * 20;

    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r;
    positions[i * 3 + 2] = z;
    this.particleZ[i] = z;
    this.particleSpeed[i] = 40 + Math.random() * 46;
    // each particle keeps its own random base size for its whole life —
    // combined with the shader's own distance attenuation, this is what
    // makes "near = bigger" compound into an obvious difference instead
    // of a uniform field that merely shrinks smoothly with distance
    this.particleSize[i] = 3.4 + Math.random() * 6.2;

    const brightness = 0.55 + Math.random() * 0.45;
    const c = Math.random() < PARTICLE_SPARK_CHANCE ? this.particleSpark : this.particleAmber;
    this.particleBaseColor[i * 3] = c.r * brightness;
    this.particleBaseColor[i * 3 + 1] = c.g * brightness;
    this.particleBaseColor[i * 3 + 2] = c.b * brightness;
  }

  private buildShip(): THREE.Group {
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({ color: 0x1a100c, roughness: 0.4, metalness: 0.5 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0xa83421 });

    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 6), hullMat);
    fuselage.rotation.x = -Math.PI / 2;
    group.add(fuselage);

    const wingGeo = new THREE.BoxGeometry(2.4, 0.08, 0.9);
    const wing = new THREE.Mesh(wingGeo, hullMat);
    wing.position.z = 0.3;
    group.add(wing);

    const finGeo = new THREE.BoxGeometry(0.08, 0.5, 0.7);
    const finL = new THREE.Mesh(finGeo, accentMat);
    finL.position.set(-1.1, 0.2, 0.5);
    group.add(finL);
    const finR = finL.clone();
    finR.position.x = 1.1;
    group.add(finR);

    const engineGlow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), accentMat);
    engineGlow.position.z = 1.15;
    group.add(engineGlow);

    group.position.z = SHIP_Z;
    return group;
  }

  private buildTrail() {
    const mat = () => new THREE.MeshBasicMaterial({ color: 0xa83421, transparent: true, opacity: 0 });
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const bead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat());
      bead.visible = false;
      this.scene.add(bead);
      this.trailBeads.push(bead);
    }
  }

  private buildProjectilePool() {
    const geo = new THREE.CapsuleGeometry(0.09, 0.6, 2, 4);
    // a hotter ember tone than the structural lit-red accents elsewhere —
    // reads clearly as active fired energy against the tunnel/ship
    for (let i = 0; i < PROJECTILE_MAX_POOL; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc988 }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({ active: false, mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: -PROJECTILE_SPEED });
    }
  }

  // Creatures, not ships — an organic silhouette (irregular stretched
  // blob body + jagged horn spikes + a single glowing eye) rather than
  // the previous crystalline/vehicle-like octahedron. Shared geometry and
  // materials across the whole pool (cheap), but each pooled creature
  // gets its own randomized spike layout/scale at build time so the
  // swarm doesn't read as one shape stamped repeatedly.
  private buildEnemyPool() {
    const bodyGeo = new THREE.IcosahedronGeometry(0.62, 0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2a0f10,
      emissive: 0xff8a3d,
      emissiveIntensity: 0.55,
      roughness: 0.6,
      metalness: 0.15,
      flatShading: true,
    });
    const spikeGeo = new THREE.ConeGeometry(0.1, 0.5, 5);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0a08,
      emissive: 0xff8a3d,
      emissiveIntensity: 0.3,
      roughness: 0.7,
      flatShading: true,
    });
    const eyeGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

    for (let i = 0; i < ENEMY_MAX_POOL; i++) {
      const group = new THREE.Group();

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      // irregular, non-uniform stretch so the body reads as an organic
      // blob rather than a perfect crystalline solid
      body.scale.set(0.85 + Math.random() * 0.3, 0.8 + Math.random() * 0.35, 1.05 + Math.random() * 0.35);
      group.add(body);

      const spikeCount = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < spikeCount; s++) {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        spike.position.copy(dir).multiplyScalar(0.45);
        spike.lookAt(dir.clone().multiplyScalar(2));
        spike.rotateX(Math.PI / 2);
        spike.scale.setScalar(0.7 + Math.random() * 0.6);
        group.add(spike);
      }

      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0, 0.05, 0.55); // faces the player, down the +Z approach direction
      group.add(eye);

      group.visible = false;
      this.scene.add(group);
      this.enemies.push({
        active: false,
        group,
        z: ENEMY_SPAWN_Z,
        baseX: 0,
        baseY: 0,
        weaveAmp: 0,
        weaveFreq: 0,
        phase: 0,
        speed: 0,
        spawnTime: 0,
      });
    }
  }

  private buildStreakPool() {
    const geo = new THREE.PlaneGeometry(0.06, 6);
    // same hot ember tone as the projectiles (no violet secondary accent
    // any more — everything stays within the warm red/brown family)
    for (let i = 0; i < STREAK_POOL; i++) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: 0xffc988, transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.streaks.push({ active: false, mesh, z: 0, speed: 0 });
    }
  }

  private buildBurstPool() {
    const geo = new THREE.TetrahedronGeometry(0.14, 0);
    for (let i = 0; i < BURST_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff9a6e, transparent: true, opacity: 0 }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.burstShards.push({ active: false, mesh, vx: 0, vy: 0, vz: 0, life: 0 });
    }
  }

  // Each pooled slot carries all three obstacle "looks" as hidden children
  // and just shows the one that matches whatever type it's spawned as —
  // simpler than three separate pools, and with only OBSTACLE_MAX_POOL (6)
  // slots the handful of extra idle meshes per slot costs nothing.
  private buildObstaclePool() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a1712,
      emissive: 0x6f2417,
      emissiveIntensity: 0.5,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xa83421 });
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.95, flatShading: true });

    for (let i = 0; i < OBSTACLE_MAX_POOL; i++) {
      const group = new THREE.Group();

      // "ring" look: a flat annulus (solid material) with a bright inner
      // edge marking the safe opening
      const ringGroup = new THREE.Group();
      ringGroup.name = 'ring';
      const ringWall = new THREE.Mesh(new THREE.RingGeometry(2.4, TUNNEL_RADIUS * 1.05, 24), wallMat);
      ringGroup.add(ringWall);
      const ringEdge = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 6, 24), edgeMat);
      ringGroup.add(ringEdge);
      group.add(ringGroup);

      // "split" look: one central blocking slab, safe gaps on either side
      const splitGroup = new THREE.Group();
      splitGroup.name = 'split';
      const slab = new THREE.Mesh(new THREE.BoxGeometry(4.4, TUNNEL_RADIUS * 2, 0.6), wallMat);
      splitGroup.add(slab);
      const slabEdgeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, TUNNEL_RADIUS * 2, 0.7), edgeMat);
      slabEdgeL.position.x = -2.2;
      splitGroup.add(slabEdgeL);
      const slabEdgeR = slabEdgeL.clone();
      slabEdgeR.position.x = 2.2;
      splitGroup.add(slabEdgeR);
      group.add(splitGroup);

      // "debris" look: a handful of irregular rocks, individually dodged
      const debrisGroup = new THREE.Group();
      debrisGroup.name = 'debris';
      for (let r = 0; r < 4; r++) {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.scale.setScalar(0.6 + Math.random() * 0.5);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        debrisGroup.add(rock);
      }
      group.add(debrisGroup);

      group.visible = false;
      this.scene.add(group);
      this.obstacles.push({ active: false, type: 'ring', group, z: OBSTACLE_SPAWN_Z, speed: 0, tested: false, gaps: [] });
    }
  }

  private buildSecretPool() {
    const geo = new THREE.OctahedronGeometry(0.4, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 });
    for (let i = 0; i < SECRET_MAX_POOL; i++) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(geo, mat);
      group.add(core);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.makeRadialTexture('rgba(255,233,168,0.9)', 'rgba(255,233,168,0)'),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      glow.scale.set(2.2, 2.2, 1);
      group.add(glow);
      group.visible = false;
      this.scene.add(group);
      this.secrets.push({ active: false, group, x: 0, y: 0, z: OBSTACLE_SPAWN_Z, speed: 0 });
    }
  }

  private handleResize() {
    // window.innerWidth/innerHeight, not just container.clientWidth — the
    // container is a position:fixed, inset:0 overlay so the two should
    // always agree, but reading directly off the viewport is one less
    // link in the chain that could ever produce a letterboxed canvas.
    const w = window.innerWidth || this.container.clientWidth;
    const h = window.innerHeight || this.container.clientHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    // composer.setSize() would otherwise size bloom's own (5-mip, ~12
    // extra full-screen blur passes per frame) render targets at full
    // resolution too — a soft glow doesn't need that, and halving it here
    // cuts bloom's own cost roughly 4x for no visible quality loss.
    this.bloomPass.setSize(Math.round(w / 2), Math.round(h / 2));
  }

  // ---- viewpoint -----------------------------------------------------

  // Cockpit (default): the camera IS the pilot's eyes — no ship exterior
  // ever in view. Third: the classic distant chase framing. Second: the
  // same chase framing pulled in noticeably closer. Safe to call at any
  // time, including mid-run (see Phase 2's pause-menu viewpoint switch).
  setViewpoint(vp: Viewpoint) {
    this.viewpoint = vp;
    this.ship.visible = vp !== 'cockpit';
    this.cockpitFrameEl?.classList.toggle('is-active', vp === 'cockpit');
    this.camera.fov = vp === 'cockpit' ? 78 : CHASE_OFFSETS[vp].fov;
    this.camera.updateProjectionMatrix();
  }

  getViewpoint(): Viewpoint {
    return this.viewpoint;
  }

  // ---- settings ------------------------------------------------------

  private applySettings(partial: Partial<GameSettings>) {
    this.settings = {
      ...this.settings,
      ...partial,
      keyBindings: { ...this.settings.keyBindings, ...(partial.keyBindings ?? {}) },
    };
  }

  // Public entry point — called from the pause menu (Phase 2) to change
  // sensitivity/bindings/control scheme live, mid-run, with no need to
  // reconstruct the game.
  setSettings(partial: Partial<GameSettings>) {
    this.applySettings(partial);
    this.reticleEl?.classList.toggle('is-active', this.settings.controlScheme === 'mouse');
    this.container.classList.toggle('lv8-hide-cursor', this.settings.controlScheme === 'mouse');
  }

  getSettings(): GameSettings {
    return { ...this.settings, keyBindings: { ...this.settings.keyBindings } };
  }

  // ---- pause -----------------------------------------------------------

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastFrameTime = performance.now(); // avoid a huge dt jump on the first frame back
  }

  isPaused(): boolean {
    return this.paused;
  }

  // ---- lifecycle ---------------------------------------------------------

  start() {
    this.running = true;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  restart() {
    this.score = 0;
    this.lives = START_LIVES;
    this.health = HEALTH_MAX;
    this.level = 1;
    this.elapsed = 0;
    this.nextSpawnAt = 1.2;
    this.nextStreakAt = 2;
    this.nextObstacleAt = 5;
    this.nextSecretCheckAt = SECRET_CHECK_INTERVAL;
    this.frenzyUntil = -Infinity;
    this.nextSpeedReadoutAt = 0;
    this.lastDisplaySpeed = -1;
    this.gameOver = false;
    this.paused = false;
    this.shipX = this.shipY = this.targetX = this.targetY = 0;
    this.trailHistory = [];
    for (const e of this.enemies) {
      e.active = false;
      e.group.visible = false;
    }
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const s of this.streaks) {
      s.active = false;
      s.mesh.visible = false;
    }
    for (const b of this.burstShards) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const o of this.obstacles) {
      o.active = false;
      o.group.visible = false;
    }
    for (const s of this.secrets) {
      s.active = false;
      s.group.visible = false;
    }
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onLivesChange(this.lives);
    this.callbacks.onHealthChange(this.health);
    this.callbacks.onLevelChange(this.level);
    this.running = true;
  }

  dispose() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.reticleEl?.classList.remove('is-active');
    this.container.classList.remove('lv8-hide-cursor');

    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const m of mats) {
        // canvas-generated textures (particle dot / vanishing-point glow)
        // aren't freed by material.dispose() on their own
        const withMap = m as THREE.Material & { map?: THREE.Texture | null };
        withMap.map?.dispose();
        m.dispose();
      }
    });
    this.composer.dispose();
    this.bloomPass.dispose();
    this.particleDotTexture.dispose();
    this.renderer.dispose();
    if (this.cockpitFrameEl) this.cockpitFrameEl.classList.remove('is-active');
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // ---- main loop ---------------------------------------------------------

  private loop = (time: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min((time - this.lastFrameTime) / 1000, 1 / 20);
    this.lastFrameTime = time;
    if (this.running && !this.gameOver && !this.paused) this.update(dt);
    this.composer.render();
  };

  private update(dt: number) {
    this.elapsed += dt;
    this.updateLevel();
    this.updateSpeedReadout();
    this.updateInput(dt);
    this.updateShip(dt);
    this.updateTrail();
    this.updateParticles(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateObstacles(dt);
    this.updateSecrets(dt);
    this.updateStreaks(dt);
    this.updateBursts(dt);
    this.checkCollisions();
    this.updateCamera(dt);
  }

  private updateLevel() {
    const next = 1 + Math.floor(this.elapsed / LEVEL_DURATION);
    if (next !== this.level) {
      this.level = next;
      this.callbacks.onLevelChange(this.level);
      if (MILESTONE_LEVELS.includes(this.level)) {
        this.score += MILESTONE_BONUS_SCORE;
        this.callbacks.onScoreChange(this.score);
        if (this.level === 10) {
          // the one scripted checkpoint — game.ts pauses itself so main.ts
          // only has to show the message and call resume() on "Ready"
          this.pause();
          this.callbacks.onPortal(this.level, MILESTONE_BONUS_SCORE);
        } else {
          this.callbacks.onMilestone(this.level, MILESTONE_BONUS_SCORE);
        }
      }
    }
  }

  // Speed HUD readout — a fictional but honest number: it's literally
  // derived from the same level-progress curve driving the tunnel's own
  // rush-past speed (see updateParticles), plus a little live wobble so it
  // doesn't read as a static label. Throttled to a few times a second
  // rather than every frame, and only pushed to the callback when the
  // rounded value actually changes, since main.ts writes it straight to
  // the DOM.
  private updateSpeedReadout() {
    if (this.elapsed < this.nextSpeedReadoutAt) return;
    this.nextSpeedReadoutAt = this.elapsed + SPEED_READOUT_INTERVAL;
    const p = levelProgress(this.level);
    const wobble = Math.sin(this.elapsed * 3.1) * 8 + Math.sin(this.elapsed * 1.7) * 5;
    const speed = Math.round(SPEED_BASE + SPEED_RANGE * p + wobble);
    if (speed !== this.lastDisplaySpeed) {
      this.lastDisplaySpeed = speed;
      this.callbacks.onSpeedChange(speed);
    }
  }

  // ---- ship / input --------------------------------------------------

  private updateInput(dt: number) {
    // Movement is always keys, regardless of control scheme — only aim/
    // fire changes between "Keyboard" (Space, straight ahead) and
    // "Keyboard + Mouse" (click, aimed at the cursor). Bindings and
    // sensitivity are both live-configurable (see setSettings).
    const moveStep = 22 * dt * this.settings.sensitivity;
    const kb = this.settings.keyBindings;
    if (this.keys.has(kb.left)) this.targetX -= moveStep;
    if (this.keys.has(kb.right)) this.targetX += moveStep;
    if (this.keys.has(kb.up)) this.targetY += moveStep;
    if (this.keys.has(kb.down)) this.targetY -= moveStep;

    const len = Math.hypot(this.targetX, this.targetY);
    if (len > SHIP_MOVE_RADIUS) {
      const scale = SHIP_MOVE_RADIUS / len;
      this.targetX *= scale;
      this.targetY *= scale;
    }

    if (this.settings.controlScheme === 'mouse') {
      if (this.mouseDown) this.fire();
    } else if (this.keys.has(' ')) {
      this.fire();
    }
  }

  private updateShip(dt: number) {
    this.prevX = this.shipX;
    this.prevY = this.shipY;
    const ease = 1 - Math.exp(-SHIP_EASE * dt);
    this.shipX += (this.targetX - this.shipX) * ease;
    this.shipY += (this.targetY - this.shipY) * ease;

    this.ship.position.x = this.shipX;
    this.ship.position.y = this.shipY;

    const vx = (this.shipX - this.prevX) / Math.max(dt, 0.0001);
    const vy = (this.shipY - this.prevY) / Math.max(dt, 0.0001);
    const targetRoll = THREE.MathUtils.clamp(-vx * 0.05, -0.6, 0.6);
    const targetPitch = THREE.MathUtils.clamp(vy * 0.04, -0.4, 0.4);
    this.ship.rotation.z += (targetRoll - this.ship.rotation.z) * Math.min(1, dt * 8);
    this.ship.rotation.x += (targetPitch - this.ship.rotation.x) * Math.min(1, dt * 8);
  }

  private updateTrail() {
    this.trailHistory.unshift({ x: this.shipX, y: this.shipY });
    if (this.trailHistory.length > TRAIL_LENGTH) this.trailHistory.length = TRAIL_LENGTH;

    for (let i = 0; i < this.trailBeads.length; i++) {
      const bead = this.trailBeads[i];
      const sample = this.trailHistory[i];
      if (!sample) {
        bead.visible = false;
        continue;
      }
      const t = i / TRAIL_LENGTH; // 0 near ship -> 1 at the tail
      bead.visible = true;
      bead.position.set(sample.x, sample.y, SHIP_Z + 0.6 + i * 0.22);
      const scale = 1 - t * 0.75;
      bead.scale.setScalar(scale);
      (bead.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55;
    }
  }

  private fire() {
    const now = this.elapsed;
    if (now - this.lastFireTime < FIRE_COOLDOWN) return;
    this.lastFireTime = now;

    let dirX: number;
    let dirY: number;
    let dirZ: number;
    if (this.settings.controlScheme === 'mouse') {
      const target = this.unprojectMouse();
      const dx = target.x - this.shipX;
      const dy = target.y - this.shipY;
      const dz = target.z - (SHIP_Z - 1.4);
      const len = Math.hypot(dx, dy, dz) || 1;
      dirX = dx / len;
      dirY = dy / len;
      dirZ = dz / len;
    } else {
      dirX = 0;
      dirY = 0;
      dirZ = -1;
    }

    if (this.frenzyActive) {
      // secret-bonus reward: quad-fire, a small angular spread around the
      // same base aim direction rather than 4 identical overlapping bolts
      const spreads: [number, number][] = [
        [-0.09, 0.05],
        [-0.03, -0.05],
        [0.03, 0.05],
        [0.09, -0.05],
      ];
      for (const [ox, oy] of spreads) this.spawnProjectile(dirX + ox, dirY + oy, dirZ);
    } else {
      this.spawnProjectile(dirX, dirY, dirZ);
    }
  }

  private spawnProjectile(dirX: number, dirY: number, dirZ: number) {
    const slot = this.projectiles.find(p => !p.active);
    if (!slot) return;
    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    slot.active = true;
    slot.x = this.shipX;
    slot.y = this.shipY;
    slot.z = SHIP_Z - 1.4;
    slot.vx = (dirX / len) * PROJECTILE_SPEED;
    slot.vy = (dirY / len) * PROJECTILE_SPEED;
    slot.vz = (dirZ / len) * PROJECTILE_SPEED;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
    // orient the bolt to match its actual travel direction (only on fire,
    // not per-frame — the capsule's long axis is Y by default, hence the
    // extra 90-degree twist after lookAt points its Z at the target)
    slot.mesh.lookAt(slot.x + slot.vx, slot.y + slot.vy, slot.z + slot.vz);
    slot.mesh.rotateX(Math.PI / 2);
  }

  // Projects the mouse's screen position through the camera onto a fixed
  // plane well down the tunnel, giving a real 3D aim point for "Keyboard
  // + Mouse" mode's fired bolts — not just a flat screen-space offset.
  // Only called on an actual fire (cooldown-limited), never per frame, so
  // the small allocation here is negligible.
  private unprojectMouse(): THREE.Vector3 {
    const vec = new THREE.Vector3(this.mouseNdcX, this.mouseNdcY, 0.5).unproject(this.camera);
    const dir = vec.sub(this.camera.position).normalize();
    const planeZ = SHIP_Z - 70;
    const dist = dir.z !== 0 ? (planeZ - this.camera.position.z) / dir.z : 1;
    return this.camera.position.clone().addScaledVector(dir, dist);
  }

  // ---- particle tunnel ---------------------------------------------------

  private updateParticles(dt: number) {
    const pos = this.particlePos;
    const col = this.particleColor;
    const base = this.particleBaseColor;
    const depthRange = PARTICLE_Z_NEAR - PARTICLE_Z_FAR;
    // ties the tunnel's own perceived rush-past speed to the same level
    // curve as everything else — levels 1-5 stream past noticeably slower,
    // which is a big part of "level 1 feels like an on-ramp, not a wall"
    const speedMul = getLevelParams(this.level).tunnelSpeedMultiplier;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let z = this.particleZ[i] + this.particleSpeed[i] * speedMul * dt;
      if (z > PARTICLE_Z_NEAR) {
        // recycled to the far end with a fresh angle/radius — same
        // "reposition, never regrow" rule as every other pool here
        this.resetParticle(i, pos, false);
        z = this.particleZ[i];
      } else {
        this.particleZ[i] = z;
        pos[i * 3 + 2] = z;
      }

      // depth cue: brightness ramps up toward the camera, steeply (far
      // particles fade close to fully dark) so the near/far contrast reads
      // as obvious layering rather than a subtle gradient — size does the
      // same job on the shader side (see buildParticleField's aSize).
      const t = Math.min(Math.max((z - PARTICLE_Z_FAR) / depthRange, 0), 1);
      const bright = 0.04 + t * t * t * 0.85;
      col[i * 3] = base[i * 3] * bright;
      col[i * 3 + 1] = base[i * 3 + 1] * bright;
      col[i * 3 + 2] = base[i * 3 + 2] * bright;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.aColor.needsUpdate = true;
  }

  // ---- projectiles -------------------------------------------------------

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      // mouse-aimed bolts can drift sideways out of the tunnel, not just
      // forward past the far end — both are "gone", not just the old
      // straight-ahead z check
      const outOfRange = p.z < ENEMY_SPAWN_Z - 10 || Math.abs(p.x) > TUNNEL_RADIUS * 2.2 || Math.abs(p.y) > TUNNEL_RADIUS * 2.2;
      if (outOfRange) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  // ---- enemies -----------------------------------------------------------

  private updateEnemies(dt: number) {
    if (this.elapsed >= this.nextSpawnAt) {
      this.spawnWave();
      let interval = getLevelParams(this.level).enemySpawnInterval;
      if (this.frenzyActive) interval *= 0.4; // secret bonus: faster spawns alongside quad-fire
      this.nextSpawnAt = this.elapsed + interval;
    }

    for (const e of this.enemies) {
      if (!e.active) continue;
      e.z += e.speed * dt;
      const age = this.elapsed - e.spawnTime;
      const wx = e.baseX + Math.sin(age * e.weaveFreq + e.phase) * e.weaveAmp;
      const wy = e.baseY + Math.cos(age * e.weaveFreq * 0.8 + e.phase) * e.weaveAmp * 0.6;
      const len = Math.hypot(wx, wy);
      const clampScale = len > TUNNEL_RADIUS - 1 ? (TUNNEL_RADIUS - 1) / len : 1;
      e.group.position.set(wx * clampScale, wy * clampScale, e.z);
      // a slow organic wobble + breathing pulse, not a constant spin — a
      // creature's eye should keep roughly facing the player it's
      // approaching, not spin away from them
      e.group.rotation.z = Math.sin(age * 1.6 + e.phase) * 0.25;
      e.group.rotation.x = Math.sin(age * 1.1 + e.phase * 1.3) * 0.15;
      const pulse = 1 + Math.sin(age * 3.2 + e.phase) * 0.06;
      e.group.scale.setScalar(pulse);

      if (e.z > SHIP_Z + 1.5) {
        const dx = e.group.position.x - this.shipX;
        const dy = e.group.position.y - this.shipY;
        if (Math.hypot(dx, dy) < HIT_RADIUS + 0.6) {
          this.damagePlayer();
        }
        e.active = false;
        e.group.visible = false;
      }
    }
  }

  private spawnWave() {
    const params = getLevelParams(this.level);
    const group2 = Math.random() < 0.3;
    const count = group2 ? 2 : 1;
    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const slot = this.enemies.find(e => !e.active);
      if (!slot) return;
      const angle = baseAngle + i * 1.1;
      const r = 2 + Math.random() * 4.5;
      const speed = params.enemySpeedMin + Math.random() * (params.enemySpeedMax - params.enemySpeedMin);
      slot.active = true;
      slot.z = ENEMY_SPAWN_Z;
      slot.baseX = Math.cos(angle) * r;
      slot.baseY = Math.sin(angle) * r;
      slot.weaveAmp = params.enemyWeaveAmp * (0.6 + Math.random() * 0.8);
      slot.weaveFreq = 0.6 + Math.random() * 0.8;
      slot.phase = Math.random() * Math.PI * 2;
      slot.speed = speed;
      slot.spawnTime = this.elapsed;
      slot.group.visible = true;
      slot.group.position.set(slot.baseX, slot.baseY, slot.z);
    }
  }

  // ---- obstacles (fail condition A) --------------------------------------

  private updateObstacles(dt: number) {
    if (this.elapsed >= this.nextObstacleAt) {
      this.spawnObstacle();
      this.nextObstacleAt = this.elapsed + getLevelParams(this.level).obstacleInterval;
    }

    for (const o of this.obstacles) {
      if (!o.active) continue;
      o.z += o.speed * dt;
      o.group.position.z = o.z;

      if (!o.tested && o.z >= SHIP_Z - OBSTACLE_HIT_Z_WINDOW) {
        o.tested = true;
        this.checkObstacleCollision(o);
      }
      if (o.z > SHIP_Z + OBSTACLE_HIT_Z_WINDOW + 2) {
        o.active = false;
        o.group.visible = false;
      }
    }
  }

  private spawnObstacle() {
    const slot = this.obstacles.find(o => !o.active);
    if (!slot) return;

    const params = getLevelParams(this.level);
    const types: ObstacleType[] = ['ring', 'split', 'debris'];
    const type = types[Math.floor(Math.random() * types.length)];
    slot.type = type;
    slot.active = true;
    slot.tested = false;
    slot.z = OBSTACLE_SPAWN_Z;
    slot.speed = params.obstacleSpeed;
    slot.group.position.set(0, 0, slot.z);
    slot.group.rotation.z = Math.random() * Math.PI * 2;
    slot.group.visible = true;

    for (const child of slot.group.children) child.visible = child.name === type;

    // safe-zone radius narrows as levels climb, driven by the same level
    // parameter curve as everything else — this is the actual "narrowing
    // sections" difficulty knob, and the main reason level ~20 is "practically
    // impossible": the gap shrinks well below comfortable steering precision
    const safeR = params.obstacleSafeRadius;

    if (type === 'ring') {
      const ringWall = slot.group.children.find(c => c.name === 'ring') as THREE.Group;
      (ringWall.children[0] as THREE.Mesh).geometry.dispose();
      (ringWall.children[0] as THREE.Mesh).geometry = new THREE.RingGeometry(safeR, TUNNEL_RADIUS * 1.05, 24);
      (ringWall.children[1] as THREE.Mesh).scale.setScalar(safeR / 2.4);
      slot.gaps = [{ x: 0, y: 0, r: safeR }];
    } else if (type === 'split') {
      const gapOffset = 2.2 + safeR; // the two safe lanes flanking the central slab
      const splitGroup = slot.group.children.find(c => c.name === 'split') as THREE.Group;
      splitGroup.children[1].position.x = -gapOffset + safeR * 0.6;
      splitGroup.children[2].position.x = gapOffset - safeR * 0.6;
      slot.gaps = [
        { x: -gapOffset, y: 0, r: safeR },
        { x: gapOffset, y: 0, r: safeR },
      ];
    } else {
      // debris: the "gaps" list is repurposed as solid rocks to avoid —
      // hit test is inverted for this type (see checkObstacleCollision)
      const debrisGroup = slot.group.children.find(c => c.name === 'debris') as THREE.Group;
      slot.gaps = [];
      for (const child of debrisGroup.children) {
        const angle = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * (TUNNEL_RADIUS * 0.75);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        child.position.set(x, y, 0);
        slot.gaps.push({ x, y, r: params.debrisRockRadius });
      }
    }
  }

  private checkObstacleCollision(o: Obstacle) {
    if (o.type === 'debris') {
      // hit if the ship is too close to ANY rock
      for (const rock of o.gaps) {
        const d = Math.hypot(this.shipX - rock.x, this.shipY - rock.y);
        if (d < rock.r + 0.9) {
          this.crashShip();
          return;
        }
      }
      return;
    }
    // ring/split: hit unless the ship is inside AT LEAST ONE safe gap
    const clear = o.gaps.some(g => Math.hypot(this.shipX - g.x, this.shipY - g.y) < g.r);
    if (!clear) this.crashShip();
  }

  // ---- secret bonus targets -----------------------------------------------

  private updateSecrets(dt: number) {
    if (this.elapsed >= this.nextSecretCheckAt) {
      this.nextSecretCheckAt = this.elapsed + SECRET_CHECK_INTERVAL;
      if (Math.random() < SECRET_SPAWN_CHANCE) this.spawnSecret();
    }
    for (const s of this.secrets) {
      if (!s.active) continue;
      s.z += s.speed * dt;
      s.group.position.set(s.x, s.y, s.z);
      s.group.rotation.y += dt * 2;
      if (s.z > SHIP_Z + 3) {
        s.active = false;
        s.group.visible = false;
      }
    }
  }

  private spawnSecret() {
    const slot = this.secrets.find(s => !s.active);
    if (!slot) return;
    // deliberately tucked out near the tunnel wall, off the path most
    // players hold — finding it takes actually exploring, not just flying
    // straight and shooting
    const angle = Math.random() * Math.PI * 2;
    const r = TUNNEL_RADIUS * 0.85;
    slot.active = true;
    slot.x = Math.cos(angle) * r;
    slot.y = Math.sin(angle) * r;
    slot.z = OBSTACLE_SPAWN_Z;
    slot.speed = 30;
    slot.group.position.set(slot.x, slot.y, slot.z);
    slot.group.visible = true;
  }

  private applyBonus() {
    const kind: 'life' | 'frenzy' = Math.random() < 0.5 ? 'life' : 'frenzy';
    if (kind === 'life') {
      if (this.level < HEARTS_FROM_LEVEL) {
        this.health = HEALTH_MAX;
        this.callbacks.onHealthChange(this.health);
      } else {
        this.lives = Math.min(this.lives + 1, START_LIVES + 1);
        this.callbacks.onLivesChange(this.lives);
      }
    } else {
      this.frenzyUntil = this.elapsed + FRENZY_DURATION;
    }
    this.callbacks.onBonus(kind);
  }

  private get frenzyActive() {
    return this.elapsed < this.frenzyUntil;
  }

  // Fail condition (B): a target got past the player without being
  // destroyed. Budgeted differently depending on level — see the brief:
  // levels 1-9 deplete a continuous health bar, level 10+ switches
  // entirely to the existing 3-heart system (never both at once).
  private damagePlayer() {
    this.triggerHitFeedback();
    if (this.level < HEARTS_FROM_LEVEL) {
      this.health = Math.max(0, this.health - HEALTH_LOSS_PER_MISS);
      this.callbacks.onHealthChange(this.health);
      if (this.health <= 0) this.endGame();
    } else {
      this.lives -= 1;
      this.callbacks.onLivesChange(this.lives);
      if (this.lives <= 0) this.endGame();
    }
  }

  // Fail condition (A): the ship hit terrain/an obstacle directly.
  // Instant destruction at ANY level, regardless of remaining
  // health/hearts — a completely separate consequence from a missed
  // target, never routed through damagePlayer().
  private crashShip() {
    this.callbacks.onCrash();
    this.endGame();
  }

  private shakeUntil = 0;

  private triggerHitFeedback() {
    this.shakeUntil = this.elapsed + 0.3;
    this.callbacks.onHit();
  }

  private endGame() {
    this.gameOver = true;
    this.running = false;
    this.callbacks.onGameOver(this.score, this.level);
  }

  // ---- streaks -----------------------------------------------------------

  private updateStreaks(dt: number) {
    if (this.elapsed >= this.nextStreakAt) {
      this.triggerStreak();
      this.nextStreakAt = this.elapsed + 2.2 + Math.random() * 2.6;
    }
    for (const s of this.streaks) {
      if (!s.active) continue;
      s.z += s.speed * dt;
      s.mesh.position.z = s.z;
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      const lifeT = (s.z - ENEMY_SPAWN_Z) / (SHIP_Z + 10 - ENEMY_SPAWN_Z);
      mat.opacity = Math.sin(Math.min(Math.max(lifeT, 0), 1) * Math.PI) * 0.8;
      if (s.z > SHIP_Z + 10) {
        s.active = false;
        s.mesh.visible = false;
      }
    }
  }

  private triggerStreak() {
    const slot = this.streaks.find(s => !s.active);
    if (!slot) return;
    const angle = Math.random() * Math.PI * 2;
    const r = TUNNEL_RADIUS * 0.7;
    slot.active = true;
    slot.z = ENEMY_SPAWN_Z;
    slot.speed = 140 + Math.random() * 60;
    slot.mesh.visible = true;
    slot.mesh.position.set(Math.cos(angle) * r, Math.sin(angle) * r, slot.z);
    slot.mesh.rotation.z = angle;
  }

  // ---- destruction bursts -------------------------------------------------

  private updateBursts(dt: number) {
    for (const b of this.burstShards) {
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.vx *= 0.9;
      b.vy *= 0.9;
      b.vz *= 0.9;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = b.life / BURST_LIFE;
    }
  }

  private triggerBurst(x: number, y: number, z: number) {
    let spawned = 0;
    for (const b of this.burstShards) {
      if (b.active) continue;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const speed = 5 + Math.random() * 7;
      b.active = true;
      b.life = BURST_LIFE;
      b.vx = dir.x * speed;
      b.vy = dir.y * speed;
      b.vz = dir.z * speed;
      b.mesh.position.set(x, y, z);
      b.mesh.visible = true;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      spawned++;
      if (spawned >= BURST_SHARDS) break;
    }
  }

  // ---- collisions --------------------------------------------------------

  private checkCollisions() {
    for (const p of this.projectiles) {
      if (!p.active) continue;

      for (const e of this.enemies) {
        if (!e.active) continue;
        const dx = p.x - e.group.position.x;
        const dy = p.y - e.group.position.y;
        const dz = p.z - e.group.position.z;
        if (dx * dx + dy * dy + dz * dz < HIT_RADIUS * HIT_RADIUS) {
          p.active = false;
          p.mesh.visible = false;
          e.active = false;
          e.group.visible = false;
          this.score += 10;
          this.callbacks.onScoreChange(this.score);
          this.triggerBurst(e.group.position.x, e.group.position.y, e.group.position.z);
          break;
        }
      }
      if (!p.active) continue; // already consumed by an enemy hit above

      for (const s of this.secrets) {
        if (!s.active) continue;
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const dz = p.z - s.z;
        if (dx * dx + dy * dy + dz * dz < HIT_RADIUS * HIT_RADIUS) {
          p.active = false;
          p.mesh.visible = false;
          s.active = false;
          s.group.visible = false;
          this.triggerBurst(s.x, s.y, s.z);
          this.applyBonus();
          break;
        }
      }
    }
  }

  // ---- camera --------------------------------------------------------

  private updateCamera(dt: number) {
    const shake = this.elapsed < this.shakeUntil ? (this.shakeUntil - this.elapsed) * 6 : 0;
    const shakeX = shake ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake ? (Math.random() - 0.5) * shake : 0;
    const ease = 1 - Math.exp(-7 * dt);

    if (this.viewpoint === 'cockpit') {
      // the camera IS the pilot — full 1:1 tracking of the ship's own
      // position at (roughly) the ship's own z, not offset behind/above
      // it, and with no ship exterior ever rendered (see setViewpoint).
      const targetCamX = this.shipX + shakeX;
      const targetCamY = this.shipY + 1.1 + shakeY;
      this.camera.position.x += (targetCamX - this.camera.position.x) * ease;
      this.camera.position.y += (targetCamY - this.camera.position.y) * ease;
      this.camera.position.z = SHIP_Z + 0.6;
      // a fraction of the ship's own bank carries into the camera roll —
      // reads as the pilot's own head/body leaning with the turn
      this.camera.rotation.z += (this.ship.rotation.z * 0.6 - this.camera.rotation.z) * ease;
      this.camera.lookAt(this.shipX, this.shipY + 1, SHIP_Z - 24);
      this.camera.rotation.z = this.ship.rotation.z * 0.6; // lookAt() resets rotation — re-apply roll after
      return;
    }

    // Third/Second person: full 1:1 tracking of the ship's own position
    // (eased, not an instant snap, for smoothness/weight) — not a fraction
    // of it. A partial-tracking factor reads nicer as subtle parallax right
    // up until the ship nears the edge of its movement radius, where the
    // camera falls behind enough that the ship drifts out of frame
    // entirely — breaking the "ship always in frame" Star Fox framing both
    // of these modes are built on. Constant relative offset once eased in
    // means the ship stays framed at rest regardless of where in the
    // tunnel it is. Second-person uses the exact same logic, just a
    // noticeably closer/lower offset (see CHASE_OFFSETS).
    const offsets = CHASE_OFFSETS[this.viewpoint as 'third' | 'second'];
    const targetCamX = this.shipX + shakeX;
    const targetCamY = this.shipY + offsets.y + shakeY;
    this.camera.position.x += (targetCamX - this.camera.position.x) * ease;
    this.camera.position.y += (targetCamY - this.camera.position.y) * ease;
    this.camera.position.z = SHIP_Z + offsets.z;
    this.camera.lookAt(this.shipX, this.shipY + 1, SHIP_Z - 24);
  }
}
