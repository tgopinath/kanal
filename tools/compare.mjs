import { chromium } from 'playwright';
const [id, ...extra] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1040, height: 520 } });
await p.goto(`http://localhost:5310/tools/compare.html?id=${id}&old=1&${extra.join('&')}`);
await p.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
await p.screenshot({ path: `/private/tmp/claude-502/-Users-gopi-4423-Documents/b733d8d4-f360-4f41-8ea2-267f0e7f9700/scratchpad/cmp-${id}.jpg`, quality: 85 });
await b.close();
