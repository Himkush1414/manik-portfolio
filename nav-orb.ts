// Navbar orb — the round Contact button right of "Skills" (both the hero
// nav and the slide-down return nav): a small circular window into the
// hero box's own fluid flow, drawn by fluid-orb.ts in the same four blues
// as .lv2-effect / hero-wave.ts (#060F1C, #0A2036, #103C69, #205FA4) at
// the same ramp positions. The pointer highlight is #6C97CC, the lighter
// blue the navbar already uses on this button's hover (lv2.css).
//
// The circle is cut by the button's CSS border-radius + overflow: hidden
// with a solid 1px #205FA4 ring (lv2.css), so the edge stays crisp. Click
// handling is untouched: the button is still a[href="#contact"], picked up
// by lv6-transition.ts like the tabs.
import { startFluidOrb } from './fluid-orb';

export function startNavOrbs() {
  document.querySelectorAll<HTMLElement>('.nav__orb').forEach(host => {
    const canvas = host.querySelector<HTMLCanvasElement>('.nav__orb-canvas');
    if (!canvas) return;
    startFluidOrb(host, canvas, {
      stops: [
        [6, 15, 28],
        [10, 32, 54],
        [16, 60, 105],
        [32, 95, 164]
      ],
      mid: [0.38, 0.74],
      highlight: [108, 151, 204],
      scale: 1.08,
      hoverPad: 12
    });
  });
}
