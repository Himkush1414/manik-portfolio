// Planet 1 §1.1: ridge turbulence, the climb-authority fade, forced descent, the cloud-deck whiteout
// descent and the "TURBULENCE" HUD warning are DELETED — code, tests and strings. Nothing may warn about or
// block climbing. This scans the source so none of it creeps back.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [/TURBULENCE/, /forced descent/i, /climb authority/i, /downdraft/i, /ridge turbulence/i, /CLOUD DECK — DESCEND/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|css)$/.test(n) ? [p] : [];
  });
}

describe('vertical freedom: no climb warnings or blocks anywhere', () => {
  it('no forbidden mechanic or string in src (tests excluded)', () => {
    const root = join(__dirname, '..');
    const hits: string[] = [];
    for (const f of files(root)) {
      if (f.includes(join('src', 'tests'))) continue;
      const t = readFileSync(f, 'utf8');
      for (const re of FORBIDDEN) if (re.test(t)) hits.push(`${f.slice(root.length)}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
});
