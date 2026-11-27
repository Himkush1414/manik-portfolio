import { afterEach, describe, expect, it, vi } from 'vitest';

// The /games library demo (?demo=eject, src/app/demoFlag.ts): nothing after the catapult ejection is
// reachable through the flow FSM; without the flag the game is unchanged.
async function loadFlow(search: string) {
  vi.resetModules();
  vi.stubGlobal('location', { search });
  return import('../app/flow');
}

afterEach(() => vi.unstubAllGlobals());

describe('library demo cutoff', () => {
  it('?demo=eject: the launch runs, the mission never starts', async () => {
    const { useFlow } = await loadFlow('?demo=eject');
    const f = useFlow.getState();
    f.force('launch.standby');
    expect(f.send('LAUNCH')).toBe(true); // mission.preparing
    expect(f.send('PREPARED')).toBe(true); // mission.launching = the catapult run
    expect(useFlow.getState().state).toBe('mission.launching');
    expect(f.send('LAUNCHED')).toBe(false); // mission.playing is locked
    expect(useFlow.getState().state).toBe('mission.launching');
    for (const s of ['mission.playing', 'mission.paused', 'mission.results', 'mission.failed'] as const) {
      useFlow.getState().force(s);
      expect(useFlow.getState().state).toBe('mission.launching');
    }
  });

  it('without the flag the full flow is untouched', async () => {
    const { useFlow } = await loadFlow('');
    const f = useFlow.getState();
    f.force('mission.launching');
    expect(f.send('LAUNCHED')).toBe(true);
    expect(useFlow.getState().state).toBe('mission.playing');
  });
});
