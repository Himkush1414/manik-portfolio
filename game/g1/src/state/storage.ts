// localStorage wrapper: every access guarded (quota exceeded, private mode,
// storage disabled). Falls back to an in-memory map so the game still runs
// and settings still apply for the session.
import { SAVE_KEY } from '../core/constants';

const memory = new Map<string, string>();
let persistent = true;

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__g1_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readRaw(): unknown {
  const s = safeStorage();
  if (!s) persistent = false;
  let text: string | null = null;
  try {
    text = s ? s.getItem(SAVE_KEY) : memory.get(SAVE_KEY) ?? null;
  } catch {
    persistent = false;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null; // corrupt save -> defaults (migrateSave handles null)
  }
}

export function writeRaw(value: unknown): void {
  const text = JSON.stringify(value);
  memory.set(SAVE_KEY, text);
  if (!persistent) return;
  const s = safeStorage();
  if (!s) {
    persistent = false;
    return;
  }
  try {
    s.setItem(SAVE_KEY, text);
  } catch {
    persistent = false; // quota — keep playing on the in-memory copy
  }
}

export function clearRaw(): void {
  memory.delete(SAVE_KEY);
  try {
    safeStorage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export const isPersistent = () => persistent;
