// Pure data, no side effects — the "colour of the page being left" map
// lv6-transition.ts's strip transition uses (see that file for the rule:
// the overlay always takes the colour of the page being LEFT, not the
// destination). Split out from lv6-transition.ts itself so anything else
// that needs one of these real colours (e.g. /lab/lv12/'s loader, which
// plays the same strip transition leaving "home") can import just the
// data without also re-running lv6-transition.ts's own top-level wiring
// (click delegation, About-iframe loading, etc.) as a side effect of the
// import.
import type { StripColor } from './strip-transition';

export type ViewId = 'home' | 'projects' | 'contact' | 'about' | 'skills';

// The four original values are lv7's own (Home's navy "iceberg" gradient,
// About's dark warm background, Projects/Contact's shared light
// background nudged a few percent so the wipe stays visible even between
// two same-family crossings). Skills' own value is its section's darkest
// cool-teal tone (see skillsfun.css's --skillsfun-darkest), not borrowed
// from any of the other four.
export const LEAVE_COLOR: Record<ViewId, StripColor> = {
  home: { gradient: 'linear-gradient(180deg, #0A1E38 0%, #12335C 100%)' },
  about: { solid: '#3A3632' },
  projects: { solid: '#D7D4CC' },
  contact: { solid: '#D7D4CC' },
  skills: { solid: '#0B1417' },
};
