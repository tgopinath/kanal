// Writes public/env/counter.jpg: Bun Kadai's counter top, dark brushed steel with a faint warm cast (procedural).
import sharp from 'sharp';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const N = 1600, rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
// Long horizontal grain: a narrow column of noise stretched across the width.
const col = Buffer.alloc(48 * N); for (let i = 0; i < col.length; i++) col[i] = 128 + (rnd() - 0.5) * 120;
const grain = await sharp(col, { raw: { width: 48, height: N, channels: 1 } }).resize(N, N, { kernel: 'cubic', fit: 'fill' }).raw().toBuffer();
const fine = Buffer.alloc(N * N); for (let i = 0; i < fine.length; i++) fine[i] = 128 + (rnd() - 0.5) * 50;
const out = Buffer.alloc(N * N * 3);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = y * N + x;
  const v = 34 + (grain[i] - 128) * 0.09 + (fine[i] - 128) * 0.06 + Math.sin((x + y * 0.02) / 90) * 1.5;
  out[i * 3] = Math.max(0, Math.min(255, v + 3)); out[i * 3 + 1] = Math.max(0, Math.min(255, v + 1)); out[i * 3 + 2] = Math.max(0, Math.min(255, v - 1));
}
await sharp(out, { raw: { width: N, height: N, channels: 3 } }).jpeg({ quality: 84 }).toFile(path.join(root, 'public/env/counter.jpg'));
console.log('counter.jpg');
