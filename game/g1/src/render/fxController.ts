// Imperative post-FX controller (brief §19): pulse / transition blur /
// exposure. Scenes and choreography call these; PostFX.tsx reads the values
// every frame and pushes them into effect uniforms. GSAP drives the tweens so
// everything stays on the one ticker (pausable, seekable, no timer drift).
import gsap from 'gsap';
import { CameraShaker } from './CameraShaker';

type PulseOpts = { ca?: number; shake?: number; vignette?: number; duration?: number };

class PostFxController {
  /** extra chromatic-aberration offset (UV units) on top of the base */
  ca = 0;
  /** extra vignette darkness on top of the base */
  vignette = 0;
  /** 0..1 full-screen transition blur */
  blur = 0;
  exposure = 1;
  reduceFlashing = false;
  private lastPulse = 0;

  pulse({ ca = 0.006, shake = 0, vignette = 0, duration = 0.35 }: PulseOpts = {}): void {
    // reduce-flashing caps flash-like pulses to < 3/s
    const now = performance.now();
    if (this.reduceFlashing && now - this.lastPulse < 340) ca = 0;
    this.lastPulse = now;
    if (shake > 0) CameraShaker.addTrauma(shake);
    if (ca > 0) {
      this.ca = Math.max(this.ca, ca);
      gsap.to(this, { ca: 0, duration, ease: 'power2.out', overwrite: 'auto' });
    }
    if (vignette > 0) {
      this.vignette = Math.max(this.vignette, vignette);
      gsap.to(this, { vignette: 0, duration: duration * 1.4, ease: 'power2.out', overwrite: 'auto' });
    }
  }

  setTransitionBlur(v: number): void {
    this.blur = Math.min(1, Math.max(0, v));
  }

  setExposure(v: number, duration = 0): void {
    if (duration <= 0) {
      gsap.killTweensOf(this, 'exposure');
      this.exposure = v;
    } else gsap.to(this, { exposure: v, duration, ease: 'power2.inOut', overwrite: 'auto' });
  }
}

export const postfx = new PostFxController();
