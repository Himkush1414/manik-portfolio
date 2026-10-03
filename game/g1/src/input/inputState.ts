// Input state (brief §7), DOM-free so it is unit-testable: the DOM layer
// (InputManager) feeds it raw events; the mission loop samples a SimInput per
// fixed step. Rules:
//  - actions come from the player's bindings (KeyboardEvent.code / MouseN), never hard-coded
//  - auto-repeat is ignored; Ctrl / Alt / Meta are never gameplay state
//  - clear() drops EVERYTHING held (blur, hidden tab, pointer-lock loss, modal)
//  - roll / camera / pause are edges: latched until consumed
//  - Control / Camera / Boundary addendum: the mouse moves ONLY the reticle, a cursor over the whole
//    screen (relative motion x sensitivity, 2 % margin). KEYBOARD steering (default): the movement keys
//    fly the ship and never touch the reticle. KEYBOARD + MOUSE steering: the ship flies toward the
//    reticle (sim) and the keys nudge the reticle. The aim angles come from the camera ray through the
//    reticle (MissionDriver -> setCursorAim), so the guns converge exactly under it.
import { InputAction } from './actions';
import { actionsFor, isModifierCode, type Bindings } from './bindings';
import { INPUT, PLAYER } from '../data/mission';
import type { SimInput } from '../game/input';
import type { SteeringScheme } from '../state/schema';

export type InputOptions = { sensitivity: number; invertY: boolean; autoFire: boolean; steering: SteeringScheme; reticleAutoCentre: boolean };

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
  /** aim (rad) through the reticle, from the camera ray (setCursorAim); the sim fires along it */
  yaw = 0;
  pitch = 0;
  private lastMove = -1e9;
  /** absolute-cursor fallback (no pointer lock) */
  absolute = false;
  /** the reticle in screen NDC (-1..1, y up); never moved = centred */
  cx = 0;
  cy = 0;
  /** viewport (CSS px) the cursor's pixel motion is measured against */
  private vw = 1920;
  private vh = 1080;

  /** the canvas size (cursor px -> NDC) */
  setViewport(w: number, h: number): void {
    if (w > 0 && h > 0) {
      this.vw = w;
      this.vh = h;
    }
  }

  /** the aim (rad) the camera ray through the reticle gives this frame (MissionDriver) */
  setCursorAim(yaw: number, pitch: number): void {
    this.yaw = clamp(yaw, PLAYER.aim.coneX);
    this.pitch = clamp(pitch, PLAYER.aim.coneY);
  }

  /** KEYBOARD + MOUSE steering: the ship flies toward the reticle */
  get mouseSteers(): boolean {
    return this.opts().steering === 'keyboardMouse';
  }

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

  /** relative motion (pointer locked), in mouse counts: moves the reticle only */
  mouseMove(dx: number, dy: number, now: number): void {
    if (Math.abs(dx) > INPUT.spikeCounts || Math.abs(dy) > INPUT.spikeCounts) return;
    const o = this.opts();
    const px = INPUT.cursorPxPerCount * o.sensitivity, E = INPUT.reticleEdge;
    this.cx = clamp(this.cx + (dx * px * 2) / this.vw, E);
    this.cy = clamp(this.cy + ((o.invertY ? dy : -dy) * px * 2) / this.vh, E);
    this.lastMove = now;
  }

  /** absolute cursor (fallback), normalised -1..1 from the screen centre (y up) */
  cursor(nx: number, ny: number, now: number): void {
    const o = this.opts();
    this.cx = clamp(nx, INPUT.reticleEdge);
    this.cy = clamp(o.invertY ? -ny : ny, INPUT.reticleEdge);
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

  /** Per rendered frame: KEYBOARD + MOUSE: the keys nudge the reticle; optional auto-centre after idle. */
  update(dt: number, now: number): void {
    const o = this.opts();
    const E = INPUT.reticleEdge;
    let mx = 0, my = 0;
    if (o.steering === 'keyboardMouse') {
      mx = (this.isHeld(InputAction.MoveRight) ? 1 : 0) - (this.isHeld(InputAction.MoveLeft) ? 1 : 0);
      my = (this.isHeld(InputAction.MoveUp) ? 1 : 0) - (this.isHeld(InputAction.MoveDown) ? 1 : 0);
      if (mx && my) {
        mx *= DIAG;
        my *= DIAG;
      }
    }
    if (mx || my) {
      this.cx = clamp(this.cx + mx * INPUT.keyCursorRate * dt, E);
      this.cy = clamp(this.cy + my * INPUT.keyCursorRate * dt, E);
    } else if (o.reticleAutoCentre && !this.absolute && now - this.lastMove > INPUT.cursorIdle) {
      const f = Math.exp(-INPUT.cursorRecenter * dt);
      this.cx *= f;
      this.cy *= f;
    }
  }

  /** The SimInput for the next fixed step (consumes the roll edge). */
  sample(out: SimInput): SimInput {
    const o = this.opts();
    const steer = o.steering === 'keyboardMouse';
    let mx = (this.isHeld(InputAction.MoveRight) ? 1 : 0) - (this.isHeld(InputAction.MoveLeft) ? 1 : 0);
    let my = (this.isHeld(InputAction.MoveUp) ? 1 : 0) - (this.isHeld(InputAction.MoveDown) ? 1 : 0);
    if (mx && my) {
      mx *= DIAG;
      my *= DIAG;
    }
    // KEYBOARD + MOUSE: the keys already moved the reticle the ship follows
    out.moveX = steer ? 0 : mx;
    out.moveY = steer ? 0 : my;
    out.aimYaw = this.yaw;
    out.aimPitch = this.pitch;
    out.cursor = steer;
    out.cursorX = this.cx;
    out.cursorY = this.cy;
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
