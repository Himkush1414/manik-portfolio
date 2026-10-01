// Time-sliced job runner (brief §4 rule 4): build work (procedural geometry,
// canvas bakes, program compiles, texture uploads) is written as a generator
// that yields between small steps; the runner advances it inside idle time
// (or the gap after a frame) in slices of at most `budgetMs`, so no single
// main-thread task grows past the long-task threshold.
//
// Jobs run one at a time in FIFO order. Failures are isolated per job: the
// job's promise rejects, the error is logged, and the queue moves on (Phase 1
// bug: one failed thumbnail render silently killed the whole queue).

export type SliceJob<T> = Generator<unknown, T, void>;

/** Yield this to end the current slice early (polling something async, e.g. a parallel shader link). */
export const WAIT = Symbol('slicer.wait');

type Entry = {
  name: string;
  gen: SliceJob<unknown>;
  budget: number;
  resolve(v: unknown): void;
  reject(e: unknown): void;
};

const queue: Entry[] = [];
let running = false;
/** QA: the longest single slice so far (ms) and job stats */
export const slicerStats = { maxSliceMs: 0, slices: 0, jobs: 0, failed: 0 };

const hasIdle = typeof window !== 'undefined' && 'requestIdleCallback' in window;

function nextSlot(fn: () => void): void {
  if (hasIdle) requestIdleCallback(() => fn(), { timeout: 120 });
  else setTimeout(fn, 16);
}

function pump(): void {
  const e = queue[0];
  if (!e) {
    running = false;
    return;
  }
  const t0 = performance.now();
  try {
    // advance the generator until the budget is spent (at least one step)
    for (;;) {
      const r = e.gen.next();
      if (r.done) {
        queue.shift();
        slicerStats.jobs++;
        e.resolve(r.value);
        break;
      }
      if (r.value === WAIT || performance.now() - t0 >= e.budget) break;
    }
  } catch (err) {
    queue.shift();
    slicerStats.failed++;
    console.error(`[slicer] job "${e.name}" failed`, err);
    e.reject(err);
  }
  const ms = performance.now() - t0;
  slicerStats.slices++;
  if (ms > slicerStats.maxSliceMs) slicerStats.maxSliceMs = ms;
  nextSlot(pump);
}

/** Queue a generator job; resolves with its return value. */
export function runSliced<T>(name: string, gen: SliceJob<T>, budgetMs = 4): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ name, gen, budget: budgetMs, resolve: resolve as (v: unknown) => void, reject });
    if (!running) {
      running = true;
      nextSlot(pump);
    }
  });
}

/** Drain a generator synchronously (fallback paths, tests). */
export function runNow<T>(gen: SliceJob<T>): T {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

/** Resolves after the next idle slot (or ~1 frame without requestIdleCallback). */
export function idleSlot(timeout = 120): Promise<void> {
  return new Promise(resolve => {
    if (hasIdle) requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 16);
  });
}
