// Cockpit displays (brief §15): three MFDs (centre: rotating wireframe of the
// flown ship + status; left: weapons / energy; right: nav + radar sweep) and
// the combiner HUD (flight symbology + briefing / standby text), drawn to
// canvases at 15 fps (MFD) / 30 fps (HUD) with scanlines and a boot flicker
// driven by `cockpitFx.power`.
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import type { ShipSpec } from '../../ships/types';
import { MISSION_01 } from '../../data/lore';

export const cockpitFx = {
  /** per-system power 0..1 (systems boot staggers these) */
  power: { dash: 0, mfdL: 0, mfdC: 0, mfdR: 0, hud: 0 },
  hudMode: 'off' as 'off' | 'boot' | 'briefing' | 'select' | 'standby',
  /** briefing characters revealed (typewriter) */
  typed: 0,
  shipName: 'HALCYON',
  callsign: 'HALCYON-7',
};

export const BRIEFING_TEXT: string[] = [MISSION_01.header, '', MISSION_01.salutation, ...MISSION_01.body.flatMap(p => [p, '']), ...MISSION_01.signoff];
export const BRIEFING_CHARS = BRIEFING_TEXT.reduce((a, l) => a + l.length, 0);

const HUD_COL = '#ffb07a';
const MFD_COL = '#9fe0ff';
const HOT = '#ff8a3d';

type Pt = [number, number, number];

/** Wireframe polylines of a ship from its spec: hull rings + stringers + wing outlines. */
export function shipWireframe(spec: ShipSpec): Pt[][] {
  const lines: Pt[][] = [];
  const rings = spec.hull.rings;
  const ringPts = (r: (typeof rings)[number], k = 14): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= k; i++) {
      const a = (i / k) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const e = 2 / r.n;
      out.push([r.w * Math.sign(c) * Math.abs(c) ** e, (s >= 0 ? r.top : r.bot) * Math.sign(s) * Math.abs(s) ** e, r.z]);
    }
    return out;
  };
  const step = Math.max(1, Math.floor(rings.length / 6));
  for (let i = 0; i < rings.length; i += step) lines.push(ringPts(rings[i]));
  for (let k = 0; k < 14; k += 3.5) lines.push(rings.map(r => ringPts(r)[Math.round(k)]));
  for (const w of spec.wings) {
    const sides = w.mirror ? [1, -1] : [1];
    for (const sx of sides) {
      const r0: Pt = [w.root[0] * sx, w.root[1], w.root[2]], t0: Pt = [w.tip[0] * sx, w.tip[1], w.tip[2]];
      lines.push([r0, t0, [t0[0], t0[1], t0[2] - w.tipChord], [r0[0], r0[1], r0[2] - w.rootChord], r0]);
    }
  }
  return lines;
}

function mk(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  // text on tilted glass: no mip blur, anisotropic sampling instead
  t.generateMipmaps = false;
  t.minFilter = LinearFilter;
  t.anisotropy = 8;
  return { c, g: c.getContext('2d')!, t };
}

function scanlines(g: CanvasRenderingContext2D, w: number, h: number, power: number, t: number) {
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  if (power < 1) {
    // boot flicker: random dropouts while powering up
    const f = Math.sin(t * 91) * Math.sin(t * 37);
    if (f > 0.3 + power * 0.7) {
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(0, 0, w, h);
    }
    g.globalAlpha = 1;
  }
}

export type Displays = {
  mfdL: CanvasTexture;
  mfdC: CanvasTexture;
  mfdR: CanvasTexture;
  hud: CanvasTexture;
  setShip(spec: ShipSpec): void;
  update(t: number): void;
  dispose(): void;
};

export function createDisplays(): Displays {
  const L = mk(384, 288), C = mk(384, 288), R = mk(384, 288), H = mk(1024, 720);
  let wire: Pt[][] = [];
  let lastMfd = -1, lastHud = -1;

  const frame = (g: CanvasRenderingContext2D, w: number, h: number, title: string, col: string) => {
    g.fillStyle = '#02060a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = col;
    g.globalAlpha = 0.5;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.globalAlpha = 1;
    g.fillStyle = col;
    g.font = '600 15px "JetBrains Mono", monospace';
    g.fillText(title, 16, 28);
  };

  const drawC = (t: number, p: number) => {
    const { g, c } = C;
    frame(g, c.width, c.height, `${cockpitFx.shipName} // STATUS`, MFD_COL);
    if (p <= 0.02) return;
    g.save();
    g.globalAlpha = p;
    const cx = c.width / 2, cy = c.height / 2 + 8, sc = 13;
    const yaw = t * 0.6, pitch = 0.45;
    const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    g.strokeStyle = MFD_COL;
    g.lineWidth = 1.2;
    for (const line of wire) {
      g.beginPath();
      line.forEach(([x, y, z], i) => {
        const X = x * cy2 - z * sy2, Z = x * sy2 + z * cy2;
        const Y = y * cp - Z * sp;
        const px = cx + X * sc, py = cy - Y * sc;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      });
      g.stroke();
    }
    g.fillStyle = MFD_COL;
    g.font = '500 13px "JetBrains Mono", monospace';
    ['HULL 100%', 'SHLD 100%', 'PWR NOMINAL'].forEach((s, i) => g.fillText(s, 16, c.height - 52 + i * 17));
    g.fillStyle = HOT;
    g.fillText('RAIL LOCK', c.width - 110, c.height - 18);
    g.restore();
  };

  const drawL = (t: number, p: number) => {
    const { g, c } = L;
    frame(g, c.width, c.height, 'WPN // ENERGY', MFD_COL);
    if (p <= 0.02) return;
    g.save();
    g.globalAlpha = p;
    const bars = [
      ['PULSE L', 1],
      ['PULSE R', 1],
      ['CAPACITOR', 0.62 + Math.sin(t * 1.3) * 0.06],
      ['SHIELD', 1],
      ['BOOST', 0.8],
    ] as const;
    bars.forEach(([name, v], i) => {
      const y = 62 + i * 42;
      g.fillStyle = MFD_COL;
      g.font = '500 13px "JetBrains Mono", monospace';
      g.fillText(name, 18, y);
      g.strokeStyle = 'rgba(159,224,255,0.4)';
      g.strokeRect(18, y + 8, c.width - 36, 14);
      g.fillStyle = i === 2 ? HOT : MFD_COL;
      const segs = 20, filled = Math.round(v * segs);
      for (let k = 0; k < filled; k++) g.fillRect(21 + k * ((c.width - 42) / segs), y + 11, (c.width - 42) / segs - 3, 8);
    });
    g.restore();
  };

  const drawR = (t: number, p: number) => {
    const { g, c } = R;
    frame(g, c.width, c.height, 'NAV // VEIL 01', MFD_COL);
    if (p <= 0.02) return;
    g.save();
    g.globalAlpha = p;
    const cx = c.width / 2, cy = c.height / 2 + 14, r = 100;
    g.strokeStyle = 'rgba(159,224,255,0.35)';
    for (const k of [0.33, 0.66, 1]) {
      g.beginPath();
      g.arc(cx, cy, r * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx - r, cy);
    g.lineTo(cx + r, cy);
    g.moveTo(cx, cy - r);
    g.lineTo(cx, cy + r);
    g.stroke();
    const a = t * 1.8;
    const grd = g.createConicGradient ? g.createConicGradient(a - 0.9, cx, cy) : null;
    if (grd) {
      grd.addColorStop(0, 'rgba(159,224,255,0)');
      grd.addColorStop(0.14, 'rgba(159,224,255,0.45)');
      grd.addColorStop(0.145, 'rgba(159,224,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    // convoy beacon + route
    g.fillStyle = HOT;
    g.beginPath();
    g.arc(cx + 30, cy - 70, 4, 0, Math.PI * 2);
    g.fill();
    g.setLineDash([4, 4]);
    g.strokeStyle = HOT;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + 30, cy - 70);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = MFD_COL;
    g.font = '500 12px "JetBrains Mono", monospace';
    g.fillText('KESTREL-9  RNG 9.4', 16, c.height - 18);
    g.restore();
  };

  const wrap = (g: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
    return out;
  };

  const drawHud = (t: number) => {
    const { g, c } = H;
    const p = cockpitFx.power.hud;
    g.clearRect(0, 0, c.width, c.height);
    if (p <= 0.02) return;
    g.save();
    g.globalAlpha = p;
    g.strokeStyle = HUD_COL;
    g.fillStyle = HUD_COL;
    g.lineWidth = 2;
    const w = c.width, h = c.height;
    // boresight + pitch ladder + heading tape (always)
    g.beginPath();
    g.moveTo(w / 2 - 22, h / 2);
    g.lineTo(w / 2 - 8, h / 2);
    g.moveTo(w / 2 + 8, h / 2);
    g.lineTo(w / 2 + 22, h / 2);
    g.moveTo(w / 2, h / 2 - 8);
    g.lineTo(w / 2, h / 2 + 8);
    g.stroke();
    g.font = '500 18px "JetBrains Mono", monospace';
    for (let k = -2; k <= 2; k++) {
      if (!k) continue;
      const y = h / 2 - k * 70;
      g.globalAlpha = p * 0.5;
      g.beginPath();
      g.moveTo(w / 2 - 150, y);
      g.lineTo(w / 2 - 60, y);
      g.moveTo(w / 2 + 60, y);
      g.lineTo(w / 2 + 150, y);
      g.stroke();
      g.fillText(`${k * 5}`, w / 2 + 160, y + 6);
    }
    g.globalAlpha = p;
    g.strokeRect(w / 2 - 44, 20, 88, 30);
    g.textAlign = 'center';
    g.fillText('000', w / 2, 43);
    g.textAlign = 'left';
    // mode text
    const mode = cockpitFx.hudMode;
    if (mode === 'boot') {
      g.font = '600 26px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.fillText(`SYSTEMS ${Math.round(p * 100)}%`, w / 2, h - 60);
      g.textAlign = 'left';
    } else if (mode === 'briefing') {
      // translucent card behind the text so it stays readable on the tunnel lights
      g.fillStyle = 'rgba(8,3,2,0.78)';
      g.fillRect(40, 60, w - 80, h - 100);
      g.fillStyle = HUD_COL;
      g.font = '500 22px "JetBrains Mono", monospace';
      let left = cockpitFx.typed, y = 98;
      for (const para of BRIEFING_TEXT) {
        if (left <= 0) break;
        const shown = para.slice(0, Math.max(0, left));
        left -= para.length;
        if (!para) {
          y += 8;
          continue;
        }
        g.fillStyle = para === MISSION_01.header ? '#ff5a6e' : HUD_COL;
        for (const l of wrap(g, shown, w - 150)) {
          g.fillText(l, 75, y);
          y += 28;
        }
      }
      if (cockpitFx.typed < BRIEFING_CHARS && Math.sin(t * 12) > 0) g.fillRect(75, y - 22, 12, 22);
    } else if (mode === 'standby') { // ('select': the DOM selector carries the title; the combiner stays clear)
      g.font = '700 34px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.globalAlpha = p * (0.75 + 0.25 * Math.sin(t * 3));
      g.fillText('LAUNCH WINDOW: STANDBY', w / 2, h / 2 + 120);
      g.globalAlpha = p;
      g.font = '500 20px "JetBrains Mono", monospace';
      g.fillText('ESC — RETURN TO HANGAR', w / 2, h / 2 + 160);
      g.textAlign = 'left';
    }
    g.restore();
  };

  return {
    mfdL: L.t,
    mfdC: C.t,
    mfdR: R.t,
    hud: H.t,
    setShip(spec) {
      wire = shipWireframe(spec);
    },
    update(t) {
      const P = cockpitFx.power;
      if (t - lastMfd >= 1 / 15) {
        lastMfd = t;
        drawL(t, P.mfdL);
        scanlines(L.g, L.c.width, L.c.height, P.mfdL, t);
        drawC(t, P.mfdC);
        scanlines(C.g, C.c.width, C.c.height, P.mfdC, t + 1);
        drawR(t, P.mfdR);
        scanlines(R.g, R.c.width, R.c.height, P.mfdR, t + 2);
        L.t.needsUpdate = C.t.needsUpdate = R.t.needsUpdate = true;
      }
      if (t - lastHud >= 1 / 30) {
        lastHud = t;
        drawHud(t);
        H.t.needsUpdate = true;
      }
    },
    dispose() {
      [L.t, C.t, R.t, H.t].forEach(x => x.dispose());
    },
  };
}
