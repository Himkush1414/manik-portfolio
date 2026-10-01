// Settings store. Every setter applies live; persistence is handled by
// save.ts (subscribes, debounced). Components select narrow slices.
import { create } from 'zustand';
import type { SettingsData } from './schema';
import type { Bindings } from '../input/bindings';
import type { CameraMode } from '../render/cameraRig';
import type { Preset } from '../render/quality';

type Section = keyof Omit<SettingsData, 'bootSeen' | 'briefingSeen' | 'gpuHintShown'>;

type SettingsActions = {
  patch<K extends Section>(section: K, values: Partial<SettingsData[K]>): void;
  setBindings(b: Bindings): void;
  setCameraMode(mode: CameraMode): void;
  setPreset(preset: Preset, auto?: boolean): void;
  setBootSeen(): void;
  setBriefingSeen(): void;
  setGpuHintShown(): void;
  replace(data: SettingsData): void;
};

export type SettingsState = SettingsData & SettingsActions;

export const useSettings = create<SettingsState>()(set => ({
  // real values are hydrated by save.ts before first render
  ...({} as SettingsData),
  patch: (section, values) => set(s => ({ [section]: { ...s[section], ...values } }) as Partial<SettingsState>),
  setBindings: bindings => set(s => ({ controls: { ...s.controls, bindings } })),
  setCameraMode: mode => set(s => ({ camera: { ...s.camera, mode } })),
  setPreset: (preset, auto = false) => set(s => ({ graphics: { ...s.graphics, preset, autoPicked: auto || s.graphics.autoPicked } })),
  setBootSeen: () => set({ bootSeen: true }),
  setBriefingSeen: () => set({ briefingSeen: true }),
  setGpuHintShown: () => set({ gpuHintShown: true }),
  replace: data => set({ ...data }),
}));

export function settingsSnapshot(): SettingsData {
  const s = useSettings.getState();
  return {
    controls: s.controls,
    camera: s.camera,
    graphics: s.graphics,
    audio: s.audio,
    accessibility: s.accessibility,
    bootSeen: s.bootSeen,
    briefingSeen: s.briefingSeen,
    gpuHintShown: s.gpuHintShown,
  };
}
