// The tactical reticle (Planet 1 §1.3), ONE canvas overlay, redrawn per frame by MissionHudDriver:
//   TACTICAL — thin crosshair with a centre gap + dot; an inner ring at 5 deg; the scale beyond it on the
//     left / right / up arms (none below: the ship sits there), ticks every 5 deg to 15 (major, labelled)
//     — every tick placed by exact projection through the live camera FOV, so the scale truly measures
//     angle; a slim convergence marker left of the ring (the twin cannons' range, m); AZ / EL off the
//     ship's boresight right of it; a thin boresight line from the ship pipper to the reticle with a
//     degree label when the offset > 4 deg.
//   MINIMAL — dot, short crosshair, the 5 deg ring.   CLASSIC — the Phase 1 ring + dot.
// Phase 1 HUD language: thin frost lines over a dark outline pass (legible over bright sky). Size scales
// line weights / arm length / text (never the degree scale); brightness scales alpha. Text strings are
// rebuilt at <= 20 Hz (`setText`), never per frame; no allocation per frame.
import type { ReticleStyle } from '../../../state/schema';
import { angleBetween, azEl, offsetPoint, screenToDir, type P2, type V3 } from '../../../render/mission/reticleMath';
import { flightData, type FlightDataIn } from './flightData';

const FROST = 'rgba(232, 236, 255, 0.92)';
const ICE = 'rgba(127, 209, 255, 0.85)';
const SHADE = 'rgba(4, 6, 12, 0.55)';
/** degree scale: ring radius, arm ticks, the label step */
export const RETICLE_DEG = { ring: 5, tickStep: 5, major: 15, armTo: 15, gap: 0.9, boresightLabel: 4 } as const;

export type ReticleOpts = { style: ReticleStyle; size: number; brightness: number; degrees: boolean };

const _a: V3 = { x: 0, y: 0, z: -1 }, _b: V3 = { x: 0, y: 0, z: -1 };
const _p: P2 = { x: 0, y: 0, on: false };
const _ae = { az: 0, el: 0 };
const NO_DASH: number[] = [];
const fmt = (v: number) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(1);

export class ReticleCanvas {
  private g: CanvasRenderingContext2D | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  /** text, rebuilt at the HUD's 20 Hz */
  private azText = 'AZ +0.0';
  private elText = 'EL +0.0';
  private offText = '';
  private convText = '';
  private convM = -1;
  private fontK = -1;
  private font10 = '';
  private font11 = '';
  private readonly dash = [4, 5];
  /** latest measured offset (deg; QA + the 20 Hz text) */
  readonly offset = { az: 0, el: 0, total: 0 };

  attach(c: HTMLCanvasElement | null): void {
    this.g = c ? c.getContext('2d') : null;
    this.w = this.h = 0;
  }

  /** match the canvas backing store to the viewport (only when it changed) */
  private fit(w: number, h: number): void {
    const c = this.g!.canvas, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }

  /** <= 20 Hz: the readout strings (convergence in m) */
  setText(convM: number): void {
    const o = this.offset;
    this.azText = 'AZ ' + fmt(o.az);
    this.elText = 'EL ' + fmt(o.el);
    this.offText = o.total.toFixed(1) + '°';
    if (convM !== this.convM) {
      this.convM = convM;
      this.convText = Math.round(convM) + ' m';
    }
  }

  /**
   * Per frame. rx/ry: the reticle (CSS px); bx/by/bon: the ship's boresight pipper; fov: the camera's
   * vertical FOV (deg). `show` false clears and stops. `fd`: the flight data to draw under it (null in the
   * cockpit, where the combiner carries it).
   */
  draw(w: number, h: number, fov: number, rx: number, ry: number, bx: number, by: number, bon: boolean, o: ReticleOpts, show: boolean, fd: FlightDataIn | null = null): void {
    const g = this.g;
    if (!g) return;
    this.fit(w, h);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    // the measured offset is kept current even when hidden (QA reads it)
    screenToDir(rx, ry, w, h, fov, _a);
    screenToDir(bx, by, w, h, fov, _b);
    azEl(_a, _b, _ae);
    this.offset.az = _ae.az;
    this.offset.el = _ae.el;
    this.offset.total = bon ? angleBetween(_a, _b) : 0;
    if (!show) return;
    // flight data first (dim, under the reticle): the overlay views only — the cockpit combiner carries it
    if (fd) flightData.draw(g, w, h, fov, fd, o.brightness);
    // size x the viewport unit (the CSS --u: 1 at 1920 x 1080), floored so 720p stays legible
    const k = o.size * Math.max(0.85, Math.min(w / 1920, h / 1080)), alpha = o.brightness;
    if (k !== this.fontK) {
      this.fontK = k;
      this.font10 = `500 ${Math.round(12 * k)}px "JetBrains Mono", monospace`;
      this.font11 = `500 ${Math.round(13 * k)}px "JetBrains Mono", monospace`;
      this.dash[0] = 4 * k;
      this.dash[1] = 5 * k;
    }
    g.lineCap = 'butt';
    g.lineJoin = 'miter';
    if (o.style === 'classic') {
      g.beginPath();
      g.arc(rx, ry, 23 * k, 0, Math.PI * 2);
      this.stroke2(g, alpha, 2 * k, FROST);
      this.dot(g, rx, ry, 2 * k, alpha);
      return;
    }
    const D = RETICLE_DEG;
    // ring at 5 deg (exact: the directions 5 deg off the reticle's ray) + the inner crosshair (gap -> ring)
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      offsetPoint(_a, D.ring, (i / 48) * Math.PI * 2, w, h, fov, _p);
      if (i) g.lineTo(_p.x, _p.y);
      else g.moveTo(_p.x, _p.y);
    }
    for (let q = 0; q < 4; q++) {
      const phi = (q * Math.PI) / 2;
      offsetPoint(_a, D.gap, phi, w, h, fov, _p);
      g.moveTo(_p.x, _p.y);
      offsetPoint(_a, o.style === 'minimal' ? D.ring * 0.66 : D.ring, phi, w, h, fov, _p);
      g.lineTo(_p.x, _p.y);
    }
    this.stroke2(g, alpha, 1.25 * k, FROST);
    this.dot(g, rx, ry, 1.6 * k, alpha);
    if (o.style === 'minimal') return;
    // TACTICAL: the outer arms carry the scale — ticks every 5 deg (major 15) out to 30 deg (degrees off:
    // short stubs past the ring)
    const outTo = o.degrees ? D.armTo : D.ring + 3;
    g.beginPath();
    for (let q = 0; q < 3; q++) { // right, up, left (bearings 0, pi/2, pi)
      const phi = (q * Math.PI) / 2, nx = -Math.sin(phi), ny = -Math.cos(phi); // screen-space normal to the arm
      offsetPoint(_a, D.ring, phi, w, h, fov, _p);
      g.moveTo(_p.x, _p.y);
      offsetPoint(_a, outTo, phi, w, h, fov, _p);
      g.lineTo(_p.x, _p.y);
      if (!o.degrees) continue;
      for (let deg = D.ring + D.tickStep; deg <= D.armTo; deg += D.tickStep) {
        offsetPoint(_a, deg, phi, w, h, fov, _p);
        if (!_p.on) break;
        const len = (deg % D.major === 0 ? 6 : 3) * k;
        g.moveTo(_p.x - nx * len, _p.y - ny * len);
        g.lineTo(_p.x + nx * len, _p.y + ny * len);
      }
    }
    this.stroke2(g, alpha * 0.75, 1 * k, FROST);
    if (o.degrees) {
      g.font = this.font10;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      offsetPoint(_a, D.major, Math.PI / 2, w, h, fov, _p); // the label up the vertical arm
      if (_p.on) this.text(g, '15', _p.x + 9 * k, _p.y, alpha * 0.8, FROST);
    }
    // convergence marker, left of the ring: two gun lines converging to a point, then the range
    offsetPoint(_a, D.ring + 1.5, Math.PI, w, h, fov, _p);
    const cx = _p.x - 4 * k, cy = _p.y + 12 * k;
    g.beginPath();
    g.moveTo(cx - 14 * k, cy - 4 * k);
    g.lineTo(cx, cy);
    g.lineTo(cx - 14 * k, cy + 4 * k);
    this.stroke2(g, alpha * 0.85, 1 * k, ICE);
    g.font = this.font10;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    this.text(g, this.convText, cx - 18 * k, cy, alpha * 0.85, ICE);
    // offset readout beside the ring (right), AZ over EL
    if (o.degrees) {
      offsetPoint(_a, D.ring + 1.5, 0, w, h, fov, _p);
      g.font = this.font11;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      this.text(g, this.azText, _p.x + 4 * k, _p.y - 9 * k, alpha, FROST);
      this.text(g, this.elText, _p.x + 4 * k, _p.y + 8 * k, alpha, FROST);
    }
    // boresight line: ship pipper -> reticle, with the offset in degrees when > 4 deg
    if (bon && this.offset.total > D.boresightLabel) {
      const dx = rx - bx, dy = ry - by, L = Math.hypot(dx, dy);
      if (L > 30) {
        const ux = dx / L, uy = dy / L;
        g.setLineDash(this.dash);
        g.beginPath();
        g.moveTo(bx + ux * 10 * k, by + uy * 10 * k);
        g.lineTo(rx - ux * 14 * k, ry - uy * 14 * k);
        this.stroke2(g, alpha * 0.55, 1 * k, ICE);
        g.setLineDash(NO_DASH);
        if (o.degrees) {
          g.font = this.font10;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          // near the pipper end (clear of the AZ / EL readout beside the ring)
          this.text(g, this.offText, bx + ux * 34 * k - uy * 12 * k, by + uy * 34 * k + ux * 12 * k, alpha * 0.8, ICE);
        }
      }
    }
  }

  /** the current path stroked twice: a dark outline pass, then the colour (the path survives stroke()) */
  private stroke2(g: CanvasRenderingContext2D, alpha: number, lw: number, col: string): void {
    g.globalAlpha = alpha * 0.9;
    g.strokeStyle = SHADE;
    g.lineWidth = lw + 2;
    g.stroke();
    g.globalAlpha = alpha;
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.stroke();
  }

  private dot(g: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
    g.globalAlpha = alpha;
    g.fillStyle = SHADE;
    g.beginPath();
    g.arc(x, y, r + 1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = FROST;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  private text(g: CanvasRenderingContext2D, s: string, x: number, y: number, alpha: number, col: string): void {
    g.globalAlpha = alpha * 0.9;
    g.lineWidth = 3;
    g.strokeStyle = SHADE;
    g.strokeText(s, x, y);
    g.globalAlpha = alpha;
    g.fillStyle = col;
    g.fillText(s, x, y);
  }
}

export const reticleCanvas = new ReticleCanvas();
