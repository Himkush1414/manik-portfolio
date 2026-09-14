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

export interface WormholeGameCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onHit: () => void; // player took damage — main.ts pulses the screen-flash overlay
}

// ---- tunable constants -----------------------------------------------
const TUNNEL_RADIUS = 9;
const SHIP_MOVE_RADIUS = 6.6; // ship is kept within this — always short of the walls
const SHIP_Z = 6; // ship's fixed z (world scrolls past it, it never moves in z)

// ---- particle vortex (replaces the old solid-cylinder tunnel — see
// buildParticleField) ---------------------------------------------------
const PARTICLE_COUNT = 4000;
const PARTICLE_MIN_R = TUNNEL_RADIUS * 0.12;
const PARTICLE_MAX_R = TUNNEL_RADIUS * 1.3;
const PARTICLE_Z_FAR = -190;
const PARTICLE_Z_NEAR = SHIP_Z + 9; // recycle once a particle passes this
const PARTICLE_VIOLET_CHANCE = 0.08; // rare secondary-accent flecks
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

export type Viewpoint = 'cockpit' | 'chase';

export class WormholeGame {
  private container: HTMLElement;
  private callbacks: WormholeGameCallbacks;

  private renderer: THREE.WebGLRenderer;
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
  private particleZ!: Float32Array;
  private particleSpeed!: Float32Array;
  private vanishingGlow!: THREE.Sprite;
  private readonly particleCyan = new THREE.Color(0x4ce0e8);
  private readonly particleViolet = new THREE.Color(0xa85cf0);

  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private streaks: Streak[] = [];
  private burstShards: BurstShard[] = [];

  private keys = new Set<string>();
  private lastFireTime = -Infinity;

  private score = 0;
  private lives = START_LIVES;
  private elapsed = 0;
  private nextSpawnAt = 1.2;
  private nextStreakAt = 2;
  private running = false;
  private gameOver = false;
  private rafId: number | null = null;
  private lastFrameTime = 0;

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['a', 'd', 'w', 's', ' '].includes(k)) e.preventDefault();
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onResize = () => this.handleResize();
  private cockpitFrameEl = document.getElementById('lv8-cockpit');

  constructor(container: HTMLElement, callbacks: WormholeGameCallbacks, initialViewpoint: Viewpoint = 'cockpit') {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x15100d, 0.021);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    this.camera.position.set(0, 3.4, SHIP_Z + 7);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x15100d, 1);
    container.appendChild(this.renderer.domElement);

    this.addLights();
    this.buildParticleField();
    this.ship = this.buildShip();
    this.scene.add(this.ship);
    this.buildTrail();
    this.buildProjectilePool();
    this.buildEnemyPool();
    this.buildStreakPool();
    this.buildBurstPool();
    this.setViewpoint(initialViewpoint);

    this.handleResize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
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

  // The tunnel itself: a single THREE.Points cloud of particles streaming
  // outward along radial lines toward the camera, plus a soft haze sprite
  // marking the dark vanishing point ahead. This is what replaces the old
  // solid-cylinder tunnel — a finite-radius solid wall always has an edge
  // the camera can see past at some angle (the exact "visible boundary"
  // complaint being fixed); a dense particle field with no hard edge of
  // its own, backed by fog + a haze sprite, has nothing to see past.
  private buildParticleField() {
    const dotTex = this.makeRadialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    this.particleZ = new Float32Array(PARTICLE_COUNT);
    this.particleSpeed = new Float32Array(PARTICLE_COUNT);
    this.particleBaseColor = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.resetParticle(i, positions, this.particleCyan, this.particleViolet, true);
    }
    colors.set(this.particleBaseColor);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particlePos = positions;
    this.particleColor = colors;

    // PointsMaterial has no per-vertex size, only a single uniform size —
    // sizeAttenuation alone already gives "closer = bigger" for free
    // (it's driven by the camera projection, not per-vertex data), which
    // covers the size half of the depth cue; the brightness half (closer
    // = brighter) is handled by rewriting the colour buffer every frame
    // in updateParticles instead of needing a custom shader for it.
    const mat = new THREE.PointsMaterial({
      size: 0.55,
      map: dotTex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);

    // dark vanishing point the particles stream out of/toward — a big
    // soft sprite far down the tunnel, additive so it reads as a glow,
    // not a flat disc
    const glowTex = this.makeRadialTexture('rgba(168,52,33,0.55)', 'rgba(21,16,13,0)');
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.vanishingGlow = new THREE.Sprite(glowMat);
    this.vanishingGlow.scale.set(70, 70, 1);
    this.vanishingGlow.position.set(0, 0, PARTICLE_Z_FAR + 10);
    this.scene.add(this.vanishingGlow);
  }

  private resetParticle(i: number, positions: Float32Array, cyan: THREE.Color, violet: THREE.Color, initialSpread: boolean) {
    const angle = Math.random() * Math.PI * 2;
    // sqrt-distributed radius so particles don't bunch up near the centre
    const r = PARTICLE_MIN_R + (PARTICLE_MAX_R - PARTICLE_MIN_R) * Math.sqrt(Math.random());
    const z = initialSpread ? PARTICLE_Z_FAR + Math.random() * (PARTICLE_Z_NEAR - PARTICLE_Z_FAR) : PARTICLE_Z_FAR - Math.random() * 20;

    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r;
    positions[i * 3 + 2] = z;
    this.particleZ[i] = z;
    this.particleSpeed[i] = 46 + Math.random() * 40;

    const brightness = 0.55 + Math.random() * 0.45;
    const c = Math.random() < PARTICLE_VIOLET_CHANCE ? violet : cyan;
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
      mesh.rotation.x = Math.PI / 2;
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({ active: false, mesh, x: 0, y: 0, z: 0 });
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

  private handleResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---- viewpoint -----------------------------------------------------

  // Cockpit (default): the camera IS the pilot's eyes — no ship exterior
  // ever in view (that exterior view was exactly what made the old
  // tunnel's edge visible/breaking immersion). Chase: the previous
  // third-person framing, kept as a selectable alternate. Safe to call
  // at any time, including mid-run (see Phase 2's pause-menu viewpoint
  // switch).
  setViewpoint(vp: Viewpoint) {
    this.viewpoint = vp;
    this.ship.visible = vp === 'chase';
    this.cockpitFrameEl?.classList.toggle('is-active', vp === 'cockpit');
    this.camera.fov = vp === 'cockpit' ? 78 : 62;
    this.camera.updateProjectionMatrix();
  }

  getViewpoint(): Viewpoint {
    return this.viewpoint;
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
    this.elapsed = 0;
    this.nextSpawnAt = 1.2;
    this.nextStreakAt = 2;
    this.gameOver = false;
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
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onLivesChange(this.lives);
    this.running = true;
  }

  dispose() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

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
    if (this.running && !this.gameOver) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.elapsed += dt;
    this.updateInput(dt);
    this.updateShip(dt);
    this.updateTrail();
    this.updateParticles(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateStreaks(dt);
    this.updateBursts(dt);
    this.checkCollisions();
    this.updateCamera(dt);
  }

  // ---- ship / input --------------------------------------------------

  private updateInput(dt: number) {
    const moveStep = 22 * dt;
    if (this.keys.has('a')) this.targetX -= moveStep;
    if (this.keys.has('d')) this.targetX += moveStep;
    if (this.keys.has('w')) this.targetY += moveStep;
    if (this.keys.has('s')) this.targetY -= moveStep;

    const len = Math.hypot(this.targetX, this.targetY);
    if (len > SHIP_MOVE_RADIUS) {
      const scale = SHIP_MOVE_RADIUS / len;
      this.targetX *= scale;
      this.targetY *= scale;
    }

    if (this.keys.has(' ')) this.fire();
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
    const slot = this.projectiles.find(p => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.x = this.shipX;
    slot.y = this.shipY;
    slot.z = SHIP_Z - 1.4;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
  }

  // ---- particle tunnel ---------------------------------------------------

  private updateParticles(dt: number) {
    const pos = this.particlePos;
    const col = this.particleColor;
    const base = this.particleBaseColor;
    const depthRange = PARTICLE_Z_NEAR - PARTICLE_Z_FAR;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let z = this.particleZ[i] + this.particleSpeed[i] * dt;
      if (z > PARTICLE_Z_NEAR) {
        // recycled to the far end with a fresh angle/radius — same
        // "reposition, never regrow" rule as every other pool here
        this.resetParticle(i, pos, this.particleCyan, this.particleViolet, false);
        z = this.particleZ[i];
      } else {
        this.particleZ[i] = z;
        pos[i * 3 + 2] = z;
      }

      // depth cue: brightness ramps up toward the camera (size already
      // scales for free via the material's sizeAttenuation)
      const t = Math.min(Math.max((z - PARTICLE_Z_FAR) / depthRange, 0), 1);
      const bright = 0.1 + t * t * 0.9;
      col[i * 3] = base[i * 3] * bright;
      col[i * 3 + 1] = base[i * 3 + 1] * bright;
      col[i * 3 + 2] = base[i * 3 + 2] * bright;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  // ---- projectiles -------------------------------------------------------

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.z -= PROJECTILE_SPEED * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.z < ENEMY_SPAWN_Z - 10) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  // ---- enemies -----------------------------------------------------------

  private updateEnemies(dt: number) {
    if (this.elapsed >= this.nextSpawnAt) {
      this.spawnWave();
      const interval = Math.max(0.42, 1.5 - this.elapsed * 0.012);
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
    const group2 = Math.random() < 0.3;
    const count = group2 ? 2 : 1;
    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const slot = this.enemies.find(e => !e.active);
      if (!slot) return;
      const angle = baseAngle + i * 1.1;
      const r = 2 + Math.random() * 4.5;
      const speed = 24 + Math.min(this.elapsed * 0.4, 30) + Math.random() * 6;
      slot.active = true;
      slot.z = ENEMY_SPAWN_Z;
      slot.baseX = Math.cos(angle) * r;
      slot.baseY = Math.sin(angle) * r;
      slot.weaveAmp = 1.5 + Math.random() * 2.5;
      slot.weaveFreq = 0.6 + Math.random() * 0.8;
      slot.phase = Math.random() * Math.PI * 2;
      slot.speed = speed;
      slot.spawnTime = this.elapsed;
      slot.group.visible = true;
      slot.group.position.set(slot.baseX, slot.baseY, slot.z);
    }
  }

  private damagePlayer() {
    this.lives -= 1;
    this.callbacks.onLivesChange(this.lives);
    this.triggerHitFeedback();
    if (this.lives <= 0) this.endGame();
  }

  private shakeUntil = 0;

  private triggerHitFeedback() {
    this.shakeUntil = this.elapsed + 0.3;
    this.callbacks.onHit();
  }

  private endGame() {
    this.gameOver = true;
    this.running = false;
    this.callbacks.onGameOver(this.score);
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

    // Chase (legacy third-person): full 1:1 tracking of the ship's own
    // position (eased, not an instant snap, for smoothness/weight) — not
    // a fraction of it. A partial-tracking factor reads nicer as subtle
    // parallax right up until the ship nears the edge of its movement
    // radius, where the camera falls behind enough that the ship drifts
    // out of frame entirely — breaking the "ship always in frame" Star
    // Fox framing this mode is built on. Constant relative offset once
    // eased in means the ship stays framed at rest regardless of where in
    // the tunnel it is.
    const targetCamX = this.shipX + shakeX;
    const targetCamY = this.shipY + 3.4 + shakeY;
    this.camera.position.x += (targetCamX - this.camera.position.x) * ease;
    this.camera.position.y += (targetCamY - this.camera.position.y) * ease;
    this.camera.position.z = SHIP_Z + 7;
    this.camera.lookAt(this.shipX, this.shipY + 1, SHIP_Z - 24);
  }
}
