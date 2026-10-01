// Structure-of-arrays pools (brief §3/§4): fixed caps, allocated once, dense
// (swap-remove keeps live entries in [0, count)), zero allocation after init.
// Projectiles: render position = pos - vel * (1 - alpha) * STEP, so no
// previous-position arrays are needed for interpolation.

export class ProjectilePool {
  readonly cap: number;
  count = 0;
  /** rail position (s absolute, double) */
  readonly s: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** velocity, u/s */
  readonly vs: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  /** seconds left */
  readonly life: Float64Array;
  readonly dmg: Float64Array;
  readonly radius: Float64Array;
  /** visual / behaviour kind */
  readonly kind: Uint8Array;
  /** shooter slot or -1; homing target etc. */
  readonly owner: Int16Array;
  /** extra per-kind state (homing turn rate, hp of shootable missiles) */
  readonly aux: Float64Array;
  /** spawn serial (stable id for VFX trails) */
  readonly serial: Uint32Array;
  private nextSerial = 1;
  /** spawns refused because the pool was full (QA) */
  refused = 0;

  constructor(cap: number) {
    this.cap = cap;
    this.s = new Float64Array(cap);
    this.x = new Float64Array(cap);
    this.y = new Float64Array(cap);
    this.vs = new Float64Array(cap);
    this.vx = new Float64Array(cap);
    this.vy = new Float64Array(cap);
    this.life = new Float64Array(cap);
    this.dmg = new Float64Array(cap);
    this.radius = new Float64Array(cap);
    this.kind = new Uint8Array(cap);
    this.owner = new Int16Array(cap);
    this.aux = new Float64Array(cap);
    this.serial = new Uint32Array(cap);
  }

  /** index of a new projectile, or -1 when full */
  spawn(s: number, x: number, y: number, vs: number, vx: number, vy: number, life: number, dmg: number, radius: number, kind: number, owner = -1): number {
    if (this.count >= this.cap) {
      this.refused++;
      return -1;
    }
    const i = this.count++;
    this.s[i] = s;
    this.x[i] = x;
    this.y[i] = y;
    this.vs[i] = vs;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.dmg[i] = dmg;
    this.radius[i] = radius;
    this.kind[i] = kind;
    this.owner[i] = owner;
    this.aux[i] = 0;
    this.serial[i] = this.nextSerial++;
    return i;
  }

  /** swap-remove: the last live entry moves into slot i (iterate backwards when killing) */
  kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.s[i] = this.s[last];
    this.x[i] = this.x[last];
    this.y[i] = this.y[last];
    this.vs[i] = this.vs[last];
    this.vx[i] = this.vx[last];
    this.vy[i] = this.vy[last];
    this.life[i] = this.life[last];
    this.dmg[i] = this.dmg[last];
    this.radius[i] = this.radius[last];
    this.kind[i] = this.kind[last];
    this.owner[i] = this.owner[last];
    this.aux[i] = this.aux[last];
    this.serial[i] = this.serial[last];
  }

  clear(): void {
    this.count = 0;
  }

  /** bytes held (QA: proves nothing grows) */
  get bytes(): number {
    return this.s.byteLength * 9 + this.kind.byteLength + this.owner.byteLength + this.aux.byteLength + this.serial.byteLength;
  }
}

/**
 * Fixed-slot object pool (enemies, hazards, pickups): slots never move, so the
 * renderer can map slot -> instance index directly. `alive` is a dense list of
 * live slots for iteration; free slots form a stack.
 */
export class SlotPool<T> {
  readonly items: T[];
  readonly alive: Int16Array;
  aliveCount = 0;
  private free: Int16Array;
  private freeCount: number;
  private live: Uint8Array;
  refused = 0;

  constructor(
    readonly cap: number,
    make: (slot: number) => T,
  ) {
    this.items = new Array<T>(cap);
    for (let i = 0; i < cap; i++) this.items[i] = make(i);
    this.alive = new Int16Array(cap);
    this.free = new Int16Array(cap);
    this.live = new Uint8Array(cap);
    for (let i = 0; i < cap; i++) this.free[i] = cap - 1 - i; // pop gives 0, 1, 2...
    this.freeCount = cap;
  }

  /** a free slot (now live), or -1 */
  acquire(): number {
    if (this.freeCount === 0) {
      this.refused++;
      return -1;
    }
    const slot = this.free[--this.freeCount];
    this.live[slot] = 1;
    this.alive[this.aliveCount++] = slot;
    return slot;
  }

  release(slot: number): void {
    if (!this.live[slot]) return;
    this.live[slot] = 0;
    for (let i = 0; i < this.aliveCount; i++) {
      if (this.alive[i] === slot) {
        this.alive[i] = this.alive[--this.aliveCount];
        break;
      }
    }
    this.free[this.freeCount++] = slot;
  }

  isLive(slot: number): boolean {
    return this.live[slot] === 1;
  }

  clear(): void {
    for (let i = 0; i < this.aliveCount; i++) this.live[this.alive[i]] = 0;
    this.aliveCount = 0;
    for (let i = 0; i < this.cap; i++) this.free[i] = this.cap - 1 - i;
    this.freeCount = this.cap;
  }
}
