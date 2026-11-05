// node tools/inspect.mjs <url-path-to-glb> <out.jpg> [orbits]  — three views on magenta, to spot leftover scan ground.
import { chromium } from 'playwright';
const [src, out, orbits] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1200, height: 400 } });
await p.goto(`http://localhost:5310/tools/inspect.html?src=${encodeURIComponent(src)}${orbits ? '&orbits=' + encodeURIComponent(orbits) : ''}`);
await p.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
await p.screenshot({ path: out, quality: 80 });
await b.close();
