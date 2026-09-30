// Turntable control (brief §11; custom, NOT OrbitControls). Plain state +
// update(dt) driven from a frame loop; DOM listeners bind to the canvas only,
// so HTML panels above it never lose events.
//   auto-yaw 4 deg/s, resuming with a smooth ramp 2.5 s after the last input
//   pointer drag: yaw with inertia + damping, pitch +-10 deg springing back
//   wheel / pinch zoom 0.85..1.2 (smoothed); double-click = animated reset
//   keys: Left/Right rotate, Up/Down change ship (hangar only)
import gsap from 'gsap';
import { SHIP_IDS, type ShipId } from '../../data/ships';

const DEG = Math.PI / 180;
export const TURNTABLE = {
  autoSpeed: 4 * DEG,
  resumeAfter: 2.5,
  resumeRamp: 1.6,
  dragGain: 0.0068, // rad per px
  pitchGain: 0.0032,
  pitchMax: 10 * DEG,
  inertiaDamp: 3.2, // 1/s
  keySpeed: 70 * DEG,
  zoomMin: 0.85,
  zoomMax: 1.2,
  restYaw: -0.62, // 3/4 front on load
} as const;

export const turntable = {
  yaw: TURNTABLE.restYaw,
  vel: 0,
  pitch: 0,
  pitchVel: 0,
  zoom: 1,
  zoomTarget: 1,
  dragging: false,
  /** seconds since the last user input */
  idle: 99,
  keyDir: 0,
  frozen: false, // QA: hold still
  enabled: false,
  reduceMotion: false,
};

export function updateTurntable(dt: number): void {
  const t = turntable;
  dt = Math.min(dt, 0.05);
  t.idle += dt;
  if (t.frozen) return;
  if (!t.dragging) {
    t.vel *= Math.exp(-TURNTABLE.inertiaDamp * dt);
    // critically damped spring back to level
    const k = 36, c = 12;
    t.pitchVel += (-k * t.pitch - c * t.pitchVel) * dt;
    t.pitch += t.pitchVel * dt;
  }
  if (t.keyDir) {
    t.vel = t.keyDir * TURNTABLE.keySpeed;
    t.idle = 0;
  }
  const ramp = t.reduceMotion ? 0 : smooth01((t.idle - TURNTABLE.resumeAfter) / TURNTABLE.resumeRamp);
  if (!t.dragging) t.yaw += (t.vel + TURNTABLE.autoSpeed * ramp) * dt;
  t.zoom += (t.zoomTarget - t.zoom) * (1 - Math.exp(-6 * dt));
}

const smooth01 = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export function resetTurntable(animate = true): void {
  const t = turntable;
  const target = TURNTABLE.restYaw + Math.round((t.yaw - TURNTABLE.restYaw) / (Math.PI * 2)) * Math.PI * 2;
  t.vel = 0;
  t.idle = 0;
  gsap.killTweensOf(t);
  if (!animate || t.reduceMotion) {
    Object.assign(t, { yaw: target, pitch: 0, zoomTarget: 1 });
    return;
  }
  gsap.to(t, { yaw: target, pitch: 0, zoomTarget: 1, duration: 1.1, ease: 'power3.inOut' });
}

export type TurntableHooks = {
  /** Up/Down: move the pad selection by +-1 */
  cycleShip(dir: 1 | -1): void;
  /** true while a modal/text field owns the keyboard */
  keysBlocked(): boolean;
};

/** Binds pointer/wheel/key input to `el`; returns the unbind function. */
export function bindTurntable(el: HTMLElement, hooks: TurntableHooks): () => void {
  const t = turntable;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch0 = 0, zoom0 = 1;
  let lastX = 0, lastT = 0, sampleVel = 0;
  const setCursor = () => {
    el.style.cursor = !t.enabled ? '' : t.dragging ? 'grabbing' : 'grab';
  };

  const down = (e: PointerEvent) => {
    if (!t.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.setPointerCapture(e.pointerId);
    gsap.killTweensOf(t);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      zoom0 = t.zoomTarget;
      t.dragging = false;
    } else {
      t.dragging = true;
      t.vel = 0;
      lastX = e.clientX;
      lastT = performance.now();
      sampleVel = 0;
    }
    t.idle = 0;
    setCursor();
  };
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    t.idle = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) t.zoomTarget = clamp(zoom0 * (d / pinch0), TURNTABLE.zoomMin, TURNTABLE.zoomMax);
      return;
    }
    if (!t.dragging) return;
    t.yaw += dx * TURNTABLE.dragGain;
    t.pitch = clamp(t.pitch - dy * TURNTABLE.pitchGain, -TURNTABLE.pitchMax, TURNTABLE.pitchMax);
    t.pitchVel = 0;
    const now = performance.now();
    const dtm = Math.max(1, now - lastT);
    const v = ((e.clientX - lastX) * TURNTABLE.dragGain) / (dtm / 1000);
    sampleVel = sampleVel * 0.6 + v * 0.4; // smoothed release velocity
    lastX = e.clientX;
    lastT = now;
  };
  const up = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (t.dragging && pointers.size === 0) {
      t.dragging = false;
      // stale samples (held still before release) carry no fling
      t.vel = performance.now() - lastT > 90 ? 0 : clamp(sampleVel, -4, 4);
    }
    if (pointers.size < 2) pinch0 = 0;
    t.idle = 0;
    setCursor();
  };
  const wheel = (e: WheelEvent) => {
    if (!t.enabled) return;
    e.preventDefault();
    t.zoomTarget = clamp(t.zoomTarget * Math.exp(-e.deltaY * 0.0011), TURNTABLE.zoomMin, TURNTABLE.zoomMax);
    t.idle = 0;
  };
  const dbl = () => {
    if (t.enabled) resetTurntable(true);
  };
  const keydown = (e: KeyboardEvent) => {
    if (!t.enabled || hooks.keysBlocked() || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      t.keyDir = e.code === 'ArrowLeft' ? -1 : 1;
      e.preventDefault();
    } else if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && !e.repeat) {
      hooks.cycleShip(e.code === 'ArrowUp' ? -1 : 1);
      e.preventDefault();
    }
  };
  const keyup = (e: KeyboardEvent) => {
    if ((e.code === 'ArrowLeft' && t.keyDir < 0) || (e.code === 'ArrowRight' && t.keyDir > 0)) t.keyDir = 0;
  };
  const blur = () => {
    t.keyDir = 0;
    t.dragging = false;
    pointers.clear();
    setCursor();
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('dblclick', dbl);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', blur);
  el.style.touchAction = 'none';
  setCursor();
  const cursorTimer = window.setInterval(setCursor, 250); // follows enabled flips
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('wheel', wheel);
    el.removeEventListener('dblclick', dbl);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', blur);
    window.clearInterval(cursorTimer);
    el.style.cursor = '';
  };
}

/** Next/previous ship in canonical order (wraps). */
export function stepShip(current: ShipId, dir: 1 | -1): ShipId {
  const i = SHIP_IDS.indexOf(current);
  return SHIP_IDS[(i + dir + SHIP_IDS.length) % SHIP_IDS.length];
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
