// Offscreen thumbnails + §10 silhouette test.
//   node tools/qa-thumbs.mjs [origin]
// Saves qa/1c-thumbs-sheet.png (6 livery thumbs + locked holograms) and
// qa/1c-silhouettes.png (all six, same 3/4 view, flat black on white).
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const ids = ['halcyon', 'vesper', 'basilisk', 'nocturne', 'tempest', 'obsidian'];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.thumbs && window.__G1__?.ship, null, { timeout: 30000 });
await p.waitForTimeout(2500);
const t0 = Date.now();
const normal = [], holo = [], sil = [];
for (const id of ids) normal.push(await p.evaluate(i => window.__G1__.thumbs.make(i, {}), id));
const tNormal = Date.now() - t0;
for (const id of ids) holo.push(await p.evaluate(i => window.__G1__.thumbs.make(i, { locked: true }), id));
for (const id of ids) sil.push(await p.evaluate(i => window.__G1__.thumbs.make(i, { silhouette: true }), id));
const info = await p.evaluate(() => window.__G1__.info());
const sheet = await b.newPage({ viewport: { width: 1000, height: 440 } });
const grid = (urls, bg) => `<body style="margin:0;background:${bg};display:grid;grid-template-columns:repeat(3,304px);gap:12px;padding:20px">${urls.map((u, i) => `<figure style="margin:0"><img src="${u}" width="304" height="192" style="display:block;background:${bg === '#fff' ? '#fff' : '#0d1330'}"><figcaption style="font:12px monospace;color:${bg === '#fff' ? '#000' : '#8c9ac0'}">${ids[i]}</figcaption></figure>`).join('')}</body>`;
await sheet.setContent(grid(normal, '#04050a'));
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: 'qa/1c-thumbs-sheet.png' });
await sheet.setContent(grid(holo, '#04050a'));
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: 'qa/1c-thumbs-locked.png' });
await sheet.setContent(grid(sil, '#fff'));
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: 'qa/1c-silhouettes.png' });
console.log(JSON.stringify({ msPerNormalThumb: Math.round(tNormal / ids.length), sizes: normal.map(u => u.length), info, logs }));
await b.close();
