// Pad effect state (brief §11 PAD): plain tweened fields read by <Pad/> each
// frame. ShipDisplay triggers them on a ship swap; nothing here renders.
import gsap from 'gsap';

export const padFx = {
  /** 0..1 outward ring pulse progress (1 = idle / finished) */
  pulse: 1,
  /** scan plane: 0 = at the pad, 1 = above the ship; `scanA` its opacity */
  scan: 0,
  scanA: 0,
  /** pylon lens boost while scanning */
  pylon: 0,
  /** contact-shadow strength: 1 - dissolve, 0 for holograms (ShipDisplay) */
  shadow: 1,
};

let tl: gsap.core.Timeline | null = null;

/** Ring pulse + scan-plane sweep as a ship materialises (duration = dissolve-in). */
export function padMaterialise(duration: number, reduceMotion: boolean): void {
  tl?.kill();
  if (reduceMotion) {
    padFx.pulse = 1;
    padFx.scanA = 0;
    return;
  }
  tl = gsap
    .timeline()
    .fromTo(padFx, { pulse: 0 }, { pulse: 1, duration: 1.1, ease: 'power2.out' }, 0)
    .fromTo(padFx, { pylon: 1 }, { pylon: 0, duration: duration + 0.4, ease: 'power1.in' }, 0)
    .fromTo(padFx, { scan: 0, scanA: 1 }, { scan: 1, duration, ease: 'power1.inOut' }, 0)
    .to(padFx, { scanA: 0, duration: 0.25, ease: 'power1.in' }, duration - 0.1);
}
