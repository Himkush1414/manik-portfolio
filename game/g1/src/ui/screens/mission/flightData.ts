// FLIGHT DATA on the reticle canvas (Planet 1 §1.3; the overlay views — in the cockpit the combiner
// carries it diegetically): a heading tape top-centre (0-359, N / E / S / W, under the ROUTE panel), a
// pitch ladder (+-5 / 10 / 20 / 30 deg + the horizon) placed by exact projection through the live camera
// so every rung sits at its true elevation and lies along the true horizon, and a bank arc (0 / 10 / 20 /
// 30 / 45 / 60) with the ship's bank pointer. Speed and ALT / CLR are the existing readouts (BOOST panel,
// the ALT box). Dim (the reticle stays on top visually), outlined for bright sky; no allocation per frame.
import { rungOnScreen, type Quat } from '../../../render/mission/flightAttitude';
import type { V3 } from '../../../render/mission/reticleMath';

const FROST = 'rgba(232, 236, 255, 0.92)';
const SHADE = 'rgba(4, 6, 12, 0.55)';
export const LADDER_DEG = [-30, -20, -10, -5, 0, 5, 10, 20, 30] as const;
export const BANK_TICKS = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60] as const;
const DEG = Math.PI / 180;
const LABELS: string[] = Array.from({ length: 36 }, (_, i) => (i === 0 ? 'N' : i === 9 ? 'E' : i === 18 ? 'S' : i === 27 ? 'W' : String(i * 10).padStart(3, '0')));
const RUNG_LABEL: Record<number, string> = { [-30]: '-30', [-20]: '-20', [-10]: '-10', [-5]: '-5', 0: '', 5: '5', 10: '10', 20: '20', 30: '30' };
const DASH = [6, 5];
const NO_DASH: number[] = [];

export type FlightDataIn = {
  /** ship heading (deg), bank (deg, + = rolled right) */
  heading: number;
  bank: number;
  /** camera forward in WORLD axes, its scene quaternion, missionSpace.r */
  camFwW: V3;
  camQ: Quat;
  r: ArrayLike<number>;
};

const _rung = { x: 0, y: 0, angle: 0 };

export class FlightDataDraw {
  private headText = '000';
  private headQ = -1;
  private font = '';
  private fontBig = '';
  private fontU = -1;

  /** <= 20 Hz: the heading readout */
  setText(heading: number): void {
    const q = Math.round(heading) % 360;
    if (q === this.headQ) return;
    this.headQ = q;
    this.headText = String(q).padStart(3, '0');
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, fov: number, d: FlightDataIn, alpha: number): void {
    const u = Math.max(0.85, Math.min(w / 1920, h / 1080));
    if (u !== this.fontU) {
      this.fontU = u;
      this.font = `500 ${Math.round(11 * u)}px "JetBrains Mono", monospace`;
      this.fontBig = `600 ${Math.round(14 * u)}px "JetBrains Mono", monospace`;
    }
    this.ladder(g, w, h, fov, d, u, alpha * 0.55);
    this.bankArc(g, w, h, d.bank, u, alpha * 0.6);
    this.tape(g, w, d.heading, u, alpha * 0.8);
  }

  private ladder(g: CanvasRenderingContext2D, w: number, h: number, fov: number, d: FlightDataIn, u: number, alpha: number): void {
    const gap = 46 * u, len = 64 * u, cy = h / 2, band = 0.34 * h;
    g.font = this.font;
    g.textBaseline = 'middle';
    for (let i = 0; i < LADDER_DEG.length; i++) {
      const deg = LADDER_DEG[i];
      if (!rungOnScreen(deg, d.camFwW, d.r, d.camQ, w, h, fov, _rung)) continue;
      const fade = 1 - Math.max(0, Math.min(1, (Math.abs(_rung.y - cy) - band * 0.75) / (band * 0.25)));
      if (fade <= 0) continue;
      const a = alpha * fade, cs = Math.cos(_rung.angle), sn = Math.sin(_rung.angle);
      const x = _rung.x, y = _rung.y;
      const g0 = deg === 0 ? gap * 0.6 : gap, L = deg === 0 ? len * 2.2 : len;
      // the rung's end ticks point toward the horizon (down for +, up for -): screen normal (-sn, cs)
      const tick = (deg > 0 ? 7 : deg < 0 ? -7 : 0) * u;
      g.setLineDash(deg < 0 ? DASH : NO_DASH);
      g.beginPath();
      for (let s = -1; s <= 1; s += 2) {
        const ax = x + cs * g0 * s, ay = y + sn * g0 * s, bx = x + cs * (g0 + L) * s, by = y + sn * (g0 + L) * s;
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        if (tick) {
          g.moveTo(ax, ay);
          g.lineTo(ax - sn * tick, ay + cs * tick);
        }
      }
      stroke2(g, a, deg === 0 ? 1.4 * u : 1.1 * u);
      g.setLineDash(NO_DASH);
      const lab = RUNG_LABEL[deg];
      if (lab) {
        g.textAlign = 'left';
        text(g, lab, x + cs * (g0 + L + 6 * u), y + sn * (g0 + L + 6 * u), a);
        g.textAlign = 'right';
        text(g, lab, x - cs * (g0 + L + 6 * u), y - sn * (g0 + L + 6 * u), a);
      }
    }
  }

  private bankArc(g: CanvasRenderingContext2D, w: number, h: number, bank: number, u: number, alpha: number): void {
    const cx = w / 2, cy = h / 2, R = 0.33 * h;
    g.beginPath();
    g.arc(cx, cy, R, -Math.PI / 2 - 60 * DEG, -Math.PI / 2 + 60 * DEG);
    for (let i = 0; i < BANK_TICKS.length; i++) {
      const t = BANK_TICKS[i];
      const a = -Math.PI / 2 + t * DEG, L = (t % 30 === 0 ? 10 : t === 45 || t === -45 ? 8 : 5) * u;
      g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.lineTo(cx + Math.cos(a) * (R + L), cy + Math.sin(a) * (R + L));
    }
    stroke2(g, alpha, 1 * u);
    // the pointer: a small triangle inside the arc at the ship's bank (+ = rolled right = pointer right)
    const b = Math.max(-75, Math.min(75, bank)), a = -Math.PI / 2 + b * DEG;
    const px = cx + Math.cos(a) * (R - 3 * u), py = cy + Math.sin(a) * (R - 3 * u);
    const tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px - nx * 9 * u + tx * 5 * u, py - ny * 9 * u + ty * 5 * u);
    g.lineTo(px - nx * 9 * u - tx * 5 * u, py - ny * 9 * u - ty * 5 * u);
    g.closePath();
    g.globalAlpha = alpha * 1.4;
    g.fillStyle = FROST;
    g.fill();
  }

  private tape(g: CanvasRenderingContext2D, w: number, hd: number, u: number, alpha: number): void {
    const cx = w / 2, y = 82 * u, half = 180 * u, ppd = half / 30;
    g.beginPath();
    const first = Math.ceil((hd - 30) / 5) * 5;
    for (let t = first; t <= hd + 30; t += 5) {
      const x = cx + (t - hd) * ppd, major = ((t % 10) + 10) % 10 === 0;
      g.moveTo(x, y);
      g.lineTo(x, y - (major ? 9 : 5) * u);
    }
    // the baseline + the centre caret
    g.moveTo(cx - half, y);
    g.lineTo(cx + half, y);
    g.moveTo(cx, y + 2 * u);
    g.lineTo(cx - 5 * u, y + 9 * u);
    g.moveTo(cx, y + 2 * u);
    g.lineTo(cx + 5 * u, y + 9 * u);
    stroke2(g, alpha, 1 * u);
    g.font = this.font;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    for (let t = Math.ceil((hd - 28) / 10) * 10; t <= hd + 28; t += 10) {
      const i = ((Math.round(t / 10) % 36) + 36) % 36;
      const x = cx + (t - hd) * ppd, edge = 1 - Math.max(0, (Math.abs(t - hd) - 18) / 10);
      if (Math.abs(t - hd) < 4) continue; // the readout box owns the centre
      text(g, LABELS[i], x, y - 11 * u, alpha * edge);
    }
    // the readout: boxed heading under the caret
    g.font = this.fontBig;
    g.textBaseline = 'top';
    const bw = 26 * u, by = y + 11 * u;
    g.beginPath();
    g.rect(cx - bw, by, bw * 2, 20 * u);
    g.globalAlpha = alpha * 0.6;
    g.fillStyle = SHADE;
    g.fill();
    stroke2(g, alpha, 1 * u);
    text(g, this.headText, cx, by + 3 * u, alpha);
  }
}

function stroke2(g: CanvasRenderingContext2D, alpha: number, lw: number): void {
  g.globalAlpha = Math.min(1, alpha * 0.9);
  g.strokeStyle = SHADE;
  g.lineWidth = lw + 2;
  g.stroke();
  g.globalAlpha = Math.min(1, alpha);
  g.strokeStyle = FROST;
  g.lineWidth = lw;
  g.stroke();
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, alpha: number): void {
  g.globalAlpha = Math.min(1, alpha * 0.9);
  g.lineWidth = 3;
  g.strokeStyle = SHADE;
  g.strokeText(s, x, y);
  g.globalAlpha = Math.min(1, alpha);
  g.fillStyle = FROST;
  g.fillText(s, x, y);
}

export const flightData = new FlightDataDraw();
