// Sim -> world event ring (brief §3): the sim writes typed events into a
// preallocated ring; render / audio / HUD / camera each keep their own read
// cursor and drain it once per frame. The sim never calls audio or VFX.
// Zero allocation: fields live in typed arrays; a reader gets an index.

export const enum Ev {
  /** a = damage, b = 1 if weak point; id = target slot */
  Hit = 1,
  /** a = score value, b = type code; id = slot */
  Kill,
  /** a = hull damage, b = source kind */
  PlayerHull,
  /** a = shield damage */
  PlayerShield,
  /** a = pickup kind */
  Pickup,
  /** a = cannon index (0/1) */
  PlayerFire,
  /** id = shooter slot */
  EnemyTell,
  EnemyFire,
  /** player pressing the envelope boundary */
  Graze,
  /** a = direction (-1/1) */
  Roll,
  BoostOn,
  BoostOff,
  /** a = phase index */
  PhaseChange,
  /** a = comm index */
  Comm,
  /** a = size class (0 S, 1 M, 2 L, 3 boss) */
  Explode,
  /** a = seconds (presentation) */
  HitStop,
  /** a = checkpoint index */
  Checkpoint,
  PlayerDied,
  LevelComplete,
  /** a = hazard type code, b = damage */
  HazardImpact,
  /** projectile hit something indestructible / the terrain: sparks / surface puff (b = 1: terrain) */
  Spark,
  /** the player scraped the terrain: a = damage */
  GroundScrape,
}

export class EventRing {
  readonly cap: number;
  /** total events ever written (monotonic); slot = head % cap */
  head = 0;
  readonly type: Uint8Array;
  readonly id: Int32Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly s: Float64Array;
  readonly a: Float64Array;
  readonly b: Float64Array;
  readonly tick: Uint32Array;

  constructor(cap: number) {
    this.cap = cap;
    this.type = new Uint8Array(cap);
    this.id = new Int32Array(cap);
    this.x = new Float64Array(cap);
    this.y = new Float64Array(cap);
    this.s = new Float64Array(cap);
    this.a = new Float64Array(cap);
    this.b = new Float64Array(cap);
    this.tick = new Uint32Array(cap);
  }

  push(type: Ev, tick: number, id: number, x: number, y: number, s: number, a = 0, b = 0): void {
    const i = this.head % this.cap;
    this.type[i] = type;
    this.tick[i] = tick;
    this.id[i] = id;
    this.x[i] = x;
    this.y[i] = y;
    this.s[i] = s;
    this.a[i] = a;
    this.b[i] = b;
    this.head++;
  }

  /** A reader's cursor; call `drain` once per frame. */
  reader(): EventReader {
    return new EventReader(this);
  }

  clear(): void {
    this.head = 0;
  }
}

export class EventReader {
  private cur: number;
  /** events lost because this reader fell more than `cap` behind (QA) */
  lost = 0;
  constructor(private ring: EventRing) {
    this.cur = ring.head;
  }
  /** Calls fn(slot) for every event since the last drain (oldest first). */
  drain(fn: (slot: number) => void): void {
    const r = this.ring;
    if (r.head - this.cur > r.cap) {
      this.lost += r.head - this.cur - r.cap;
      this.cur = r.head - r.cap;
    }
    if (r.head < this.cur) this.cur = r.head; // ring was cleared (retry)
    for (; this.cur < r.head; this.cur++) fn(this.cur % r.cap);
  }
  /** skip everything pending (scene swap) */
  skip(): void {
    this.cur = this.ring.head;
  }
}
