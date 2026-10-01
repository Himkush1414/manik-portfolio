// Launch-sequence UI state (Phase 2): the DOM countdown + Sato line shown over
// third / chase views (the cockpit view shows the combiner instead).
import { create } from 'zustand';

type LaunchUi = { count: number | null; line: string | null; set(p: Partial<{ count: number | null; line: string | null }>): void };

export const useLaunchUi = create<LaunchUi>()(set => ({
  count: null,
  line: null,
  set: p => set(p),
}));
