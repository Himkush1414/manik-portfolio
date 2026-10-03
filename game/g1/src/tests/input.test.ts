import { describe, expect, it } from 'vitest';
import { InputState, type InputOptions } from '../input/inputState';
import { DEFAULT_BINDINGS, cloneBindings, assignBinding } from '../input/bindings';
import { InputAction } from '../input/actions';
import { emptyInput } from '../game/input';
import { INPUT, PLAYER } from '../data/mission';

const opts: InputOptions = { sensitivity: 1, invertY: false, autoFire: false, steering: 'keyboard', reticleAutoCentre: false };
const mk = (o: Partial<InputOptions> = {}, b = cloneBindings(DEFAULT_BINDINGS)) => new InputState(() => b, () => ({ ...opts, ...o }));

describe('input state (brief §7 robustness)', () => {
  it('maps bound keys to actions and normalises diagonals', () => {
    const s = mk();
    s.keyDown('KeyD', false, false);
    s.keyDown('KeyW', false, false);
    const o = s.sample(emptyInput());
    expect(o.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(o.moveY).toBeCloseTo(Math.SQRT1_2);
  });
  it('clear() drops every held key (no stuck fire / movement after blur)', () => {
    const s = mk();
    s.keyDown('Space', false, false);
    s.mouseDown(0);
    s.keyDown('KeyA', false, false);
    s.clear();
    const o = s.sample(emptyInput());
    expect(o.fire).toBe(false);
    expect(o.moveX).toBe(0);
    // the keyup that arrives after a blur must not drive counts negative
    s.keyUp('Space');
    s.keyDown('Space', false, false);
    expect(s.sample(emptyInput()).fire).toBe(true);
  });
  it('two inputs on one action: releasing one keeps it held', () => {
    const s = mk();
    s.keyDown('Space', false, false);
    s.mouseDown(0);
    s.keyUp('Space');
    expect(s.sample(emptyInput()).fire).toBe(true);
    s.mouseUp(0);
    expect(s.sample(emptyInput()).fire).toBe(false);
  });
  it('ignores auto-repeat for edges and never treats modifiers as game keys', () => {
    const s = mk();
    expect(s.keyDown('KeyE', false, false)).toBe(true);
    expect(s.sample(emptyInput()).roll).toBe(1);
    s.keyDown('KeyE', true, false); // auto-repeat
    expect(s.sample(emptyInput()).roll).toBe(0);
    expect(s.keyDown('ControlLeft', false, false)).toBe(false);
    expect(s.keyDown('KeyW', false, true)).toBe(false); // Ctrl+W is the browser's
    expect(s.sample(emptyInput()).moveY).toBe(0);
  });
  it('honours remapped bindings', () => {
    const b = assignBinding(cloneBindings(DEFAULT_BINDINGS), { action: InputAction.Fire, slot: 0 }, 'KeyJ');
    const s = mk({}, b);
    s.keyDown('KeyJ', false, false);
    expect(s.sample(emptyInput()).fire).toBe(true);
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

describe('reticle + steering schemes (Control / Camera / Boundary addendum)', () => {
  const mkv = (o: Partial<InputOptions> = {}) => {
    const s = mk(o);
    s.setViewport(1920, 1080);
    return s;
  };
  it('KEYBOARD (default): the mouse moves only the reticle, over the whole screen (2 % margin)', () => {
    const s = mkv();
    for (let i = 0; i < 50; i++) s.mouseMove(400, -400, 0);
    let o = s.sample(emptyInput());
    expect(o.cursor).toBe(false);
    expect(o.moveX).toBe(0);
    expect(o.moveY).toBe(0);
    expect(o.cursorX).toBe(INPUT.reticleEdge);
    expect(o.cursorY).toBe(INPUT.reticleEdge);
    for (let i = 0; i < 50; i++) s.mouseMove(-400, 400, 0);
    o = s.sample(emptyInput());
    expect(o.cursorX).toBe(-INPUT.reticleEdge);
    expect(o.cursorY).toBe(-INPUT.reticleEdge);
    expect(INPUT.reticleEdge).toBeCloseTo(0.96, 9);
  });
  it('KEYBOARD: the movement keys fly the ship and never move the reticle', () => {
    const s = mkv();
    s.keyDown('KeyD', false, false);
    s.keyDown('KeyS', false, false);
    for (let i = 0; i < 60; i++) s.update(1 / 60, i / 60);
    const o = s.sample(emptyInput());
    expect(o.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(o.moveY).toBeCloseTo(-Math.SQRT1_2);
    expect(o.cursorX).toBe(0);
    expect(o.cursorY).toBe(0);
  });
  it('never moved = centred; invert-Y flips the vertical', () => {
    expect(mkv().sample(emptyInput()).cursorX).toBe(0);
    const inv = mkv({ invertY: true });
    inv.mouseMove(0, -200, 0);
    expect(inv.sample(emptyInput()).cursorY).toBeLessThan(0);
  });
  it('drops a pointer-lock motion spike (browser glitch), keeps a fast real flick', () => {
    const s = mkv();
    s.mouseMove(-541, -536, 0);
    expect(s.sample(emptyInput()).cursorX).toBe(0);
    s.mouseMove(INPUT.spikeCounts, 0, 0);
    expect(s.sample(emptyInput()).cursorX).toBeGreaterThan(0.5);
  });
  it('a half-screen sweep takes a sensible number of counts at sensitivity 1', () => {
    const s = mkv();
    for (let i = 0; i < 4; i++) s.mouseMove(120 / INPUT.cursorPxPerCount, 0, 0);
    expect(s.sample(emptyInput()).cursorX).toBeCloseTo(0.5, 6);
  });
  it('KEYBOARD + MOUSE: the ship follows the reticle; the keys nudge the reticle (additive)', () => {
    const s = mkv({ steering: 'keyboardMouse' });
    s.keyDown('KeyD', false, false);
    s.update(0.5, 10);
    let o = s.sample(emptyInput());
    expect(o.cursor).toBe(true);
    expect(o.moveX).toBe(0);
    expect(o.cursorX).toBeCloseTo(INPUT.keyCursorRate * 0.5, 6);
    s.keyUp('KeyD');
    s.mouseMove(-200, 0, 10);
    o = s.sample(emptyInput());
    expect(o.cursorX).toBeLessThan(INPUT.keyCursorRate * 0.5);
  });
  it('reticle auto-centre: off by default; when on, only after the mouse idles', () => {
    const off = mkv();
    off.mouseMove(500, 0, 0);
    const x0 = off.sample(emptyInput()).cursorX;
    off.update(1, 5);
    expect(off.sample(emptyInput()).cursorX).toBe(x0);
    const on = mkv({ reticleAutoCentre: true });
    on.mouseMove(500, 0, 0);
    on.update(0.1, 0.5);
    expect(on.sample(emptyInput()).cursorX).toBe(x0);
    on.update(1, 5);
    expect(on.sample(emptyInput()).cursorX).toBeLessThan(x0 * 0.5);
  });
  it('the camera-derived aim is what the sim receives (no lag), bounded by the aim cone', () => {
    const s = mkv();
    s.setCursorAim(0.6, -0.3);
    const o = s.sample(emptyInput());
    expect(o.aimYaw).toBeCloseTo(0.6, 9);
    expect(o.aimPitch).toBeCloseTo(-0.3, 9);
    s.setCursorAim(9, -9);
    expect(s.yaw).toBeCloseTo(PLAYER.aim.coneX, 9);
    expect(s.pitch).toBeCloseTo(-PLAYER.aim.coneY, 9);
  });
});
