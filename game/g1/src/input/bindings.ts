// Default bindings + conflict logic. A binding slot holds a KeyboardEvent.code
// or a mouse token ('Mouse0'..'Mouse4'). Two slots per action (primary, alt).
import { InputAction, ACTION_ORDER } from './actions';

export type Binding = [primary: string | null, alternate: string | null];
export type Bindings = Record<InputAction, Binding>;

export const DEFAULT_BINDINGS: Bindings = {
  [InputAction.MoveUp]: ['KeyW', 'ArrowUp'],
  [InputAction.MoveDown]: ['KeyS', 'ArrowDown'],
  [InputAction.MoveLeft]: ['KeyA', 'ArrowLeft'],
  [InputAction.MoveRight]: ['KeyD', 'ArrowRight'],
  [InputAction.RollLeft]: ['KeyQ', null],
  [InputAction.RollRight]: ['KeyE', null],
  [InputAction.Fire]: ['Space', 'Mouse0'],
  [InputAction.Boost]: ['ShiftLeft', null],
  // not Ctrl: Ctrl+W (brake + move up) closes the tab and cannot be prevented
  [InputAction.Brake]: ['KeyF', null],
  [InputAction.CycleCamera]: ['KeyC', null],
  [InputAction.Pause]: ['Escape', null],
};

/** Codes that can never be rebound (browser/OS reserved). Ctrl / Alt / Meta are
 *  never gameplay keys (brief §7: they combine into browser shortcuts). */
export const RESERVED_CODES = new Set(['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'F5', 'F11', 'F12']);

export const isModifierCode = (code: string | null): boolean => !!code && /^(Control|Alt|Meta|OS)(Left|Right)?$/.test(code);

export function cloneBindings(b: Bindings): Bindings {
  const out = {} as Bindings;
  for (const a of ACTION_ORDER) out[a] = [b[a][0], b[a][1]];
  return out;
}

export type Conflict = { action: InputAction; slot: 0 | 1 };

/** Which other (action, slot) already uses `code`, if any. */
export function findConflict(b: Bindings, code: string, self: { action: InputAction; slot: 0 | 1 }): Conflict | null {
  for (const a of ACTION_ORDER) {
    for (const slot of [0, 1] as const) {
      if (a === self.action && slot === self.slot) continue;
      if (b[a][slot] === code) return { action: a, slot };
    }
  }
  return null;
}

/**
 * Assign `code` to (action, slot). mode 'swap' moves the conflicting slot's
 * old code into the other action; 'clear' unbinds it. Pure: returns a copy.
 */
export function assignBinding(
  b: Bindings,
  target: { action: InputAction; slot: 0 | 1 },
  code: string,
  mode: 'swap' | 'clear' = 'swap',
): Bindings {
  const next = cloneBindings(b);
  const conflict = findConflict(next, code, target);
  const previous = next[target.action][target.slot];
  if (conflict) next[conflict.action][conflict.slot] = mode === 'swap' ? previous : null;
  next[target.action][target.slot] = code;
  return next;
}

export function actionsFor(b: Bindings, code: string): InputAction[] {
  return ACTION_ORDER.filter(a => b[a][0] === code || b[a][1] === code);
}
