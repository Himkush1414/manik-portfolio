// DOM input layer (brief §7 INPUT ROBUSTNESS). Feeds input/inputState.ts and
// owns the browser-facing rules:
//  - pointer lock on the first click in a mission (unadjustedMovement when the
//    browser supports it, plain lock otherwise, absolute cursor if denied)
//  - every held key / button is dropped on blur, hidden tab, pointer-lock
//    loss and when a modal opens (clear()); the mission pauses on those
//  - while PLAYING: game keys, Tab, Enter, the wheel (passive: false) and the
//    context menu are preventDefault-ed so nothing scrolls, zooms, tabs away
//    or triggers browser behaviour; outside play nothing is swallowed
//  - Esc exits pointer lock and pauses: pointerlockchange drives it (the
//    keydown may never arrive while locked)
import { InputState, type InputOptions } from './inputState';
import { useSettings } from '../state/settings.store';

type Hooks = {
  /** the mission should pause (focus / visibility / lock lost, or Esc) */
  pause?: () => void;
  cycleCamera?: () => void;
};

class InputManagerImpl {
  readonly state: InputState;
  private el: HTMLElement | null = null;
  /** true while the mission accepts gameplay input (mission.playing / bossIntro) */
  playing = false;
  locked = false;
  hooks: Hooks = {};
  private off: (() => void)[] = [];

  constructor() {
    this.state = new InputState(
      () => useSettings.getState().controls.bindings,
      (): InputOptions => {
        const c = useSettings.getState().controls;
        return { sensitivity: c.sensitivity, invertY: c.invertY, autoFire: c.autoFire, steering: c.steering, reticleAutoCentre: c.reticleAutoCentre };
      },
    );
  }

  /** Listen on the window; `el` is the pointer-lock target (the canvas). Idempotent. */
  attach(el: HTMLElement): void {
    if (this.el === el) return;
    this.detach();
    this.el = el;
    const on = <K extends keyof WindowEventMap>(t: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      window.addEventListener(t, fn as EventListener, opts);
      this.off.push(() => window.removeEventListener(t, fn as EventListener, opts));
    };
    const onDoc = <K extends keyof DocumentEventMap>(t: K, fn: (e: DocumentEventMap[K]) => void) => {
      document.addEventListener(t, fn as EventListener);
      this.off.push(() => document.removeEventListener(t, fn as EventListener));
    };
    on('keydown', e => {
      if (!this.playing) return;
      const game = this.state.keyDown(e.code, e.repeat, e.ctrlKey || e.metaKey || e.altKey);
      if (game || ((e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') && !(e.ctrlKey || e.metaKey))) e.preventDefault();
      this.flushEdges();
    });
    on('keyup', e => this.state.keyUp(e.code));
    on('mousedown', e => {
      if (!this.playing || e.target !== this.el) return;
      if (!this.locked) this.requestLock();
      if (this.state.mouseDown(e.button)) e.preventDefault();
      this.flushEdges();
    });
    on('mouseup', e => this.state.mouseUp(e.button));
    on('mousemove', e => {
      if (!this.playing) return;
      const now = performance.now() / 1000;
      if (this.locked) this.state.mouseMove(e.movementX, e.movementY, now);
      else if (this.state.absolute) this.state.cursor((e.clientX / window.innerWidth) * 2 - 1, 1 - (e.clientY / window.innerHeight) * 2, now);
    });
    on('wheel', e => void (this.playing && e.preventDefault()), { passive: false });
    on('contextmenu', e => void (this.playing && e.preventDefault()));
    on('blur', () => this.lost());
    onDoc('visibilitychange', () => document.hidden && this.lost());
    onDoc('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.el;
      if (this.locked) this.state.absolute = false;
      if (was && !this.locked) this.lost(); // Esc while locked lands here
    });
    onDoc('pointerlockerror', () => {
      this.locked = false;
      this.state.absolute = true;
    });
  }

  detach(): void {
    this.off.forEach(f => f());
    this.off = [];
    this.el = null;
    this.state.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    this.locked = false;
  }

  /** Must run inside a user gesture (click). Falls back to the absolute cursor. */
  requestLock(): void {
    const el = this.el as (HTMLElement & { requestPointerLock(o?: { unadjustedMovement?: boolean }): Promise<void> | void }) | null;
    if (!el || this.locked) return;
    const plain = () => {
      try {
        const r = el.requestPointerLock();
        if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => void (this.state.absolute = true));
      } catch {
        this.state.absolute = true;
      }
    };
    try {
      const r = el.requestPointerLock({ unadjustedMovement: true });
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(plain);
    } catch {
      plain();
    }
  }

  releaseLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Drop all held input (modal opened, pause) without pausing. */
  clear(): void {
    this.state.clear();
  }

  private lost(): void {
    this.state.clear();
    if (this.playing) this.hooks.pause?.();
  }

  private flushEdges(): void {
    if (this.state.pauseEdge) {
      this.state.pauseEdge = false;
      this.hooks.pause?.();
    }
    if (this.state.cameraEdge) {
      this.state.cameraEdge = false;
      this.hooks.cycleCamera?.();
    }
  }
}

export const InputManager = new InputManagerImpl();
