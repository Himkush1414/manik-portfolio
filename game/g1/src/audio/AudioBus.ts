// Web Audio bus graph: sources -> {music|sfx|ui} -> master -> compressor ->
// destination. Gains follow the settings store; the whole graph ducks when
// the tab is hidden. Autoplay policy: try resume() at load; if still
// suspended, ui.store.audioLocked shows the "CLICK FOR SOUND" hint and the
// first user gesture unlocks it without disturbing anything else.
import { useSettings } from '../state/settings.store';
import { useUi } from '../state/ui.store';
import { bus } from '../core/bus';

export type BusName = 'music' | 'sfx' | 'ui';

class AudioBusImpl {
  ctx: AudioContext | null = null;
  master!: GainNode;
  buses!: Record<BusName, GainNode>;
  private duck!: GainNode;
  private noise: AudioBuffer | null = null;
  private started = false;

  /**
   * Idempotent. The AudioContext is created on the first user gesture (or
   * immediately when the browser reports audio autoplay as allowed): creating
   * it earlier makes Chrome log an autoplay warning, and the brief allows zero
   * console warnings. Until then ui.store.audioLocked shows the corner hint.
   */
  init(): void {
    if (this.started) return;
    this.started = true;
    useUi.getState().setAudioLocked(true);
    const policy = (navigator as Navigator & { getAutoplayPolicy?: (t: string) => string }).getAutoplayPolicy?.('audiocontext');
    if (policy === 'allowed') {
      this.createContext();
      return;
    }
    const unlock = () => {
      if (!this.ctx) this.createContext();
      void this.tryResume().then(ok => {
        if (!ok) return;
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      });
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  private createContext(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.duck = ctx.createGain();
    this.master = ctx.createGain();
    this.master.connect(this.duck).connect(comp).connect(ctx.destination);
    this.buses = { music: ctx.createGain(), sfx: ctx.createGain(), ui: ctx.createGain() };
    for (const b of Object.values(this.buses)) b.connect(this.master);
    this.applyGains();
    useSettings.subscribe((s, prev) => {
      if (s.audio !== prev.audio) this.applyGains();
    });
    document.addEventListener('visibilitychange', () => {
      const t = ctx.currentTime;
      this.duck.gain.cancelScheduledValues(t);
      this.duck.gain.setTargetAtTime(document.hidden ? 0 : 1, t, 0.12);
    });
    void this.tryResume();
  }

  private async tryResume(): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      try {
        await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 250))]);
      } catch {
        /* still locked */
      }
    }
    const running = ctx.state === 'running';
    useUi.getState().setAudioLocked(!running);
    if (running) bus.emit('audio:unlocked', {});
    return running;
  }

  private applyGains(): void {
    if (!this.ctx) return;
    const a = useSettings.getState().audio;
    if (!a) return;
    const t = this.ctx.currentTime;
    const ramp = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.05);
    ramp(this.master, a.mute ? 0 : a.master);
    ramp(this.buses.music, a.music);
    ramp(this.buses.sfx, a.sfx);
    ramp(this.buses.ui, a.ui);
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** Shared 2s white-noise buffer (hiss, clunks, air). */
  noiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noise) {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647;
        d[i] = (seed / 2147483647) * 2 - 1;
      }
      this.noise = buf;
    }
    return this.noise;
  }
}

export const AudioBus = new AudioBusImpl();
