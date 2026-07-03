// End-to-end play-through with Playwright (plain script, global install).
// Run: node e2e/game.e2e.mjs [--headed]
// Serves the site on :8347, then drives a real Chromium through:
//   home → case 1 full win, hints, X-marks, undo/redo, wrong accusation,
//   mobile viewport sanity, console-error watchdog, screenshots.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { CAMPAIGN_CASES } from '../js/cases-data.js';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const PORT = 8347;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failures++; console.error(`  ✗ FAIL: ${label}`); }
};

// ---------------------------------------------------------------------------
const server = spawn('npx', ['http-server', '-p', String(PORT), '-c-1', '--silent', '.'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
});

try {
  // ------------------------------------------------------------- home
  console.log('HOME');
  await page.goto(BASE);
  await page.waitForSelector('#screen-home:not([hidden])');
  check(await page.locator('.case-card').count() === CAMPAIGN_CASES.length,
    `home lists ${CAMPAIGN_CASES.length} campaign cases`);
  check(await page.locator('#btn-daily').isVisible(), 'daily button visible');
  await page.screenshot({ path: `${SHOTS}01-home.png`, fullPage: true });

  // help dialog
  await page.click('#btn-help');
  check(await page.locator('#dlg-help[open]').count() === 1, 'help dialog opens');
  await page.click('#dlg-help [data-close]');

  // ------------------------------------------------------------- case 1: win
  console.log('CASE 1 — full win');
  const case1 = CAMPAIGN_CASES[0];
  await page.click('.case-card:first-child');
  await page.waitForSelector('#screen-game:not([hidden])');
  check(await page.locator('#game-title').textContent() === case1.title, 'case title shown');
  // story dialog auto-opens
  await page.waitForSelector('#dlg-story[open]');
  await page.click('#dlg-story [data-close]');

  const cellCount = await page.locator('#board .cell').count();
  check(cellCount === case1.size * case1.size, `board has ${case1.size}×${case1.size} cells`);
  const furnCount = await page.locator('#board .cell.furniture').count();
  check(furnCount === Object.keys(case1.furniture).length, 'furniture rendered');

  // X-mark via right-click on some empty floor cell (not a solution cell)
  const solutionCells = new Set(Object.values(case1.solution));
  const givenPids = new Set(Object.keys(case1.givens ?? {}));
  let freeCell = -1;
  for (let i = 0; i < case1.size * case1.size; i++) {
    if (!case1.furniture[i] && !solutionCells.has(i)) { freeCell = i; break; }
  }
  await page.click(`#board .cell[data-cell="${freeCell}"]`, { button: 'right' });
  check(await page.locator(`#board .cell[data-cell="${freeCell}"] .xmark`).count() === 1,
    'right-click adds an ✕ mark');
  await page.click(`#board .cell[data-cell="${freeCell}"]`, { button: 'right' });
  check(await page.locator(`#board .cell[data-cell="${freeCell}"] .xmark`).count() === 0,
    'right-click again removes the ✕');

  // hint flow: use a hint for the first unplaced person
  await page.click('#tool-hint');
  await page.waitForSelector('#dlg-hint[open]');
  const hintText = await page.locator('#hint-text').textContent();
  check(hintText.length > 20, 'hint gives a reasoned explanation');
  await page.click('#hint-apply');
  check(await page.locator('#board .pawn').count() >= 1 + Object.keys(case1.givens ?? {}).length,
    'hint placement lands on the board');

  // undo the hint placement, then redo it
  const pawnsAfterHint = await page.locator('#board .pawn').count();
  await page.click('#tool-undo');
  check(await page.locator('#board .pawn').count() === pawnsAfterHint - 1, 'undo removes the pawn');
  await page.click('#tool-redo');
  check(await page.locator('#board .pawn').count() === pawnsAfterHint, 'redo restores the pawn');

  // place everyone per the frozen solution (skip givens & already-placed)
  for (const person of case1.people) {
    if (givenPids.has(person.id)) continue;
    const target = case1.solution[person.id];
    const already = await page.locator(`#board .cell[data-cell="${target}"] .pawn`).count();
    if (already) continue; // hint already placed this one
    await page.click(`.suspect-card[data-pid="${person.id}"]`);
    await page.click(`#board .cell[data-cell="${target}"]`);
  }
  check(await page.locator('#board .pawn').count() === case1.size, 'all people placed');
  check(await page.locator('.clue-item.bad').count() === 0, 'no clue shows as violated');
  await page.screenshot({ path: `${SHOTS}02-board-solved.png`, fullPage: true });

  // accuse the murderer
  const accuse = page.locator('#tool-accuse');
  check(await accuse.isEnabled(), 'accuse button unlocks when board is valid');
  await accuse.click();
  await page.waitForSelector('#dlg-accuse[open]');
  await page.click(`#accuse-lineup .lineup-btn:has-text("${
    case1.people.find((p) => p.id === case1.murderer).name}")`);
  await page.waitForSelector('#dlg-verdict[open]');
  check((await page.locator('#verdict-title').textContent()).includes('Case closed'),
    'correct accusation wins the case');
  await page.screenshot({ path: `${SHOTS}03-win.png` });
  await page.click('#verdict-primary'); // more cases
  await page.waitForSelector('#screen-home:not([hidden])');
  check(await page.locator('.case-card:first-child .chip.solved').count() === 1,
    'case marked as solved on home');

  // --------------------------------------------------- case 2: wrong accusation
  console.log('CASE 2 — wrong accusation path');
  const case2 = CAMPAIGN_CASES[1];
  await page.click('.case-card:nth-child(2)');
  await page.waitForSelector('#dlg-story[open]');
  await page.click('#dlg-story [data-close]');
  const givens2 = new Set(Object.keys(case2.givens ?? {}));
  for (const person of case2.people) {
    if (givens2.has(person.id)) continue;
    await page.click(`.suspect-card[data-pid="${person.id}"]`);
    await page.click(`#board .cell[data-cell="${case2.solution[person.id]}"]`);
  }
  await page.click('#tool-accuse');
  await page.waitForSelector('#dlg-accuse[open]');
  const innocent = case2.people.find((p) => !p.isVictim && p.id !== case2.murderer);
  await page.click(`#accuse-lineup .lineup-btn:has-text("${innocent.name}")`);
  await page.waitForSelector('#dlg-verdict[open]');
  check((await page.locator('#verdict-title').textContent()).includes('not convinced'),
    'wrong accusation is rejected');
  await page.click('#verdict-primary'); // keep investigating
  // now accuse correctly
  await page.click('#tool-accuse');
  await page.click(`#accuse-lineup .lineup-btn:has-text("${
    case2.people.find((p) => p.id === case2.murderer).name}")`);
  await page.waitForSelector('#dlg-verdict[open]');
  check((await page.locator('#verdict-title').textContent()).includes('Case closed'),
    'follow-up correct accusation wins');
  await page.click('#verdict-primary');

  // --------------------------------------------------- persistence
  console.log('PERSISTENCE');
  const case3 = CAMPAIGN_CASES[2];
  await page.click('.case-card:nth-child(3)');
  await page.waitForSelector('#dlg-story[open]');
  await page.click('#dlg-story [data-close]');
  const p3 = case3.people.find((p) => !(p.id in (case3.givens ?? {})));
  await page.click(`.suspect-card[data-pid="${p3.id}"]`);
  await page.click(`#board .cell[data-cell="${case3.solution[p3.id]}"]`);
  await page.reload();
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.click('.case-card:nth-child(3)');
  await page.waitForSelector('#screen-game:not([hidden])');
  check(await page.locator('#board .pawn').count()
    === 1 + Object.keys(case3.givens ?? {}).length,
  'placement survives a reload');

  // --------------------------------------------------- keyboard controls
  console.log('KEYBOARD');
  // history does not survive reloads (by design) — make a fresh move, then Ctrl+Z
  const p3b = case3.people.filter((p) => !(p.id in (case3.givens ?? {})))[1];
  const before = await page.locator('#board .pawn').count();
  await page.click(`.suspect-card[data-pid="${p3b.id}"]`);
  await page.click(`#board .cell[data-cell="${case3.solution[p3b.id]}"]`);
  check(await page.locator('#board .pawn').count() === before + 1, 'second pawn placed');
  await page.keyboard.press('Control+z');
  check(await page.locator('#board .pawn').count() === before, 'Ctrl+Z undoes the move');
  await page.click('#btn-back');

  // --------------------------------------------------- mobile viewport
  console.log('MOBILE');
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mob.on('pageerror', (err) => consoleErrors.push(`mobile pageerror: ${err.message}`));
  await mob.goto(BASE);
  await mob.waitForSelector('#screen-home:not([hidden])');
  await mob.click('.case-card:nth-child(4)');
  await mob.waitForSelector('#dlg-story[open]');
  await mob.click('#dlg-story [data-close]');
  const case4 = CAMPAIGN_CASES[3];
  const boardBox = await mob.locator('#board').boundingBox();
  check(boardBox.width <= 390, 'board fits a phone viewport');
  // tap-to-place on touch
  const person4 = case4.people.find((p) => !(p.id in (case4.givens ?? {})));
  await mob.tap(`.suspect-card[data-pid="${person4.id}"]`);
  await mob.tap(`#board .cell[data-cell="${case4.solution[person4.id]}"]`);
  check(await mob.locator('#board .pawn').count()
    === 1 + Object.keys(case4.givens ?? {}).length, 'tap-to-place works on touch');
  await mob.screenshot({ path: `${SHOTS}04-mobile.png`, fullPage: true });
  await mob.close();

  // --------------------------------------------------- console errors
  check(consoleErrors.length === 0,
    `no console errors (got: ${consoleErrors.slice(0, 3).join(' | ') || 'none'})`);
} catch (err) {
  failures++;
  console.error('E2E crashed:', err);
  await page.screenshot({ path: `${SHOTS}99-crash.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.kill();
}

console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} E2E CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
