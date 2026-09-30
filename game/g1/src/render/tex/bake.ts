// Canvas texture bakes → THREE textures. Colour maps are tagged sRGB; data
// maps (ORM, normal) stay linear (colour-space rules, brief §17).
import { CanvasTexture, SRGBColorSpace, NoColorSpace, RepeatWrapping, LinearMipmapLinearFilter, LinearFilter, type Texture } from 'three';

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return { canvas, ctx };
}

export function toTexture(canvas: HTMLCanvasElement, kind: 'color' | 'data', repeat = true, anisotropy = 8): Texture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = kind === 'color' ? SRGBColorSpace : NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

/** Height (0..1, Float32, w*h) → tangent-space normal map canvas (tileable Sobel). */
export function heightToNormal(height: Float32Array, w: number, h: number, strength: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const at = (x: number, y: number) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      // canvas y runs down; three's normal map expects +y up (OpenGL): flip dy
      const nx = -dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      d[i] = ((nx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      d[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
