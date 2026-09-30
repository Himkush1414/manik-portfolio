// Blast-door motion + events (brief §9). progress: 0 = sealed, 1 = open
// (may overshoot to ~1.03 before settling). Deterministic and SEEKABLE: the
// only animated value is the normalised motion time `t` (a GSAP tween, which a
// master timeline can nest); `progress` is derived from it, so seeking a
// parent timeline — which suppresses callbacks — still renders the right pose.
// Velocity + doors:move are computed per frame in tick(); doors:unlock /
// doors:slam fire from the tween's start/complete (only during real playback).
import gsap from 'gsap';
import { bus } from '../../../core/bus';

export type DoorState = 'sealed' | 'opening' | 'open' | 'closing';

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/** Breakaway stutter (0-12%), accelerate, decelerate with 3% overshoot + settle. */
export function openCurve(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.12) {
    const s = t / 0.12;
    return 0.02 * s * s + 0.007 * Math.sin(s * Math.PI * 5) * s * (1 - s);
  }
  const u = (t - 0.12) / 0.88;
  if (u < 0.84) return 0.02 + 1.01 * easeInOutCubic(u / 0.84);
  return 1.03 - 0.03 * easeOutCubic((u - 0.84) / 0.16);
}

/** Close: hard acceleration into a slam with a tiny rebound. Returns closed-fraction. */
export function closeCurve(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.88) return Math.pow(t / 0.88, 2.3);
  const v = (t - 0.88) / 0.12;
  return 1 - 0.014 * Math.sin(v * Math.PI);
}

export class DoorController {
  readonly id: string;
  /** normalised time of the current motion (the ONLY tweened value) */
  t = 0;
  mode: 'open' | 'close' = 'open';
  velocity = 0; // progress units / second (updated in tick)
  /** seconds (performance clock) of the last unlock — drives particle bursts */
  burstAt = -100;
  slamAt = -100;
  private tween: gsap.core.Tween | null = null;
  private lastP = 0;
  private movingEmitted = false;

  constructor(id: string) {
    this.id = id;
  }

  get progress(): number {
    return this.mode === 'open' ? openCurve(this.t) : 1 - closeCurve(this.t);
  }

  get state(): DoorState {
    const p = this.progress;
    if (this.mode === 'open') return this.t <= 0 ? 'sealed' : this.t >= 1 ? 'open' : 'opening';
    return this.t >= 1 || p <= 0.0005 ? 'sealed' : this.t <= 0 ? 'open' : 'closing';
  }

  /** Per-frame: velocity + doors:move while moving. Called by <BlastDoors/>. */
  tick(dt: number): void {
    const p = this.progress;
    this.velocity = dt > 0 ? (p - this.lastP) / dt : 0;
    this.lastP = p;
    const moving = Math.abs(this.velocity) > 0.001;
    if (moving || this.movingEmitted) {
      bus.emit('doors:move', { id: this.id, velocity: moving ? this.velocity : 0 });
      this.movingEmitted = moving;
    }
  }

  private build(mode: 'open' | 'close', duration: number, paused: boolean): gsap.core.Tween {
    this.tween?.kill();
    const tw = gsap.fromTo(
      this,
      { t: 0 },
      {
        t: 1,
        duration,
        ease: 'none',
        paused,
        immediateRender: false,
        onStart: () => {
          this.mode = mode;
          if (mode === 'open') this.burstAt = performance.now() / 1000;
          bus.emit('doors:unlock', { id: this.id });
        },
        onComplete: () => {
          this.slamAt = performance.now() / 1000;
          bus.emit('doors:slam', { id: this.id });
        },
      },
    );
    this.tween = tw;
    return tw;
  }

  /**
   * Tween for nesting into a master timeline. NOT paused: a paused child never
   * renders when its parent seeks. (mode is set as the tween starts.)
   */
  openTween(duration = 1.65): gsap.core.Tween {
    return this.build('open', duration, false);
  }

  closeTween(duration = 1.0): gsap.core.Tween {
    return this.build('close', duration, false);
  }

  open(duration = 1.65): Promise<void> {
    this.mode = 'open';
    const tw = this.build('open', duration, true);
    return new Promise(res => {
      tw.then(() => res());
      tw.play();
    });
  }

  close(duration = 1.0): Promise<void> {
    this.mode = 'close';
    const tw = this.build('close', duration, true);
    return new Promise(res => {
      tw.then(() => res());
      tw.play();
    });
  }

  /** QA/debug: jump to normalised time t of an open (or close) motion. */
  seek(t: number, mode: 'open' | 'close' = 'open'): void {
    this.tween?.kill();
    this.tween = null;
    this.mode = mode;
    this.t = Math.min(1, Math.max(0, t));
    this.lastP = this.progress;
  }

  /** Snap to sealed (0) or open (1) instantly. */
  set(progress: 0 | 1): void {
    this.tween?.kill();
    this.tween = null;
    this.mode = 'open';
    this.t = progress;
    this.lastP = this.progress;
  }

  dispose(): void {
    this.tween?.kill();
    this.tween = null;
  }
}
