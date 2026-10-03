// Flight-contact voices (Control / Camera / Boundary addendum §3): the terrain
// is the wall, and touching it is heard. All Web Audio synthesis, zero samples.
//   grind(k)    scrape: a short band-passed noise rasp + a low rumble (k 0..1)
//   impact(k)   head-on: a thud (pitch-dropping sine) + a gravel burst
//   splash()    water: a hiss that opens and closes + a low plop
//   closeCall() near miss: a fast airy whoosh, Doppler-dropped
// Voices route to the sfx bus; the mission loop calls them from sim events.
import { AudioBus } from '../AudioBus';

const ctx = () => AudioBus.ctx!;

function noiseSrc(): AudioBufferSourceNode {
  const s = ctx().createBufferSource();
  s.buffer = AudioBus.noiseBuffer();
  s.loop = true;
  return s;
}

/** one shaped noise burst: band-pass (f0 -> f1), attack / decay, gain */
function burst(f0: number, f1: number, q: number, peak: number, attack: number, decay: number, offset = 0): void {
  const c = ctx();
  const t = c.currentTime;
  const n = noiseSrc();
  const bp = c.createBiquadFilter();
  const g = c.createGain();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  n.connect(bp).connect(g).connect(AudioBus.buses.sfx);
  n.start(t, offset);
  n.stop(t + attack + decay + 0.02);
}

export function grind(k: number): void {
  const a = Math.max(0.2, Math.min(1, k));
  burst(900 + 900 * Math.random(), 2400, 2.2, 0.09 * a, 0.012, 0.22, Math.random());
  burst(160, 90, 1.1, 0.12 * a, 0.02, 0.26, Math.random());
}

export function impact(k: number): void {
  const c = ctx();
  const t = c.currentTime;
  const a = Math.max(0.3, Math.min(1, k));
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * a, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(AudioBus.buses.sfx);
  o.start(t);
  o.stop(t + 0.5);
  burst(1800, 500, 0.9, 0.16 * a, 0.004, 0.4, Math.random());
}

export function splash(): void {
  burst(600, 4200, 0.7, 0.16, 0.05, 0.55, Math.random());
  burst(260, 120, 1.4, 0.14, 0.01, 0.3, Math.random());
}

export function closeCall(): void {
  const c = ctx();
  const t = c.currentTime;
  const n = noiseSrc();
  const bp = c.createBiquadFilter();
  const g = c.createGain();
  bp.type = 'bandpass';
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(3200, t);
  bp.frequency.exponentialRampToValueAtTime(700, t + 0.32);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.11, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
  n.connect(bp).connect(g).connect(AudioBus.buses.sfx);
  n.start(t, Math.random());
  n.stop(t + 0.4);
}

