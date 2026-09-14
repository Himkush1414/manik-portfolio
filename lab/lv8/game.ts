// /lab/lv8 — "Wormhole Run": a third-person rail-shooter down a Three.js
// tunnel. Dynamically imported by main.ts only when "PLAY" is pressed, so
// none of this (or the three.js it pulls in) ever loads for the hub page
// itself, let alone any other route on the site.
//
// Everything performance-sensitive here follows the same two rules:
//   1. Fixed-size object pools (projectiles, enemies, engine-trail beads,
//      hyperspace streaks) allocated once up front — nothing is created
//      or destroyed during play, only toggled active/inactive and
//      repositioned. See spawnProjectile/spawnEnemy/triggerStreak below.
//   2. The tunnel is a small ring of recycled segments (SEGMENT_COUNT),
//      each repositioned to the far end the instant it passes the camera
//      — never a single ever-growing mesh, never new geometry mid-flight.
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
const SEGMENT_LENGTH = 18;
const SEGMENT_COUNT = 16; // 16 * 18 = 288 units of visible tunnel, recycled
const TUNNEL_SPEED = 30; // base world-scroll speed, units/sec
const SHIP_Z = 6; // ship's fixed z (world scrolls past it, it never moves in z)
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

export class WormholeGame {
  private container: HTMLElement;
  private callbacks: WormholeGameCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private ship: THREE.Group;
  private shipX = 0;
  private shipY = 0;
  private targetX = 0;
  private targetY = 0;
  private prevX = 0;
  private prevY = 0;

  private trailBeads: THREE.Mesh[] = [];
  private trailHistory: { x: number; y: number }[] = [];

  private segments: { group: THREE.Group; z: number }[] = [];
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

  constructor(container: HTMLElement, callbacks: WormholeGameCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06060c, 0.014);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.camera.position.set(0, 3.4, SHIP_Z + 7);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x06060c, 1);
    container.appendChild(this.renderer.domElement);

    this.addLights();
    this.buildTunnel();
    this.ship = this.buildShip();
    this.scene.add(this.ship);
    this.buildTrail();
    this.buildProjectilePool();
    this.buildEnemyPool();
    this.buildStreakPool();
    this.buildBurstPool();

    this.handleResize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  // ---- setup -----------------------------------------------------------

  private addLights() {
    const hemi = new THREE.HemisphereLight(0x4ce0e8, 0x0a0a14, 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xe8e9f0, 0.6);
    key.position.set(2, 4, 6);
    this.scene.add(key);
  }

  private makeSegment(): THREE.Group {
    const group = new THREE.Group();

    // main body: low-poly (8-sided) open cylinder, dark with a faint cool
    // tint so it isn't a pure silhouette against the fog
    const bodyGeo = new THREE.CylinderGeometry(TUNNEL_RADIUS, TUNNEL_RADIUS, SEGMENT_LENGTH, 8, 1, true);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e18,
      emissive: 0x0c2530,
      emissiveIntensity: 0.4,
      side: THREE.BackSide,
      roughness: 0.85,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // bright emissive accent ring at the segment's leading edge
    const ringGeo = new THREE.TorusGeometry(TUNNEL_RADIUS, 0.16, 6, 8);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4ce0e8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = -SEGMENT_LENGTH / 2;
    group.add(ring);

    return group;
  }

  private buildTunnel() {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const group = this.makeSegment();
      const z = -i * SEGMENT_LENGTH;
      group.position.z = z;
      this.scene.add(group);
      this.segments.push({ group, z });
    }
  }

  private buildShip(): THREE.Group {
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({ color: 0x0d1a1f, roughness: 0.4, metalness: 0.5 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x4ce0e8 });

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
    const mat = () => new THREE.MeshBasicMaterial({ color: 0x4ce0e8, transparent: true, opacity: 0 });
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const bead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat());
      bead.visible = false;
      this.scene.add(bead);
      this.trailBeads.push(bead);
    }
  }

  private buildProjectilePool() {
    const geo = new THREE.CapsuleGeometry(0.09, 0.6, 2, 4);
    for (let i = 0; i < PROJECTILE_MAX_POOL; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x4ce0e8 }));
      mesh.rotation.x = Math.PI / 2;
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({ active: false, mesh, x: 0, y: 0, z: 0 });
    }
  }

  private buildEnemyPool() {
    const geo = new THREE.OctahedronGeometry(0.75, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a0f10,
      emissive: 0xff6a4c,
      emissiveIntensity: 0.55,
      roughness: 0.5,
      metalness: 0.3,
    });
    for (let i = 0; i < ENEMY_MAX_POOL; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(geo, mat);
      group.add(body);
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
    for (let i = 0; i < STREAK_POOL; i++) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: 0xa85cf0, transparent: true, opacity: 0, side: THREE.DoubleSide })
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
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
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
    this.updateTunnel(dt);
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

  // ---- tunnel ----------------------------------------------------------

  private updateTunnel(dt: number) {
    const advance = TUNNEL_SPEED * dt;
    let minZ = Infinity;
    let anyPastThreshold = false;
    for (const seg of this.segments) {
      seg.z += advance;
      if (seg.z < minZ) minZ = seg.z;
      if (seg.z > SHIP_Z + SEGMENT_LENGTH) anyPastThreshold = true;
    }

    // Any segment now behind the ship gets recycled to the far end. No
    // arrays/allocations here (this runs every frame of every session) —
    // just a plain selection loop over the tiny, fixed segment list,
    // repeatedly picking whichever remaining offender is furthest forward
    // so multiple recycles in the same frame (e.g. after a stutter) still
    // stack up behind each other in the correct order, never colliding on
    // the same z.
    if (anyPastThreshold) {
      let farthest = minZ;
      for (;;) {
        let candidate: { group: THREE.Group; z: number } | null = null;
        for (const seg of this.segments) {
          if (seg.z > SHIP_Z + SEGMENT_LENGTH && (!candidate || seg.z > candidate.z)) candidate = seg;
        }
        if (!candidate) break;
        farthest -= SEGMENT_LENGTH;
        candidate.z = farthest;
      }
    }
    for (const seg of this.segments) seg.group.position.z = seg.z;
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
      e.group.rotation.y += dt * 1.4;
      e.group.rotation.x += dt * 0.6;

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

    // Full 1:1 tracking of the ship's own position (eased, not an instant
    // snap, for smoothness/weight) — not a fraction of it. A partial-
    // tracking factor reads nicer as subtle parallax right up until the
    // ship nears the edge of its movement radius, where the camera falls
    // behind enough that the ship drifts out of frame entirely — directly
    // breaking the "ship always in frame" Star Fox framing this game is
    // built on. Constant relative offset once eased in means the ship
    // stays framed at rest regardless of where in the tunnel it is.
    const targetCamX = this.shipX + shakeX;
    const targetCamY = this.shipY + 3.4 + shakeY;
    const ease = 1 - Math.exp(-7 * dt);
    this.camera.position.x += (targetCamX - this.camera.position.x) * ease;
    this.camera.position.y += (targetCamY - this.camera.position.y) * ease;
    this.camera.position.z = SHIP_Z + 7;
    this.camera.lookAt(this.shipX, this.shipY + 1, SHIP_Z - 24);
  }
}
