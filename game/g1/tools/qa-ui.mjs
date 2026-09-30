// Hangar UI checks (brief §12, §18): screenshots at the required resolutions,
// console, and a few interactions (select locked ship, livery, tabs).
//   node tools/qa-ui.mjs [origin] [tag]
import { chromium } from 'playwright';
const origin = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5199';
const tag = process.argv.find(a => !a.startsWith('http') && !a.includes('/') && a !== process.argv[0] && a !== process.argv[1]) ?? 'p1';
const sizes = [[1920, 1080], [1280, 720], [1366, 768], [2560, 1440], [3440, 1440], [820, 1000]];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const logs = [];
for (const [w, h] of sizes) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`${w}x${h} ${m.text()}`); });
  p.on('pageerror', e => logs.push(`${w}x${h} pageerror ${e.message}`));
  await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
  await p.waitForTimeout(5500);
  await p.screenshot({ path: `qa/1e-ui-${tag}-${w}x${h}.png` });
  if (w === 1920) {
    // locked ship selection + codex tab + livery
    await p.click('button[aria-label^="VESPER"]');
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `qa/1e-ui-${tag}-locked.png` });
    await p.click('button[aria-label^="HALCYON"]');
    await p.waitForTimeout(1400);
    await p.click('[role="tab"]:has-text("CODEX")');
    await p.click('button[role="radio"][aria-label="GHOST"]');
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `qa/1e-ui-${tag}-codex-ghost.png` });
  }
  await p.close();
}
console.log(JSON.stringify({ logs }));
await b.close();
