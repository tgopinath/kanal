// Renders the table lockup PNGs the native AR views lay on the table (needs `npm run dev`).
// Output: public/ar/lockup-pause.png (slideshow running) and public/ar/lockup-play.png (paused).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(root, 'public/ar'), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1024, height: 512 } });
for (const [venue, prefix] of [['kanal', 'lockup'], ['bun', 'bun-lockup']]) for (const s of ['pause', 'play']) {
  await page.goto(`http://localhost:5310/tools/ar-lockup.html?state=${s}&venue=${venue}`);
  await page.waitForSelector('body[data-ready="1"]');
  await page.locator('#c').screenshot({ path: path.join(root, `public/ar/${prefix}-${s}.png`), omitBackground: true });
  console.log('lockup', venue, s);
}
await browser.close();
