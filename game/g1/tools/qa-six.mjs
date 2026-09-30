// The six ships on the hangar pad at the rest composition (1920x1080), via
// the ?ship= deep link. node tools/qa-six.mjs [origin] [--debug]
import { chromium } from 'playwright';
const origin = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5199';
const debug = process.argv.includes('--debug');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const out = {};
for (const id of ['halcyon', 'vesper', 'basilisk', 'nocturne', 'tempest', 'obsidian']) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const logs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
  p.on('pageerror', e => logs.push('pageerror ' + e.message));
  await p.goto(`${origin}/game/g1/?boot=0&ship=${id}${debug ? '&debug=1' : ''}`);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `qa/1d-six-${debug ? 'real' : 'game'}-${id}.png` });
  out[id] = logs;
  await p.close();
}
console.log(JSON.stringify(out));
await b.close();
