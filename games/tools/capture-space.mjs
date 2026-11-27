// Real gameplay frames of the space game (SPACE WAR: DARK EDITION) for its library cover.
// Drives the production launch path with page clicks (same route as game/g1/tools/qa-prodlaunch.mjs):
// hangar -> START MISSION -> briefing -> LET'S GO -> camera -> standby -> catapult launch.
//   cmd.exe /c "set PLAYWRIGHT_BROWSERS_PATH=& set G1_DGPU=1& node games/tools/capture-space.mjs <origin> <outDir>"
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../game/g1/package.json', import.meta.url));
const { chromium } = require('playwright');

const [origin = 'http://localhost:4181', out = 'space-frames'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const args = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])];
const b = await chromium.launch({ channel: 'chrome', headless: true, args });
const [VW, VH] = (process.env.VIEW || '1920x1080').split('x').map(Number);
const p = await b.newPage({ viewport: { width: VW, height: VH } });
const logs = [];
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(() => {
  if (!sessionStorage.getItem('cap-seeded')) {
    sessionStorage.setItem('cap-seeded', '1');
    localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true } }));
  }
});
const shot = name => p.screenshot({ path: `${out}/${name}.png` });
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
const until = (state, timeout = 90000) => p.waitForFunction(s => window.__G1__?.flowState?.get() === s, state, { timeout, polling: 50 });
await until('hangar.idle');
await p.waitForTimeout(4000);
await shot('1-hangar');
await p.click('button[aria-label^="Start mission"]');
await until('launch.briefing');
await p.waitForTimeout(2500);
await shot('2-briefing');
await p.click('button:has-text("LET\'S GO")');
await p.waitForTimeout(300);
await p.click('button:has-text("LET\'S GO")');
await until('launch.cameraSelect');
await p.waitForTimeout(600);
await shot('3-camera');
await p.click(`[role="radiogroup"][aria-label="Camera mode"] [role="radio"]:has-text("${process.env.CAM || 'COCKPIT'}")`);
await until('launch.standby');
await p.waitForTimeout(800);
await shot('4-standby');
await until('mission.launching', 20000);
// HIDE_LINE=1: hide the radio-chatter subtitle line (cover art only; the game itself is unchanged)
if (process.env.HIDE_LINE) await p.addStyleTag({ content: '[class*="_line_"],[class*="_launch_"]{visibility:hidden!important}' });
const t0 = Date.now();
for (const ms of (process.env.TIMES || '400,1500,2600,3300,3900').split(",").map(Number)) {
  const wait = ms - (Date.now() - t0);
  if (wait > 0) await p.waitForTimeout(wait);
  await shot(`5-launch-${String(ms).padStart(4, '0')}`);
}
console.log(JSON.stringify({ out, logs }));
await b.close();
