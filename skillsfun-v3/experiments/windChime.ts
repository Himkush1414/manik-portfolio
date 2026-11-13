// EXPERIMENT (sound for HangingStrings.tsx): a soft wind chime, synthesized
// with the Web Audio API. No audio files, no libraries.
// Remove the sound only: delete this file and the lines marked `// SOUND`
// in HangingStrings.tsx.
//
// - Each note: a sine fundamental plus two quiet inharmonic partials (x2.76,
//   x5.4, like a struck metal tube), 5ms attack, long exponential decay
//   (1.5-3s, longer when louder). Pitch: C major pentatonic, C5 to C7, with
//   a tiny random detune, so any run of notes stays melodic.
// - A string triggers a note when its tip speed crosses THRESHOLD upwards
//   (re-armed once it slows to half that). Faster = louder.
// - At most 6 voices at once, at least 80ms between notes, master gain 0.15
//   into a DynamicsCompressor.
// - The AudioContext is only created inside a click/tap (browsers block
//   audio before one), suspended while the hero is off screen or the tab is
//   hidden, and closed on dispose. Off by default.

const THRESHOLD = 140 // px/s of a string tip
const FULL = 620 // px/s that counts as a full-strength hit
const MAX_VOICES = 6
const MIN_GAP = 0.08 // s
const MASTER = 0.15
const PARTIALS = [1, 2.76, 5.4]
const PARTIAL_GAIN = [1, 0.22, 0.08]
const PARTIAL_DECAY = [1, 0.45, 0.25]
// C major pentatonic, C5..C7
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0]

export interface WindChime {
  /** call per string per step with |tip speed| in px/s */
  feel(i: number, speed: number): void
  /** hero on screen and tab visible */
  setActive(on: boolean): void
  enabled(): boolean
  /** fromGesture: called inside a click/tap/key handler (else the context
   *  waits for the next one) */
  setEnabled(on: boolean, fromGesture?: boolean): void
  dispose(): void
}

type AudioCtor = typeof AudioContext

export function createWindChime(maxStrings: number): WindChime {
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  const armed = new Uint8Array(maxStrings).fill(1)
  const voiceEnds = new Float64Array(MAX_VOICES)
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let on = false
  let active = false
  let lastNote = -1

  const ensureCtx = () => {
    if (ctx || !Ctor) return
    try {
      ctx = new Ctor()
    } catch {
      ctx = null
      return
    }
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -24
    comp.knee.value = 24
    comp.ratio.value = 4
    comp.attack.value = 0.003
    comp.release.value = 0.25
    master = ctx.createGain()
    master.gain.value = MASTER
    master.connect(comp)
    comp.connect(ctx.destination)
  }

  const sync = () => {
    if (!ctx) return
    if (on && active) {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    } else if (ctx.state === 'running') {
      void ctx.suspend().catch(() => {})
    }
  }

  // a stored "on" from an earlier visit still needs a gesture before audio
  // can start: the first click/tap/key anywhere creates the context
  const unlock = () => {
    if (!on) return
    ensureCtx()
    sync()
    removeUnlock()
  }
  const removeUnlock = () => {
    document.removeEventListener('pointerdown', unlock, true)
    document.removeEventListener('keydown', unlock, true)
  }

  const play = (intensity: number) => {
    const c = ctx!
    const now = c.currentTime
    if (lastNote >= 0 && now - lastNote < MIN_GAP) return
    let slot = -1
    for (let v = 0; v < MAX_VOICES; v++) {
      if (voiceEnds[v] <= now) {
        slot = v
        break
      }
    }
    if (slot < 0) return
    const decay = 1.5 + 1.5 * intensity
    const peak = 0.16 + 0.5 * intensity
    const base = SCALE[Math.floor(Math.random() * SCALE.length)] * Math.pow(2, ((Math.random() - 0.5) * 16) / 1200)
    for (let k = 0; k < PARTIALS.length; k++) {
      const osc = c.createOscillator()
      const env = c.createGain()
      const d = decay * PARTIAL_DECAY[k]
      osc.type = 'sine'
      osc.frequency.value = base * PARTIALS[k]
      env.gain.setValueAtTime(0, now)
      env.gain.linearRampToValueAtTime(peak * PARTIAL_GAIN[k], now + 0.005)
      env.gain.exponentialRampToValueAtTime(0.0001, now + d)
      osc.connect(env)
      env.connect(master!)
      osc.start(now)
      osc.stop(now + d + 0.05)
      osc.onended = () => {
        osc.disconnect()
        env.disconnect()
      }
    }
    voiceEnds[slot] = now + decay
    lastNote = now
  }

  return {
    feel(i, speed) {
      if (speed > THRESHOLD) {
        if (!armed[i]) return
        armed[i] = 0
        if (on && active && ctx && ctx.state === 'running') {
          const x = (speed - THRESHOLD) / (FULL - THRESHOLD)
          play(x > 1 ? 1 : x)
        }
      } else if (speed < THRESHOLD * 0.5) {
        armed[i] = 1
      }
    },
    setActive(next) {
      active = next
      sync()
    },
    enabled: () => on,
    setEnabled(next, fromGesture = false) {
      on = next
      if (on) {
        if (fromGesture) ensureCtx()
        if (!ctx) {
          document.addEventListener('pointerdown', unlock, true)
          document.addEventListener('keydown', unlock, true)
        }
      }
      sync()
    },
    dispose() {
      removeUnlock()
      if (ctx) void ctx.close().catch(() => {})
      ctx = null
    },
  }
}
