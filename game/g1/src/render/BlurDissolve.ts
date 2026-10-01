// BlurDissolve (brief §8 + §19 handoff): THE transition primitive, reused by
// the boot beats now and by level transitions later. Two halves:
//  - DOM: exit = opacity 1->0, blur 0->28px, scale 1->1.05, power2.in, 0.6 s;
//         enter = opacity 0->1, blur 18->0px, scale 0.96->1, expo.out, 0.6 s.
//         will-change is set for the transition only and cleared after.
//         Reduced motion: a plain 0.25 s fade (no blur, no scale).
//  - WebGL twin: blurDissolve(swap) blurs + dims the post chain, runs `swap`
//    at the peak (the frame is unreadable), then clears.
// Tokens live in data/boot.config.ts (BOOT.dissolve / BOOT.reduced).
import gsap from 'gsap';
import { postfx } from './fxController';
import { BOOT } from '../data/boot.config';

const D = BOOT.dissolve;
const WILL = 'filter, transform, opacity';

export type DissolveOpts = { reduced?: boolean; duration?: number };

/** from/to vars for an enter (use with tl.fromTo so it is seek-safe). */
export function dissolveEnterVars({ reduced = false, duration = D.in.dur }: DissolveOpts = {}): [gsap.TweenVars, gsap.TweenVars] {
  return [
    { autoAlpha: 0, filter: `blur(${reduced ? 0 : D.in.blur}px)`, scale: reduced ? 1 : D.in.scale, willChange: WILL },
    { autoAlpha: 1, filter: 'blur(0px)', scale: 1, duration: reduced ? BOOT.reduced.fade : duration, ease: 'expo.out', clearProps: 'willChange' },
  ];
}

/** to-vars for an exit. */
export function dissolveExitVars({ reduced = false, duration = D.out.dur }: DissolveOpts = {}): gsap.TweenVars {
  return {
    autoAlpha: 0,
    filter: `blur(${reduced ? 0 : D.out.blur}px)`,
    scale: reduced ? 1 : D.out.scale,
    duration: reduced ? BOOT.reduced.fade : duration,
    ease: 'power2.in',
    onStart() {
      gsap.set(this.targets(), { willChange: WILL });
    },
    onComplete() {
      gsap.set(this.targets(), { clearProps: 'willChange' });
    },
  };
}

/** Standalone DOM enter / exit (outside a master timeline). */
export const dissolveIn = (el: gsap.TweenTarget, o?: DissolveOpts) => gsap.fromTo(el, ...dissolveEnterVars(o));
export const dissolveOut = (el: gsap.TweenTarget, o?: DissolveOpts) => gsap.to(el, dissolveExitVars(o));

export type BlurDissolveOpts = { duration?: number; dim?: number; reduceMotion?: boolean };

/** Full-screen WebGL dissolve around a scene swap. Resolves once fully clear. */
export function blurDissolve(swap: () => void | Promise<void>, opts: BlurDissolveOpts = {}): Promise<void> {
  const half = opts.reduceMotion ? BOOT.reduced.fade / 2 : (opts.duration ?? D.out.dur + D.in.dur - D.overlap) / 2;
  const dim = opts.dim ?? 0.35;
  gsap.killTweensOf(postfx, 'exposure,blur');
  const state = { blur: postfx.blur, exposure: postfx.exposure };
  return new Promise(resolve => {
    const tl = gsap.timeline({
      onUpdate: () => {
        postfx.setTransitionBlur(state.blur);
        postfx.exposure = state.exposure;
      },
    });
    tl.to(state, { blur: opts.reduceMotion ? 0 : 1, exposure: dim, duration: half, ease: 'power2.in' });
    tl.call(() => {
      tl.pause();
      void Promise.resolve(swap()).finally(() => tl.resume());
    });
    tl.to(state, { blur: 0, exposure: 1, duration: half, ease: 'expo.out' });
    tl.call(() => resolve());
  });
}
