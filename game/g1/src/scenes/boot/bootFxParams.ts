// WebGL boot-FX parameters, animated by the master boot timeline and read by
// <BootFX/> every frame. Plain object: GSAP tweens it, no React state.
export const bootFx = {
  point: 0, // ignition point intensity 0..1
  streak: 0, // streak width 0..1 (fraction of screen)
  glow: 0, // streak glow multiplier (breathing)
  embers: 0, // ember emission/opacity 0..1
  opacity: 1, // whole FX layer
  drift: 0, // slow parallax drift (units)
};

export function resetBootFx(): void {
  bootFx.point = 0;
  bootFx.streak = 0;
  bootFx.glow = 0;
  bootFx.embers = 0;
  bootFx.opacity = 1;
  bootFx.drift = 0;
}

/** Layer the boot FX render on (the camera shows ONLY this layer during beats 0-4). */
export const BOOT_LAYER = 1;
