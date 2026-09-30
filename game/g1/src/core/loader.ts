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

/** Runs every task (in parallel unless it awaits another). Idempotent. */
export function startLoading(): Promise<void> {
  if (started && finishedPromise) return finishedPromise;
  started = true;
  const tasks = Array.from(registry.values());
  const total = tasks.reduce((a, t) => a + t.weight, 0);
  useLoader.setState({ total, done: 0, completed: [], running: tasks.map(t => t.id), failed: [], finished: false });
  finishedPromise = Promise.all(
    tasks.map(async t => {
      try {
        performance.mark(`task:${t.id}:start`);
        await t.run();
        performance.mark(`task:${t.id}:end`);
      } catch (err) {
        // a failed task never blocks boot forever: it is reported (retry UI in
        // the loader) and counted so the sequence can still complete
        useLoader.setState(s => ({ failed: [...s.failed, { id: t.id, error: String(err) }] }));
        console.error(`[loader] task ${t.id} failed`, err);
      }
      useLoader.setState(s => ({
        done: s.done + t.weight,
        completed: [...s.completed, t.id],
        running: s.running.filter(r => r !== t.id),
      }));
    }),
  ).then(() => {
    useLoader.setState({ finished: true });
  });
  return finishedPromise;
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
