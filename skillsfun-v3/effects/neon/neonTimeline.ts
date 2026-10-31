// The neon tube's light, as a pure function of time. Everything the shader
// needs comes from sample(now): tube core intensity, spill (light poured
// into the room), lit half-length (0..1 of the tube's half-width) and tip
// heat while the lit section races outward.
//
//   dark  -> stutter (irregular on-pulses, each brighter/longer/wider)
//         -> catch (overshoot to ~1.15, settle to 1.0)
//         -> expand (center -> both ends, 2500ms ease-out)
//         -> hum (about 3% breathing at 0.4Hz)

export interface NeonState {
  tube: number
  spill: number
  half: number
  tip: number
  done: boolean
}

interface Pulse {
  start: number
  on: number
  peak: number
  half: number
}

interface Flicker {
  start: number
  end: number
  level: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3)

// base on/off pattern (ms), jittered every ignition so no two look alike
const FIRST_ON = [40, 30, 60, 45, 120, 90, 170]
const FIRST_OFF = [90, 200, 60, 240, 60, 110, 80]
const RE_ON = [35, 70, 50, 140]
const RE_OFF = [120, 60, 150, 70]

const EXPAND_MS = 2500
const CATCH_RISE_MS = 70
const CATCH_HOLD_MS = 220
const HALF_START = 0.065

export class NeonTimeline {
  private t0 = 0
  private dark = 400
  private pulses: Pulse[] = []
  private catchAt = 0
  private expandAt = 0
  private doneAt = 0
  private flickers: Flicker[] = []
  private prev: NeonState = { tube: 0, spill: 0, half: 0, tip: 0, done: false }
  private finished = false
  private reduced: boolean
  private onDone?: () => void
  private noiseSeed = Math.random() * 1000

  constructor(now: number, reduced: boolean, onDone?: () => void) {
    this.reduced = reduced
    this.onDone = onDone
    this.ignite(now, 400, FIRST_ON, FIRST_OFF, 0.12)
    if (reduced) {
      this.finished = true
      queueMicrotask(() => onDone?.())
    }
  }

  private ignite(now: number, dark: number, ons: number[], offs: number[], firstPeak: number) {
    this.t0 = now
    this.finished = this.reduced
    this.dark = dark
    this.pulses = []
    this.flickers = []
    let t = dark
    const n = ons.length
    for (let k = 0; k < n; k++) {
      const f = n === 1 ? 1 : k / (n - 1)
      const on = ons[k] * rand(0.75, 1.3)
      this.pulses.push({
        start: t,
        on,
        peak: (firstPeak + (0.62 - firstPeak) * Math.pow(f, 1.2)) * rand(0.85, 1.1),
        half: 0.008 + (HALF_START - 0.012) * f * rand(0.85, 1.1),
      })
      t += on + offs[k] * rand(0.7, 1.4)
    }
    this.catchAt = t
    this.expandAt = t + CATCH_HOLD_MS
    this.doneAt = this.expandAt + EXPAND_MS
  }

  /** full ignition again (new colors): black for `dark` ms, then the whole stutter -> catch -> expand */
  relight(now: number, dark = 400) {
    this.prev = { tube: 0, spill: 0, half: 0, tip: 0, done: false }
    this.ignite(now, dark, FIRST_ON, FIRST_OFF, 0.12)
    if (this.reduced) queueMicrotask(() => this.onDone?.())
  }

  /** click: re-ignite when settled, otherwise make the running reveal flicker */
  click(now: number) {
    if (this.reduced) return
    const rel = now - this.t0
    if (rel >= this.doneAt) {
      this.prev = this.sample(now)
      this.ignite(now, 260, RE_ON, RE_OFF, 0.3)
      return
    }
    let t = rel + rand(0, 30)
    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const len = rand(25, 75)
      this.flickers.push({ start: t, end: t + len, level: rand(0.02, 0.45) })
      t += len + rand(30, 110)
    }
  }

  get revealDone() {
    return this.finished
  }

  sample(now: number): NeonState {
    if (this.reduced) return { tube: 1, spill: 1, half: 1, tip: 0, done: true }
    const rel = now - this.t0
    let tube = 0
    let spill = 0
    let half = HALF_START
    let tip = 0

    if (rel < this.dark) {
      // the light cuts out (afterglow decays in a few ms), or initial black
      tube = this.prev.tube * Math.exp(-rel / 18)
      spill = this.prev.spill * Math.exp(-rel / 45)
      half = this.prev.half
    } else if (rel < this.catchAt) {
      // stutter: find the current/last pulse
      let last: Pulse | null = null
      for (const p of this.pulses) if (p.start <= rel) last = p
      if (last) {
        const into = rel - last.start
        half = last.half
        // gas noise + a 100Hz mains ripple that aliases into irregular shimmer
        const n = 0.82 + 0.3 * this.noise(rel * 0.09) - 0.1 * Math.abs(Math.sin(rel * 0.314))
        if (into < last.on) {
          const attack = 1 - Math.exp(-into / 5)
          tube = last.peak * attack * n
        } else {
          tube = last.peak * Math.exp(-(into - last.on) / 14) // phosphor afterglow
        }
        // each strike throws a weak, quickly dying spill into the room
        spill = last.peak * 0.5 * Math.exp(-into / 70) * (into < last.on ? 1 : Math.exp(-(into - last.on) / 25))
      }
    } else {
      const c = rel - this.catchAt
      // catch: fast rise to ~1.15 overshoot, settle to 1.0
      if (c < CATCH_RISE_MS) {
        const u = c / CATCH_RISE_MS
        tube = 1.15 * (1 - Math.pow(1 - u, 2))
      } else {
        tube = 1 + 0.15 * Math.exp(-(c - CATCH_RISE_MS) / 170)
      }
      const s = (now - this.t0) / 1000
      tube *= 1 + 0.015 * Math.sin(s * Math.PI * 2 * 0.4) + 0.004 * (this.noise(rel * 0.02) - 0.5)
      spill = tube * Math.min(1, c / 260)
      const lastHalf = this.pulses.length ? this.pulses[this.pulses.length - 1].half : HALF_START
      if (rel < this.expandAt) {
        half = lastHalf
      } else {
        const u = Math.min(1, (rel - this.expandAt) / EXPAND_MS)
        half = lastHalf + (1 - lastHalf) * easeOutCubic(u)
        tip = Math.pow(1 - u, 0.7)
      }
      if (rel >= this.doneAt && !this.finished) {
        this.finished = true
        this.onDone?.()
      }
    }

    for (const f of this.flickers) {
      if (rel >= f.start && rel < f.end) {
        tube *= f.level
        spill *= 0.3 + f.level
      }
    }
    const state = { tube, spill, half, tip, done: rel >= this.doneAt }
    return state
  }

  private noise(x: number) {
    // cheap 1D value noise
    const i = Math.floor(x)
    const f = x - i
    const h = (n: number) => {
      const s = Math.sin((n + this.noiseSeed) * 127.1) * 43758.5453
      return s - Math.floor(s)
    }
    const u = f * f * (3 - 2 * f)
    return h(i) * (1 - u) + h(i + 1) * u
  }
}
