import { describe, expect, it } from 'vitest';
import { InputState, type InputOptions } from '../input/inputState';
import { DEFAULT_BINDINGS, cloneBindings, assignBinding } from '../input/bindings';
import { InputAction } from '../input/actions';
import { emptyInput } from '../game/input';
import { INPUT, PLAYER } from '../data/mission';

const opts: InputOptions = { sensitivity: 1, invertY: false, deadzone: 0.08, smoothing: 0, autoFire: false };
const mk = (o: Partial<InputOptions> = {}, b = cloneBindings(DEFAULT_BINDINGS)) => new InputState(() => b, () => ({ ...opts, ...o }));

describe('input state (brief §7 robustness)', () => {
  it('maps bound keys to actions and normalises diagonals', () => {
    const s = mk();
    s.keyDown('KeyD', false, false);
    s.keyDown('KeyW', false, false);
    const o = s.sample(emptyInput(), 0);
    expect(o.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(o.moveY).toBeCloseTo(Math.SQRT1_2);
  });
  it('clear() drops every held key (no stuck fire / movement after blur)', () => {
    const s = mk();
    s.keyDown('Space', false, false);
    s.mouseDown(0);
    s.keyDown('KeyA', false, false);
    s.clear();
    const o = s.sample(emptyInput(), 0);
    expect(o.fire).toBe(false);
    expect(o.moveX).toBe(0);
    // the keyup that arrives after a blur must not drive counts negative
    s.keyUp('Space');
    s.keyDown('Space', false, false);
    expect(s.sample(emptyInput(), 0).fire).toBe(true);
  });
  it('two inputs on one action: releasing one keeps it held', () => {
    const s = mk();
    s.keyDown('Space', false, false);
    s.mouseDown(0);
    s.keyUp('Space');
    expect(s.sample(emptyInput(), 0).fire).toBe(true);
    s.mouseUp(0);
    expect(s.sample(emptyInput(), 0).fire).toBe(false);
  });
  it('ignores auto-repeat for edges and never treats modifiers as game keys', () => {
    const s = mk();
    expect(s.keyDown('KeyE', false, false)).toBe(true);
    expect(s.sample(emptyInput(), 0).roll).toBe(1);
    s.keyDown('KeyE', true, false); // auto-repeat
    expect(s.sample(emptyInput(), 0).roll).toBe(0);
    expect(s.keyDown('ControlLeft', false, false)).toBe(false);
    expect(s.keyDown('KeyW', false, true)).toBe(false); // Ctrl+W is the browser's
    expect(s.sample(emptyInput(), 0).moveY).toBe(0);
  });
  it('honours remapped bindings', () => {
    const b = assignBinding(cloneBindings(DEFAULT_BINDINGS), { action: InputAction.Fire, slot: 0 }, 'KeyJ');
    const s = mk({}, b);
    s.keyDown('KeyJ', false, false);
    expect(s.sample(emptyInput(), 0).fire).toBe(true);
    s.clear();
    s.keyDown('Space', false, false); // Space now free (swap put it nowhere bound to fire)
    expect(s.isHeld(InputAction.Fire)).toBe(false);
  });
  it('edges latch until consumed: camera / pause', () => {
    const s = mk();
    s.keyDown('KeyC', false, false);
    s.keyDown('Escape', false, false);
    expect(s.cameraEdge).toBe(true);
    expect(s.pauseEdge).toBe(true);
  });
});

describe('reticle (brief §7 mouse)', () => {
  it('stays inside the aim cone; invert-Y flips pitch', () => {
    const s = mk();
    s.mouseMove(1e6, -1e6, 0);
    expect(s.yaw).toBeCloseTo(PLAYER.aim.coneX);
    expect(s.pitch).toBeCloseTo(PLAYER.aim.coneY); // mouse up (negative dy) = pitch up
    const inv = mk({ invertY: true });
    inv.mouseMove(0, -1e6, 0);
    expect(inv.pitch).toBeCloseTo(-PLAYER.aim.coneY);
  });
  it('eases back to centre after the mouse idles (keyboard-only play)', () => {
    const s = mk();
    s.mouseMove(200, 0, 0);
    const y0 = s.yaw;
    s.update(1 / 60, 0.5); // still recent
    expect(s.yaw).toBe(y0);
    for (let t = 0; t < 120; t++) s.update(1 / 60, INPUT.idleRecenter + t / 60);
    expect(Math.abs(s.yaw)).toBeLessThan(y0 * 0.05);
  });
  it('fine positioning only while the mouse is active and outside the deadzone', () => {
    const s = mk();
    s.mouseMove(300, 0, 10);
    s.update(1 / 60, 10);
    expect(s.sample(emptyInput(), 10).aimSteer).toBe(true);
    expect(s.sample(emptyInput(), 10 + INPUT.steerActive + 0.1).aimSteer).toBe(false);
    const c = mk();
    c.mouseMove(5, 0, 10); // inside the 8 % deadzone
    c.update(1 / 60, 10);
    expect(c.sample(emptyInput(), 10).aimSteer).toBe(false);
  });
  it('smoothing lags the sim aim behind the raw (HUD) reticle', () => {
    const s = mk({ smoothing: 1 });
    s.mouseMove(300, 0, 0);
    s.update(1 / 60, 0);
    const o = s.sample(emptyInput(), 0);
    expect(o.aimYaw).toBeGreaterThan(0);
    expect(o.aimYaw).toBeLessThan(s.yaw);
  });
});
