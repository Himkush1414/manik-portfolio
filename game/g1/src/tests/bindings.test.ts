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
