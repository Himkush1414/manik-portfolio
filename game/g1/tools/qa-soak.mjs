// Leak soak (brief §17): N hangar <-> cockpit round trips through the REAL
// flow (GSAP clock sped up), forced GC via CDP, then JS heap + renderer
// resource counts per checkpoint. Pass = flat: no monotonic growth.
//   node tools/qa-soak.mjs [origin] [trips=20] [rate=4] [warmSeconds=40]
// warm: idle first so the hangar's idle-time work (other ships' preload,
// thumbnails) is done and only round-trip growth is measured.
import { chromium } from 'playwright';
const origin = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5199';
const trips = +(process.argv[3] ?? 20), rate = +(process.argv[4] ?? 4), warm = +(process.argv[5] ?? 40);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
const cdp = await p.context().newCDPSession(p);
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.launch?.jump, null, { timeout: 60000 });
await p.waitForTimeout(warm * 1000); // hangar idle work: ship preloads, thumbnails, cockpit pre-warm
const log = (...a) => console.error('[soak]', ...a);
const state = () => p.evaluate(() => window.__G1__.flowState.get());
const sample = async trip => {
  await cdp.send('HeapProfiler.collectGarbage');
  await p.waitForTimeout(400);
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  const info = await p.evaluate(() => window.__G1__.info());
  return { trip, heapMB: +(usedSize / 1048576).toFixed(1), geometries: info.geometries, textures: info.textures, programs: info.programs };
};
log('hangar settled', await state());
const rows = [await sample(0)];
log('baseline', JSON.stringify(rows[0]));
for (let i = 1; i <= trips; i++) {
  const ok = await p.evaluate(() => window.__G1__.launch.jump('cockpit'));
  log(`trip ${i}: in`, await state());
  if (!ok) throw new Error(`trip ${i}: launch refused in ${await state()}`);
  await p.waitForTimeout(300);
  const sent = await p.evaluate(r => { window.__G1__.launch.rate(r); return window.__G1__.launch.back(); }, rate);
  log(`trip ${i}: back sent`, sent);
  for (let k = 0; (await state()) !== 'hangar.idle'; k++) {
    if (k > 150) throw new Error(`trip ${i}: stuck in ${await state()}`);
    await p.waitForTimeout(100);
  }
  log(`trip ${i}: idle`);
  await p.evaluate(() => window.__G1__.launch.rate(1));
  log(`trip ${i}: back`);
  await p.waitForTimeout(250);
  if (i === 1 || i % 5 === 0) rows.push(await sample(i));
}
// trip 1 = after the first cockpit visit (its geometry/textures upload once)
const first = rows[1], last = rows[rows.length - 1];
const verdict = {
  heapGrowthMB: +(last.heapMB - first.heapMB).toFixed(1),
  geometriesDelta: last.geometries - first.geometries,
  texturesDelta: last.textures - first.textures,
  programsDelta: last.programs - first.programs,
};
console.log(JSON.stringify({ rows, verdict, logs: [...new Set(logs)] }, null, 1));
await b.close();
