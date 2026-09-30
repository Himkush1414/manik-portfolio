// UI voices: short, dry, tonal — hover tick, confirm, deny buzz.
import { AudioBus } from '../AudioBus';

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

export function uiTick(): void {
  const ctx = AudioBus.ctx!;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = 'triangle';
  o.frequency.setValueAtTime(2400, t);
  o.frequency.exponentialRampToValueAtTime(1500, t + 0.03);
  f.type = 'highpass';
  f.frequency.value = 900;
  env(g, t, 0.08, 0.002, 0.045);
  o.connect(f).connect(g).connect(AudioBus.buses.ui);
  o.start(t);
  o.stop(t + 0.06);
}

export function uiConfirm(): void {
  const ctx = AudioBus.ctx!;
  const t = ctx.currentTime;
  [660, 990].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    env(g, t + i * 0.055, 0.12, 0.004, 0.16);
    o.connect(g).connect(AudioBus.buses.ui);
    o.start(t + i * 0.055);
    o.stop(t + i * 0.055 + 0.2);
  });
}

export function uiDeny(): void {
  const ctx = AudioBus.ctx!;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.value = 118;
  f.type = 'lowpass';
  f.frequency.value = 900;
  env(g, t, 0.1, 0.004, 0.22);
  o.connect(f).connect(g).connect(AudioBus.buses.ui);
  o.start(t);
  o.stop(t + 0.26);
}

/** Locked item: a dull detent click. */
export function uiLocked(): void {
  const ctx = AudioBus.ctx!;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.05);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1200;
  env(g, t, 0.07, 0.002, 0.07);
  o.connect(f).connect(g).connect(AudioBus.buses.ui);
  o.start(t);
  o.stop(t + 0.1);
}

/** Purchase: bright rising triad + a soft shimmer tail. */
export function uiPurchase(): void {
  const ctx = AudioBus.ctx!;
  const t = ctx.currentTime;
  [523.25, 783.99, 1046.5, 1567.98].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = i === 3 ? 'sine' : 'triangle';
    o.frequency.value = freq;
    const at = t + i * 0.07;
    env(g, at, i === 3 ? 0.06 : 0.1, 0.005, i === 3 ? 0.9 : 0.3);
    o.connect(g).connect(AudioBus.buses.ui);
    o.start(at);
    o.stop(at + 1);
  });
}

/** Livery change: a short band-passed noise whoosh (the repaint sweep). */
export function uiLivery(): void {
  const ctx = AudioBus.ctx!;
  const buf = AudioBus.noiseBuffer();
  if (!buf) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(600, t);
  f.frequency.exponentialRampToValueAtTime(4200, t + 0.45);
  const g = ctx.createGain();
  env(g, t, 0.09, 0.08, 0.4);
  s.connect(f).connect(g).connect(AudioBus.buses.ui);
  s.start(t);
  s.stop(t + 0.6);
}

/** Ship materialise: rising sine sweep under a glassy noise shimmer. */
export function sfxMaterialise(): void {
  const ctx = AudioBus.ctx!;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.7);
  env(g, t, 0.08, 0.2, 0.55);
  o.connect(g).connect(AudioBus.buses.sfx);
  o.start(t);
  o.stop(t + 0.8);
  const buf = AudioBus.noiseBuffer();
  if (!buf) return;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 5200;
  const g2 = ctx.createGain();
  env(g2, t + 0.1, 0.035, 0.3, 0.4);
  s.connect(f).connect(g2).connect(AudioBus.buses.sfx);
  s.start(t + 0.1);
  s.stop(t + 0.85);
}
