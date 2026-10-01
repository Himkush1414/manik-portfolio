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

describe('mission flow (brief §17)', () => {
  beforeEach(() => useFlow.getState().force('launch.standby'));
  const send = (e: Parameters<ReturnType<typeof useFlow.getState>['send']>[0]) => useFlow.getState().send(e);

  it('standby -> LAUNCH -> preparing -> launching -> playing <-> paused', () => {
    for (const e of ['LAUNCH', 'PREPARED', 'LAUNCHED', 'PAUSE', 'RESUME'] as const) expect(send(e), e).toBe(true);
    expect(useFlow.getState().state).toBe('mission.playing');
  });
  it('death -> failed -> RETRY relaunches fast; results -> NEXT prepares the next sortie', () => {
    useFlow.getState().force('mission.playing');
    for (const e of ['PLAYER_DIED', 'DEATH_DONE', 'RETRY', 'LAUNCHED', 'LEVEL_COMPLETE', 'COMPLETE_DONE', 'NEXT'] as const) expect(send(e), e).toBe(true);
    expect(useFlow.getState().state).toBe('mission.preparing');
  });
  it('boss intro is pausable and can only end once', () => {
    useFlow.getState().force('mission.playing');
    expect(send('BOSS_INTRO')).toBe(true);
    expect(send('BOSS_INTRO_DONE')).toBe(true);
    expect(send('BOSS_INTRO_DONE')).toBe(false);
  });
  it('button mashing cannot start two transitions', () => {
    useFlow.getState().force('mission.failed');
    expect(send('RETRY')).toBe(true);
    expect(send('RETRY')).toBe(false);
    expect(send('HANGAR')).toBe(false);
    expect(send('PAUSE')).toBe(false); // no pause during the relaunch
  });
  it('HANGAR leaves through the reverse bulkhead state from pause / failed / results', () => {
    for (const from of ['mission.paused', 'mission.failed', 'mission.results'] as const) {
      useFlow.getState().force(from);
      expect(send('HANGAR')).toBe(true);
      expect(useFlow.getState().state).toBe('launch.returning');
      expect(send('RETURNED')).toBe(true);
    }
  });
  it('dying / completing ignore pause (short presentation beats)', () => {
    useFlow.getState().force('mission.dying');
    expect(send('PAUSE')).toBe(false);
    useFlow.getState().force('mission.completing');
    expect(send('PAUSE')).toBe(false);
  });
});
