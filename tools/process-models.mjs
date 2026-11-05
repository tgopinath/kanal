// Turns the downloaded source models (models-src/) into the small, table-ready GLBs the app ships (public/models/).
// Each model is welded, simplified to a triangle budget, its textures resized to 1024 px JPEG/PNG,
// re-centred (middle of the footprint at the origin, bottom resting on y = 0) and scaled to real-world size in metres.
// No Draco/meshopt geometry compression on purpose: Filament (Android), RealityKit (via USDZ) and model-viewer all read plain glTF.
//   node tools/process-models.mjs            all dishes
//   node tools/process-models.mjs prime-rib  one dish
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, dedup, weld, simplify, textureCompress, prune, getBounds, flatten, join, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dishes = JSON.parse(fs.readFileSync(path.join(root, 'tools/dishes-src.json'), 'utf8'));
const only = process.argv[2];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

for (const d of dishes) {
  if (only && d.id !== only) continue;
  const src = path.join(root, 'models-src', d.src);
  const doc = await io.read(src);
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];

  // Optional re-arrangement of a multi-part source (e.g. a tea set laid out as a catalogue sheet).
  if (d.compose) {
    const nodes = Object.fromEntries(doc.getRoot().listNodes().map(n => [n.getName(), n]));
    const keep = new Set();
    const delta = {};
    for (const c of d.compose) {
      const n = nodes[c.node]; keep.add(n);
      if (c.with) { delta[c.node] = delta[c.with]; }
      else {
        const b = getBounds(n);
        delta[c.node] = [c.at[0] - (b.min[0] + b.max[0]) / 2, c.at[1] - b.min[1], c.at[2] - (b.min[2] + b.max[2]) / 2];
      }
      const t = n.getTranslation();
      n.setTranslation([t[0] + delta[c.node][0], t[1] + delta[c.node][1], t[2] + delta[c.node][2]]);
    }
    for (const n of doc.getRoot().listNodes()) if (n.getMesh() && !keep.has(n)) n.dispose();
  }
  // Optional: drop the flat scan ground (paper/turntable) under the food: triangles whose world-space
  // vertices all sit in the bottom `trimBelow` fraction of the model's height.
  // Proper cut-out: drop scan-ground triangles by their real texture colour, then any loose fragments.
  if (d.remove) await removeByColour(doc, scene, d.remove);
  if (d.islands) dropIslands(doc, d.islands);
  if (d.trimBelow) {
    const b0 = getBounds(scene);
    const cut = b0.min[1] + d.trimBelow * (b0.max[1] - b0.min[1]);
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const m = node.getWorldMatrix();
      const wy = v => m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION'), idx = prim.getIndices();
        if (!idx) continue;
        const a = idx.getArray(), keepIdx = [], v = [0, 0, 0];
        for (let k = 0; k < a.length; k += 3) {
          let low = true;
          for (let j = 0; j < 3; j++) { pos.getElement(a[k + j], v); if (wy(v) > cut) { low = false; break; } }
          if (!low) keepIdx.push(a[k], a[k + 1], a[k + 2]);
        }
        idx.setArray(new (a.constructor)(keepIdx));
      }
    }
  }

  await doc.transform(
    dedup(),
    flatten(),
    join(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 1, error: 0.0005, lockBorder: true }),
    textureCompress({ encoder: sharp, resize: [1024, 1024], targetFormat: undefined, quality: 82 }),
    prune(),
  );

  if (d.look) {
    // Lit, the scans' faceted vertex normals show as flat triangles; recompute smooth ones.
    await doc.transform(weld());
    smoothNormals(doc);
    await enhanceLook(doc, d.look);
  }

  // Ratio pass: keep simplifying until we're inside the triangle budget.
  const tris = () => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  let t = tris();
  if (t > d.maxTris) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: d.maxTris / t, error: 0.01 }), prune());
  }
  t = tris();

  // Wrap everything in one root node and fix orientation, centre and scale.
  const wrapper = doc.createNode('dish');
  for (const child of scene.listChildren()) { scene.removeChild(child); wrapper.addChild(child); }
  scene.addChild(wrapper);
  if (d.rotate) wrapper.setRotation(d.rotate); // quaternion [x,y,z,w]
  let b = getBounds(scene);
  const ext = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const measure = d.fit === 'height' ? ext[1] : Math.max(ext[0], ext[2]);
  const s = d.size / measure;
  wrapper.setScale([s, s, s]);
  b = getBounds(scene);
  const c = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
  const outer = doc.createNode('kanal-' + d.id);
  scene.removeChild(wrapper); outer.addChild(wrapper); scene.addChild(outer);
  outer.setTranslation([-c[0], -c[1], -c[2]]);
  b = getBounds(scene);

  // A clean modelled vessel in place of a broken scanned one; the food is lifted onto it.
  if (d.vessel) {
    if (d.vessel.src) {
      await addModelVessel(doc, scene, outer, d.vessel);
      await doc.transform(textureCompress({ encoder: sharp, resize: [1024, 1024], targetFormat: 'jpeg', quality: 82 }), prune());
    } else addVessel(doc, scene, outer, d.vessel);
    b = getBounds(scene);
  }

  const out = path.join(root, 'public/models', d.id + '.glb');
  await io.write(out, doc);
  // A lighter copy for iOS: USDZ stores geometry as text, so big scans are simplified further before tools/usdz.mjs converts them.
  const iosTris = d.iosTris || 24000;
  fs.mkdirSync(path.join(root, 'models-src/ios'), { recursive: true });
  if (t > iosTris) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: iosTris / t, error: 0.08 }), prune());
  await io.write(path.join(root, 'models-src/ios', d.id + '.glb'), doc);
  const kb = Math.round(fs.statSync(out).size / 1024);
  const dims = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].map(v => (v * 100).toFixed(1) + 'cm');
  console.log(`${d.id.padEnd(16)} ${String(Math.round(t)).padStart(7)} tris  ${String(kb).padStart(5)} KB  ${dims.join(' x ')}`);
}

// Scans arrive with roughness 1 and no normal map, so under any light they read as chalk. From each scan's own colour
// texture this builds (a) a normal map from luminance detail, so grill marks, crumb and flakes catch the light, and
// (b) a packed map: G = roughness, R = a gloss mask (saturated, darker pixels: meat, glaze, fish) that also drives an
// optional clearcoat, so juices shine while boards, bread and pastry stay matte.
//   look: { rough: [glossy, matte], normal: strength, coat: 0..1, coatRough, sat: base-colour saturation boost }
async function enhanceLook(doc, look) {
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_materials_unlit') e.dispose();
  const done = new Map();
  for (const m of doc.getRoot().listMaterials()) {
    const base = m.getBaseColorTexture();
    if (!base || m.getNormalTexture()) continue;
    let maps = done.get(base);
    if (!maps) {
      const img = Buffer.from(base.getImage());
      if (look.sat) base.setImage(await sharp(img).modulate({ saturation: look.sat }).jpeg({ quality: 90 }).toBuffer()).setMimeType('image/jpeg');
      const { data: rgb, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height;
      const { data: hgt } = await sharp(img).removeAlpha().greyscale().blur(1.1).raw().toBuffer({ resolveWithObject: true });
      const nrm = Buffer.alloc(W * H * 3), orm = Buffer.alloc(W * H * 3);
      const [r0, r1] = look.rough, k = (look.normal ?? 1) * 4, cl = 0.12;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const h = (xx, yy) => hgt[Math.min(H - 1, Math.max(0, yy)) * W + Math.min(W - 1, Math.max(0, xx))] / 255;
        // Clamp the slope so the black gaps between UV islands don't draw seams.
        let dx = Math.max(-cl, Math.min(cl, h(x + 1, y) - h(x - 1, y))) * k;
        let dy = Math.max(-cl, Math.min(cl, h(x, y + 1) - h(x, y - 1))) * k;
        const len = Math.hypot(dx, dy, 1);
        nrm[i * 3] = (-dx / len * 0.5 + 0.5) * 255; nrm[i * 3 + 1] = (dy / len * 0.5 + 0.5) * 255; nrm[i * 3 + 2] = (1 / len * 0.5 + 0.5) * 255;
        const R = rgb[i * 3] / 255, G = rgb[i * 3 + 1] / 255, B = rgb[i * 3 + 2] / 255;
        const mx = Math.max(R, G, B), mn = Math.min(R, G, B), lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        const sat = mx ? (mx - mn) / mx : 0;
        const gloss = Math.min(1, Math.max(0, (sat - 0.28) / 0.45)) * Math.min(1, Math.max(0, (0.92 - lum) / 0.55));
        orm[i * 3] = gloss * 255; orm[i * 3 + 1] = (r1 - (r1 - r0) * gloss) * 255; orm[i * 3 + 2] = 0;
      }
      const tex = (buf, name) => doc.createTexture(name).setMimeType('image/jpeg');
      const nTex = tex(null, 'normal').setImage(await sharp(nrm, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90 }).toBuffer());
      const oTex = tex(null, 'gloss-roughness').setImage(await sharp(orm, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88 }).toBuffer());
      maps = { nTex, oTex };
      done.set(base, maps);
    }
    // Scans ship as KHR_materials_unlit (flat albedo, no response to light at all); make them lit PBR.
    m.setExtension('KHR_materials_unlit', null);
    // The scan's colour already has the capture light baked in; lit on top of that it goes muddy. Feeding part of it
    // back as emission keeps the scan's true colour, while the lit part adds shape, highlights and gloss.
    m.setEmissiveTexture(base).setEmissiveFactor([look.glow ?? 0.5, look.glow ?? 0.5, look.glow ?? 0.5]);
    m.setNormalTexture(maps.nTex).setNormalScale(0.45);
    m.setMetallicRoughnessTexture(maps.oTex).setRoughnessFactor(1).setMetallicFactor(0);
    if (look.coat) {
      const ext = doc.createExtension(KHRMaterialsClearcoat);
      m.setExtension('KHR_materials_clearcoat', ext.createClearcoat()
        .setClearcoatFactor(look.coat).setClearcoatTexture(maps.oTex).setClearcoatRoughnessFactor(look.coatRough ?? 0.25));
    }
  }
}

// Area-weighted smooth normals, averaged by position so UV seams (split vertices) don't leave creases.
function smoothNormals(doc, only) {
  for (const mesh of (only ? [only] : doc.getRoot().listMeshes())) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices();
    if (!pos || !idx) continue;
    const P = pos.getArray(), I = idx.getArray(), n = pos.getCount();
    const key = new Int32Array(n), map = new Map();
    for (let v = 0; v < n; v++) {
      const k = `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`;
      let id = map.get(k); if (id === undefined) { id = map.size; map.set(k, id); }
      key[v] = id;
    }
    const acc = new Float64Array(map.size * 3);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [I[t], I[t + 1], I[t + 2]]) { acc[key[v] * 3] += nx; acc[key[v] * 3 + 1] += ny; acc[key[v] * 3 + 2] += nz; }
    }
    const N = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const x = acc[key[v] * 3], y = acc[key[v] * 3 + 1], z = acc[key[v] * 3 + 2], l = Math.hypot(x, y, z) || 1;
      N[v * 3] = x / l; N[v * 3 + 1] = y / l; N[v * 3 + 2] = z / l;
    }
    let attr = prim.getAttribute('NORMAL');
    if (!attr) { attr = doc.createAccessor().setType('VEC3').setBuffer(pos.getBuffer()); prim.setAttribute('NORMAL', attr); }
    attr.setArray(N);
  }
}

// ---------- cut-out helpers ----------
// rules: [{ below?: 0..1 (fraction of height from the bottom), above?: 0..1, sat?: [min,max], lum?: [min,max], hue?: [min,max] (deg) }]
async function removeByColour(doc, scene, rules) {
  const b0 = getBounds(scene), H = b0.max[1] - b0.min[1];
  const cache = new Map();
  const pixels = async tex => {
    if (!cache.has(tex)) {
      const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      cache.set(tex, { data, W: info.width, H: info.height });
    }
    return cache.get(tex);
  };
  let removed = 0, total = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
      const tex = prim.getMaterial()?.getBaseColorTexture();
      if (!idx || !uv || !tex) continue;
      const px = await pixels(tex);
      const a = idx.getArray(), keep = [], v = [0, 0, 0], t = [0, 0];
      for (let k = 0; k < a.length; k += 3) {
        let y = 0, u = 0, w = 0;
        // Sample the colour at the three corners and the centre; a triangle goes only if all of them match.
        const samples = [];
        for (let j = 0; j < 3; j++) {
          pos.getElement(a[k + j], v); y += m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
          uv.getElement(a[k + j], t); u += t[0]; w += t[1]; samples.push([t[0], t[1]]);
        }
        samples.push([u / 3, w / 3]);
        const f = (y / 3 - b0.min[1]) / H;
        let rx = 0, rz = 0;
        for (let j = 0; j < 3; j++) { pos.getElement(a[k + j], v); rx += m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]; rz += m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]; }
        const rad = Math.hypot(rx / 3 - (b0.min[0] + b0.max[0]) / 2, rz / 3 - (b0.min[2] + b0.max[2]) / 2) / (Math.max(b0.max[0] - b0.min[0], b0.max[2] - b0.min[2]) / 2);
        total++;
        const hit = rules.some(r => {
          if (r.below != null && f > r.below) return false;
          if (r.above != null && f < r.above) return false;
          if (r.outside != null && rad < r.outside) return false;
          return samples.every(([su, sv]) => {
            const x = Math.min(px.W - 1, Math.max(0, Math.floor((su - Math.floor(su)) * px.W)));
            const yy = Math.min(px.H - 1, Math.max(0, Math.floor((sv - Math.floor(sv)) * px.H)));
            const i = (yy * px.W + x) * 3, R = px.data[i] / 255, G = px.data[i + 1] / 255, B = px.data[i + 2] / 255;
            const mx = Math.max(R, G, B), mn = Math.min(R, G, B), lum = 0.2126 * R + 0.7152 * G + 0.0722 * B, sat = mx ? (mx - mn) / mx : 0;
            let hue = 0;
            if (mx !== mn) hue = mx === R ? 60 * (((G - B) / (mx - mn)) % 6) : mx === G ? 60 * ((B - R) / (mx - mn) + 2) : 60 * ((R - G) / (mx - mn) + 4);
            if (hue < 0) hue += 360;
            return (!r.sat || (sat >= r.sat[0] && sat <= r.sat[1])) && (!r.lum || (lum >= r.lum[0] && lum <= r.lum[1])) && (!r.hue || (hue >= r.hue[0] && hue <= r.hue[1]));
          });
        });
        if (hit) removed++; else keep.push(a[k], a[k + 1], a[k + 2]);
      }
      idx.setArray(new (a.constructor)(keep));
    }
  }
  console.log(`  colour cut: ${removed} of ${total} triangles`);
}

// Drops connected pieces smaller than `minFrac` of the model's total surface area (flecks, torn skirt, floating crumbs).
function dropIslands(doc, minFrac) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(); if (!pos || !idx) continue;
    const P = pos.getArray(), I = idx.getArray(), n = pos.getCount();
    const map = new Map(), key = new Int32Array(n);
    for (let v = 0; v < n; v++) {
      const k = `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`;
      let id = map.get(k); if (id === undefined) { id = map.size; map.set(k, id); } key[v] = id;
    }
    const par = new Int32Array(map.size).map((_, i) => i);
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (let t = 0; t < I.length; t += 3) { const a = find(key[I[t]]), b = find(key[I[t + 1]]), c = find(key[I[t + 2]]); par[b] = a; par[find(c)] = a; }
    const area = new Map(); let tot = 0;
    const triArea = t => {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    };
    for (let t = 0; t < I.length; t += 3) { const r = find(key[I[t]]), A = triArea(t); area.set(r, (area.get(r) || 0) + A); tot += A; }
    const keep = [];
    let dropped = 0;
    for (let t = 0; t < I.length; t += 3) { if (area.get(find(key[I[t]])) >= minFrac * tot) keep.push(I[t], I[t + 1], I[t + 2]); else dropped++; }
    idx.setArray(new (I.constructor)(keep));
    console.log(`  islands: dropped ${dropped} triangles in ${[...area.values()].filter(a => a < minFrac * tot).length} pieces`);
  }
}

// vessel: { kind: 'plate' | 'slate', color: [r,g,b] linear, rough, pad (x food footprint), clearcoat? }
async function addModelVessel(doc, scene, food, v) {
  const b = getBounds(scene);
  const src = await io.read(path.join(root, 'models-src', v.src));
  const before = new Set(doc.getRoot().listNodes());
  mergeDocuments(doc, src);
  await doc.transform(unpartition());
  const holder = doc.createNode(v.kind);
  for (const sc of doc.getRoot().listScenes()) if (sc !== scene) { for (const c of sc.listChildren()) holder.addChild(c); sc.dispose(); }
  scene.addChild(holder);
  if (v.rotate) holder.setRotation(v.rotate);
  let vb = getBounds(holder);
  const fx = b.max[0] - b.min[0], fz = b.max[2] - b.min[2];
  const vx = vb.max[0] - vb.min[0], vz = vb.max[2] - vb.min[2];
  const k = Math.max(fx / vx, fz / vz) * (v.pad ?? 1.12);
  holder.setScale([k, k, k]);
  vb = getBounds(holder);
  holder.setTranslation([(b.min[0] + b.max[0]) / 2 - (vb.min[0] + vb.max[0]) / 2, -vb.min[1], (b.min[2] + b.max[2]) / 2 - (vb.min[2] + vb.max[2]) / 2]);
  vb = getBounds(holder);
  const t = food.getTranslation();
  food.setTranslation([t[0], t[1] + vb.max[1] - (v.sink ?? 0.002), t[2]]);
}

function addVessel(doc, scene, food, v) {
  const b = getBounds(scene);
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const fx = b.max[0] - b.min[0], fz = b.max[2] - b.min[2];
  const buf = doc.getRoot().listBuffers()[0];
  const pos = [], idx = [];
  let top;
  if (v.kind === 'plate') {
    const R = Math.max(fx, fz) / 2 * (v.pad ?? 1.18), seg = 128;
    // Lathe profile (radius, height), top surface from the centre out over the rim and back under.
    const prof = [[0, 0.006], [0.7, 0.006], [0.8, 0.008], [0.9, 0.016], [0.97, 0.021], [1, 0.02], [1, 0.016], [0.95, 0.012], [0.62, 0.003], [0.58, 0], [0, 0]];
    top = 0.006;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      for (const [r, y] of prof) pos.push(cx + Math.cos(a) * r * R, y, cz + Math.sin(a) * r * R);
    }
    const L = prof.length;
    for (let i = 0; i < seg; i++) for (let j = 0; j < L - 1; j++) {
      const a = i * L + j, b2 = (i + 1) * L + j;
      idx.push(a, a + 1, b2, b2, a + 1, b2 + 1);
    }
  } else {
    // A rounded slab: superellipse outline, flat top, small bevel.
    const W = fx * (v.pad ?? 1.12) / 2, D = fz * (v.pad ?? 1.12) / 2, h = v.height ?? 0.014, seg = 160, e = 0.18;
    top = h;
    const ring = (sx, sz, y) => { for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(cx + Math.sign(c) * Math.abs(c) ** e * sx, y, cz + Math.sign(s) * Math.abs(s) ** e * sz); } };
    pos.push(cx, h, cz); ring(W - 0.004, D - 0.004, h); ring(W, D, h - 0.004); ring(W, D, 0.002); ring(W - 0.003, D - 0.003, 0); pos.push(cx, 0, cz);
    const c0 = 0, r1 = 1, last = 1 + seg * 4;
    for (let i = 0; i < seg; i++) { const n = (i + 1) % seg; idx.push(c0, r1 + n, r1 + i); }
    for (let r = 0; r < 3; r++) for (let i = 0; i < seg; i++) { const n = (i + 1) % seg, a = r1 + r * seg; idx.push(a + i, a + n, a + seg + i, a + seg + i, a + n, a + seg + n); }
    for (let i = 0; i < seg; i++) { const n = (i + 1) % seg, a = r1 + 3 * seg; idx.push(last, a + i, a + n); }
  }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf))
    .setMaterial(doc.createMaterial(v.kind).setBaseColorFactor([...v.color, 1]).setRoughnessFactor(v.rough ?? 0.4).setMetallicFactor(0));
  if (v.clearcoat) {
    const ext = doc.createExtension(KHRMaterialsClearcoat);
    prim.getMaterial().setExtension('KHR_materials_clearcoat', ext.createClearcoat().setClearcoatFactor(v.clearcoat).setClearcoatRoughnessFactor(0.08));
  }
  const mesh = doc.createMesh(v.kind).addPrimitive(prim);
  smoothNormals(doc, mesh);
  // Lift the food so it rests in the vessel's well (it may sink a little into it, like food does).
  const t = food.getTranslation();
  food.setTranslation([t[0], t[1] + top - (v.sink ?? 0.002), t[2]]);
  scene.addChild(doc.createNode(v.kind).setMesh(mesh));
}
