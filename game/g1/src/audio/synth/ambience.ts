// Hangar ambience bed (brief §16): detuned saws through a slow-LFO lowpass,
// distant air / PA noise, occasional far metallic ticks. Music bus; fades in
// and out; one instance. Started by the hangar once audio is unlocked.
import { AudioBus } from '../AudioBus';

type Bed = { stop(fade?: number): void };
let bed: Bed | null = null;

export function startHangarAmbience(): void {
  const ctx = AudioBus.ctx;
  if (!ctx || bed) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.5, t + 3);
  out.connect(AudioBus.buses.music);

  // drone: 3 detuned saws (A1 / E2 / A2) -> lowpass swept by a slow LFO
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 320;
  lp.Q.value = 2.2;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.045;
  lfoGain.gain.value = 170;
  lfo.connect(lfoGain).connect(lp.frequency);
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.05;
  lp.connect(droneGain).connect(out);
  const oscs = [55, 55.35, 82.4, 110.2].map((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 7;
    o.connect(lp);
    o.start(t);
    return o;
  });
  lfo.start(t);

  // air: band-limited noise (vents + distant PA)
  const nodes: AudioScheduledSourceNode[] = [...oscs, lfo];
  const noise = AudioBus.noiseBuffer();
  if (noise) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.018;
    src.connect(bp).connect(g).connect(out);
    src.start(t);
    nodes.push(src);
  }

  // far metallic ticks at random intervals (pinged resonant filter on noise)
  let alive = true;
  let timer = 0;
  const tick = () => {
    if (!alive || !AudioBus.ctx || !noise) return;
    const n = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800 + Math.random() * 2600;
    f.Q.value = 28;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.04, n + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, n + 0.5);
    s.connect(f).connect(g).connect(out);
    s.start(n);
    s.stop(n + 0.55);
    timer = window.setTimeout(tick, 2500 + Math.random() * 6500);
  };
  timer = window.setTimeout(tick, 1800);

  bed = {
    stop(fade = 1.2) {
      alive = false;
      window.clearTimeout(timer);
      const n = ctx.currentTime;
      out.gain.cancelScheduledValues(n);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), n);
      out.gain.exponentialRampToValueAtTime(0.0001, n + fade);
      nodes.forEach(x => x.stop(n + fade + 0.05));
      window.setTimeout(() => out.disconnect(), (fade + 0.2) * 1000);
      bed = null;
    },
  };
}

export function stopHangarAmbience(fade?: number): void {
  bed?.stop(fade);
}
