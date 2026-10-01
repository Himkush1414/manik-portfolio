// Level registry (brief §14/§22): id -> LevelDef. Phase 2 ships levels 1, 10
// and 22 (added as their slices land); Phase 3's generator fills the rest.
import type { LevelDef } from './types';
import { TEST_LEVEL } from './testLevel';

export const LEVELS: Readonly<Record<string, LevelDef>> = {
  test: TEST_LEVEL,
};

export function levelById(id: string): LevelDef | null {
  return LEVELS[id] ?? null;
}
