// The safe half vector (render/shaderFixes.ts): no three chunk keeps an unguarded normalize(l + v),
// and the helper is defined where every program can see it.
import { describe, expect, it } from 'vitest';
import { ShaderChunk } from 'three';
import { SAFE_HALF } from '../render/shaderFixes';

describe('shader fixes', () => {
  it('replaces every normalize( lightDir + viewDir ) and defines safeHalfDir in common', () => {
    const chunks = ShaderChunk as unknown as Record<string, string>;
    const unsafe = Object.keys(chunks).filter(k => chunks[k].includes('normalize( lightDir + viewDir )'));
    expect(unsafe).toEqual([]);
    const uses = Object.keys(chunks).filter(k => chunks[k].includes(SAFE_HALF));
    expect(uses).toEqual(expect.arrayContaining(['bsdfs', 'lights_physical_pars_fragment']));
    expect(chunks.common).toContain('vec3 safeHalfDir(');
  });
});
