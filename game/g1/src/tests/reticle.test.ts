import { describe, expect, it } from 'vitest';
import { angleBetween, azEl, dirToScreen, offsetPoint, screenToDir, type P2, type V3 } from '../render/mission/reticleMath';
import { RETICLE_DEG } from '../ui/screens/mission/reticleCanvas';
import { defaultSettings, migrateSave } from '../state/schema';
import { SAVE_VERSION } from '../core/constants';

const v = (): V3 => ({ x: 0, y: 0, z: -1 });
const p = (): P2 => ({ x: 0, y: 0, on: false });
const W = 1920, H = 1080;

describe('tactical reticle projection (Planet 1 §1.3: the degree scale truly measures angle)', () => {
  it('screen <-> direction round-trips anywhere on screen, at any FOV', () => {
    for (const fov of [60, 75, 100]) {
      for (const [x, y] of [[960, 540], [100, 80], [1800, 1000], [1400, 300]]) {
        const d = screenToDir(x, y, W, H, fov, v()), q = dirToScreen(d, W, H, fov, p());
        expect(q.on).toBe(true);
        expect(q.x).toBeCloseTo(x, 6);
        expect(q.y).toBeCloseTo(y, 6);
      }
    }
  });

  it('the screen centre at the half-FOV is the top edge (vertical FOV)', () => {
    const c = screenToDir(W / 2, H / 2, W, H, 75, v());
    const q = offsetPoint(c, 37.5, Math.PI / 2, W, H, 75, p());
    expect(q.y).toBeCloseTo(0, 4);
    expect(q.x).toBeCloseTo(W / 2, 4);
  });

  it('every tick sits at exactly its angle off the reticle ray, at any FOV and screen position', () => {
    for (const fov of [60, 75, 100]) {
      for (const [x, y] of [[960, 540], [300, 200], [1700, 900]]) {
        const a = screenToDir(x, y, W, H, fov, v());
        for (let deg = RETICLE_DEG.tickStep; deg <= RETICLE_DEG.armTo; deg += RETICLE_DEG.tickStep) {
          for (const phi of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
            const q = offsetPoint(a, deg, phi, W, H, fov, p());
            if (!q.on) continue;
            const b = screenToDir(q.x, q.y, W, H, fov, v());
            expect(angleBetween(a, b)).toBeCloseTo(deg, 6);
          }
        }
      }
    }
  });

  it('tick spacing on screen follows the FOV: a wider FOV packs the same degrees closer', () => {
    const spacing = (fov: number) => {
      const c = screenToDir(W / 2, H / 2, W, H, fov, v());
      return offsetPoint(c, 5, 0, W, H, fov, p()).x - W / 2;
    };
    // at the centre: px = (H / 2) * tan(5 deg) / tan(fov / 2)
    for (const fov of [60, 75, 100]) expect(spacing(fov)).toBeCloseTo(((H / 2) * Math.tan((5 * Math.PI) / 180)) / Math.tan(((fov / 2) * Math.PI) / 180), 6);
    expect(spacing(60)).toBeGreaterThan(spacing(100));
  });

  it('bearings: phi 0 = screen right, pi/2 = screen up', () => {
    const c = screenToDir(W / 2, H / 2, W, H, 75, v());
    const r = offsetPoint(c, 5, 0, W, H, 75, p()), u = offsetPoint(c, 5, Math.PI / 2, W, H, 75, p());
    expect(r.x).toBeGreaterThan(W / 2);
    expect(r.y).toBeCloseTo(H / 2, 6);
    expect(u.y).toBeLessThan(H / 2);
    expect(u.x).toBeCloseTo(W / 2, 6);
  });

  it('AZ / EL: + right / up, and the total offset is the true angle', () => {
    const fov = 75, bore = screenToDir(W / 2, H / 2, W, H, fov, v());
    const q = offsetPoint(bore, 12.4, 0, W, H, fov, p());
    const a = screenToDir(q.x, q.y, W, H, fov, v());
    const o = azEl(a, bore, { az: 0, el: 0 });
    expect(o.az).toBeCloseTo(12.4, 6);
    expect(o.el).toBeCloseTo(0, 6);
    const q2 = offsetPoint(bore, 3.1, -Math.PI / 2, W, H, fov, p());
    const o2 = azEl(screenToDir(q2.x, q2.y, W, H, fov, v()), bore, { az: 0, el: 0 });
    expect(o2.el).toBeCloseTo(-3.1, 6);
    expect(angleBetween(a, bore)).toBeCloseTo(12.4, 6);
  });
});

describe('reticle settings (persisted)', () => {
  it('defaults: TACTICAL, size 1, degrees on', () => {
    const h = defaultSettings().hud;
    expect(h).toEqual({ reticle: 'tactical', reticleSize: 1, reticleBrightness: 0.9, reticleDegrees: true });
  });

  it('a save without the hud section gets the defaults; stored values survive; garbage is sanitised', () => {
    const base = { version: SAVE_VERSION, profile: {}, settings: { ...defaultSettings() } as Record<string, unknown> };
    delete base.settings.hud;
    expect(migrateSave(base).settings.hud).toEqual(defaultSettings().hud);
    const kept = migrateSave({ ...base, settings: { ...base.settings, hud: { reticle: 'minimal', reticleSize: 1.4, reticleBrightness: 0.5, reticleDegrees: false } } });
    expect(kept.settings.hud).toEqual({ reticle: 'minimal', reticleSize: 1.4, reticleBrightness: 0.5, reticleDegrees: false });
    const bad = migrateSave({ ...base, settings: { ...base.settings, hud: { reticle: 'huge', reticleSize: 9, reticleBrightness: -1, reticleDegrees: 'yes' } } });
    expect(bad.settings.hud.reticle).toBe('tactical');
    expect(bad.settings.hud.reticleSize).toBeLessThanOrEqual(1.6);
    expect(bad.settings.hud.reticleBrightness).toBeGreaterThanOrEqual(0.3);
    expect(bad.settings.hud.reticleDegrees).toBe(true);
  });
});
