// Global three.js shader-chunk fixes, applied once at startup BEFORE any
// material compiles (imported first by main.tsx), so they never cause a
// runtime recompile.
//
// SAFE HALF VECTOR. three r169's GGX terms use halfDir = normalize(lightDir +
// viewDir). For the fragment lying exactly on the camera -> light line (a far
// ridge in front of the sun disc, a hull panel between the eye and the sun)
// lightDir = -viewDir, the sum is zero and normalize() returns NaN — and
// 0 x NaN is still NaN, so even an unlit (back-lit) fragment keeps it. One
// NaN pixel is then smeared over the whole frame by bloom's mip chain: the
// "black screen" frames of late Level 1 (2026-10-03, found in W2b). Any finite
// direction is correct there (that light contributes nothing to that pixel).
import { ShaderChunk } from 'three';

const UNSAFE = 'normalize( lightDir + viewDir )';
export const SAFE_HALF = 'safeHalfDir( lightDir, viewDir )';
const FN = `
vec3 safeHalfDir( const in vec3 l, const in vec3 v ) {
  vec3 h = l + v;
  float d = dot( h, h );
  return d > 1e-12 ? h * inversesqrt( d ) : l;
}
`;

const chunks = ShaderChunk as unknown as Record<string, string>;
let applied = false;

export function applyShaderFixes(): void {
  if (applied) return;
  applied = true;
  if (!chunks.common.includes('safeHalfDir')) chunks.common += FN;
  for (const k of Object.keys(chunks)) if (chunks[k].includes(UNSAFE)) chunks[k] = chunks[k].split(UNSAFE).join(SAFE_HALF);
}

applyShaderFixes();
