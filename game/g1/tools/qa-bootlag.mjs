// Boot timeline vs wall clock: samples boot.time() every 100 ms and reports
// how far the timeline fell behind real time (GSAP lag smoothing absorbs
// long tasks, so any main-thread stall shows up as lag).
//   node tools/qa-bootlag.mjs [origin] [runs]
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const runs = +(process.argv[3] ?? 3);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
for (let r = 0; r < runs; r++) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(origin + '/game/g1/?debug=1');
  await p.waitForFunction(() => window.__G1__?.boot, null, { timeout: 30000 });
  const res = await p.evaluate(async () => {
    const out = [];
    let base = null;
    const t0 = performance.now();
    while (performance.now() - t0 < 13500) {
      const tl = window.__G1__.boot.time();
      const now = performance.now() / 1000;
      if (base === null && tl > 0) base = now - tl;
      if (base !== null) out.push({ wall: now - base, tl });
      await new Promise(r => setTimeout(r, 100));
    }
    let maxLag = 0, at = 0, jumps = [];
    for (let i = 1; i < out.length; i++) {
      const lag = out[i].wall - out[i].tl;
      if (lag > maxLag && out[i].tl < 12.1) { maxLag = lag; at = out[i].tl; }
      const dw = out[i].wall - out[i - 1].wall, dt = out[i].tl - out[i - 1].tl;
      if (dw - dt > 0.08 && out[i].tl < 12.1) jumps.push(`${out[i - 1].tl.toFixed(2)}:+${((dw - dt) * 1000).toFixed(0)}ms`);
    }
    return { final: out.at(-1)?.tl, maxLag: +maxLag.toFixed(2), at: +at.toFixed(2), hitches: jumps };
  });
  console.log(JSON.stringify(res));
  await p.close();
}
await b.close();
