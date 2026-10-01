import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, findConflict, assignBinding, actionsFor } from '../input/bindings';
import { InputAction } from '../input/actions';

describe('keybinding conflicts', () => {
  it('defaults are conflict-free', () => {
    const seen = new Map<string, string>();
    for (const [action, slots] of Object.entries(DEFAULT_BINDINGS)) {
      for (const code of slots) {
        if (!code) continue;
        expect(seen.has(code), `${code} bound to ${seen.get(code)} and ${action}`).toBe(false);
        seen.set(code, action);
      }
    }
  });
  it('detects a conflict with another action', () => {
    expect(findConflict(DEFAULT_BINDINGS, 'KeyW', { action: InputAction.Fire, slot: 0 })).toEqual({ action: InputAction.MoveUp, slot: 0 });
    expect(findConflict(DEFAULT_BINDINGS, 'KeyW', { action: InputAction.MoveUp, slot: 0 })).toBeNull();
  });
  it('swap moves the previous key to the conflicting action', () => {
    const next = assignBinding(DEFAULT_BINDINGS, { action: InputAction.Fire, slot: 0 }, 'KeyW', 'swap');
    expect(next.fire[0]).toBe('KeyW');
    expect(next.moveUp[0]).toBe('Space');
    expect(DEFAULT_BINDINGS.fire[0]).toBe('Space'); // pure
  });
  it('clear unbinds the conflicting slot', () => {
    const next = assignBinding(DEFAULT_BINDINGS, { action: InputAction.Fire, slot: 0 }, 'KeyW', 'clear');
    expect(next.moveUp[0]).toBeNull();
    expect(actionsFor(next, 'KeyW')).toEqual([InputAction.Fire]);
  });
});

import { migrateSave } from '../state/schema';
import { RESERVED_CODES } from '../input/bindings';
describe('Phase 2: modifier keys are never gameplay keys', () => {
  it('defaults bind no Ctrl / Alt / Meta', () => {
    for (const b of Object.values(DEFAULT_BINDINGS)) for (const c of b) expect(c ?? '').not.toMatch(/Control|Alt|Meta/);
    expect(RESERVED_CODES.has('ControlLeft')).toBe(true);
  });
  it('a Phase 1 save with Brake on ControlLeft is repaired to the new default', () => {
    const save = migrateSave({ version: 1, profile: {}, settings: { controls: { bindings: { [InputAction.Brake]: ['ControlLeft', null] } } } });
    expect(save.settings.controls.bindings[InputAction.Brake]).toEqual(['KeyF', null]);
  });
  it('if the default is taken, the modifier slot is cleared instead', () => {
    const save = migrateSave({ version: 1, profile: {}, settings: { controls: { bindings: { [InputAction.Brake]: ['AltLeft', null], [InputAction.Boost]: ['KeyF', null] } } } });
    expect(save.settings.controls.bindings[InputAction.Brake]).toEqual([null, null]);
  });
});
