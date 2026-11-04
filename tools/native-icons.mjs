// Writes Kanal's launcher icons and splash screens into the Android project (and the iOS asset catalog if present).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const mark = fs.readFileSync(path.join(root, 'public/brand/mark.svg'), 'utf8').replace(/<svg[^>]*>|<\/svg>/g, '');
const svg = (size, scale, bg = '#17110c') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${bg ? `<rect width="64" height="64" fill="${bg}"/>` : ''}<g transform="translate(32 32) scale(${scale}) translate(-32 -32)" fill="none" stroke="#d9bd84" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${mark.replace(/ (fill|stroke)[-a-z]*="[^"]*"/g, '')}</g></svg>`);
const res = path.join(root, 'android/app/src/main/res');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const dir = path.join(res, `mipmap-${d}`);
  if (!fs.existsSync(dir)) continue;
  await sharp(svg(48 * k, 0.62)).png().toFile(path.join(dir, 'ic_launcher.png'));
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${48 * k}" height="${48 * k}"><defs><clipPath id="c"><circle cx="${24 * k}" cy="${24 * k}" r="${24 * k}"/></clipPath></defs><image href="data:image/png;base64,${(await sharp(svg(48 * k, 0.62)).png().toBuffer()).toString('base64')}" width="${48 * k}" height="${48 * k}" clip-path="url(#c)"/></svg>`)).png().toFile(path.join(dir, 'ic_launcher_round.png'));
  await sharp(svg(108 * k, 0.42, null)).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
}
const bgXml = path.join(res, 'values/ic_launcher_background.xml');
fs.writeFileSync(bgXml, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#17110C</color>\n</resources>\n');
for (const dir of fs.readdirSync(res).filter(d => d.startsWith('drawable'))) {
  const f = path.join(res, dir, 'splash.png');
  if (!fs.existsSync(f)) continue;
  const { width, height } = await sharp(f).metadata();
  const s = Math.round(Math.min(width, height) * 0.28);
  const icon = await sharp(svg(s, 1, null)).png().toBuffer();
  await sharp({ create: { width, height, channels: 4, background: '#120e0a' } }).composite([{ input: icon, gravity: 'center' }]).png().toFile(f + '.tmp');
  fs.renameSync(f + '.tmp', f);
}
// iOS app icon (single 1024 image, Xcode 14+ style)
const ios = path.join(root, 'ios/Kanal/Assets.xcassets/AppIcon.appiconset');
if (fs.existsSync(ios)) await sharp(svg(1024, 0.62)).flatten({ background: '#17110c' }).png().toFile(path.join(ios, 'icon-1024.png'));
console.log('icons written');
