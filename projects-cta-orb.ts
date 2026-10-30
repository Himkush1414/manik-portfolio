// Projects page CTA circle — the round Contact link beside "Contact Me"
// at the bottom of the Projects view: the same fluid-wave language as the
// hero box and the navbar orb (fluid-orb.ts), in this section's own two
// colours only — the ink #111111 and the cream #E3E1DC (projects.css
// --lv7-ink / --lv7-bg), with the two middle stops blended from them.
//
// Hover adds a magnetic drift toward the pointer (max 6px) and a slight
// scale on top of the shared speed-up / swell / highlight. Clicking is
// handled by lv6-transition.ts: the circle is a[href="#contact"], so it
// gets the same goTo('contact') strip transition as "Contact Me".
import { startFluidOrb } from './fluid-orb';

export function startProjectsCtaOrb() {
  const host = document.getElementById('lv7-cta-orb');
  const canvas = host?.querySelector<HTMLCanvasElement>('.lv7-cta__orb-canvas');
  if (!host || !canvas) return;
  startFluidOrb(host, canvas, {
    stops: [
      [17, 17, 17],
      [80, 79, 78],
      [147, 146, 143],
      [227, 225, 220]
    ],
    mid: [0.38, 0.74],
    highlight: [227, 225, 220],
    scale: 1.06,
    magnet: 6,
    hoverPad: 12
  });
}
