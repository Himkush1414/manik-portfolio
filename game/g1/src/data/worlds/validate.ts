// WorldDef validator (Phase 2R §3 / §19): structural + design-rule checks
// shared by the unit tests and (later) the world loader. Returns readable
// errors; an empty list = valid.
import type { Hex, WorldDef } from './types';

const HEX = /^#[0-9A-Fa-f]{6}$/;
/** the three worlds this pass builds (the only ones allowed to flip `implemented`) */
export const BUILT_THIS_PASS = ['arden', 'kharan', 'stormward'] as const;

function hexes(v: unknown, path: string, out: string[]): void {
  if (typeof v === 'string') {
    if (v.startsWith('#') && !HEX.test(v)) out.push(`${path}: bad colour ${v}`);
  } else if (Array.isArray(v)) v.forEach((x, i) => hexes(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) hexes(x, `${path}.${k}`, out);
}

const range = (r: readonly [number, number], path: string, out: string[]) => {
  if (!(r[0] <= r[1])) out.push(`${path}: range [${r[0]}, ${r[1]}] inverted`);
};

export function validateWorld(w: WorldDef): string[] {
  const e: string[] = [];
  const at = (s: string) => `${w.id}.${s}`;
  hexes(w, w.id, e);
  if (w.number < 1 || w.number > 12) e.push(at('number out of 1..12'));
  range(w.levels, at('levels'), e);
  const t = w.terrain;
  range(t.floorHalfWidth, at('terrain.floorHalfWidth'), e);
  range(t.gorgeHalfWidth, at('terrain.gorgeHalfWidth'), e);
  range(t.wallHeight, at('terrain.wallHeight'), e);
  range(t.relief, at('terrain.relief'), e);
  if (t.gorgeHalfWidth[1] > t.floorHalfWidth[0]) e.push(at('terrain: gorge wider than the open floor'));
  if (t.surfaces.length < 3) e.push(at('terrain.surfaces: need >= 3 splat layers'));
  if (w.sky.suns.length < 1 || w.sky.suns.length > 2) e.push(at('sky.suns: 1 or 2'));
  for (const b of w.sky.bodies) {
    if (b.kind === 'gasGiant' && (b.angularDeg < 12 || b.angularDeg > 18)) e.push(at(`sky.${b.id}: gas giant ${b.angularDeg} deg outside 12-18`));
    if (b.kind === 'moon' && (b.angularDeg < 3 || b.angularDeg > 9)) e.push(at(`sky.${b.id}: moon ${b.angularDeg} deg outside 3-9`));
    if (b.rings && !(b.rings.inner > 1 && b.rings.outer > b.rings.inner)) e.push(at(`sky.${b.id}: rings inner/outer`));
  }
  if (w.flora.length < 2) e.push(at('flora: need >= 2 species'));
  for (const f of w.flora) {
    if (f.variants < 6) e.push(at(`flora.${f.id}: >= 6 variants`));
    range(f.height, at(`flora.${f.id}.height`), e);
  }
  if (w.strains.length < 2) e.push(at('strains: need >= 2'));
  for (const s of w.strains) if (!HEX.test(s.vein)) e.push(at(`strains.${s.id}: vein colour`));
  if (w.atmosphere.emergeAt < 200 || w.atmosphere.emergeAt > 340) e.push(at('atmosphere.emergeAt outside 200-340 (enemies emerge ~260-320)'));
  if (w.implemented && !(BUILT_THIS_PASS as readonly string[]).includes(w.id)) e.push(at('implemented: only arden / kharan / stormward ship in this pass'));
  return e;
}

/** a world's palette swatches for contact sheets / the uniqueness test */
export function signature(w: WorldDef): Hex[] {
  return [w.sky.zenith, w.sky.horizon, w.atmosphere.hazeFar, w.terrain.surfaces[0].color, w.water.deep, w.lighting.key];
}
