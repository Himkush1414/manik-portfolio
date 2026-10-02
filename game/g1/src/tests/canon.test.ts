import { describe, expect, it } from 'vitest';
import { CODEX, COMMS, MISSIONS, MISSION_01, MISSION_10, MISSION_22, LAUNCH_LINES } from '../data/lore';

const words = (m: { body: readonly string[] }) => m.body.join(' ').split(/\s+/).filter(Boolean).length;
const text = (o: unknown) => JSON.stringify(o);

describe('Phase 2R canon (§2)', () => {
  it('Mission 01 is the new verbatim briefing', () => {
    expect(MISSION_01.body[0]).toContain('lost its engines over the Arden highlands');
    expect(MISSION_01.body[1]).toBe('The valley is the only road to the landing basin. You have nine minutes of altitude left.');
    expect(MISSION_01.body.at(-1)).toBe('Bring them home, Seven.');
    expect(MISSION_01.objectives).toEqual(['Reach KESTREL-9', 'Escort the convoy to the landing basin', 'Keep hull above zero']);
    expect(MISSION_01.worldName).toBe('ARDEN — MARROW VALLEY');
    expect([MISSION_01.threat, MISSION_01.reward]).toEqual(['LOW', 800]);
  });
  it('Sortie 010 and 022 briefings are 80-110 words; L22 is STORMFRONT', () => {
    for (const m of [MISSION_10, MISSION_22]) {
      const n = words(m);
      expect(n >= 80 && n <= 110, `${m.title}: ${n} words`).toBe(true);
    }
    expect(MISSION_22.title).toBe('STORMFRONT');
    expect(MISSIONS.l10.worldName).toContain('KHARAN');
  });
  it('no corridor / wormhole canon left (the Veil is a chain of gates)', () => {
    const all = text([MISSIONS, CODEX, COMMS, LAUNCH_LINES.count, LAUNCH_LINES.release, LAUNCH_LINES.retry]);
    expect(all).not.toMatch(/corridor|wormhole|ride the line|on the line/i);
    expect(CODEX.find(c => c.id === 'veil')!.body).toMatch(/gates/);
  });
  it('comms scripts are sorted by rail position, STATIC lines are marked', () => {
    for (const [id, lines] of Object.entries(COMMS)) {
      for (let i = 1; i < lines.length; i++) expect(lines[i].atM, id).toBeGreaterThan(lines[i - 1].atM);
      for (const l of lines) if (l.speaker === 'STATIC') expect(l.static, l.text).toBe(true);
    }
  });
});
