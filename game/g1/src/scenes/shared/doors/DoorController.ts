// Blast-door motion + events (brief §9). progress: 0 = sealed, 1 = open
// (may overshoot to ~1.03 before settling). Deterministic: the motion is a
// GSAP tween over a normalised time `t`, so a master timeline can nest it
// (boot) and QA can seek it. Emits doors:unlock / doors:move / doors:slam.
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
  progress = 0;
  velocity = 0; // progress units / second
  state: DoorState = 'sealed';
  /** timestamp (s, performance clock) of the last unlock — drives particle bursts */
  burstAt = -100;
  slamAt = -100;
  private t = 0;
  private mode: 'open' | 'close' = 'open';
  private tween: gsap.core.Tween | null = null;
  private lastP = 0;
  private lastTime = 0;

  constructor(id: string) {
    this.id = id;
  }

  private apply() {
    const p = this.mode === 'open' ? openCurve(this.t) : 1 - closeCurve(this.t);
    const now = performance.now() / 1000;
    const dt = Math.max(1 / 240, now - this.lastTime);
    this.velocity = (p - this.lastP) / dt;
    this.lastP = p;
    this.lastTime = now;
    this.progress = p;
    bus.emit('doors:move', { id: this.id, velocity: this.velocity });
  }

  private build(mode: 'open' | 'close', duration: number): gsap.core.Tween {
    this.tween?.kill();
    this.mode = mode;
    this.t = 0;
    const tw = gsap.to(this, {
      t: 1,
      duration,
      ease: 'none',
      paused: true,
      onStart: () => {
        this.state = mode === 'open' ? 'opening' : 'closing';
        if (mode === 'open') this.burstAt = performance.now() / 1000;
        bus.emit('doors:unlock', { id: this.id });
      },
      onUpdate: () => this.apply(),
      onComplete: () => {
        this.state = mode === 'open' ? 'open' : 'sealed';
        this.velocity = 0;
        this.slamAt = performance.now() / 1000;
        bus.emit('doors:slam', { id: this.id });
      },
    });
    this.tween = tw;
    return tw;
  }

  /** Tween for nesting into a master timeline (not auto-played). */
  openTween(duration = 1.65): gsap.core.Tween {
    return this.build('open', duration);
  }

  closeTween(duration = 1.0): gsap.core.Tween {
    return this.build('close', duration);
  }

  open(duration = 1.65): Promise<void> {
    const tw = this.build('open', duration);
    return new Promise(res => {
      tw.then(() => res());
      tw.play();
    });
  }

  close(duration = 1.0): Promise<void> {
    const tw = this.build('close', duration);
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
    this.progress = mode === 'open' ? openCurve(this.t) : 1 - closeCurve(this.t);
    this.lastP = this.progress;
    this.velocity = 0;
    this.state = this.progress <= 0.001 ? 'sealed' : this.progress >= 0.999 && this.t >= 1 ? 'open' : mode === 'open' ? 'opening' : 'closing';
  }

  set(progress: number): void {
    this.tween?.kill();
    this.tween = null;
    this.progress = progress;
    this.lastP = progress;
    this.velocity = 0;
    this.state = progress <= 0.001 ? 'sealed' : 'open';
  }

  dispose(): void {
    this.tween?.kill();
    this.tween = null;
  }
}
