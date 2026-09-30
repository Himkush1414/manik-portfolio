// Worn-gunmetal PBR set (albedo + ORM + normal), baked in the bake worker and
// wrapped here as mipmapped DataTextures (colour map sRGB, data maps linear).
import { DataTexture, RGBAFormat, UnsignedByteType, SRGBColorSpace, NoColorSpace, RepeatWrapping, LinearMipmapLinearFilter, LinearFilter, type Texture } from 'three';
import type { MetalSetData, MetalSetOptions } from './bakeData';
import { bakeClient } from '../../workers/bakeClient';

export type { MetalSetOptions } from './bakeData';
export type MetalSet = { map: Texture; orm: Texture; normal: Texture; dispose(): void };

function tex(data: Uint8ClampedArray, size: number, color: boolean): Texture {
  const t = new DataTexture(data as Uint8ClampedArray<ArrayBuffer>, size, size, RGBAFormat, UnsignedByteType);
  t.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function metalSetFromData(d: MetalSetData): MetalSet {
  const set = {
    map: tex(d.albedo, d.size, true),
    orm: tex(d.orm, d.size, false),
    normal: tex(d.normal, d.size, false),
    dispose() {
      set.map.dispose();
      set.orm.dispose();
      set.normal.dispose();
    },
  };
  return set;
}

/** Bakes off the main thread (bake worker). */
export async function bakeMetalSet(opts: MetalSetOptions): Promise<MetalSet> {
  return metalSetFromData(await bakeClient.metal(opts));
}
