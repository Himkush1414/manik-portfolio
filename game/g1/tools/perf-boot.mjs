// Long-task + boot-mark profiler: node tools/perf-boot.mjs [origin] (default dev :5199).
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.addInitScript(() => {
  window.__longtasks = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__longtasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true });
});
await p.goto((process.argv[2] || 'http://localhost:5199') + '/game/g1/?debug=1');
await p.waitForTimeout(12000);
console.log(JSON.stringify(await p.evaluate(() => ({
  long: window.__longtasks.filter(t => t.dur > 50),
  marks: performance.getEntriesByType('mark').map(m => `${m.name}@${Math.round(m.startTime)}`),
  parallel: !!document.createElement('canvas').getContext('webgl2').getExtension('KHR_parallel_shader_compile'),
})), null, 0));
await b.close();
