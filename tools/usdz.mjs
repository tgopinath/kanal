// Makes the iOS copies of every dish: public/models/<id>.usdz (needs `npm run dev`).
// RealityKit and AR Quick Look read USDZ, not GLB; three.js's USDZExporter keeps the scan's textures and real-world scale.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const dishes = JSON.parse(fs.readFileSync(path.join(root, 'tools/dishes-src.json'), 'utf8'));
const only = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:5310/tools/usdz.html');
await page.waitForSelector('body[data-ready="1"]', { state: 'attached' });
for (const d of dishes) {
  if (only && d.id !== only) continue;
  const b64 = await page.evaluate(id => window.convert(id), d.id);
  const out = path.join(root, 'public/models', d.id + '.usdz');
  const raw = out + '.raw.usdz';
  fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
  // macOS's usdcrush rewrites the text geometry as compressed binary USD (iOS 17-compatible with "widest"), then usdchecker validates it.
  execFileSync('/usr/bin/usdcrush', [raw, '-o', out, '-c', 'widest', '-t', '85'], { stdio: 'pipe' });
  fs.rmSync(raw);
  const check = execFileSync('/usr/bin/usdchecker', [out], { encoding: 'utf8' });
  if (!/Success/.test(check)) throw new Error(`usdchecker failed for ${d.id}: ${check}`);
  console.log(d.id.padEnd(16), Math.round(fs.statSync(out).size / 1024), 'KB');
}
await browser.close();
