// Dynamic-resolution governor (brief §4 rule 9). Pure logic (no DOM, no
// three): feed it frame times, it answers with a quantised resolution step.
//   p95 over the last 90 frames > downMs for downHold s  -> next lower scale
//   p95 < upMs for upHold s                               -> next higher scale
//   at most one change per minInterval s (each change reallocates targets)
// Below the lowest scale it walks `extraSteps` (scene-specific degrade steps:
// mission = mirror -> bloom -> tunnel layers -> particles; hangar = AO -> DOF
// -> reflections -> particles), and climbs back the same way.

import { DRS } from '../data/render.config';

export const DRS_SCALES = DRS.scales;
export type DrsProfile = 'mission' | 'menu';

export type DrsConfig = {
  window: number;
  downMs: number;
  upMs: number;
  downHold: number;
  upHold: number;
  minInterval: number;
  /** degrade steps available after the resolution floor */
  extraSteps: number;
};

export const DRS_DEFAULT: DrsConfig = { window: DRS.window, ...DRS.mission, extraSteps: 0 };

/** Thresholds for a scene profile and frame-rate cap (a 30 fps cap doubles the mission budget). */
export function drsConfigForCap(fpsCap: number, extraSteps: number, profile: DrsProfile = 'mission'): DrsConfig {
  const base = DRS[profile];
  const k = profile === 'mission' && fpsCap > 0 && fpsCap < 60 ? 60 / fpsCap : 1;
  return { window: DRS.window, ...base, downMs: base.downMs * k, upMs: base.upMs * k, extraSteps };
}

export class DrsGovernor {
  cfg: DrsConfig;
  /** 0 = full scale; DRS_SCALES.length - 1 = floor; beyond = extra degrade steps */
  level = 0;
  private ring: Float32Array;
  private sorted: Float32Array;
  private n = 0;
  private head = 0;
  private overSince = -1;
  private underSince = -1;
  private lastChange = -1e9;

  constructor(cfg: DrsConfig = DRS_DEFAULT) {
    this.cfg = cfg;
    this.ring = new Float32Array(cfg.window);
    this.sorted = new Float32Array(cfg.window);
  }

  get maxLevel(): number {
    return DRS_SCALES.length - 1 + this.cfg.extraSteps;
  }

  /** resolution multiplier for the current level */
  get scale(): number {
    return DRS_SCALES[Math.min(this.level, DRS_SCALES.length - 1)];
  }

  /** extra degrade steps applied (0 while above the resolution floor) */
  get extra(): number {
    return Math.max(0, this.level - (DRS_SCALES.length - 1));
  }

  /** Switch threshold profile (scene change); keeps the current level. */
  configure(cfg: DrsConfig, now: number): void {
    this.cfg = cfg;
    this.reset(now);
  }

  /** Forget recent samples (scene swap, tab return, after a change). */
  reset(now: number): void {
    this.n = 0;
    this.head = 0;
    this.overSince = -1;
    this.underSince = -1;
    this.lastChange = Math.max(this.lastChange, now - this.cfg.minInterval + 1); // short grace
  }

  /** p95 of a FULL window (allocation-free: typed-array copy + in-place sort). */
  p95(): number {
    if (this.n < this.cfg.window) return 0;
    this.sorted.set(this.ring);
    this.sorted.sort();
    return this.sorted[Math.floor(this.cfg.window * 0.95)];
  }

  /**
   * One frame: `ms` = frame time, `now` = seconds. Returns -1 (stepped down),
   * +1 (stepped up) or 0. Needs a full window before deciding.
   */
  sample(ms: number, now: number): -1 | 0 | 1 {
    this.ring[this.head] = ms;
    this.head = (this.head + 1) % this.cfg.window;
    if (this.n < this.cfg.window) this.n++;
    if (this.n < this.cfg.window) return 0;
    const p = this.p95();
    const c = this.cfg;
    if (p > c.downMs) {
      if (this.overSince < 0) this.overSince = now;
      this.underSince = -1;
    } else if (p < c.upMs) {
      if (this.underSince < 0) this.underSince = now;
      this.overSince = -1;
    } else {
      this.overSince = -1;
      this.underSince = -1;
    }
    if (now - this.lastChange < c.minInterval) return 0;
    if (this.overSince >= 0 && now - this.overSince >= c.downHold && this.level < this.maxLevel) {
      this.level++;
      this.changed(now);
      return -1;
    }
    if (this.underSince >= 0 && now - this.underSince >= c.upHold && this.level > 0) {
      this.level--;
      this.changed(now);
      return 1;
    }
    return 0;
  }

  private changed(now: number): void {
    this.lastChange = now;
    this.n = 0;
    this.head = 0;
    this.overSince = -1;
    this.underSince = -1;
  }
}
