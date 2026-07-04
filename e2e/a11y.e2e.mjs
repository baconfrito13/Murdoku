// Automated accessibility audit with axe-core (dev-only tool; the library is
// injected into the page at test time, never shipped).
// Run: node e2e/a11y.e2e.mjs   (expects axe-core resolvable — see AXE_PATH)

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const AXE_CANDIDATES = [
  new URL('../node_modules/axe-core/axe.min.js', import.meta.url).pathname,
  '/tmp/claude-0/-home-user-gpt-apps/bde30e76-65a2-58fc-b7ea-e79fdbbf8917/scratchpad/icons/node_modules/axe-core/axe.min.js',
];
const AXE_PATH = AXE_CANDIDATES.find((p) => existsSync(p));
if (!AXE_PATH) { console.error('axe-core not found — npm i -D axe-core'); process.exit(2); }
const AXE_SRC = readFileSync(AXE_PATH, 'utf8');

const PORT = 8361;
const server = spawn('npx', ['http-server', '-p', String(PORT), '-c-1', '--silent', '.'], {
  cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function audit(label) {
  await page.evaluate(AXE_SRC);
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    return r.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      count: v.nodes.length,
    }));
  });
  console.log(`\n== ${label}: ${result.length} violation type(s)`);
  for (const v of result) {
    console.log(`  [${v.impact}] ${v.id} — ${v.help} (${v.count} node(s))`);
    for (const t of v.nodes) console.log(`      ${t}`);
  }
  return result.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

let serious = [];
await page.goto(`http://127.0.0.1:${PORT}`);
await page.waitForSelector('#screen-home:not([hidden])');
serious = serious.concat(await audit('home (dark)'));

await page.click('#btn-theme');
serious = serious.concat(await audit('home (light)'));
await page.click('#btn-theme');

await page.click('.case-card:first-child');
await page.waitForSelector('#dlg-story[open]');
serious = serious.concat(await audit('story dialog'));
await page.click('#dlg-story [data-close]');
serious = serious.concat(await audit('game board'));

await browser.close();
server.kill();

if (serious.length) {
  console.error(`\n${serious.length} SERIOUS/CRITICAL a11y violation(s)`);
  process.exit(1);
}
console.log('\nA11Y AUDIT PASSED (no serious/critical violations)');
