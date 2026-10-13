// "Tall touch" viewport — a phone in Chrome/Safari "Desktop site" mode (the
// layout viewport is forced to ~980px+ wide while its height follows the
// phone's portrait screen, e.g. 980x1860), or a portrait tablet. Touch input,
// a desktop-width layout, and a viewport TALLER than the 4:3 frame the
// desktop design is composed for.
//
// The desktop layout sizes its sections, gaps and pinned scroll stages in
// vh, so on these viewports every vh-based value is stretched ~2x: sections
// drift apart and the scroll-pinned stages hold a portrait-tall frame. The
// CSS counterpart (tall-touch.css, about/tall-touch.css) re-measures those
// values against a 4:3 frame (1vh -> 0.75vw) instead, which is exactly what
// they already resolve to at the 4:3 edge of this query, so there is no jump
// at its boundary. True desktops (fine pointer) and phones/landscape phones
// (narrower than 861px, or wider than 4:3) never match, so their layout is
// untouched. Keep this string in sync with the @media rule in those files.
export const TALL_TOUCH_QUERY = '(pointer: coarse) and (min-width: 861px) and (max-aspect-ratio: 4/3)';

export const tallTouchMQ = window.matchMedia(TALL_TOUCH_QUERY);
