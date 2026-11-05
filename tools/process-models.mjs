// Turns the downloaded source models (models-src/) into the small, table-ready GLBs the app ships (public/models/).
// Each model is welded, simplified to a triangle budget, its textures resized to 1024 px JPEG/PNG,
// re-centred (middle of the footprint at the origin, bottom resting on y = 0) and scaled to real-world size in metres.
// No Draco/meshopt geometry compression on purpose: Filament (Android), RealityKit (via USDZ) and model-viewer all read plain glTF.
//   node tools/process-models.mjs            all dishes
//   node tools/process-models.mjs prime-rib  one dish
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, textureCompress, prune, getBounds, flatten, join, resample } from '@gltf-transform/functions';
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
function smoothNormals(doc) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
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
