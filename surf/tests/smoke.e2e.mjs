// End-to-end smoke test (Playwright, global install): boots Maresia with the
// Open-Meteo APIs blocked so it must fall back to data/snapshot.json, then
// walks every screen and the main interactions, failing on any page error.
// Run: node surf/tests/smoke.e2e.mjs            (needs surf/data/snapshot.json)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(normalize(root))) throw new Error('forbidden');
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ FAIL: ${label}`);
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-PT', timezoneId: 'Europe/Lisbon' });
await ctx.route(/open-meteo\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort('blockedbyclient'));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${base}#agora`);
await page.waitForSelector('.hero-name', { timeout: 15000 });
check(/Previsão de|Arquivo/.test(await page.textContent('#data-status')), 'falls back to the bundled snapshot');
check((await page.$$('.hero .reasons li')).length > 0, 'hero explains its score');
check((await page.$$('.rows .row')).length > 0, 'runner-up spots listed');

await page.click('.sport-tab[data-sport="kitesurf"]');
check(await page.getAttribute('.sport-tab[data-sport="kitesurf"]', 'aria-selected') === 'true', 'switches sport');
await page.click('.sport-tab[data-sport="surf"]');

await page.click('#tabbar .tab[href="#costa"]');
await page.waitForSelector('.heat');
const cell = await page.$('.heat td.c button:not([disabled])');
check(!!cell, 'heatmap has cells');
await cell.click();
await page.waitForSelector('.spot-name');
check(page.url().includes('#spot-'), 'heatmap cell opens a spot');
check((await page.$$('.fchart .sbar')).length > 20, 'spot chart drawn');
const before = await page.textContent('[data-when]');
await page.click('[data-step="1"]');
check((await page.textContent('[data-when]')) !== before, 'time cursor steps forward');

await page.click('#tabbar .tab[href="#mapa"]');
await page.waitForSelector('.map-svg .pin');
const pin = await page.$('.map-svg .pin');
const box = await pin.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(300);
check((await page.$$('.map-svg .pin')).length > 3, 'map shows pins');

for (const r of ['spots', 'favoritos', 'definicoes']) {
  await page.evaluate((h) => { location.hash = h; }, `#${r}`);
  await page.waitForTimeout(300);
  check((await page.innerHTML('#main')).length > 2000, `#${r} renders`);
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);

await browser.close();
server.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nsmoke test passed');
