// Accessibility audit (brief §17): axe-core (WCAG 2 A/AA: contrast, names,
// roles, ARIA) on every Phase 1 screen, plus keyboard checks (Esc closes
// modals, focus trapped in modals, focus-visible ring present).
//   node tools/qa-a11y.mjs [origin] --axe <path to axe.min.js>
// (axe-core is a QA-only tool: pass a local copy, it is not a game dependency)
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const origin = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5199';
const ai = process.argv.indexOf('--axe');
const axeSrc = readFileSync(ai > 0 ? process.argv[ai + 1] : 'node_modules/axe-core/axe.min.js', 'utf8');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 160)); });
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.launch?.jump, null, { timeout: 60000 });
await p.waitForTimeout(9000);
await p.addScriptTag({ content: axeSrc });
const report = {};
const noRing = {};
// Tab through `stops` stops; an element whose computed look does not change
// between focused (keyboard) and blurred has no visible focus indicator.
async function focusAudit(screen, stops = 40) {
  const bad = new Set();
  for (let i = 0; i < stops; i++) {
    await p.keyboard.press('Tab');
    // styles transition (border/background ~220 ms): settle before each read
    await p.waitForTimeout(320);
    const look = () => p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const c = getComputedStyle(el);
      const ps = ['::before', '::after'].map(x => { const k = getComputedStyle(el, x); return k.background + k.borderColor; }).join('|');
      return [c.outlineStyle + c.outlineWidth + c.outlineColor, c.boxShadow, c.borderColor, c.background, c.color, c.filter, ps].join('|');
    });
    const a = await look();
    if (a === null) continue;
    const label = await p.evaluate(() => { const el = document.activeElement; return `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`; });
    await p.evaluate(() => { window.__fa = document.activeElement; window.__fa.blur(); });
    await p.waitForTimeout(320);
    const bStyle = await p.evaluate(() => { const el = window.__fa; const c = getComputedStyle(el); const ps = ['::before', '::after'].map(x => { const k = getComputedStyle(el, x); return k.background + k.borderColor; }).join('|'); return [c.outlineStyle + c.outlineWidth + c.outlineColor, c.boxShadow, c.borderColor, c.background, c.color, c.filter, ps].join('|'); });
    await p.evaluate(() => window.__fa.focus());
    const r = a === bStyle ? label : null;
    if (r) bad.add(r);
  }
  noRing[screen] = [...bad];
}
async function axe(screen, include) {
  const r = await p.evaluate(async inc => {
    const res = await window.axe.run(inc ? { include: [inc] } : document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }, resultTypes: ['violations'] });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, nodes: v.nodes.slice(0, 4).map(n => `${n.target.join(' ')} :: ${(n.failureSummary || '').split('\n').slice(1, 2).join('').slice(0, 140)}`) }));
  }, include ?? null);
  report[screen] = r;
}
const tabOrderTrapped = async () => {
  // 25 Tabs inside an open modal must never leave it
  for (let i = 0; i < 25; i++) {
    await p.keyboard.press('Tab');
    const inside = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    if (!inside) return false;
  }
  return true;
};
await axe('hangar');
await focusAudit('hangar', 45);
await p.click('button[aria-label^="Upgrades"]');
await p.waitForTimeout(1200);
await axe('upgrades', '[role="dialog"]');
const trapUpg = await tabOrderTrapped();
await focusAudit('upgrades', 20);
await p.keyboard.press('Escape');
await p.waitForTimeout(900);
const escUpg = await p.evaluate(() => !document.querySelector('[role="dialog"]'));
await p.click('button[aria-label^="Settings"]');
await p.waitForTimeout(1200);
for (const tab of await p.$$('[role="dialog"] [role="tab"]')) {
  const name = (await tab.textContent()).replace(/\W/g, '');
  await tab.click();
  await p.waitForTimeout(450);
  await axe('settings/' + name, '[role="dialog"]');
}
const trapSet = await tabOrderTrapped();
await focusAudit('settings', 60);
await p.keyboard.press('Escape');
await p.waitForTimeout(900);
const escSet = await p.evaluate(() => !document.querySelector('[role="dialog"]'));
await p.evaluate(() => window.__G1__.launch.jump('briefing'));
await p.waitForTimeout(1500);
await axe('cockpit-briefing');
await p.keyboard.press('Enter'); // skip typewriter (LET'S GO has focus)
await p.keyboard.press('Enter'); // LET'S GO
await p.waitForTimeout(1000);
await axe('camera-select');
await focusAudit('camera-select', 6);
const total = Object.values(report).reduce((a, v) => a + v.length, 0);
console.log(JSON.stringify({ total, report, keyboard: { trapUpg, escUpg, trapSet, escSet }, noRing, logs: [...new Set(logs)] }, null, 1));
await b.close();
