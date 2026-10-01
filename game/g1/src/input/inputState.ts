// Input state (brief §7), DOM-free so it is unit-testable: the DOM layer
// (InputManager) feeds it raw events; the mission loop samples a SimInput per
// fixed step. Rules:
//  - actions come from the player's bindings (KeyboardEvent.code / MouseN), never hard-coded
//  - auto-repeat is ignored; Ctrl / Alt / Meta are never gameplay state
//  - clear() drops EVERYTHING held (blur, hidden tab, pointer-lock loss, modal)
//  - roll / camera / pause are edges: latched until consumed
//  - the reticle is an angular offset inside the aim cone; it eases to centre
//    after the mouse idles (keyboard-only play) and is smoothed for the sim
//    while the HUD draws the RAW latest value (late latching)
import { InputAction } from './actions';
import { actionsFor, isModifierCode, type Bindings } from './bindings';
import { INPUT, PLAYER } from '../data/mission';
import type { SimInput } from '../game/input';

export type InputOptions = { sensitivity: number; invertY: boolean; deadzone: number; smoothing: number; autoFire: boolean };

const HOLD = [InputAction.MoveUp, InputAction.MoveDown, InputAction.MoveLeft, InputAction.MoveRight, InputAction.Fire, InputAction.Boost, InputAction.Brake] as const;
const DIAG = Math.SQRT1_2;

export class InputState {
  /** how many bound inputs currently hold each action (two keys can share one) */
  private held = new Map<InputAction, number>();
  private down = new Set<string>();
  /** latched edges */
  private rollEdge: -1 | 0 | 1 = 0;
  cameraEdge = false;
  pauseEdge = false;
  /** raw reticle (rad) — the HUD reads this at render time */
  yaw = 0;
  pitch = 0;
  /** smoothed reticle the sim consumes */
  private sYaw = 0;
  private sPitch = 0;
  private lastMove = -1e9;
  /** absolute-cursor fallback (no pointer lock) */
  absolute = false;

  constructor(
    private bindings: () => Bindings,
    private opts: () => InputOptions,
  ) {
    for (const a of HOLD) this.held.set(a, 0);
  }

  /** Returns true when the code is a game key (the DOM layer then preventDefaults while playing). */
  keyDown(code: string, repeat: boolean, modifiers: boolean): boolean {
    if (isModifierCode(code) || modifiers) return false;
    const acts = actionsFor(this.bindings(), code);
    if (!acts.length) return false;
    if (repeat || this.down.has(code)) return true;
    this.down.add(code);
    for (const a of acts) this.press(a);
    return true;
  }

  keyUp(code: string): void {
    if (!this.down.delete(code)) return;
    for (const a of actionsFor(this.bindings(), code)) this.release(a);
  }

  mouseDown(button: number): boolean {
    return this.keyDown(`Mouse${button}`, false, false);
  }

  mouseUp(button: number): void {
    this.keyUp(`Mouse${button}`);
  }

  /** relative motion (pointer locked), in mouse counts */
  mouseMove(dx: number, dy: number, now: number): void {
    const o = this.opts();
    const k = INPUT.radPerCount * o.sensitivity;
    this.yaw = clamp(this.yaw + dx * k, PLAYER.aim.coneX);
    this.pitch = clamp(this.pitch + (o.invertY ? dy : -dy) * k, PLAYER.aim.coneY);
    this.lastMove = now;
  }

  /** absolute cursor (fallback), normalised -1..1 from the screen centre (y up) */
  cursor(nx: number, ny: number, now: number): void {
    const o = this.opts();
    this.yaw = clamp(nx * PLAYER.aim.coneX, PLAYER.aim.coneX);
    this.pitch = clamp((o.invertY ? -ny : ny) * PLAYER.aim.coneY, PLAYER.aim.coneY);
    this.lastMove = now;
  }

  /** Drop everything held + pending edges (blur, visibility, lock loss, modal). Reticle stays. */
  clear(): void {
    this.down.clear();
    for (const a of HOLD) this.held.set(a, 0);
    this.rollEdge = 0;
    this.cameraEdge = false;
    this.pauseEdge = false;
  }

  /** Per rendered frame: recentre after idle, smooth toward the raw reticle. */
  update(dt: number, now: number): void {
    if (!this.absolute && now - this.lastMove > INPUT.idleRecenter) {
      const f = Math.exp(-INPUT.recenterRate * dt);
      this.yaw *= f;
      this.pitch *= f;
    }
    const tau = this.opts().smoothing * INPUT.smoothingTau;
    const f = tau > 1e-4 ? 1 - Math.exp(-dt / tau) : 1;
    this.sYaw += (this.yaw - this.sYaw) * f;
    this.sPitch += (this.pitch - this.sPitch) * f;
  }

  /** The SimInput for the next fixed step (consumes the roll edge). */
  sample(out: SimInput, now: number): SimInput {
    let mx = (this.isHeld(InputAction.MoveRight) ? 1 : 0) - (this.isHeld(InputAction.MoveLeft) ? 1 : 0);
    let my = (this.isHeld(InputAction.MoveUp) ? 1 : 0) - (this.isHeld(InputAction.MoveDown) ? 1 : 0);
    if (mx && my) {
      mx *= DIAG;
      my *= DIAG;
    }
    out.moveX = mx;
    out.moveY = my;
    out.aimYaw = this.sYaw;
    out.aimPitch = this.sPitch;
    // fine positioning only while the mouse is actively used and outside the deadzone
    const o = this.opts();
    const r = Math.hypot(this.sYaw / PLAYER.aim.coneX, this.sPitch / PLAYER.aim.coneY);
    out.aimSteer = (this.absolute || now - this.lastMove < INPUT.steerActive) && r > o.deadzone;
    out.fire = o.autoFire || this.isHeld(InputAction.Fire);
    out.boost = this.isHeld(InputAction.Boost);
    out.brake = this.isHeld(InputAction.Brake);
    out.roll = this.rollEdge;
    this.rollEdge = 0;
    return out;
  }

  /** is an action held right now (HUD prompts, tutorial) */
  isHeld(a: InputAction): boolean {
    return (this.held.get(a) ?? 0) > 0;
  }

  private press(a: InputAction): void {
    if (a === InputAction.RollLeft) this.rollEdge = -1;
    else if (a === InputAction.RollRight) this.rollEdge = 1;
    else if (a === InputAction.CycleCamera) this.cameraEdge = true;
    else if (a === InputAction.Pause) this.pauseEdge = true;
    else this.held.set(a, (this.held.get(a) ?? 0) + 1);
  }

  private release(a: InputAction): void {
    if (this.held.has(a)) this.held.set(a, Math.max(0, (this.held.get(a) ?? 0) - 1));
  }
}

function clamp(v: number, lim: number): number {
  return v > lim ? lim : v < -lim ? -lim : v;
}
