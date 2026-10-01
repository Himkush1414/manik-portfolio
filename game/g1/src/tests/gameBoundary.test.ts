// Brief §3: src/game is a pure-TypeScript simulation — no three.js, no React,
// no DOM. This scans the TRANSITIVE import graph from src/game and src/levels
// (every file they reach, including shared data/core modules) and fails on a
// forbidden package import or a browser global.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

const SRC = resolve(__dirname, '..');
const ROOTS = ['game', 'levels'].map(d => join(SRC, d)).filter(existsSync);
const FORBIDDEN_PKG = /^(three|react|react-dom|@react-three\/.*|postprocessing|n8ao|gsap|@gsap\/.*|zustand|motion|maath|leva|stats-gl|detect-gpu|three-.*)$/;
const DOM_TOKENS = /\b(window|document|navigator|requestAnimationFrame|localStorage|HTMLElement|performance\.now|Date\.now|Math\.random)\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.ts$/.test(f) && !/\.test\.ts$/.test(f)) out.push(p);
  }
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const c of [base + '.ts', base + '.tsx', join(base, 'index.ts'), base]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

/** strip comments so prose ("the window of 90 frames") never trips the token check */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('src/game import boundary (brief §3)', () => {
  it('reaches no renderer / UI / DOM code', () => {
    const queue = ROOTS.flatMap(r => walk(r));
    expect(queue.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    const problems: string[] = [];
    while (queue.length) {
      const f = queue.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      const src = code(readFileSync(f, 'utf8'));
      if (/\.tsx$/.test(f)) problems.push(`${relative(SRC, f)}: .tsx (React) module`);
      const tok = src.match(DOM_TOKENS);
      if (tok) problems.push(`${relative(SRC, f)}: uses ${tok[0]}`);
      for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const spec = m[1] ?? m[2];
        if (spec.startsWith('.')) {
          const r = resolveImport(f, spec);
          if (!r) problems.push(`${relative(SRC, f)}: unresolved ${spec}`);
          else queue.push(r);
        } else if (FORBIDDEN_PKG.test(spec)) problems.push(`${relative(SRC, f)}: imports ${spec}`);
        else problems.push(`${relative(SRC, f)}: imports package ${spec} (not allow-listed)`);
      }
    }
    expect(problems).toEqual([]);
  });
});
