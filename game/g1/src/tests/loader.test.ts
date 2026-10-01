// Loader fault semantics (brief §17): a failed task is not counted as done,
// dependents wait, retryFailed() re-runs only the failures, finished resolves
// once everything has succeeded.
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => vi.resetModules());

describe('loader faults + retry', () => {
  it('holds dependents on a failure and completes after a retry', async () => {
    const L = await import('../core/loader');
    let geometryRuns = 0;
    const order: string[] = [];
    L.registerTask({ id: 'fonts', weight: 1, run: async () => void order.push('fonts') });
    L.registerTask({
      id: 'geometry',
      weight: 4,
      run: async () => {
        geometryRuns++;
        if (geometryRuns === 1) throw new Error('bake worker unavailable');
        order.push('geometry');
      },
    });
    L.registerTask({
      id: 'shaders',
      weight: 3,
      run: async () => {
        await L.whenDone('geometry');
        order.push('shaders');
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let finished = false;
    void L.startLoading().then(() => (finished = true));
    await new Promise(r => setTimeout(r, 10));
    let s = L.useLoader.getState();
    expect(s.failed.map(f => f.id)).toEqual(['geometry']);
    expect(s.completed).toEqual(['fonts']); // failure NOT counted as done
    expect(s.running).toEqual(['shaders']); // dependent waits
    expect(s.finished).toBe(false);
    expect(L.progress()).toBeCloseTo(1 / 8);
    L.retryFailed();
    await new Promise(r => setTimeout(r, 10));
    s = L.useLoader.getState();
    expect(s.failed).toEqual([]);
    expect(s.finished).toBe(true);
    expect(finished).toBe(true);
    expect(order).toEqual(['fonts', 'geometry', 'shaders']);
    expect(L.progress()).toBe(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it('retryFailed is a no-op without failures', async () => {
    const L = await import('../core/loader');
    L.registerTask({ id: 'fonts', weight: 1, run: async () => {} });
    await L.startLoading();
    L.retryFailed();
    expect(L.useLoader.getState().finished).toBe(true);
  });
});
