import fs from 'fs'; import path from 'path';
for (const a of process.argv.slice(2)) {
  const f = await (await fetch(`https://api.polyhaven.com/files/${a}`)).json();
  const res = f.gltf['2k'] ? '2k' : Object.keys(f.gltf)[0];
  const g = f.gltf[res].gltf;
  fs.mkdirSync(a, { recursive: true });
  const dl = async (url, p) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(await (await fetch(url)).arrayBuffer())); };
  await dl(g.url, `${a}/${a}.gltf`);
  for (const [rel, v] of Object.entries(g.include || {})) await dl(v.url, path.join(a, rel));
  console.log(a, res, 'ok');
}
