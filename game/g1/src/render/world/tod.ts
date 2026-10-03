// Time of day DURING a mission (Creative Bible AC5.1, Phase 2R W2b): the
// level's todTimeline keys (by rail position) blended with a smoothstep, each
// key falling back to the world's def for what it leaves out. evaluate()
// writes preallocated colours / vectors (no allocation per frame); apply()
// pushes them into the SHARED uniforms the sky dome, aerial perspective,
// clouds and terrain already read — a sunrise is uniforms only, never a
// recompile. The sun light (borrowed cockpit key) takes key colour /
// intensity from here (MissionWorld.applySun).
import { Color, Vector3 } from 'three';
import type { WorldDef } from '../../data/worlds/types';
import type { TodKey } from '../../levels/types';
import { sunDirection } from './atmosphere';

export type TodState = {
  sunDir: Vector3;
  sunEl: number;
  sunColor: Color;
  zenith: Color;
  mid: Color;
  horizon: Color;
  hazeNear: Color;
  hazeFar: Color;
  /** in-scatter colour x the world's strength */
  inscatter: Color;
  key: Color;
  keyIntensity: number;
  exposure: number;
  stars: number;
  hazeDensity: number;
  cloudCover: number;
};

export function createTodState(): TodState {
  return { sunDir: new Vector3(0, 1, 0), sunEl: 0, sunColor: new Color(), zenith: new Color(), mid: new Color(), horizon: new Color(), hazeNear: new Color(), hazeFar: new Color(), inscatter: new Color(), key: new Color(), keyIntensity: 1, exposure: 1, stars: 1, hazeDensity: 1, cloudCover: 1 };
}

type Resolved = { el: number; az: number; sunColor: Color; zenith: Color; mid: Color; horizon: Color; hazeNear: Color; hazeFar: Color; inscatter: Color; key: Color; keyIntensity: number; exposure: number; stars: number; hazeDensity: number; cloudCover: number };

const smooth = (t: number) => t * t * (3 - 2 * t);

export class TodTimeline {
  private readonly keys: readonly (Resolved & { atM: number })[];

  /** keys sorted by atM; none -> one key from the world's def (a constant sky) */
  constructor(def: WorldDef, keys: readonly TodKey[] = []) {
    const sun = def.sky.suns[0], a = def.atmosphere;
    const base = (k: Partial<TodKey> & { atM: number }) => ({
      atM: k.atM,
      el: k.sunEl ?? sun.elevation,
      az: k.sunAz ?? sun.azimuth,
      sunColor: new Color(k.sunColor ?? sun.color),
      zenith: new Color(k.zenith ?? def.sky.zenith),
      mid: new Color(k.mid ?? def.sky.mid),
      horizon: new Color(k.horizon ?? def.sky.horizon),
      hazeNear: new Color(k.hazeNear ?? a.hazeNear),
      hazeFar: new Color(k.hazeFar ?? a.hazeFar),
      inscatter: new Color(k.inscatter ?? a.inscatter.color).multiplyScalar(a.inscatter.strength),
      key: new Color(k.key ?? def.lighting.key),
      keyIntensity: k.keyIntensity ?? def.lighting.keyIntensity,
      exposure: k.exposure ?? 1,
      stars: k.stars ?? 1,
      hazeDensity: k.hazeDensity ?? 1,
      cloudCover: k.cloudCover ?? 1,
    });
    this.keys = keys.length ? [...keys].sort((x, y) => x.atM - y.atM).map(base) : [base({ atM: 0 })];
  }

  /** the blended state at rail position s */
  evaluate(s: number, out: TodState): TodState {
    const K = this.keys;
    let i = 0;
    while (i < K.length - 1 && K[i + 1].atM <= s) i++;
    const a = K[i], b = K[Math.min(i + 1, K.length - 1)];
    const t = b.atM > a.atM ? smooth(Math.min(1, Math.max(0, (s - a.atM) / (b.atM - a.atM)))) : 0;
    const lerp = (x: number, y: number) => x + (y - x) * t;
    out.sunEl = lerp(a.el, b.el);
    sunDirection(out.sunEl, lerp(a.az, b.az), out.sunDir);
    out.sunColor.copy(a.sunColor).lerp(b.sunColor, t);
    out.zenith.copy(a.zenith).lerp(b.zenith, t);
    out.mid.copy(a.mid).lerp(b.mid, t);
    out.horizon.copy(a.horizon).lerp(b.horizon, t);
    out.hazeNear.copy(a.hazeNear).lerp(b.hazeNear, t);
    out.hazeFar.copy(a.hazeFar).lerp(b.hazeFar, t);
    out.inscatter.copy(a.inscatter).lerp(b.inscatter, t);
    out.key.copy(a.key).lerp(b.key, t);
    out.keyIntensity = lerp(a.keyIntensity, b.keyIntensity);
    out.exposure = lerp(a.exposure, b.exposure);
    out.stars = lerp(a.stars, b.stars);
    out.hazeDensity = lerp(a.hazeDensity, b.hazeDensity);
    out.cloudCover = lerp(a.cloudCover, b.cloudCover);
    return out;
  }
}
