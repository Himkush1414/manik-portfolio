// C1 chapters (Creative Bible §3 AC3.1 / AC3.2) + the boundary validator (AC2.11): presets fill what a
// chapter leaves out, chapters blend smoothly (the land morphs, never seams), Level 1 is framed by real
// walls within 160 u everywhere at 40 probes per second of flight, and the validator catches a level
// that is not.
import { describe, expect, it } from 'vitest';
import { chapterAt, resolveChapters, terrainOptions } from '../game/world/chapters';
import { validateBounds } from '../game/world/bounds';
import { FlightPath } from '../game/world/path';
import { HeightGrid, TerrainField } from '../game/world/terrain';
import { worldById } from '../data/worlds/registry';
import { CHAPTERS } from '../data/mission';
import { LEVEL_01 } from '../levels/level01';
import { TEST_LEVEL } from '../levels/testLevel';
import type { LevelDef } from '../levels/types';

const state = () => ({ halfWidth: 0, wallHeight: 0, steep: 0, rim: 0 });

function bounds(level: LevelDef) {
  const path = new FlightPath(level.path);
  const g = new HeightGrid(new TerrainField(worldById(level.worldId)!.terrain, path, terrainOptions(level)));
  return validateBounds(path, (s, u) => g.height(s, u), { cruise: level.cruiseSpeed });
}

describe('landscape chapters (C1)', () => {
  it('presets fill what a chapter leaves out; overrides win', () => {
    const k = resolveChapters([{ atM: 500, kind: 'gorge', halfWidth: 30 }, { atM: 0, kind: 'plains' }]);
    expect(k[0].atM).toBe(0); // sorted
    expect(k[0]).toMatchObject({ halfWidth: CHAPTERS.plains.halfWidth, wallHeight: CHAPTERS.plains.wallHeight });
    expect(k[1]).toMatchObject({ halfWidth: 30, steep: CHAPTERS.gorge.steep });
  });

  it('chapters blend smoothly across the boundary (no seam) and hold inside', () => {
    const k = resolveChapters([{ atM: 0, kind: 'plains' }, { atM: 1000, kind: 'gorge', blend: 400 }]);
    expect(chapterAt(k, 300, state()).halfWidth).toBeCloseTo(CHAPTERS.plains.halfWidth, 9);
    expect(chapterAt(k, 1500, state()).halfWidth).toBeCloseTo(CHAPTERS.gorge.halfWidth, 9);
    expect(chapterAt(k, 1000, state()).halfWidth).toBeCloseTo((CHAPTERS.plains.halfWidth + CHAPTERS.gorge.halfWidth) / 2, 9);
    // smoothstep: the steepest change is 1.5 x (difference / blend) per metre — a morph, never a step
    const maxRate = (1.5 * (CHAPTERS.plains.halfWidth - CHAPTERS.gorge.halfWidth)) / 400 + 1e-6;
    let prev = chapterAt(k, 700, state()).halfWidth;
    for (let s = 701; s <= 1300; s++) {
      const w = chapterAt(k, s, state()).halfWidth;
      expect(Math.abs(w - prev)).toBeLessThanOrEqual(maxRate);
      expect(w).toBeLessThanOrEqual(prev + 1e-9);
      prev = w;
    }
  });

  it('Level 1: 5-10 chapters, never the same archetype twice in a row (AC3.1)', () => {
    const c = LEVEL_01.chapters!;
    expect(c.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < c.length; i++) expect(c[i].kind, `chapter ${i}`).not.toBe(c[i - 1].kind);
    for (const ch of c) expect(ch.blend ?? 350).toBeGreaterThanOrEqual(200); // AC3.1 blends 200-500 u
    for (const ch of c) expect(ch.blend ?? 350).toBeLessThanOrEqual(500);
  });

  it('Level 1 is framed by real walls within 160 u at 40 probes / s; the path never within 6 u of terrain (AC2.11)', () => {
    const r = bounds(LEVEL_01);
    expect(r.samples).toBeGreaterThan((LEVEL_01.lengthM / LEVEL_01.cruiseSpeed) * 40 * 0.95);
    expect(r.escapes, JSON.stringify(r.escapes) + ' widest ' + JSON.stringify(r.widest)).toEqual([]);
    expect(r.framed).toBe(1);
    expect(r.widest.u).toBeLessThanOrEqual(160);
    expect(r.centre.clear).toBeGreaterThanOrEqual(6);
    expect(r.ok).toBe(true);
  }, 60000);

  it('the validator catches an unframed level (the open test corridor)', () => {
    const r = bounds(TEST_LEVEL);
    expect(r.ok).toBe(false);
    expect(r.escapes.length).toBeGreaterThan(0);
  }, 60000);
});
