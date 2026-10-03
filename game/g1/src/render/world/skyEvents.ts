// Authored sky moments (LevelDef.skyEvents; Creative Bible AC5.4 / AC6.2 /
// AC6.5), evaluated by rail position each frame into plain numbers the sky
// dome turns into uniforms: a world body moving (planet-rise over a ridge),
// shooting stars (their visibility follows the star field), the ICS Meridian
// crossing in orbit. Events ease in / out over EDGE metres. No allocation.
import { Vector3 } from 'three';
import type { SkyEvent } from '../../levels/types';
import { sunDirection } from './atmosphere';

const EDGE = 250;
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export type SkyEventState = {
  /** moving bodies: id + current position (deg); only events whose body exists are applied */
  bodies: { id: string; el: number; az: number }[];
  meteorsPerMin: number;
  /** 0..1 envelope of the meteor event (the dome multiplies by the stars' visibility) */
  meteorAmt: number;
  shipOn: boolean;
  shipDir: Vector3;
  shipAxis: Vector3;
};

export function createSkyEventState(events: readonly SkyEvent[]): SkyEventState {
  const ids = [...new Set(events.filter(e => e.kind === 'bodyMove').map(e => (e as Extract<SkyEvent, { kind: 'bodyMove' }>).body))];
  return { bodies: ids.map(id => ({ id, el: 0, az: 0 })), meteorsPerMin: 0, meteorAmt: 0, shipOn: false, shipDir: new Vector3(), shipAxis: new Vector3(1, 0, 0) };
}

const _a = new Vector3(), _b = new Vector3();

/** the events at rail position s; a body with no active / past event keeps its first event's start */
export function evaluateSkyEvents(events: readonly SkyEvent[], s: number, out: SkyEventState): SkyEventState {
  out.meteorsPerMin = 0;
  out.meteorAmt = 0;
  out.shipOn = false;
  for (const b of out.bodies) b.el = NaN;
  for (const e of events) {
    const t = e.untilM > e.atM ? clamp01((s - e.atM) / (e.untilM - e.atM)) : s >= e.atM ? 1 : 0;
    if (e.kind === 'bodyMove') {
      const b = out.bodies.find(x => x.id === e.body);
      if (!b) continue;
      // the latest event that has started wins; before any, the first event's start
      if (s >= e.atM || b.el !== b.el) {
        const k = smooth(t);
        b.el = e.fromEl + (e.toEl - e.fromEl) * k;
        b.az = e.fromAz + (e.toAz - e.fromAz) * k;
      }
    } else if (e.kind === 'meteors') {
      const env = clamp01((s - e.atM) / EDGE) * clamp01((e.untilM - s) / EDGE);
      if (env > out.meteorAmt) {
        out.meteorAmt = env;
        out.meteorsPerMin = e.perMinute;
      }
    } else if (s >= e.atM && s <= e.untilM) {
      // the Meridian: along the great circle between from and to (small arcs: lerp + normalise)
      sunDirection(e.fromEl, e.fromAz, _a);
      sunDirection(e.toEl, e.toAz, _b);
      out.shipDir.copy(_a).lerp(_b, t).normalize();
      out.shipAxis.copy(_b).sub(_a).normalize();
      out.shipOn = true;
    }
  }
  return out;
}
