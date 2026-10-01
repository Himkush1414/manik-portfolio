// Web Audio bus graph: sources -> {music|sfx|ui} -> master -> compressor ->
// destination. Gains follow the settings store; the whole graph ducks when
// the tab is hidden. Autoplay policy: try resume() at load; if still
// suspended, ui.store.audioLocked shows the "CLICK FOR SOUND" hint and the
// first user gesture unlocks it without disturbing anything else.
import { useSettings } from '../state/settings.store';
import { useUi } from '../state/ui.store';
import { bus } from '../core/bus';
import { runSliced } from '../core/slicer';

/** shared white noise: 2 s at this rate, synthesised in idle slices before any gesture */
const NOISE_RATE = 48000, NOISE_SECONDS = 2, NOISE_CHUNK = 12000;

function* noiseSteps(out: Float32Array): Generator<void, void, void> {
  let seed = 1234567;
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 16807) % 2147483647;
    out[i] = (seed / 2147483647) * 2 - 1;
    if (i % NOISE_CHUNK === NOISE_CHUNK - 1) yield;
  }
}

export type BusName = 'music' | 'sfx' | 'ui';

class AudioBusImpl {
  ctx: AudioContext | null = null;
  master!: GainNode;
  buses!: Record<BusName, GainNode>;
  private duck!: GainNode;
  private noise: AudioBuffer | null = null;
  private noiseData = new Float32Array(NOISE_RATE * NOISE_SECONDS);
  private noiseReady = false;
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
    this.prewarm();
    const policy = (navigator as Navigator & { getAutoplayPolicy?: (t: string) => string }).getAutoplayPolicy?.('audiocontext');
    if (policy === 'allowed') {
      this.createContext();
      return;
    }
    // the context is created in the task AFTER the gesture (sticky user
    // activation still allows it): its one-off audio-service setup no longer
    // runs inside the input event that the player is waiting on
    let pending = false;
    const unlock = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        if (!this.ctx) this.createContext();
        void this.tryResume().then(ok => {
          if (!ok) return;
          window.removeEventListener('pointerdown', unlock, true);
          window.removeEventListener('keydown', unlock, true);
        });
      }, 0);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  /**
   * Carry-over (b) (brief §4/§16). Chrome logs an autoplay warning for an
   * AudioContext created before user activation and zero console warnings is
   * a hard rule, so the context still waits for the first gesture. Measured
   * (headless Chrome, Windows): the FIRST AudioContext in a browser process
   * blocks the main thread 15-280 ms (synchronous audio-service setup; later
   * contexts take < 1 ms) and the shared noise cost 2-10 ms more on the
   * gesture. Now: enumerateDevices() (async, permission-free) nudges the
   * audio service at load — some runs then construct in ~15 ms; the noise is
   * synthesised in idle slices; and the context is built in the task after
   * the gesture, never inside it. See DEV_NOTES P2.4 / known issues.
   */
  private prewarm(): void {
    try {
      void navigator.mediaDevices?.enumerateDevices?.().catch(() => undefined);
    } catch {
      /* no media devices API: the constructor just costs more */
    }
    void runSliced('audio:noise', noiseSteps(this.noiseData)).then(
      () => (this.noiseReady = true),
      () => undefined,
    );
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
      const len = this.ctx.sampleRate * NOISE_SECONDS;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      if (!this.noiseReady) {
        // the idle job has not finished (gesture during load): finish it now
        const g = noiseSteps(this.noiseData);
        while (!g.next().done);
        this.noiseReady = true;
      }
      // white noise is rate-agnostic: copy (and tile if the device rate is higher)
      const d = buf.getChannelData(0);
      for (let o = 0; o < len; o += this.noiseData.length) d.set(this.noiseData.subarray(0, Math.min(this.noiseData.length, len - o)), o);
      this.noise = buf;
    }
    return this.noise;
  }
}

export const AudioBus = new AudioBusImpl();
