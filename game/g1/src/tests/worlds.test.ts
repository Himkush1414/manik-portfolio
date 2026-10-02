import { describe, expect, it } from 'vitest';
import { WORLDS, worldForLevel, worldNumberForLevel, worldById } from '../data/worlds/registry';
import { validateWorld, signature } from '../data/worlds/validate';

describe('world bible (Phase 2R §3)', () => {
  it('has the twelve worlds in order with unique ids', () => {
    expect(WORLDS.map(w => w.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(WORLDS.map(w => w.id)).size).toBe(12);
    expect(WORLDS.map(w => w.name)).toEqual(['ARDEN', 'CINDER', 'KHARAN', 'HALDERN', 'SPOREFALL', 'STORMWARD', 'OSSUARY', 'AURELIA', 'GLASSFIELD', 'VANTA', 'MAW', 'THE HOLLOW CROWN']);
  });

  it('every world passes the validator', () => {
    for (const w of WORLDS) expect(validateWorld(w), w.id).toEqual([]);
  });

  it('maps levels to worlds as ceil(level * 12 / 50) and each world claims its levels', () => {
    const table: [number, number][] = [[1, 1], [4, 1], [5, 2], [8, 2], [9, 3], [10, 3], [12, 3], [13, 4], [16, 4], [17, 5], [20, 5], [21, 6], [22, 6], [25, 6], [26, 7], [29, 7], [30, 8], [33, 8], [34, 9], [37, 9], [38, 10], [41, 10], [42, 11], [45, 11], [46, 12], [50, 12]];
    for (const [level, world] of table) expect(worldNumberForLevel(level), `L${level}`).toBe(world);
    for (let level = 1; level <= 50; level++) {
      const w = worldForLevel(level);
      expect(level >= w.levels[0] && level <= w.levels[1], `L${level} in ${w.id} ${w.levels}`).toBe(true);
    }
  });

  it('the three built worlds have the brief identities', () => {
    const arden = worldById('arden')!, kharan = worldById('kharan')!, storm = worldById('stormward')!;
    expect(arden.sky.bodies.map(b => b.name)).toEqual(['ORRIN', 'LUNE']);
    expect(arden.sky.bodies[0].rings?.tilt).toBe(14);
    expect(kharan.sky.suns).toHaveLength(2);
    expect(kharan.sky.bodies.map(b => b.name)).toEqual(['KHEM', 'TIR']);
    expect(storm.water.kind).toBe('sea');
    expect(storm.sky.bodies[0].name).toBe('THALASSA');
    expect(storm.weather.lightning).toBeDefined();
    expect(kharan.strains.some(s => s.name === 'SANDWYRM' && s.phase === 2)).toBe(true);
  });

  it('palette signatures are distinct between every pair of worlds (uniqueness at thumbnail size)', () => {
    const sigs = WORLDS.map(w => signature(w).join(','));
    expect(new Set(sigs).size).toBe(WORLDS.length);
  });
});
