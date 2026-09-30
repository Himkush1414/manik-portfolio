// Trauma-model camera shake (brief §9/§19). Impulses add trauma (0..1, decays
// ~1.6/s); shake = trauma² (+ a sustained rumble level) × settings shake ×
// reduce-motion gate. Applied as an additive offset just before rendering and
// removed right after, so camera controllers never see it. No allocations.
import type { Camera } from 'three';
import { Vector3, Quaternion, Euler } from 'three';

const _pos = new Vector3();
const _quat = new Quaternion();
const _euler = new Euler();
const _q = new Quaternion();

function wobble(t: number, k: number): number {
  return Math.sin(t * 1.0 + k) * 0.55 + Math.sin(t * 2.31 + k * 3.7) * 0.3 + Math.sin(t * 4.13 + k * 1.3) * 0.15;
}

class CameraShakerImpl {
  trauma = 0;
  rumble = 0;
  rumbleHz = 7.5;
  intensity = 1; // settings.camera.shake * (reduceMotion ? 0 : 1)
  maxOffset = 0.14; // world units
  maxAngle = 0.03; // radians
  private t = 0;
  private applied = false;

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Sustained rumble (e.g. doors moving). 0 turns it off. */
  setRumble(level: number, hz = 7.5): void {
    this.rumble = level;
    this.rumbleHz = hz;
  }

  update(dt: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  apply(camera: Camera): void {
    const amt = (this.trauma * this.trauma + this.rumble * 0.35) * this.intensity;
    if (amt <= 0.0001) return;
    _pos.copy(camera.position);
    _quat.copy(camera.quaternion);
    this.applied = true;
    const f = this.t * (this.trauma > this.rumble ? 22 : this.rumbleHz * Math.PI * 2 * 0.5);
    camera.position.x += wobble(f, 1.1) * this.maxOffset * amt;
    camera.position.y += wobble(f, 7.3) * this.maxOffset * amt;
    _euler.set(wobble(f, 3.9) * this.maxAngle * amt, wobble(f, 5.2) * this.maxAngle * amt, wobble(f, 9.4) * this.maxAngle * 0.6 * amt);
    _q.setFromEuler(_euler);
    camera.quaternion.multiply(_q);
    camera.updateMatrixWorld();
  }

  restore(camera: Camera): void {
    if (!this.applied) return;
    camera.position.copy(_pos);
    camera.quaternion.copy(_quat);
    camera.updateMatrixWorld();
    this.applied = false;
  }
}

export const CameraShaker = new CameraShakerImpl();
