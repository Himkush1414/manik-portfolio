// Hangar deck textures (brief §11 FLOOR): painted markings on dark polished
// plate — hazard ring around the pad, lane lines, "HALCYON WING - BAY 07"
// stencil, bay numerals, arrows — plus a tileable panel normal/roughness set
// (2 m plates, seams, corner bolts). Canvas-drawn once at mount.
import { CanvasTexture, DataTexture, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType, type Texture } from 'three';
import { heightToNormalData } from '../../../render/tex/bakeData';
import { ValueNoise } from '../../../render/tex/noise';
import { createRng } from '../../../core/rng';

/** Deck plane in world units (x width, z length) and its centre z. */
export const DECK = { w: 36, l: 64, z: 7, pxPerM: 32, panel: 2 } as const;

type Deck = { map: Texture; rough: Texture; normal: Texture; dispose(): void };

export function createDeckTextures(): Deck {
  const W = DECK.w * DECK.pxPerM, H = DECK.l * DECK.pxPerM;
  const color = document.createElement('canvas');
  color.width = W;
  color.height = H;
  const rough = document.createElement('canvas');
  rough.width = W;
  rough.height = H;
  const base = color.getContext('2d')!;
  const baseR = rough.getContext('2d')!;
  // markings go on their own layers so wear can erode them before compositing
  const layer = () => {
    const k = document.createElement('canvas');
    k.width = W;
    k.height = H;
    return k;
  };
  const marks = layer(), marksR = layer();
  const c = marks.getContext('2d')!;
  const r = marksR.getContext('2d')!;
  // world (x, z) -> canvas px. Canvas top = far end (-z) (plane rotated -90 deg on x, flipY).
  const px = (x: number) => (x + DECK.w / 2) * DECK.pxPerM;
  const pz = (z: number) => (z - (DECK.z - DECK.l / 2)) * DECK.pxPerM;
  const m = DECK.pxPerM;

  // base plate: per-panel tone variation
  const rng = createRng(707);
  for (let z = 0; z < DECK.l; z += DECK.panel) {
    for (let x = 0; x < DECK.w; x += DECK.panel) {
      const t = 6 + rng.next() * 4;
      base.fillStyle = `rgb(${t},${t + 1},${t + 4})`;
      base.fillRect(x * m, z * m, DECK.panel * m, DECK.panel * m);
      const rv = 95 + rng.next() * 40; // roughness 0.37-0.53
      baseR.fillStyle = `rgb(${rv},${rv},${rv})`;
      baseR.fillRect(x * m, z * m, DECK.panel * m, DECK.panel * m);
    }
  }

  const paint = (fill: string, roughV: number, draw: (g: CanvasRenderingContext2D) => void) => {
    c.save();
    c.fillStyle = fill;
    c.strokeStyle = fill;
    draw(c);
    c.restore();
    r.save();
    r.fillStyle = `rgb(${roughV},${roughV},${roughV})`;
    r.strokeStyle = r.fillStyle;
    draw(r);
    r.restore();
  };

  // hazard ring around the pad (r 12.2 .. 13.0): Ignition-amber / black chevrons
  const cx = px(0), cz = pz(0);
  paint('rgba(150,58,22,0.95)', 150, g => {
    g.beginPath();
    g.arc(cx, cz, 13.0 * m, 0, Math.PI * 2);
    g.arc(cx, cz, 12.2 * m, 0, Math.PI * 2, true);
    g.fill('evenodd');
  });
  paint('rgba(10,11,16,1)', 120, g => {
    const n = 72;
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n / 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a0) * 12.2 * m, cz + Math.sin(a0) * 12.2 * m);
      g.lineTo(cx + Math.cos(a0 + 0.05) * 13.0 * m, cz + Math.sin(a0 + 0.05) * 13.0 * m);
      g.lineTo(cx + Math.cos(a1 + 0.05) * 13.0 * m, cz + Math.sin(a1 + 0.05) * 13.0 * m);
      g.lineTo(cx + Math.cos(a1) * 12.2 * m, cz + Math.sin(a1) * 12.2 * m);
      g.closePath();
      g.fill();
    }
  });
  // thin steel keep-out line outside the hazard ring
  paint('rgba(140,154,192,0.55)', 140, g => {
    g.lineWidth = 0.08 * m;
    g.beginPath();
    g.arc(cx, cz, 13.5 * m, 0, Math.PI * 2);
    g.stroke();
  });

  // taxi lanes from the doors to the pad (dashed, steel)
  paint('rgba(140,154,192,0.5)', 140, g => {
    for (const x of [-7.5, 7.5]) {
      for (let z = 14; z < 38; z += 2.4) g.fillRect(px(x) - 0.1 * m, pz(z), 0.2 * m, 1.4 * m);
    }
  });
  // centre-line arrows pointing into the bay
  paint('rgba(150,58,22,0.85)', 150, g => {
    for (const z of [18, 24, 30]) {
      const y = pz(z);
      g.beginPath();
      g.moveTo(cx, y);
      g.lineTo(cx + 1.3 * m, y + 1.6 * m);
      g.lineTo(cx + 0.7 * m, y + 1.6 * m);
      g.lineTo(cx, y + 0.75 * m);
      g.lineTo(cx - 0.7 * m, y + 1.6 * m);
      g.lineTo(cx - 1.3 * m, y + 1.6 * m);
      g.closePath();
      g.fill();
    }
  });
  // stencil text, reads upright from the hangar camera (letter tops toward -z)
  const stencil = (text: string, x: number, z: number, sizeM: number, fill: string, track = 0.3) => {
    paint(fill, 150, g => {
      g.font = `900 ${sizeM * m}px "Big Shoulders Display", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${track * sizeM * m}px`;
      g.fillText(text, px(x), pz(z));
    });
  };
  stencil('HALCYON WING — BAY 07', 0, 16.2, 1.25, 'rgba(140,154,192,0.62)', 0.22);
  stencil('07', -11, 25, 6.5, 'rgba(140,154,192,0.18)', 0.05);
  stencil('07', 11, -14, 6.5, 'rgba(140,154,192,0.14)', 0.05);
  stencil('KEEP CLEAR • REPULSOR FIELD', 0, 14.2, 0.55, 'rgba(150,58,22,0.8)', 0.35);
  // pad-side service boxes
  paint('rgba(150,58,22,0.7)', 150, g => {
    g.lineWidth = 0.12 * m;
    for (const [x, z] of [[-14.5, 6], [14.5, 6], [-14.5, -8], [14.5, -8]]) g.strokeRect(px(x) - 1.2 * m, pz(z) - 1.6 * m, 2.4 * m, 3.2 * m);
  });

  // wear: a low-res erosion mask (noise + dragged streaks along z) knocks the
  // paint back, then the markings composite onto the plates
  const MW = W >> 3, MH = H >> 3; // 4 px/m is plenty for smooth wear blotches
  const mask = document.createElement('canvas');
  mask.width = MW;
  mask.height = MH;
  const mctx = mask.getContext('2d')!;
  const md = mctx.createImageData(MW, MH);
  const n = new ValueNoise(77);
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const wv = n.fbm(x / MW, y / MH, 22, 3);
      const scuff = n.noise(x * 2.8, y * 0.56, 913);
      const keep = Math.min(1, Math.max(0, (wv - 0.36) * 3.2)) * (0.72 + scuff * 0.28);
      md.data[(y * MW + x) * 4 + 3] = (1 - keep) * 255;
    }
  }
  mctx.putImageData(md, 0, 0);
  for (const g of [c, r]) {
    g.globalCompositeOperation = 'destination-out';
    g.imageSmoothingEnabled = true;
    g.drawImage(mask, 0, 0, W, H);
  }
  base.drawImage(marks, 0, 0);
  baseR.drawImage(marksR, 0, 0);

  const map = new CanvasTexture(color);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  map.minFilter = LinearMipmapLinearFilter;
  const roughT = new CanvasTexture(rough);
  roughT.colorSpace = NoColorSpace;
  roughT.anisotropy = 8;
  const normal = panelNormal();
  return {
    map,
    rough: roughT,
    normal,
    dispose() {
      map.dispose();
      roughT.dispose();
      normal.dispose();
    },
  };
}

/** One 2 m plate: seams on the edges, bolts at the corners, faint grain. Tiled. */
function panelNormal(): Texture {
  const S = 256;
  const h = new Float32Array(S * S);
  const n = new ValueNoise(5);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const e = Math.min(x, y, S - 1 - x, S - 1 - y);
      let v = e < 2 ? -1 : e < 4 ? -0.4 : 0;
      for (const [bx, by] of [[12, 12], [S - 12, 12], [12, S - 12], [S - 12, S - 12]]) {
        const d = Math.hypot(x - bx, y - by);
        if (d < 4) v += 0.6 * (1 - d / 4);
      }
      h[y * S + x] = v * 0.5 + n.noise(x * 0.6, y * 0.6, 3) * 0.02;
    }
  }
  const t = new DataTexture(heightToNormalData(h, S, S, 0.7) as Uint8ClampedArray<ArrayBuffer>, S, S, RGBAFormat, UnsignedByteType);
  t.colorSpace = NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(DECK.w / DECK.panel, DECK.l / DECK.panel);
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
