// Hydrates both stores from the single save key and writes them back
// (debounced) as { version, profile, settings }. Call initSave() once, before
// the first render.
import { useProfile, profileSnapshot } from './profile.store';
import { useSettings, settingsSnapshot } from './settings.store';
import { migrateSave, type SaveData } from './schema';
import { readRaw, writeRaw, clearRaw } from './storage';
import { SAVE_VERSION } from '../core/constants';

let timer: number | undefined;
let started = false;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function flushSave(): void {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  const data: SaveData = { version: SAVE_VERSION, profile: profileSnapshot(), settings: settingsSnapshot() };
  writeRaw(data);
}

function schedule(): void {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(flushSave, 400);
}

/** Idempotent (StrictMode-safe). */
export function initSave(): void {
  if (started) return;
  started = true;
  const data = migrateSave(readRaw(), prefersReducedMotion());
  useProfile.getState().replace(data.profile);
  useSettings.getState().replace(data.settings);
  useProfile.subscribe(schedule);
  useSettings.subscribe(schedule);
  window.addEventListener('pagehide', flushSave);
}

/** "Reset progress" (after confirm): wipes progress, keeps settings. */
export function resetProgress(): void {
  useProfile.getState().reset();
  flushSave();
}

export function wipeSave(): void {
  clearRaw();
  const fresh = migrateSave(null, prefersReducedMotion());
  useProfile.getState().replace(fresh.profile);
  useSettings.getState().replace(fresh.settings);
  flushSave();
}
