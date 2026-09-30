// Decal quad mapped to an atlas rect (optionally mirrored horizontally).
import { PlaneGeometry, Float32BufferAttribute } from 'three';
import type { AtlasRect } from '../../../render/tex/decalAtlas';

export function decalGeometry(rect: AtlasRect, w: number, h: number, flipU = false): PlaneGeometry {
  const g = new PlaneGeometry(w, h);
  const u0 = flipU ? rect.x + rect.w : rect.x;
  const u1 = flipU ? rect.x : rect.x + rect.w;
  // PlaneGeometry vertex order: TL, TR, BL, BR
  g.setAttribute(
    'uv',
    new Float32BufferAttribute([u0, rect.y + rect.h, u1, rect.y + rect.h, u0, rect.y, u1, rect.y], 2),
  );
  return g;
}
