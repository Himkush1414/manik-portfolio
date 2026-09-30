import { describe, expect, it } from 'vitest';
import { migrateSave, DEFAULT_PROFILE, defaultSettings } from '../state/schema';
import { SAVE_VERSION } from '../core/constants';
import { DEFAULT_BINDINGS } from '../input/bindings';

describe('save migration', () => {
  it('returns defaults for empty / corrupt input', () => {
    for (const raw of [null, undefined, 42, 'x', {}]) {
      const s = migrateSave(raw);
      expect(s.version).toBe(SAVE_VERSION);
      expect(s.profile).toEqual(DEFAULT_PROFILE);
      expect(s.settings.camera.mode).toBe('cockpit');
      expect(s.profile.credits).toBe(1200);
    }
  });

  it('migrates the v0 flat shape', () => {
    const s = migrateSave({ credits: 5000, ship: 'vesper', unlockedShips: ['vesper'], pilot: 'ember' });
    expect(s.profile.credits).toBe(5000);
    expect(s.profile.selectedShip).toBe('vesper');
    expect(s.profile.unlockedShips).toContain('halcyon'); // starter always owned
    expect(s.profile.unlockedShips).toContain('vesper');
    expect(s.profile.pilot).toBe('ember');
  });

  it('sanitises out-of-range and wrong-typed values', () => {
    const s = migrateSave({
      version: 1,
      profile: { credits: -50, upgrades: { hull: 99, cannons: 'x' }, selectedShip: 'nope', liveryByShip: { halcyon: 42 } },
      settings: { camera: { fov: 400, mode: 'weird' }, audio: { master: 7 }, graphics: { preset: 'mega', fpsCap: 45 } },
    });
    expect(s.profile.credits).toBe(0);
    expect(s.profile.upgrades.hull).toBe(5);
    expect(s.profile.upgrades.cannons).toBe(0);
    expect(s.profile.selectedShip).toBe('halcyon');
    expect(s.profile.liveryByShip.halcyon).toBe(0);
    expect(s.settings.camera.fov).toBe(100);
    expect(s.settings.camera.mode).toBe('cockpit');
    expect(s.settings.audio.master).toBe(1);
    expect(s.settings.graphics.preset).toBe(defaultSettings().graphics.preset);
    expect(s.settings.graphics.fpsCap).toBe(0);
  });

  it('keeps valid custom bindings and fills missing actions with defaults', () => {
    const s = migrateSave({ version: 1, profile: {}, settings: { controls: { bindings: { fire: ['KeyF', null] } } } });
    expect(s.settings.controls.bindings.fire).toEqual(['KeyF', null]);
    expect(s.settings.controls.bindings.moveUp).toEqual(DEFAULT_BINDINGS.moveUp);
  });

  it('round-trips a current save unchanged', () => {
    const first = migrateSave({ version: 1, profile: { ...DEFAULT_PROFILE, credits: 7777 }, settings: defaultSettings() });
    expect(migrateSave(JSON.parse(JSON.stringify(first)))).toEqual(first);
  });
});
