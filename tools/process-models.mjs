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
