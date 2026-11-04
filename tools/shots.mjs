// Captures the portfolio screenshots (needs `npm run dev` on port 5310):
//   prototype/shots/*.jpg  — 600-wide phone shots (390 × 844 @2x, dark)
//   shots-desktop/web.jpg  — 1440 × 900 desktop shot for the card's browser window
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(root, 'prototype/shots'), DESK = path.join(root, 'shots-desktop');
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DESK, { recursive: true });
const base = 'http://localhost:5310/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shoot(ctxOpts, list, dir, width) {
  const ctx = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'no-preference', ...ctxOpts });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
  for (const s of list) {
    await page.goto(base + 'index.html' + s.hash);
    if (s.js) await page.evaluate(s.js);
    await sleep(s.wait || 4000);
    const png = await page.screenshot();
    await sharp(png).resize(width).jpeg({ quality: 84 }).toFile(path.join(dir, s.file + '.jpg'));
    console.log('shot', s.file);
  }
  await ctx.close();
}

await shoot({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [
  { hash: '#/', file: 'menu', wait: 3000 },
  { hash: '#/dish/prime-rib', file: 'dish', wait: 6000 },
  { hash: '#/table/prime-rib', file: 'table', wait: 6000, js: "setTimeout(()=>document.querySelector('#ts-pause')?.click(), 300)" },
  { hash: '#/table/pear-tart', file: 'table-dessert', wait: 6000, js: "setTimeout(()=>document.querySelector('#ts-pause')?.click(), 300)" },
  { hash: '#/about', file: 'credits', wait: 2000, js: "setTimeout(()=>document.querySelector('#cred-title')?.scrollIntoView(), 500)" },
], SHOTS, 600);

await shoot({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, [
  { hash: '#/dish/prime-rib', file: 'web', wait: 7000 },
], DESK, 1440);
await browser.close();
