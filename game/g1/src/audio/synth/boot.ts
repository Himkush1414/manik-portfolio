// Boot + door voices (brief §16): all Web Audio synthesis, zero samples.
import { AudioBus } from '../AudioBus';

const ctx = () => AudioBus.ctx!;

function noiseSrc(): AudioBufferSourceNode {
  const s = ctx().createBufferSource();
  s.buffer = AudioBus.noiseBuffer();
  s.loop = true;
  return s;
}

let verb: ConvolverNode | null = null;
/** Short metallic room reverb (generated impulse), shared. */
function reverb(): ConvolverNode {
  if (verb) return verb;
  const c = ctx();
  const len = Math.floor(c.sampleRate * 1.1);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (0.6 + 0.4 * Math.sin(i * 0.013 + ch));
    }
  }
  verb = c.createConvolver();
  verb.buffer = buf;
  const wet = c.createGain();
  wet.gain.value = 0.32;
  verb.connect(wet).connect(AudioBus.buses.sfx);
  return verb;
}

/** Logo sting: sub boom + rising shimmer + whoosh riser. */
export function sting(): void {
  const c = ctx();
  const t = c.currentTime;
  const sub = c.createOscillator();
  const subG = c.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(92, t);
  sub.frequency.exponentialRampToValueAtTime(34, t + 1.6);
  subG.gain.setValueAtTime(0.0001, t);
  subG.gain.exponentialRampToValueAtTime(0.9, t + 0.03);
  subG.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  sub.connect(subG).connect(AudioBus.buses.music);
  sub.start(t);
  sub.stop(t + 2.5);

  [880, 1318.5, 1760, 2637].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 1.8);
    o.detune.value = (i - 1.5) * 7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    o.connect(g).connect(reverb());
    o.connect(g).connect(AudioBus.buses.music);
    o.start(t);
    o.stop(t + 3.3);
  });

  const n = noiseSrc();
  const bp = c.createBiquadFilter();
  const ng = c.createGain();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(5200, t + 1.1);
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.18, t + 0.9);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  n.connect(bp).connect(ng).connect(AudioBus.buses.sfx);
  n.start(t);
  n.stop(t + 1.6);
}

/** Streak zing: bright filtered sweep. */
export function zing(): void {
  const c = ctx();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  const hp = c.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(7200, t + 0.35);
  hp.type = 'highpass';
  hp.frequency.value = 2400;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(hp).connect(g).connect(AudioBus.buses.sfx);
  o.start(t);
  o.stop(t + 0.55);
}

/** Soft beat transition. */
export function whoosh(): void {
  const c = ctx();
  const t = c.currentTime;
  const n = noiseSrc();
  const lp = c.createBiquadFilter();
  const g = c.createGain();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
  lp.frequency.exponentialRampToValueAtTime(300, t + 0.7);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.28);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  n.connect(lp).connect(g).connect(AudioBus.buses.sfx);
  n.start(t);
  n.stop(t + 0.8);
}

export function loaderTick(): void {
  const c = ctx();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = 3100;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.018, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  o.connect(g).connect(AudioBus.buses.ui);
  o.start(t);
  o.stop(t + 0.04);
}

/** Metal clunk: noise burst + low sine thump through the short reverb. */
export function clunk(weight = 1): void {
  const c = ctx();
  const t = c.currentTime;
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120 * (1.1 - weight * 0.2), t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.85 * weight, t + 0.006);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(og).connect(AudioBus.buses.sfx);
  o.connect(og).connect(reverb());
  o.start(t);
  o.stop(t + 0.55);

  const n = noiseSrc();
  const bp = c.createBiquadFilter();
  const ng = c.createGain();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.8;
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.5 * weight, t + 0.003);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  n.connect(bp).connect(ng).connect(reverb());
  n.connect(bp).connect(ng).connect(AudioBus.buses.sfx);
  n.start(t);
  n.stop(t + 0.2);
}

/** Hydraulic hiss (pressure release). */
export function hiss(duration = 1.2): void {
  const c = ctx();
  const t = c.currentTime;
  const n = noiseSrc();
  const hp = c.createBiquadFilter();
  const g = c.createGain();
  hp.type = 'highpass';
  hp.frequency.value = 3200;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  n.connect(hp).connect(g).connect(AudioBus.buses.sfx);
  n.start(t);
  n.stop(t + duration + 0.05);
}

/** Servo whine whose pitch follows door speed. Returns an updater + stopper. */
export function servo(): { set(speed: number): void; stop(): void } {
  const c = ctx();
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  o.type = 'sawtooth';
  o2.type = 'square';
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  g.gain.value = 0.0001;
  o.connect(lp);
  o2.connect(lp);
  lp.connect(g).connect(AudioBus.buses.sfx);
  o.start();
  o2.start();
  return {
    set(speed: number) {
      const t = c.currentTime;
      const s = Math.min(1, Math.abs(speed));
      o.frequency.setTargetAtTime(70 + s * 210, t, 0.05);
      o2.frequency.setTargetAtTime(140 + s * 420, t, 0.05);
      g.gain.setTargetAtTime(0.0001 + s * 0.07, t, 0.06);
    },
    stop() {
      const t = c.currentTime;
      g.gain.setTargetAtTime(0.0001, t, 0.08);
      o.stop(t + 0.5);
      o2.stop(t + 0.5);
    },
  };
}
