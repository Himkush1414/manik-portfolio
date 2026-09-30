// Door/bay decal atlas (1024², alpha): hazard stripes, stencilled "BAY 07",
// "PRESSURE DOOR", warning glyphs, chevrons. Needs the title/mono fonts loaded
// (the loader orders this after the fonts task). UV rects exported for meshes.
import type { Texture } from 'three';
import { makeCanvas, toTexture } from './bake';
import { bakeClient } from '../../workers/bakeClient';
import { HEX } from '../palette';

export type AtlasRect = { x: number; y: number; w: number; h: number }; // in 0..1 UV, origin bottom-left

const SIZE = 1024;
const px = (x: number, y: number, w: number, h: number): AtlasRect => ({
  x: x / SIZE,
  y: 1 - (y + h) / SIZE,
  w: w / SIZE,
  h: h / SIZE,
});

export const DECAL = {
  hazard: px(0, 0, 192, 1024),
  bay07: px(208, 16, 800, 300),
  pressure: px(208, 340, 800, 110),
  obstruct: px(208, 460, 800, 70),
  warning: px(208, 552, 232, 208),
  chevrons: px(456, 552, 552, 208),
  wing: px(208, 784, 800, 90),
  numerals: px(208, 890, 800, 118),
} as const;

export type DecalKey = keyof typeof DECAL;

function stencilText(ctx: CanvasRenderingContext2D, text: string, r: { x: number; y: number; w: number; h: number }, font: string, color: string, bridges: number) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const m = ctx.measureText(text);
  const scale = Math.min(1, (r.w * 0.94) / m.width);
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(scale, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
  // stencil bridges: thin horizontal gaps cut through the glyphs
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let b = 1; b <= bridges; b++) {
    const yy = r.y + (r.h * b) / (bridges + 1);
    ctx.fillRect(r.x, yy - r.h * 0.018, r.w, r.h * 0.036);
  }
  ctx.restore();
}

/** Draws the stencils (main thread: needs the loaded fonts), then erodes them
 *  in the bake worker (the per-pixel noise pass is the expensive part). */
export async function bakeDecalAtlas(): Promise<Texture> {
  const { canvas, ctx } = makeCanvas(SIZE, SIZE);
  const rects: { x: number; y: number; w: number; h: number; amount: number }[] = [];
  const erode = (x: number, y: number, w: number, h: number, amount: number) => rects.push({ x, y, w, h, amount });
  ctx.clearRect(0, 0, SIZE, SIZE);

  // hazard stripes (Ignition / near-black), 45°
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 192, 1024);
  ctx.clip();
  ctx.fillStyle = '#0b0c10';
  ctx.fillRect(0, 0, 192, 1024);
  ctx.fillStyle = HEX.ignition;
  for (let s = -300; s < 1300; s += 96) {
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(192, s - 192);
    ctx.lineTo(192, s - 192 + 48);
    ctx.lineTo(0, s + 48);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  erode(0, 0, 192, 1024, 0.3);

  const title = '900 280px "Big Shoulders Display"';
  const mono = '500 64px "JetBrains Mono"';
  stencilText(ctx, 'BAY 07', { x: 208, y: 16, w: 800, h: 300 }, title, '#d9dde8', 2);
  erode(208, 16, 800, 300, 0.26);
  stencilText(ctx, 'PRESSURE DOOR', { x: 208, y: 340, w: 800, h: 110 }, '900 104px "Big Shoulders Display"', HEX.hot, 1);
  erode(208, 340, 800, 110, 0.3);
  stencilText(ctx, 'DO NOT OBSTRUCT DOOR PATH', { x: 208, y: 460, w: 800, h: 70 }, mono, '#c9cfdc', 0);
  erode(208, 460, 800, 70, 0.28);

  // warning glyph: triangle + bar
  ctx.save();
  ctx.translate(208 + 116, 552 + 104);
  ctx.fillStyle = HEX.hot;
  ctx.beginPath();
  ctx.moveTo(0, -92);
  ctx.lineTo(100, 82);
  ctx.lineTo(-100, 82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0b0c10';
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(70, 64);
  ctx.lineTo(-70, 64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HEX.hot;
  ctx.fillRect(-9, -26, 18, 56);
  ctx.fillRect(-9, 40, 18, 16);
  ctx.restore();
  erode(208, 552, 232, 208, 0.3);

  // direction chevrons
  ctx.save();
  ctx.fillStyle = '#d9dde8';
  for (let c = 0; c < 4; c++) {
    const x0 = 480 + c * 128;
    ctx.beginPath();
    ctx.moveTo(x0, 572);
    ctx.lineTo(x0 + 70, 656);
    ctx.lineTo(x0, 740);
    ctx.lineTo(x0 + 38, 740);
    ctx.lineTo(x0 + 108, 656);
    ctx.lineTo(x0 + 38, 572);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  erode(456, 552, 552, 208, 0.32);

  stencilText(ctx, 'HALCYON WING  //  ICS MERIDIAN', { x: 208, y: 784, w: 800, h: 90 }, '600 58px "JetBrains Mono"', '#aeb6c8', 0);
  erode(208, 784, 800, 90, 0.3);
  stencilText(ctx, '07-A   07-B   LOAD 42T', { x: 208, y: 890, w: 800, h: 118 }, '900 96px "Big Shoulders Display"', '#d9dde8', 1);
  erode(208, 890, 800, 118, 0.3);

  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const eroded = await bakeClient.erode(img.data, SIZE, rects);
  ctx.putImageData(new ImageData(eroded as Uint8ClampedArray<ArrayBuffer>, SIZE, SIZE), 0, 0);
  return toTexture(canvas, 'color', false, 8);
}
