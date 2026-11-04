// Renders a transparent poster image of every dish with <model-viewer> (needs `npm run dev` on port 5310).
// Output: public/posters/<id>.webp — used for menu thumbnails and as the 3D viewer's poster while a model loads.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const dishes = JSON.parse(fs.readFileSync(path.join(root, 'tools/dishes-src.json'), 'utf8'));
const only = process.argv[2];
fs.mkdirSync(path.join(root, 'public/posters'), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
for (const d of dishes) {
  if (only && d.id !== only) continue;
  await page.goto(`http://localhost:5310/tools/poster.html?id=${d.id}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  const png = await page.locator('#mv').screenshot({ omitBackground: true });
  await sharp(png).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(root, 'public/posters', d.id + '.webp'));
  console.log('poster', d.id);
}
await browser.close();
