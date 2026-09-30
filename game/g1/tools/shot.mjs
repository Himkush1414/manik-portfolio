// Quick screenshot tool (QA + slice checks).
//   node tools/shot.mjs <url> <out.png> [--w 1920 --h 1080 --wait 4000 --eval "js" --gpu] [--console]
// Prints console errors/warnings, WebGL renderer string, fps and renderer.info.
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
const opt = (k, d) => {
  const i = args.indexOf('--' + k);
  return i >= 0 ? args[i + 1] : d;
};
const flag = k => args.includes('--' + k);
const W = +opt('w', 1920);
const H = +opt('h', 1080);
const wait = +opt('wait', 4000);
const evalJs = opt('eval', null);
const evalAfter = opt('after', null);
const gpu = flag('gpu');

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: gpu
    ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-webgpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const initSave = opt('save', null); // JSON patch for graphics, e.g. '{"ao":false}'
if (initSave) {
  await page.addInitScript(patch => {
    const key = 'spacewar.darkedition.save.v1';
    const cur = JSON.parse(localStorage.getItem(key) || 'null') || { version: 1, profile: {}, settings: {} };
    cur.settings = cur.settings || {};
    cur.settings.graphics = { ...(cur.settings.graphics || {}), ...JSON.parse(patch) };
    localStorage.setItem(key, JSON.stringify(cur));
  }, initSave);
}
const logs = [];
page.on('console', m => {
  if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
if (evalJs) await page.evaluate(evalJs);
await page.waitForTimeout(wait);
if (evalAfter) {
  await page.evaluate(evalAfter);
  await page.waitForTimeout(+opt('wait2', 1500));
}
const meta = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const ext = c && c.getExtension('WEBGL_debug_renderer_info');
  const g = window.__G1__;
  return {
    renderer: ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a',
    fps: g ? g.fps() : null,
    info: g ? g.info() : null,
  };
});
console.log(JSON.stringify({ ...meta, logs }, null, 1));
if (out) await page.screenshot({ path: out, timeout: +opt('shotTimeout', 60000) });
await browser.close();
