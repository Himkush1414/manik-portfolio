// Balance harness CLI (brief §15 / §22): bundles src/cli/balance.ts (the
// pure sim + bot) with the esbuild that Vite already installs — no new
// dependency, no TS loader — into .cache/ (git-ignored), then runs it.
//   node tools/balance.mjs --level test --skills novice,mid,expert --runs 20 [--ship halcyon] [--tier 0..5]
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, '.cache', 'balance-cli.mjs');
await build({ entryPoints: [join(root, 'src/cli/balance.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile, logLevel: 'warning' });
await import(pathToFileURL(outfile).href + '?t=' + Date.now());
