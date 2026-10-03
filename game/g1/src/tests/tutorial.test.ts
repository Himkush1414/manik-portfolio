// Tutorial prompts come from the REAL bindings + steering scheme (addendum: "MOVE: <keys>", "AIM: MOUSE");
// a hint shows from its atM until performed (or untilM); an action performed earlier retires its hint.
import { describe, expect, it } from 'vitest';
import { tutorialPrompt } from '../input/prompts';
import { DEFAULT_BINDINGS, assignBinding, cloneBindings } from '../input/bindings';
import { InputAction } from '../input/actions';
import { TutorialTracker, TUTORIAL_SPAN, type TutorialPerformed } from '../app/mission/tutorial';
import { LEVEL_01 } from '../levels/level01';

const none = (): TutorialPerformed => ({ move: false, aim: false, fire: false, roll: false, boost: false });

describe('tutorial prompts (from the bindings)', () => {
  it('default bindings', () => {
    const b = cloneBindings(DEFAULT_BINDINGS);
    expect(tutorialPrompt('move', b, 'keyboard')).toEqual({ verb: 'MOVE', keys: 'W A S D / ↑ ← ↓ →' });
    expect(tutorialPrompt('aim', b, 'keyboard')).toEqual({ verb: 'AIM', keys: 'MOUSE' });
    expect(tutorialPrompt('fire', b, 'keyboard')).toEqual({ verb: 'FIRE', keys: 'SPACE / MOUSE 1' });
    expect(tutorialPrompt('roll', b, 'keyboard')).toEqual({ verb: 'ROLL', keys: 'Q E' });
    expect(tutorialPrompt('boost', b, 'keyboard')).toEqual({ verb: 'BOOST', keys: 'L-SHIFT' });
    expect(tutorialPrompt('move', b, 'keyboardMouse')).toEqual({ verb: 'STEER', keys: 'MOUSE + W A S D / ↑ ← ↓ →' });
  });
  it('follows a remap (never hard-coded keys)', () => {
    let b = assignBinding(cloneBindings(DEFAULT_BINDINGS), { action: InputAction.MoveUp, slot: 0 }, 'KeyI', 'clear');
    b = assignBinding(b, { action: InputAction.Boost, slot: 0 }, 'KeyB', 'clear');
    b[InputAction.MoveUp][1] = null;
    expect(tutorialPrompt('move', b, 'keyboard').keys).toBe('I A S D / — ← ↓ →');
    expect(tutorialPrompt('boost', b, 'keyboard').keys).toBe('B');
    b[InputAction.Fire] = [null, null];
    expect(tutorialPrompt('fire', b, 'keyboard').keys).toBe('UNBOUND');
  });
});

describe('tutorial tracker', () => {
  it('shows each hint from atM until performed or expired', () => {
    const t = new TutorialTracker();
    t.reset([{ atM: 100, action: 'move' }, { atM: 200, action: 'fire', untilM: 400 }]);
    expect(t.update(50, none())).toBeNull();
    expect(t.update(120, none())?.action).toBe('move');
    const p = none();
    p.move = true;
    expect(t.update(130, p)).toBeNull(); // done
    expect(t.update(250, none())?.action).toBe('fire');
    expect(t.update(400, none())).toBeNull(); // expired
    const u = new TutorialTracker();
    u.reset([{ atM: 0, action: 'aim' }]);
    expect(u.update(TUTORIAL_SPAN + 1, none())).toBeNull();
  });
  it('an action performed before its hint retires it (pilots who already fly see nothing)', () => {
    const t = new TutorialTracker();
    t.reset([{ atM: 500, action: 'boost' }]);
    const p = none();
    p.boost = true;
    t.update(10, p);
    expect(t.update(600, none())).toBeNull();
  });
  it('Level 1 teaches move, aim, fire, boost, roll in order within the first stretch', () => {
    const acts = LEVEL_01.tutorialHints.map(h => h.action);
    expect(acts).toEqual(['move', 'aim', 'fire', 'boost', 'roll']);
    for (let i = 1; i < LEVEL_01.tutorialHints.length; i++) expect(LEVEL_01.tutorialHints[i].atM).toBeGreaterThan(LEVEL_01.tutorialHints[i - 1].atM);
    expect(LEVEL_01.tutorialHints[LEVEL_01.tutorialHints.length - 1].atM).toBeLessThan(LEVEL_01.checkpoints[0]);
  });
});
