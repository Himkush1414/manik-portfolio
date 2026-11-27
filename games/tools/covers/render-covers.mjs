// Renders the two library covers to PNG at 2x with Playwright (installed Chrome), then
// games/tools/covers/encode.py turns them into AVIF + WebP.
//   cmd.exe /c "set PLAYWRIGHT_BROWSERS_PATH=& node games/tools/covers/render-covers.mjs <mindtierSrcDir> <spaceSrcDir> <outDir>"
// Paths are Windows paths (D:/...). Output: <slug>-land.png (1920x1200), <slug>-port.png (1080x1350).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../../game/g1/package.json', import.meta.url));
const { chromium } = require('playwright');

const [mtSrc, spSrc, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const jobs = [
  ['mindtier', 'mindtier.html', mtSrc],
  ['space', 'space.html', spSrc],
];
for (const [slug, file, src] of jobs) {
  for (const crop of ['land', 'port']) {
    const [w, h] = crop === 'land' ? [960, 600] : [540, 675];
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const url = new URL(file, import.meta.url);
    url.search = `?src=${encodeURIComponent(pathToFileURL(src).href)}&crop=${crop}`;
    await page.goto(url.href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    await page.waitForTimeout(200);
    await page.locator('#art').screenshot({ path: `${out}/${slug}-${crop}.png` });
    await page.close();
  }
}
await b.close();
console.log('rendered to', out);
