import { describe, expect, it, beforeEach } from 'vitest';
import { useFlow, nextState, TRANSITIONS, type FlowState } from '../app/flow';

describe('flow FSM guards', () => {
  beforeEach(() => useFlow.getState().force('boot.black'));

  it('walks the full boot -> hangar -> cockpit -> hangar loop', () => {
    const send = useFlow.getState().send;
    const steps = ['BEAT_NEXT', 'BEAT_NEXT', 'BEAT_NEXT', 'BEAT_NEXT', 'BEAT_NEXT', 'BOOT_DONE', 'START_MISSION', 'DOORS_CLOSED', 'REVEAL_DONE', 'BRIEFING_ACK', 'CAMERA_CHOSEN', 'ABORT_TO_HANGAR', 'RETURNED'] as const;
    for (const e of steps) expect(send(e), e).toBe(true);
    expect(useFlow.getState().state).toBe('hangar.idle');
  });

  it('rejects a double START_MISSION (no re-entry while the transition runs)', () => {
    useFlow.getState().force('hangar.idle');
    expect(useFlow.getState().send('START_MISSION')).toBe(true);
    expect(useFlow.getState().send('START_MISSION')).toBe(false);
    expect(useFlow.getState().state).toBe('launch.doorsClose');
  });

  it('ignores ESC-to-hangar while doors are closing', () => {
    useFlow.getState().force('launch.doorsClose');
    expect(useFlow.getState().send('ABORT_TO_HANGAR')).toBe(false);
  });

  it('skip jumps to loading only from the early beats', () => {
    expect(nextState('boot.logo', 'SKIP_TO_LOADING')).toBe('boot.loading');
    expect(nextState('boot.doors', 'SKIP_TO_LOADING')).toBeNull();
  });

  it('every target state exists in the table', () => {
    const states = Object.keys(TRANSITIONS) as FlowState[];
    for (const s of states) for (const t of Object.values(TRANSITIONS[s])) expect(states).toContain(t);
  });
});
