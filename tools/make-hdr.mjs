// Writes public/env/hearth.hdr: the restaurant light every dish is shown in (web viewer, posters).
// A dark room, a large warm key overhead and a little in front, an amber rim behind (the wood fire), a soft fill from
// the front right and a brown bounce from the walnut table. Equirectangular, three.js convention, camera on +Z.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const W = 512, H = 256;
const norm = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const lights = [
  { dir: norm([-0.3, 0.88, 0.38]), col: [1.0, 0.8, 0.56], radius: 20, power: 7.5 },   // key softbox
  { dir: norm([0.55, 0.3, -0.78]), col: [1.0, 0.6, 0.28], radius: 12, power: 5.0 },   // ember rim
  { dir: norm([0.75, 0.2, 0.62]), col: [0.92, 0.86, 0.8], radius: 34, power: 0.45 },  // fill
];
const deg = Math.PI / 180;
const px = new Float32Array(W * H * 3);
for (let r = 0; r < H; r++) {
  const v = 1 - (r + 0.5) / H, lat = (v - 0.5) * Math.PI, y = Math.sin(lat), cl = Math.cos(lat);
  for (let c = 0; c < W; c++) {
    const a = ((c + 0.5) / W - 0.5) * 2 * Math.PI, d = [Math.cos(a) * cl, y, Math.sin(a) * cl];
    let col = y > 0 ? [0.03, 0.022, 0.016].map(k => k * (0.6 + 0.4 * y)) : [0.085, 0.052, 0.028].map(k => k * (0.5 + 0.5 * -y));
    for (const L of lights) {
      const ang = Math.acos(Math.min(1, d[0] * L.dir[0] + d[1] * L.dir[1] + d[2] * L.dir[2])) / deg;
      const t = Math.min(1, Math.max(0, (L.radius - ang) / (L.radius * 0.35)));
      const s = t * t * (3 - 2 * t) * L.power;
      col = col.map((k, i) => k + L.col[i] * s);
    }
    px.set(col, (r * W + c) * 3);
  }
}
const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`);
const body = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const [R, G, B] = [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]], m = Math.max(R, G, B);
  if (m < 1e-32) continue;
  const e = Math.ceil(Math.log2(m)), f = 256 / 2 ** e;
  body[i * 4] = Math.min(255, R * f); body[i * 4 + 1] = Math.min(255, G * f); body[i * 4 + 2] = Math.min(255, B * f); body[i * 4 + 3] = e + 128;
}
fs.writeFileSync(path.join(root, 'public/env/hearth.hdr'), Buffer.concat([head, body]));
console.log('hearth.hdr', Math.round((head.length + body.length) / 1024), 'KB');
