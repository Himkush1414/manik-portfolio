import { smoothstep } from '../../lib/hooks'
import type { NeonState } from './neonTimeline'

// Scroll-scrubbed "dying tube": progress p (0..1 over the fade runway) maps
// to a contracting, dimming tube plus irregular dropouts. Everything is a
// function of p, so scrolling back up relights it.
//
// Photosensitivity guard (WCAG 2.3.1-style): dropouts are full-area events,
// so they are capped below 3 per second (>= 340ms apart), and after 3 inside
// any 1s window the tube is left alone for 650ms, so a burst never runs
// past 1s without a gap.

const MIN_GAP = 340
const BURST_WINDOW = 1000
const BURST_MAX = 3
const BURST_REST = 650

interface Drop {
  start: number
  end: number
  level: number
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class DyingFlicker {
  private drops: Drop[] = []
  private nextAt = 0
  /** start times of recent dropouts, for the rate / burst guards (QA reads this too) */
  readonly history: number[] = []

  /** multiplier for the light at `now` (1 = untouched) */
  sample(now: number, p: number, scrollY: number, reduced: boolean) {
    if (reduced || p < 0.05 || p > 0.97) {
      this.drops = []
      this.nextAt = now + 200
      return 1
    }
    const rng = mulberry32(Math.floor(scrollY) * 73856093 ^ Math.floor(now) * 19349663)
    if (now >= this.nextAt) {
      const recent = this.history.filter(t => now - t < BURST_WINDOW)
      if (recent.length >= BURST_MAX) {
        this.nextAt = Math.max(...recent) + BURST_REST + rng() * 200
      } else {
        // a dying tube: dropouts get more frequent and deeper with p (rate tops out ~2.6/s)
        const rate = 0.5 + 2.1 * smoothstep(0.05, 0.9, p)
        const dur = 40 + rng() * (50 + 90 * p)
        this.drops.push({ start: now, end: now + dur, level: 1 - (0.25 + 0.7 * p) * (0.6 + 0.4 * rng()) })
        this.history.push(now)
        if (this.history.length > 40) this.history.shift()
        const wait = -Math.log(1 - rng() * 0.95) / rate * 1000
        this.nextAt = now + Math.max(MIN_GAP, dur + 120, wait)
      }
    }
    this.drops = this.drops.filter(d => d.end > now)
    let k = 1
    for (const d of this.drops) if (now >= d.start) k = Math.min(k, d.level)
    // gas instability: small continuous shimmer that grows as the tube dies
    const shimmer = 1 - 0.07 * p * (0.5 + 0.5 * Math.sin(now * 0.021 + Math.sin(now * 0.0073) * 3))
    return k * shimmer
  }
}

const easeInOut = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u)

/** apply scroll progress p to a timeline state (reduced motion: a plain dim, no contraction) */
export function fadeState(s: NeonState, p: number, flicker: number, reduced = false): NeonState {
  if (p <= 0) return s
  if (reduced) {
    const k = 1 - smoothstep(0.02, 0.98, p)
    return { ...s, tube: s.tube * k, spill: s.spill * k, tip: 0 }
  }
  const c = easeInOut(smoothstep(0.06, 0.95, p))
  const dim = 1 - smoothstep(0.08, 0.98, p)
  const out = 1 - smoothstep(0.86, 0.99, p)
  return {
    // the lit part contracts from both ends toward the center
    half: s.half * (1 - c),
    // hot tips ride the contraction, then cool as it closes
    tip: Math.max(s.tip, 0.7 * Math.sin(Math.PI * Math.min(1, c * 1.05))),
    tube: s.tube * (0.4 + 0.6 * dim) * out * flicker,
    spill: s.spill * Math.pow(dim, 1.3) * flicker,
    done: s.done,
  }
}

export const textFadeFor = (p: number) => 1 - smoothstep(0.05, 0.55, p)
export const extrasFadeFor = (p: number) => 1 - smoothstep(0.05, 0.45, p)
export const orbFadeFor = (p: number) => 1 - smoothstep(0.08, 0.45, p)
