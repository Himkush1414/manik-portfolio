// Honest loader (brief §8): the boot beats ARE the load mask. Systems register
// real async tasks; progress = completed weight / total weight. The loading
// beat's ring, counter, status log and SYS.CHECK row all read this store.
import { create } from 'zustand';

export type TaskId = 'fonts' | 'geometry' | 'shaders' | 'audio' | 'save' | 'warmup';
export type Check = 'FONTS' | 'GEOMETRY' | 'SHADERS' | 'AUDIO' | 'SAVE';

type Task = { id: TaskId; weight: number; check?: Check; run: () => Promise<void> };

type LoaderState = {
  total: number;
  done: number;
  completed: TaskId[];
  running: TaskId[];
  failed: { id: TaskId; error: string }[];
  finished: boolean;
};

export const useLoader = create<LoaderState>()(() => ({
  total: 0,
  done: 0,
  completed: [],
  running: [],
  failed: [],
  finished: false,
}));

const registry = new Map<TaskId, Task>();
let started = false;
let finishedPromise: Promise<void> | null = null;

/** Register before start(). Re-registering the same id replaces it (HMR/StrictMode safe). */
export function registerTask(task: Task): void {
  registry.set(task.id, task);
}

export function progress(): number {
  const s = useLoader.getState();
  return s.total === 0 ? 0 : s.done / s.total;
}

let resolveFinished: (() => void) | null = null;

/** Runs one task. A failure is NOT counted as done: dependents keep waiting
 *  (whenDone) and the fault panel offers a retry (brief §17: asset failure ->
 *  retry UI, never a white screen). */
async function runTask(t: Task): Promise<void> {
  try {
    performance.mark(`task:${t.id}:start`);
    await t.run();
    performance.mark(`task:${t.id}:end`);
    useLoader.setState(s => ({
      done: s.done + t.weight,
      completed: [...s.completed, t.id],
      running: s.running.filter(r => r !== t.id),
    }));
  } catch (err) {
    console.error(`[loader] task ${t.id} failed`, err);
    useLoader.setState(s => ({
      failed: [...s.failed, { id: t.id, error: err instanceof Error ? err.message : String(err) }],
      running: s.running.filter(r => r !== t.id),
    }));
  }
  const s = useLoader.getState();
  if (!s.finished && s.completed.length === registry.size) {
    useLoader.setState({ finished: true });
    resolveFinished?.();
  }
}

/** Runs every task (in parallel unless it awaits another). Idempotent. */
export function startLoading(): Promise<void> {
  if (started && finishedPromise) return finishedPromise;
  started = true;
  const tasks = Array.from(registry.values());
  const total = tasks.reduce((a, t) => a + t.weight, 0);
  useLoader.setState({ total, done: 0, completed: [], running: tasks.map(t => t.id), failed: [], finished: false });
  finishedPromise = new Promise<void>(r => (resolveFinished = r));
  tasks.forEach(t => void runTask(t));
  return finishedPromise;
}

/** Re-runs every failed task (the fault panel's RETRY). Tasks are retry-safe:
 *  their caches only ever store successes. */
export function retryFailed(): void {
  const failed = useLoader.getState().failed;
  if (!failed.length) return;
  useLoader.setState(s => ({ failed: [], running: [...s.running, ...failed.map(f => f.id)] }));
  failed.forEach(f => {
    const t = registry.get(f.id);
    if (t) void runTask(t);
  });
}

/** Resolves when a specific task is complete (tasks may depend on each other). */
export function whenDone(id: TaskId): Promise<void> {
  if (useLoader.getState().completed.includes(id)) return Promise.resolve();
  return new Promise(resolve => {
    const unsub = useLoader.subscribe(s => {
      if (s.completed.includes(id)) {
        unsub();
        resolve();
      }
    });
  });
}

export const CHECK_OF: Record<Check, TaskId> = {
  FONTS: 'fonts',
  GEOMETRY: 'geometry',
  SHADERS: 'shaders',
  AUDIO: 'audio',
  SAVE: 'save',
};
