// Shared strip cover/reveal mechanism — extracted from lv6-transition.ts
// (the Home<->About/Projects/Contact/Skills transition) so that mechanism
// has exactly one implementation instead of two. lv6-transition.ts keeps
// everything specific to ITS OWN router-ish view state (ViewId, showOnly,
// the About iframe, click delegation, LEAVE_COLOR's per-view map); this
// module only knows about a strip overlay's DOM structure and how to play
// it. Anything that wants "the strip transition" — a real view change or,
// as with /lab/lv12/'s loader, a one-off cover/reveal around some other
// content swap — builds a StripProfile against its own overlay markup
// (same lv6-transition.css classes) and calls playStripCoverReveal.
export interface StripProfile {
  overlay: HTMLElement;
  els: HTMLElement[];
  coverDelays: number[];
  revealDelays: number[];
  totalPlayTime: number;
}

export interface StripColor {
  solid?: string;
  gradient?: string;
}

export const STRIP_STAGGER = 70;
export const STRIP_DURATION = 420;
export const STRIP_HOLD = 120;

export function buildStripProfile(
  overlay: HTMLElement | null,
  elClass: string,
  stagger: number = STRIP_STAGGER,
  duration: number = STRIP_DURATION
): StripProfile | null {
  if (!overlay) return null;
  const els = Array.from(overlay.querySelectorAll<HTMLElement>(elClass));
  if (!els.length) return null;
  const n = els.length;
  return {
    overlay,
    els,
    coverDelays: els.map((_, i) => i * stagger),
    revealDelays: els.map((_, i) => (n - 1 - i) * stagger),
    totalPlayTime: (n - 1) * stagger + duration,
  };
}

export function setStripColor(overlay: HTMLElement, color: StripColor) {
  overlay.classList.toggle('theme-gradient', !!color.gradient);
  if (color.gradient) {
    overlay.style.setProperty('--tgrad', color.gradient);
  } else if (color.solid) {
    overlay.style.setProperty('--tcolor', color.solid);
  }
}

function setStripDelays(profile: StripProfile, delays: number[], duration: number) {
  profile.els.forEach((el, i) => {
    el.style.transitionDelay = `${delays[i]}ms`;
    el.style.transitionDuration = `${duration}ms`;
  });
}

function waitForStripEl(el: HTMLElement, fallback: number): Promise<void> {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      resolve();
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') finish();
    };
    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, fallback + 200);
  });
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface PlayStripOptions {
  color: StripColor;
  /** Called once the strips have fully covered the screen — swap whatever's underneath here. */
  onCovered: () => void | Promise<void>;
  hold?: number;
  duration?: number;
}

/**
 * Plays the full cover -> (onCovered) -> hold -> reveal sequence against an
 * already-built StripProfile. Identical timing/easing to the original
 * Home<->About transition (STAGGER/DURATION/HOLD, same
 * is-active/is-covering/is-revealing class + transform mechanism defined
 * in lv6-transition.css) — this function IS that mechanism, not a copy of it.
 */
export async function playStripCoverReveal(profile: StripProfile, opts: PlayStripOptions): Promise<void> {
  const duration = opts.duration ?? STRIP_DURATION;
  const hold = opts.hold ?? STRIP_HOLD;
  const { overlay, els, coverDelays, revealDelays, totalPlayTime } = profile;

  setStripColor(overlay, opts.color);
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('is-active');

  setStripDelays(profile, coverDelays, duration);
  void overlay.offsetWidth;
  overlay.classList.add('is-covering');
  await waitForStripEl(els[els.length - 1], totalPlayTime);

  await opts.onCovered();
  await wait(hold);

  setStripDelays(profile, revealDelays, duration);
  void overlay.offsetWidth;
  overlay.classList.remove('is-covering');
  overlay.classList.add('is-revealing');
  await waitForStripEl(els[0], totalPlayTime);

  els.forEach(el => {
    el.style.transitionDelay = '0ms';
    el.style.transitionDuration = '0ms';
  });
  void overlay.offsetWidth;
  overlay.classList.remove('is-active', 'is-revealing');
  void overlay.offsetWidth;
  overlay.setAttribute('aria-hidden', 'true');
}
