// Landscape chapters (C1; Creative Bible §3 AC3.1 / AC3.2): a level is a journey of chapters, each a
// set of valley-shape numbers (floor half-width, wall height, steepness, minimum wall) from its
// archetype preset unless overridden; the terrain blends one into the next over `blend` metres
// centred on the chapter start, so the land morphs and never seams. Pure (sim / worker / render).
import { CHAPTERS, CHAPTER_BLEND } from '../../data/mission';
import type { ChapterDef, LevelDef } from '../../levels/types';
import type { TerrainOptions } from './terrain';

/** a chapter resolved to plain numbers (structured-clone safe: goes to the tile worker) */
export type ChapterKey = { atM: number; halfWidth: number; wallHeight: number; steep: number; rim: number; blend: number };
export type ChapterState = { halfWidth: number; wallHeight: number; steep: number; rim: number };

export function resolveChapters(chapters: readonly ChapterDef[]): ChapterKey[] {
  return [...chapters]
    .sort((a, b) => a.atM - b.atM)
    .map(c => {
      const p = CHAPTERS[c.kind];
      return { atM: c.atM, halfWidth: c.halfWidth ?? p.halfWidth, wallHeight: c.wallHeight ?? p.wallHeight, steep: c.steep ?? p.steep, rim: c.rim ?? p.rim, blend: c.blend ?? CHAPTER_BLEND };
    });
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** the blended chapter numbers at rail position s (keys sorted): chapter i blends in from chapter i - 1
 *  over [atM - blend / 2, atM + blend / 2] */
export function chapterAt(keys: readonly ChapterKey[], s: number, out: ChapterState): ChapterState {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].atM - keys[i + 1].blend / 2 <= s) i++;
  const b = keys[i], a = keys[Math.max(0, i - 1)];
  const t = i > 0 ? sstep(b.atM - b.blend / 2, b.atM + b.blend / 2, s) : 1;
  out.halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
  out.wallHeight = a.wallHeight + (b.wallHeight - a.wallHeight) * t;
  out.steep = a.steep + (b.steep - a.steep) * t;
  out.rim = a.rim + (b.rim - a.rim) * t;
  return out;
}

/** the TerrainField options of a level (every builder — main thread, tile worker, bots, tests — uses this) */
export function terrainOptions(level: LevelDef): TerrainOptions {
  return { seed: level.terrainSeed, widthKeys: level.widthKeys, chapters: level.chapters?.length ? resolveChapters(level.chapters) : undefined };
}
