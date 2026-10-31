// Click-test for the Skills & Fun view and every exit out of it.
// usage: node skillsfun-v3/qa/click-test.mjs <site-url-with-trailing-slash> <outDir> [width] [height]
//   e.g. after `npm run build` + any static server on dist/:
//   node skillsfun-v3/qa/click-test.mjs http://localhost:4173/ qa-out 1440 900
// Uses the Playwright that game/g1 already depends on, with the installed Chrome.
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(new URL('../../game/g1/package.json', import.meta.url))
const { chromium } = require('playwright')
const [url, out, w = '1440', h = '900'] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })
const W = +w, H = +h, mobile = W < 600
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
const p = await ctx.newPage()
const logs = []
p.on('console', m => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`))
p.on('pageerror', e => logs.push('pageerror: ' + e.message))
const R = { steps: [] }
const view = () => p.evaluate(() => {
  const vis = id => { const el = document.getElementById(id); return el && getComputedStyle(el).display !== 'none' }
  if (document.getElementById('skillsfun-root')?.classList.contains('is-active')) return 'skills'
  if (document.getElementById('legal-root')?.classList.contains('is-active')) return 'legal:' + (document.querySelector('#legal-root .legal__tab[aria-selected="true"]')?.dataset.section || '?')
  if (document.getElementById('proj-view-contact')?.classList.contains('is-active')) return 'contact'
  if (document.getElementById('proj-view-projects')?.classList.contains('is-active')) return 'projects'
  if (document.getElementById('lv6-about-frame-wrap')?.classList.contains('is-visible')) return 'about'
  if (vis('home-root')) return 'home'
  return 'unknown'
})
const mode = () => p.evaluate(() => document.querySelector('[data-sf3-root]')?.dataset.mode)
const step = async (name, ok, extra = {}) => { R.steps.push({ name, ok, ...extra }); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(extra)) }
const waitView = async (want, ms = 5000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await view(); if (v === want) return v; await sleep(150) } return v }
const toSection = async () => {
  for (let i = 0; i < 120; i++) { await p.mouse.wheel(0, 160); await sleep(30); if (i % 8 === 7 && (await mode()) === 'section') break }
  await sleep(700)
  return mode()
}
let loads = 0
const freshSkills = async () => { await p.goto(`${url}?t=${++loads}#skills`); await sleep(2500); return view() }
const clickVisible = async sel => { const els = await p.$$(sel); for (const el of els) { if (await el.isVisible()) { await el.click(); return true } } return false }

// 1. Home -> Skills tab (the real flow)
await p.goto(url); await sleep(10000)
await step('home loads', (await view()) === 'home')
const tabbed = mobile ? false : await clickVisible('nav.lv2-nav a.pill[href="#skills"]')
if (!tabbed) { await p.evaluate(() => { const a = document.createElement('a'); a.href = '#skills'; document.body.appendChild(a); a.click(); a.remove() }) }
let v = await waitView('skills', 6000)
await step(`Skills tab -> skills view${tabbed ? ' (nav pill)' : ' (#skills link)'}`, v === 'skills', { view: v })
for (const ms of [400, 1500, 3000, 6500]) { await sleep(ms === 400 ? 400 : ms - [400, 1500, 3000, 6500][[400, 1500, 3000, 6500].indexOf(ms) - 1]); await p.screenshot({ path: `${out}/01-ignition-${ms}.png` }) }
await step('neon canvas + logo after reveal', await p.evaluate(() => !!document.querySelector('[data-testid=neon-stage] canvas') && document.querySelector('[data-testid=site-logo]')?.dataset.visible === 'true'))
let m = await toSection()
await p.screenshot({ path: `${out}/02-section.png` })
await step('scroll reveal -> section mode', m === 'section', { mode: m, hscroll: await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) })
// 2. figure menu -> Home
await p.click('#skillsfun-page2-menu-btn'); await sleep(400)
await p.click('.skillsfun-page2__menu-item[href="/"]')
v = await waitView('home'); await step('figure menu Home -> home', v === 'home', { view: v })
// 3. back into Skills: restarts at the tube
await sleep(800)
if (!mobile) await clickVisible('nav.lv2-nav a.pill[href="#skills"]'); else await p.evaluate(() => { const a = document.createElement('a'); a.href = '#skills'; document.body.appendChild(a); a.click(); a.remove() })
v = await waitView('skills'); await sleep(1200)
await step('re-enter Skills -> starts at the tube', v === 'skills' && (await mode()) === 'neon' && (await p.evaluate(() => scrollY)) === 0, { view: v, mode: await mode() })
await p.screenshot({ path: `${out}/03-reentered.png` })
// 4. exits from the section (fresh /#skills each, which also checks a direct load)
const exits = [
  ['figure Contact button', '#skillsfun-page2-contact', 'contact'],
  ['figure menu About', 'MENU:/about', 'about'],
  ['figure menu Projects', 'MENU:#projects', 'projects'],
  ["About 'Let's Connect'", '#skillsfun-about-cta', 'contact'],
  ['box Home', '.skillsfun-navgrid__box--home', 'home'],
  ['box About Me', '.skillsfun-navgrid__box--about', 'about'],
  ['box Projects', '.skillsfun-navgrid__box--projects', 'projects'],
  ["'Connect with Me'", '#skillsfun-navgrid-connect', 'contact'],
  ['footer Home', '#skillsfun-footer a[href="/"]', 'home'],
  ['footer Projects', '#skillsfun-footer a[href="#projects"]', 'projects'],
  ['footer About', '#skillsfun-footer a[href="/about"]', 'about'],
  ['footer Contact', '#skillsfun-footer-contact', 'contact'],
  ['footer Privacy Policy', '#skillsfun-footer a[href="#privacy"]', 'legal:privacy'],
  ['footer Terms of Use', '#skillsfun-footer a[href="#terms"]', 'legal:terms'],
  ['footer Skills (stays, back to top)', '#skillsfun-footer a[href="#skills"]', 'skills'],
]
let first = true
for (const [name, sel, want] of exits) {
  v = await freshSkills()
  if (first) { await step('direct /#skills load -> skills view', v === 'skills', { view: v }); first = false }
  m = await toSection()
  if (sel.startsWith('MENU:')) { await p.click('#skillsfun-page2-menu-btn'); await sleep(350); await p.click(`.skillsfun-page2__menu-item[href="${sel.slice(5)}"]`) }
  else { await p.locator(sel).first().scrollIntoViewIfNeeded(); await sleep(700); await p.locator(sel).first().click() }
  v = await waitView(want, 6000)
  const extra = { view: v, mode: m }
  if (want === 'skills') { await sleep(1500); extra.scrollY = await p.evaluate(() => scrollY) }
  await step(`${name} -> ${want}`, v === want && (want !== 'skills' || extra.scrollY < 5), extra)
}
// 5. social links open new tabs
v = await freshSkills(); await toSection()
for (const label of ['LinkedIn', 'GitHub']) {
  const loc = p.locator(`#skillsfun-footer a:has-text("${label}")`)
  await loc.scrollIntoViewIfNeeded()
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null), loc.click()])
  await step(`footer ${label} opens a new tab`, !!pop, { url: pop ? pop.url().slice(0, 60) : null })
  if (pop) await pop.close()
}
await step('footer Gmail is mailto', (await p.locator('#skillsfun-footer a:has-text("Gmail")').getAttribute('href')) === 'mailto:manikrana831@gmail.com')
// 6. logo: back to the start
await p.locator('[data-testid=site-logo]').click(); await sleep(1500)
await step('logo -> back to the tube', (await mode()) === 'neon' && (await p.evaluate(() => scrollY)) === 0, { mode: await mode() })
await sleep(5500); await p.screenshot({ path: `${out}/04-logo-replay.png` })
// 7. the colour picker (portal inside the section root)
const orb = p.locator('[data-testid=color-orb]')
if (await orb.isVisible()) {
  await orb.click(); await sleep(900)
  await p.screenshot({ path: `${out}/05-picker.png` })
  const styled = await p.evaluate(() => { const c = document.querySelector('[data-testid=picker-card]'); return c ? getComputedStyle(c).borderRadius : null })
  await p.click('[aria-label="Preset: Amber"]'); await sleep(300); await p.click('[data-testid=picker-confirm]'); await sleep(6500)
  await p.screenshot({ path: `${out}/06-amber.png` })
  await step('colour picker opens styled, confirm relights', styled === '24px', { radius: styled })
} else await step('colour orb visible', false)
// 8. the other views still look/work as before
v = await freshSkills()
await p.goto(url); await sleep(9000)
await p.screenshot({ path: `${out}/07-home-after.png` })
R.hscroll = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
R.logs = [...new Set(logs)]
R.passed = R.steps.filter(s => s.ok).length; R.total = R.steps.length
fs.writeFileSync(`${out}/report.json`, JSON.stringify(R, null, 1))
console.log(JSON.stringify({ passed: R.passed, total: R.total, hscroll: R.hscroll, logs: R.logs }))
await b.close()
