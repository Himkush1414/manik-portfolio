// Hangar camera (brief §11 COMPOSITION): long-lens product shot, FOV 30, ship
// ~45% of viewport height, centred ~52% x (between the UI panels). An orbit
// around the pad driven by the turntable (pitch, zoom) plus idle breathing
// dolly (+-0.4 u / 9 s), +-0.02 u handheld noise and critically damped mouse
// parallax (+-0.5 u). Writes the camera director while the flow is in the
// hangar and nobody else (boot/launch choreography, QA views) owns it.
import { Vector3 } from 'three';
import gsap from 'gsap';
import { director, HANGAR_ORBIT } from '../../render/cameraDirector';
import { turntable } from './turntable';

const TARGET = new Vector3(...HANGAR_ORBIT.target);
const FOCUS = new Vector3(...HANGAR_ORBIT.focus);

function orbitPos(dist: number, elev: number, out: Vector3): Vector3 {
  const o = HANGAR_ORBIT;
  return out.set(Math.sin(o.azim) * Math.cos(elev), Math.sin(elev), Math.cos(o.azim) * Math.cos(elev)).multiplyScalar(dist).add(TARGET);
}

export const hangarCam = {
  /** QA/debug views own the director while true (and hide the bay: the QA
   *  angles sit outside its walls) */
  manual: false,
  /** 1 = at rest distance; > 1 = pulled back (push-in tween) */
  push: 1,
  /** 0..1: Upgrades layout — the ship slides into the left third */
  shift: 0,
  mouse: { x: 0, y: 0 },
  par: { x: 0, y: 0, vx: 0, vy: 0 },
};

const tmp = new Vector3();
const shifted = new Vector3();

/** Called every frame while the hangar owns the camera. */
export function updateHangarCamera(time: number, dt: number, reduceMotion: boolean): void {
  const o = HANGAR_ORBIT;
  dt = Math.min(dt, 0.05);
  // critically damped spring toward the mouse target
  const p = hangarCam.par, k = 18, c = 2 * Math.sqrt(k);
  const tx = reduceMotion ? 0 : hangarCam.mouse.x, ty = reduceMotion ? 0 : hangarCam.mouse.y;
  p.vx += (k * (tx - p.x) - c * p.vx) * dt;
  p.vy += (k * (ty - p.y) - c * p.vy) * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const breathe = reduceMotion ? 0 : Math.sin((time / o.breathePeriod) * Math.PI * 2) * o.breathe;
  const dist = ((o.dist * hangarCam.push) / turntable.zoom) * (1 + hangarCam.shift * 0.2) + breathe;
  shifted.copy(TARGET);
  shifted.x += hangarCam.shift * 11;
  orbitPos(dist, o.elev + turntable.pitch, tmp);
  tmp.x += hangarCam.shift * 11;
  const n = reduceMotion ? 0 : o.noise;
  tmp.x += p.x * o.parallax + (Math.sin(time * 1.7) * 0.6 + Math.sin(time * 2.9 + 1.1) * 0.4) * n;
  tmp.y += p.y * o.parallax * 0.6 + (Math.sin(time * 2.3 + 0.4) * 0.6 + Math.sin(time * 3.7) * 0.4) * n;
  director.pos.copy(tmp);
  director.look.copy(shifted);
  director.focus.copy(FOCUS);
  director.fov = o.fov;
}

/** 1.5 s cinematic push-in (direct hangar entry; the boot dolly covers its own). */
export function pushIn(reduceMotion: boolean): void {
  gsap.killTweensOf(hangarCam);
  if (reduceMotion) {
    hangarCam.push = 1;
    return;
  }
  hangarCam.push = HANGAR_ORBIT.pushFrom;
  gsap.to(hangarCam, { push: 1, duration: 1.5, ease: 'expo.out' });
}
