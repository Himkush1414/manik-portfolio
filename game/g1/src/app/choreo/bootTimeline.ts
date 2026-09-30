// Master boot timeline (brief §8): ONE seekable, pausable GSAP timeline drives
// DOM typography, WebGL FX params, the layer mask, exposure, the doors and the
// camera. Every visual state is a TWEENED property (so seek() renders exactly);
// callbacks are only used for side effects (FSM beats, audio) that QA seeking
// may skip. The loading beat pauses on the real loader, never on a fake timer.
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { BootRefs } from '../../ui/screens/boot/BootSequence';
import { BOOT } from '../../data/boot.config';
import { bootFx, resetBootFx } from '../../scenes/boot/bootFxParams';
import { stage } from '../../scenes/Stage';
import { bootDoors } from '../../scenes/sceneBridge';
import { director, setView, VIEWS, BOOT_FX_POS } from '../../render/cameraDirector';
import { postfx } from '../../render/fxController';
import { flow, type FlowState } from '../flow';
import { sfx } from '../../audio/sfx';
import { useLoader } from '../../core/loader';
import { registerDebug } from '../../debug/debugApi';

gsap.registerPlugin(SplitText);

export type BootOptions = { reduced: boolean; bootSeen: boolean; onDone: () => void };
export type BootHandle = { dispose(): void };

const V = VIEWS.hangar;

/** Waits for the loader, then resumes the timeline (called by an addPause). */
function resumeWhenReady(tl: gsap.core.Timeline): void {
  const go = () => tl.play();
  if (useLoader.getState().finished) {
    go();
    return;
  }
  const unsub = useLoader.subscribe(s => {
    if (s.finished) {
      unsub();
      go();
    }
  });
}

export function runBoot(refs: BootRefs, opts: BootOptions): BootHandle {
  const B = BOOT;
  const R = opts.reduced;
  let done = false;
  let split: SplitText | null = null;

  // ---- initial world state ----
  setView(VIEWS.bootGate);
  director.focus.set(...BOOT_FX_POS);
  stage.world = 0;
  resetBootFx();
  bootDoors.set(0);
  postfx.setExposure(1);

  const tl = gsap.timeline({ paused: true });
  gsap.set(refs.lbTop, { yPercent: -100 });
  gsap.set(refs.lbBottom, { yPercent: 100 });

  const enter = (el: Element, at: number, dur: number = B.dissolve.in.dur) =>
    tl.fromTo(
      el,
      { autoAlpha: 0, filter: `blur(${R ? 0 : B.dissolve.in.blur}px)`, scale: R ? 1 : B.dissolve.in.scale, willChange: 'filter, transform, opacity' },
      { autoAlpha: 1, filter: 'blur(0px)', scale: 1, duration: R ? B.reduced.fade : dur, ease: 'expo.out', clearProps: 'willChange' },
      at,
    );
  const exit = (el: Element, at: number, dur: number = B.dissolve.out.dur) =>
    tl.to(
      el,
      { autoAlpha: 0, filter: `blur(${R ? 0 : B.dissolve.out.blur}px)`, scale: R ? 1 : B.dissolve.out.scale, duration: R ? B.reduced.fade : dur, ease: 'power2.in' },
      at,
    );
  const beat = (at: number, fn: () => void) => tl.call(fn, [], at);

  // ------------------------------------------------------------------ times
  const T = R
    ? { logo: 0.2, logoOut: 1.35, credit: 1.55, creditOut: 2.25, tag: 2.45, tagOut: 3.1, loading: 3.3, hold: 0.4 }
    : { logo: B.title.start, logoOut: B.logoOut.start, credit: B.credit.start, creditOut: B.credit.start + B.credit.in + B.credit.hold, tag: B.tagline.start, tagOut: B.tagline.start + B.tagline.in + B.tagline.hold, loading: B.loading.start, hold: B.loading.minHold };
  const NOMINAL = T.loading + T.hold;
  const D = NOMINAL + (R ? 0.25 : 0.4); // door beat (9.05 at full length)

  // ---------------------------------------------------------- beat 1: logo
  beat(B.streak.start, () => flow.send('BEAT_NEXT'));
  tl.to(bootFx, { point: 1, duration: 0.05, ease: 'none' }, B.ignite.at);
  tl.to(bootFx, { point: 0.3, duration: 1.4, ease: 'power2.out' }, B.ignite.at + 0.08);
  beat(B.ignite.at, () => sfx.play('sting'));
  beat(B.streak.start, () => sfx.play('zing'));
  tl.to(bootFx, { streak: 1, glow: 1, duration: R ? 0.25 : B.streak.grow, ease: 'expo.out' }, B.streak.start);
  if (!R) tl.to(bootFx, { glow: 0.42, duration: 1.1, ease: 'sine.inOut', repeat: 2, yoyo: true }, B.streak.start + B.streak.grow);
  tl.to(bootFx, { drift: 0.32, duration: 4.6, ease: 'none' }, 0);

  tl.set(refs.logoLayer, { autoAlpha: 1 }, T.logo);
  split = SplitText.create(refs.title, { type: 'chars', mask: 'chars', charsClass: 'bchar', aria: 'hidden' });
  if (R) {
    tl.fromTo(refs.lockup, { autoAlpha: 0 }, { autoAlpha: 1, duration: B.reduced.fade }, T.logo);
    tl.set([refs.edition], { autoAlpha: 1 }, T.logo);
    tl.set(refs.bar, { scaleX: 1 }, T.logo);
    tl.set(refs.signature, { '--p': '110%' }, T.logo);
    tl.set(refs.reflection, { opacity: 0.12 }, T.logo);
  } else {
    tl.fromTo(split.chars, { yPercent: 112, rotateX: -62 }, { yPercent: 0, rotateX: 0, duration: 0.95, ease: 'expo.out', stagger: { each: B.title.charStagger, from: 'center' } }, B.title.start);
    tl.fromTo(refs.lockup, { scale: B.title.scaleFrom }, { scale: 1, duration: B.title.dur, ease: 'expo.out' }, B.title.start);
    tl.fromTo(refs.titleWrap, { '--blur': `${B.title.blurFrom}px` }, { '--blur': '0px', duration: B.title.dur * 0.8, ease: 'expo.out' }, B.title.start);
    tl.fromTo(refs.titleWrap, { '--split': B.title.splitPx }, { '--split': 0, duration: B.title.splitDur, ease: 'power2.out' }, B.title.start + 0.35);
    tl.fromTo(refs.edition, { autoAlpha: 0, letterSpacing: '1.3em', filter: 'blur(10px)' }, { autoAlpha: 1, letterSpacing: `${B.edition.tracking}em`, filter: 'blur(0px)', duration: B.edition.dur, ease: 'expo.out' }, B.edition.start);
    tl.fromTo(refs.bar, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'expo.out' }, B.edition.start + 0.12);
    tl.fromTo(refs.signature, { '--p': '-10%' }, { '--p': '110%', duration: B.signature.dur, ease: 'power1.inOut' }, B.signature.start);
    tl.fromTo(refs.glint, { backgroundPosition: '130% 0' }, { backgroundPosition: '-30% 0', duration: B.glint.dur, ease: 'power2.inOut' }, B.glint.start);
    tl.to(refs.reflection, { opacity: 0.12, duration: 0.8, ease: 'power2.out' }, 1.7);
    tl.to(bootFx, { embers: 1, duration: 0.8, ease: 'power1.out' }, B.embers.start);
    tl.to(bootFx, { embers: 0, duration: 0.6, ease: 'power1.in' }, B.embers.end);
    tl.to(refs.lockup, { scale: B.hold.pushIn, duration: B.hold.end - B.hold.start, ease: 'none' }, B.hold.start);
  }
  exit(refs.logoLayer, T.logoOut, B.logoOut.dur);
  tl.to(bootFx, { opacity: 0, duration: R ? B.reduced.fade : 0.6, ease: 'power2.in' }, T.logoOut);
  if (!R) {
    // WebGL twin of the DOM blur-dissolve (tweened property: seek-safe)
    tl.fromTo(postfx, { blur: 0 }, { blur: 0.7, duration: 0.3, ease: 'power2.in', immediateRender: false }, T.logoOut);
    tl.to(postfx, { blur: 0, duration: 0.3, ease: 'power2.out' }, T.logoOut + 0.3);
  }

  // ------------------------------------------------------- beat 2: credit
  beat(T.credit, () => {
    flow.send('BEAT_NEXT');
    sfx.play('whoosh');
  });
  enter(refs.creditLayer, T.credit, B.credit.in);
  tl.fromTo(refs.hairline, { scaleX: 0 }, { scaleX: 1, duration: R ? 0.01 : 0.6, ease: 'expo.out' }, T.credit + 0.12);
  exit(refs.creditLayer, T.creditOut, B.credit.out);

  // ------------------------------------------------------ beat 3: tagline
  beat(T.tag, () => {
    flow.send('BEAT_NEXT');
    sfx.play('whoosh');
  });
  tl.set(refs.taglineLayer, { autoAlpha: 1 }, T.tag);
  tl.fromTo(
    refs.words,
    { autoAlpha: 0, filter: `blur(${R ? 0 : 14}px)`, y: R ? 0 : 12 },
    { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: R ? B.reduced.fade : B.tagline.in, ease: 'expo.out', stagger: R ? 0 : B.tagline.wordStagger },
    T.tag,
  );
  tl.fromTo(refs.lbTop, { yPercent: -100 }, { yPercent: 0, duration: R ? B.reduced.fade : B.letterbox.dur, ease: 'expo.out' }, T.tag);
  tl.fromTo(refs.lbBottom, { yPercent: 100 }, { yPercent: 0, duration: R ? B.reduced.fade : B.letterbox.dur, ease: 'expo.out' }, T.tag);
  exit(refs.taglineLayer, T.tagOut, B.tagline.out);

  // --------------------------------------------------- beat 4: loading
  tl.addLabel('loading', T.loading);
  beat(T.loading, () => flow.send('BEAT_NEXT'));
  enter(refs.loaderLayer, T.loading, 0.5);
  tl.to(refs.skip, { autoAlpha: 0, duration: 0.3 }, T.loading);
  tl.addPause(NOMINAL, () => resumeWhenReady(tl));
  tl.fromTo(refs.ring, { filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,90,31,0))' }, { filter: 'brightness(2.4) drop-shadow(0 0 14px rgba(255,90,31,0.9))', duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, NOMINAL + 0.001);
  tl.fromTo(refs.nominal, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, NOMINAL + 0.001);
  beat(NOMINAL + 0.001, () => sfx.play('confirm'));

  // ------------------------------------------------------ beat 5: doors
  tl.addLabel('doors', D);
  beat(D, () => flow.send('BEAT_NEXT'));
  tl.to(refs.loaderLayer, { autoAlpha: 0, filter: `blur(${R ? 0 : 12}px)`, duration: B.doors.domFade, ease: 'power2.in' }, D);
  tl.set(stage, { world: 1 }, D + 0.15);
  tl.set(director.focus, { x: 0, y: 6.9, z: 38 }, D + 0.15);
  tl.fromTo(postfx, { exposure: 0 }, { exposure: 1, duration: 0.45, ease: 'power2.out', immediateRender: false }, D + 0.15);
  const openAt = D + 0.15 + (R ? 0.1 : B.doors.beacons);
  tl.add(bootDoors.openTween(R ? 0.8 : B.doors.open), openAt);
  let endAt: number;
  if (R) {
    // reduced motion: no camera flight — fade-cut to the hangar view
    const cut = openAt + 0.8;
    tl.to(postfx, { exposure: 0, duration: 0.2, ease: 'power2.in' }, cut);
    tl.set(director.pos, { x: V.pos[0], y: V.pos[1], z: V.pos[2] }, cut + 0.2);
    tl.set(director.look, { x: V.look[0], y: V.look[1], z: V.look[2] }, cut + 0.2);
    tl.set(director.focus, { x: V.focus[0], y: V.focus[1], z: V.focus[2] }, cut + 0.2);
    tl.to(postfx, { exposure: 1, duration: 0.2, ease: 'power2.out' }, cut + 0.2);
    endAt = cut + 0.4;
  } else {
    const dolly = openAt + 0.05;
    tl.to(director.pos, { x: V.pos[0], y: V.pos[1], z: V.pos[2], duration: 2.2, ease: 'power2.inOut' }, dolly);
    tl.to(director.look, { x: V.look[0], y: V.look[1], z: V.look[2], duration: 2.2, ease: 'power2.inOut' }, dolly);
    tl.to(director.focus, { x: V.focus[0], y: V.focus[1], z: V.focus[2], duration: 2.2, ease: 'power2.inOut' }, dolly);
    endAt = dolly + 2.2 - 0.3;
  }
  // letterbox retracts as the hangar UI arrives (UI stagger lands in 1E)
  tl.to(refs.lbTop, { yPercent: -100, duration: R ? B.reduced.fade : 0.6, ease: 'expo.in' }, endAt);
  tl.to(refs.lbBottom, { yPercent: 100, duration: R ? B.reduced.fade : 0.6, ease: 'expo.in' }, endAt);
  beat(endAt + (R ? 0.3 : 0.6), () => {
    done = true;
    flow.send('BOOT_DONE');
    opts.onDone();
  });

  // skip hint
  tl.fromTo(refs.skip, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, opts.bootSeen ? B.skip.hintAtSeen : B.skip.hintAt);

  // ---------------------------------------------------------------- skip
  const unlockAt = opts.bootSeen ? B.skip.hintAtSeen : B.skip.unlockAt;
  let skipping = false;
  const onInput = () => {
    if (done || skipping) return;
    const t = tl.time();
    if (t < unlockAt || t >= T.loading) return; // early input only unlocks audio; loader/doors always play
    skipping = true;
    tl.pause();
    const layers = [refs.logoLayer, refs.creditLayer, refs.taglineLayer].filter(el => Number(gsap.getProperty(el, 'opacity')) > 0.01);
    gsap.to(bootFx, { opacity: 0, duration: B.skip.dissolve });
    gsap.to(layers, {
      autoAlpha: 0,
      filter: `blur(${R ? 0 : 20}px)`,
      duration: B.skip.dissolve,
      ease: 'power2.in',
      onComplete: () => {
        tl.seek('loading', true);
        flow.send('SKIP_TO_LOADING');
        tl.timeScale(B.skip.doorRate);
        tl.play();
      },
    });
  };
  window.addEventListener('keydown', onInput);
  window.addEventListener('pointerdown', onInput);

  // ------------------------------------------------------------ QA hooks
  const stateAt = (t: number): FlowState =>
    t < B.streak.start ? 'boot.black' : t < T.credit ? 'boot.logo' : t < T.tag ? 'boot.credit' : t < T.loading ? 'boot.tagline' : t < D ? 'boot.loading' : 'boot.doors';
  registerDebug('boot', {
    seek: (t: number) => {
      tl.pause();
      tl.seek(t, true);
      flow.force(stateAt(t));
    },
    play: () => tl.play(),
    time: () => tl.time(),
    duration: () => tl.duration(),
    doorsAt: () => D,
  });

  tl.play(0);

  return {
    dispose() {
      window.removeEventListener('keydown', onInput);
      window.removeEventListener('pointerdown', onInput);
      tl.kill();
      split?.revert();
      postfx.setTransitionBlur(0);
    },
  };
}
