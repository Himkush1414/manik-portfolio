// "Tall touch" viewport — a phone in Chrome/Safari "Desktop site" mode (the
// viewport meta is ignored, so the layout viewport is ~980px+ wide while its
// height follows the phone's portrait screen, e.g. 980x1860, then the whole
// page is scaled down to fit), or a portrait tablet. Touch input, a
// desktop-width layout, and a viewport TALLER than the 4:3 frame the desktop
// design is composed for.
//
// The desktop layout sizes its sections, gaps and pinned scroll stages in
// vh, so on these viewports every vh-based value is stretched ~2x: sections
// drift apart and the scroll-pinned stages hold a portrait-tall frame. The
// CSS counterpart (tall-touch.css, about/tall-touch.css) re-measures those
// values against a 4:3 frame (1vh -> 0.75vw), which is exactly what they
// already resolve to at the 4:3 edge, so there is no jump at the boundary.
//
// Detection is the inline <head> script in index.html / about/index.html,
// not a media query alone: it runs before first paint and re-runs on
// resize/rotate, and besides a coarse primary pointer it also recognises
// Desktop site by its signature — a touch device whose layout viewport is
// wider than its screen (documentElement.clientWidth ~980 vs screen.width
// ~390) — so it doesn't depend on how a given browser reports `pointer`
// in that mode. It sets two classes on <html>:
//   ds-zoomed  laid out wider than the touch screen (Desktop site)
//   tt-frame   >= 861px wide, taller than 4:3, and touch / ds-zoomed
// True desktops (no touch, never wider than their screen at 100% zoom) and
// normal phones (device-width layout) never get either class.
export const isTallTouch = () => document.documentElement.classList.contains('tt-frame');

// Backing-store pixel ratio for full-viewport canvases. Normally
// min(devicePixelRatio, cap). In Desktop site the whole layout is drawn
// scaled down (~0.4x at 980px on a 390px phone), so a canvas sized at
// devicePixelRatio x CSS size renders ~2.5x more pixels than the screen
// physically shows it at — dpr x the visual-viewport scale is the real
// on-screen density there (never below 1).
export function canvasPixelRatio(cap = 2) {
  const dpr = window.devicePixelRatio || 1;
  if (!document.documentElement.classList.contains('ds-zoomed')) return Math.min(dpr, cap);
  const scale = window.visualViewport?.scale ?? 1;
  return Math.min(Math.max(1, dpr * scale), cap);
}
