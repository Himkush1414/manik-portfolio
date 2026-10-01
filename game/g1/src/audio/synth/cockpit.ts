// Cockpit voices (brief §16): power-up rise, MFD blips, HUD projection chime,
// and the cockpit bed (avionics hum + ventilation air + far relay clicks) that
// replaces the hangar bed while the pilot is sealed in. Pure Web Audio.
import { AudioBus } from '../AudioBus';

const ctx = () => AudioBus.ctx!;

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

let noiseBuf: AudioBuffer | null = null;
function noise(): AudioBuffer {
  const c = ctx();
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let s = 987654321;
  for (let i = 0; i < d.length; i++) {
    s = (s * 16807) % 2147483647;
    d[i] = (s / 2147483647) * 2 - 1;
  }
  return noiseBuf;
}

/** Systems power-up: a filtered saw rising an octave + a sub swell + a bright settle. */
export function powerUp(): void {
  const c = ctx();
  const t = c.currentTime;
  const o = c.createOscillator();
  const lp = c.createBiquadFilter();
  const g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(55, t);
  o.frequency.exponentialRampToValueAtTime(220, t + 1.1);
  lp.type = 'lowpass';
  lp.Q.value = 6;
  lp.frequency.setValueAtTime(180, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + 1.15);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(lp).connect(g).connect(AudioBus.buses.sfx);
  o.start(t);
  o.stop(t + 1.7);
  const sub = c.createOscillator();
  const sg = c.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(38, t);
  sub.frequency.exponentialRampToValueAtTime(62, t + 1.0);
  env(sg, t, 0.22, 0.6, 0.9);
  sub.connect(sg).connect(AudioBus.buses.sfx);
  sub.start(t);
  sub.stop(t + 1.6);
  const top = c.createOscillator();
  const tg = c.createGain();
  top.type = 'triangle';
  top.frequency.value = 1760;
  env(tg, t + 1.05, 0.035, 0.01, 0.5);
  top.connect(tg).connect(AudioBus.buses.sfx);
  top.start(t + 1.05);
  top.stop(t + 1.7);
}

/** MFD boot blip: two quick square chirps; each display has its own pitch. */
export function mfdBlip(index = 0): void {
  const c = ctx();
  const t = c.currentTime;
  const base = [880, 1046.5, 1318.5][index % 3];
  [0, 0.07].forEach((dt, k) => {
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = base * (k ? 1.5 : 1);
    f.type = 'bandpass';
    f.frequency.value = base * 1.5;
    f.Q.value = 3;
    env(g, t + dt, 0.05, 0.003, 0.05);
    o.connect(f).connect(g).connect(AudioBus.buses.ui);
    o.start(t + dt);
    o.stop(t + dt + 0.08);
  });
}

/** HUD projection on the combiner: a soft glassy fifth with a slow shimmer. */
export function hudOn(): void {
  const c = ctx();
  const t = c.currentTime;
  [523.25, 783.99, 1567.98].forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    o.detune.setValueAtTime(-12, t);
    o.detune.linearRampToValueAtTime(0, t + 0.4);
    env(g, t + i * 0.04, i === 2 ? 0.025 : 0.06, 0.02, 0.7);
    o.connect(g).connect(AudioBus.buses.ui);
    o.start(t + i * 0.04);
    o.stop(t + 0.9);
  });
}

type Bed = { stop(fade?: number): void };
let bed: Bed | null = null;

/** Cockpit bed: avionics hum, ventilation air, sparse relay clicks. One instance. */
export function startCockpitBed(): void {
  const c = AudioBus.ctx;
  if (!c || bed) return;
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.45, t + 1.2);
  out.connect(AudioBus.buses.music);
  // avionics: mains-like hum + a faint high inverter whine
  const hum = c.createOscillator();
  const humG = c.createGain();
  hum.type = 'sine';
  hum.frequency.value = 96;
  humG.gain.value = 0.05;
  const whine = c.createOscillator();
  const whineG = c.createGain();
  whine.type = 'sine';
  whine.frequency.value = 3150;
  whineG.gain.value = 0.004;
  hum.connect(humG).connect(out);
  whine.connect(whineG).connect(out);
  // ventilation: band-passed noise with a slow breathing swell
  const air = c.createBufferSource();
  air.buffer = noise();
  air.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.6;
  const airG = c.createGain();
  airG.gain.value = 0.035;
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.frequency.value = 0.11;
  lfoG.gain.value = 0.012;
  lfo.connect(lfoG).connect(airG.gain);
  air.connect(bp).connect(airG).connect(out);
  [hum, whine, air, lfo].forEach(n => n.start(t));
  // far relay clicks, scheduled on the audio clock (no timers drifting)
  let next = t + 2;
  let alive = true;
  const sched = () => {
    if (!alive) return;
    const now = c.currentTime;
    while (next < now + 1) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.value = 2200 + Math.random() * 900;
      env(g, next, 0.012, 0.001, 0.02);
      o.connect(g).connect(out);
      o.start(next);
      o.stop(next + 0.03);
      next += 2.5 + Math.random() * 5;
    }
  };
  const iv = setInterval(sched, 500);
  bed = {
    stop(fade = 0.8) {
      alive = false;
      clearInterval(iv);
      const s = c.currentTime;
      out.gain.cancelScheduledValues(s);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), s);
      out.gain.exponentialRampToValueAtTime(0.0001, s + fade);
      [hum, whine, air, lfo].forEach(n => n.stop(s + fade + 0.05));
      setTimeout(() => out.disconnect(), (fade + 0.2) * 1000);
    },
  };
}

export function stopCockpitBed(fade?: number): void {
  bed?.stop(fade);
  bed = null;
}
