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
    const first = migrateSave({ version: SAVE_VERSION, profile: { ...DEFAULT_PROFILE, credits: 7777 }, settings: defaultSettings() });
    expect(migrateSave(JSON.parse(JSON.stringify(first)))).toEqual(first);
  });

  it('v1 -> v2: the control / camera fields restart from the v2 defaults; everything else is kept', () => {
    expect(SAVE_VERSION).toBe(2);
    const v1 = {
      version: 1,
      profile: { ...DEFAULT_PROFILE, credits: 4321 },
      settings: {
        // a shipped v1 save + the pre-release F1 fields (cursor flight on by default)
        controls: { bindings: { fire: ['KeyF', null] }, sensitivity: 1.7, invertY: true, deadzone: 0.2, smoothing: 0.9, aimAssist: 'high', controlModel: 'cursor', autoCentre: true, steering: 'keyboardMouse' },
        camera: { mode: 'chase', fov: 90, shake: 0.4, helmetFrame: 'full', rollCoupling: 1.4, attachment: 'steady' },
        audio: { master: 0.3 },
      },
    };
    const s = migrateSave(v1);
    const d = defaultSettings();
    expect(s.version).toBe(2);
    expect(s.settings.controls.steering).toBe('keyboard');
    expect(s.settings.controls.reticleAutoCentre).toBe(false);
    expect(s.settings.controls.reticleLookAhead).toBe(false);
    expect(s.settings.camera.attachment).toBe('attached');
    expect(s.settings.camera.rollStrength).toBe(1);
    expect(s.settings.controls).not.toHaveProperty('controlModel');
    expect(s.settings.controls).not.toHaveProperty('deadzone');
    expect(s.settings.camera).not.toHaveProperty('rollCoupling');
    // kept
    expect(s.profile.credits).toBe(4321);
    expect(s.settings.controls.bindings.fire).toEqual(['KeyF', null]);
    expect(s.settings.controls.sensitivity).toBe(1.7);
    expect(s.settings.controls.invertY).toBe(true);
    expect(s.settings.controls.aimAssist).toBe('high');
    expect(s.settings.camera).toMatchObject({ mode: 'chase', fov: 90, shake: 0.4, helmetFrame: 'full' });
    expect(s.settings.audio.master).toBe(0.3);
    expect(d.controls.steering).toBe('keyboard');
    expect(d.camera.attachment).toBe('attached');
  });

  it('v2 keeps the player\'s choices (keyboard + mouse, steady horizon, 40 % roll)', () => {
    const st = defaultSettings();
    st.controls.steering = 'keyboardMouse';
    st.controls.reticleLookAhead = true;
    st.camera.attachment = 'steady';
    st.camera.rollStrength = 0.4;
    const s = migrateSave(JSON.parse(JSON.stringify({ version: 2, profile: DEFAULT_PROFILE, settings: st })));
    expect(s.settings.controls.steering).toBe('keyboardMouse');
    expect(s.settings.controls.reticleLookAhead).toBe(true);
    expect(s.settings.camera.attachment).toBe('steady');
    expect(s.settings.camera.rollStrength).toBe(0.4);
    // out-of-range / unknown values fall back
    const bad = migrateSave({ version: 2, profile: {}, settings: { controls: { steering: 'joystick' }, camera: { attachment: 'x', rollStrength: 7 } } });
    expect(bad.settings.controls.steering).toBe('keyboard');
    expect(bad.settings.camera.attachment).toBe('attached');
    expect(bad.settings.camera.rollStrength).toBe(1);
  });
});
