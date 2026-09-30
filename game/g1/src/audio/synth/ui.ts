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
