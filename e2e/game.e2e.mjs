// End-to-end play-through with Playwright (plain script, global install).
// Run: node e2e/game.e2e.mjs [--headed]
// The player places SUSPECTS only; the victim's square is auto-revealed at
// the crossing of the free row and free column.

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

const suspectsOf = (cse) => cse.people.filter((p) => !p.isVictim);
const victimOf = (cse) => cse.people.find((p) => p.isVictim);

async function placeSuspects(page, cse) {
  for (const person of suspectsOf(cse)) {
    const target = cse.solution[person.id];
    const already = await page.locator(`#board .cell[data-cell="${target}"] .pawn`).count();
    if (already) continue;
    await page.click(`.suspect-card[data-pid="${person.id}"]`);
    await page.click(`#board .cell[data-cell="${target}"]`);
  }
}

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
  await page.screenshot({ path: `${SHOTS}01-home.png`, fullPage: true });

  await page.click('#btn-help');
  check(await page.locator('#dlg-help[open]').count() === 1, 'help dialog opens');
  check((await page.locator('.help-kbd').textContent()).includes('Ctrl'), 'help lists shortcuts');
  await page.click('#dlg-help [data-close]');

  // ------------------------------------------------------------- case 1: win
  console.log('CASE 1 — full win with victim reveal');
  const case1 = CAMPAIGN_CASES[0];
  await page.click('.case-card:first-child');
  await page.waitForSelector('#screen-game:not([hidden])');
  await page.waitForSelector('#dlg-story[open]');
  await page.click('#dlg-story [data-close]');

  const cellCount = await page.locator('#board .cell').count();
  check(cellCount === case1.size * case1.size, `board has ${case1.size}×${case1.size} cells`);
  check(await page.locator('#board .cell .icon.furn').count()
    === Object.keys(case1.furniture).length, 'furniture rendered as SVG icons');
  check(await page.locator('#board .room-tag').count() === case1.rooms.length,
    'each room shows its name tag on the map');
  check(await page.locator('.suspect-card .avatar-mono').first().textContent() !== '',
    'monogram avatars rendered (no emojis)');

  // victim card is informational, not placeable
  const victim1 = victimOf(case1);
  await page.click(`.suspect-card[data-pid="${victim1.id}"]`);
  check(await page.locator(`.suspect-card[data-pid="${victim1.id}"][aria-pressed="true"]`).count() === 0,
    'victim card cannot be armed for placement');

  // accuse gated + explains itself
  const accuse = page.locator('#tool-accuse');
  check(await accuse.getAttribute('aria-disabled') === 'true', 'accuse starts gated');
  await accuse.click({ force: true });
  check(await page.locator('#dlg-accuse[open]').count() === 0, 'gated accuse does not open lineup');

  // X-mark via right-click on some empty floor cell (not a solution cell)
  const solutionCells = new Set(Object.values(case1.solution));
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

  // hint flow
  await page.click('#tool-hint');
  await page.waitForSelector('#dlg-hint[open]');
  const hintText = await page.locator('#hint-text').textContent();
  check(hintText.length > 20, 'hint gives a reasoned explanation');
  await page.click('#hint-apply');
  check(await page.locator('#board .pawn').count() >= 1, 'hint placement lands on the board');

  const pawnsAfterHint = await page.locator('#board .pawn').count();
  await page.click('#tool-undo');
  check(await page.locator('#board .pawn').count() === pawnsAfterHint - 1, 'undo removes the pawn');
  await page.click('#tool-redo');
  check(await page.locator('#board .pawn').count() === pawnsAfterHint, 'redo restores the pawn');

  // place all suspects — the victim must be revealed automatically
  await placeSuspects(page, case1);
  const vCell1 = case1.solution[victim1.id];
  check(await page.locator(`#board .cell[data-cell="${vCell1}"] .victim-pawn`).count() === 1,
    'victim auto-revealed at the free row × free column crossing');
  check(await page.locator('#board .pawn').count() === case1.size,
    'all people visible on the board after the reveal');
  check(await page.locator('.clue-item.bad').count() === 0, 'no clue shows as violated');
  await page.screenshot({ path: `${SHOTS}02-board-solved.png`, fullPage: true });

  // clicking the revealed victim does not remove it
  await page.click(`#board .cell[data-cell="${vCell1}"]`);
  check(await page.locator(`#board .cell[data-cell="${vCell1}"] .victim-pawn`).count() === 1,
    'revealed victim cannot be picked up');

  // accuse the murderer
  check(await accuse.getAttribute('aria-disabled') === 'false',
    'accuse unlocks once the victim is revealed and the board is valid');
  await accuse.click();
  await page.waitForSelector('#dlg-accuse[open]');
  check(await page.locator(`#accuse-lineup .lineup-btn:has-text("${victim1.name}")`).count() === 0,
    'the victim is not in the accusation lineup');
  await page.click(`#accuse-lineup .lineup-btn:has-text("${
    case1.people.find((p) => p.id === case1.murderer).name}")`);
  await page.waitForSelector('#dlg-verdict[open]');
  check((await page.locator('#verdict-title').textContent()).length > 3,
    'correct accusation wins the case');
  await page.screenshot({ path: `${SHOTS}03-win.png` });
  await page.click('#verdict-primary');
  await page.waitForSelector('#screen-home:not([hidden])');
  check(await page.locator('.case-card:first-child .chip.solved').count() === 1,
    'case marked as solved on home');

  // --------------------------------------------------- case 2: wrong accusation
  console.log('CASE 2 — wrong accusation path');
  const case2 = CAMPAIGN_CASES[1];
  await page.click('.case-card:nth-child(2)');
  await page.waitForSelector('#dlg-story[open]');
  await page.click('#dlg-story [data-close]');
  await placeSuspects(page, case2);
  await page.click('#tool-accuse');
  await page.waitForSelector('#dlg-accuse[open]');
  const innocent = suspectsOf(case2).find((p) => p.id !== case2.murderer);
  await page.click(`#accuse-lineup .lineup-btn:has-text("${innocent.name}")`);
  await page.waitForSelector('#dlg-verdict[open]');
  const wrongTitle = await page.locator('#verdict-title').textContent();
  await page.click('#verdict-primary'); // keep investigating
  await page.click('#tool-accuse');
  await page.click(`#accuse-lineup .lineup-btn:has-text("${
    case2.people.find((p) => p.id === case2.murderer).name}")`);
  await page.waitForSelector('#dlg-verdict[open]');
  const rightTitle = await page.locator('#verdict-title').textContent();
  check(wrongTitle !== rightTitle, 'wrong accusation rejected, correct one wins');
  await page.click('#verdict-primary');

  // --------------------------------------------------- persistence
  console.log('PERSISTENCE');
  const case3 = CAMPAIGN_CASES[2];
  await page.click('.case-card:nth-child(3)');
  await page.waitForSelector('#dlg-story[open]');
  await page.click('#dlg-story [data-close]');
  const s3 = suspectsOf(case3)[0];
  await page.click(`.suspect-card[data-pid="${s3.id}"]`);
  await page.click(`#board .cell[data-cell="${case3.solution[s3.id]}"]`);
  await page.reload();
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.click('.case-card:nth-child(3)');
  await page.waitForSelector('#screen-game:not([hidden])');
  check(await page.locator('#board .pawn').count() === 1, 'placement survives a reload');

  // --------------------------------------------------- keyboard
  console.log('KEYBOARD');
  const s3b = suspectsOf(case3)[1];
  const before = await page.locator('#board .pawn').count();
  await page.click(`.suspect-card[data-pid="${s3b.id}"]`);
  await page.click(`#board .cell[data-cell="${case3.solution[s3b.id]}"]`);
  check(await page.locator('#board .pawn').count() === before + 1, 'second pawn placed');
  await page.keyboard.press('Control+z');
  check(await page.locator('#board .pawn').count() === before, 'Ctrl+Z undoes the move');
  await page.click('#btn-back');

  // --------------------------------------------------- Portuguese
  console.log('PORTUGUÊS');
  await page.click('#btn-lang');
  await page.waitForSelector('#screen-home:not([hidden])');
  check((await page.locator('#btn-daily').textContent()).includes('Caso do Dia'),
    'home switches to Portuguese');
  await page.click('.case-card:nth-child(2)'); // campaign case 1 (index shifts if transient present — use :has-text)
  await page.waitForSelector('#screen-game:not([hidden])');
  // story dialog may open; close if so
  if (await page.locator('#dlg-story[open]').count()) await page.click('#dlg-story [data-close]');
  const ptTitleOk = (await page.locator('#game-title').textContent()).length > 3;
  check(ptTitleOk, 'case opens under Portuguese UI');
  const ptClue = await page.locator('.clue-item .clue-quote').first().textContent();
  check(/estava|não/.test(ptClue), `clues render in Portuguese (“${ptClue.slice(0, 40)}…”)`);
  const ptRoomTag = await page.locator('#board .room-tag').first().textContent();
  check(ptRoomTag.length > 2, `room tags translated (“${ptRoomTag}”)`);
  await page.screenshot({ path: `${SHOTS}05-portuguese.png`, fullPage: true });
  await page.click('#btn-back');
  await page.click('#btn-lang'); // back to EN
  await page.waitForSelector('#screen-home:not([hidden])');

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
  const person4 = suspectsOf(case4)[0];
  await mob.tap(`#chip-strip .strip-chip:first-child`);
  await mob.tap(`#board .cell[data-cell="${case4.solution[person4.id]}"]`);
  check(await mob.locator('#board .pawn').count() === 1, 'chip-strip + tap-to-place works on touch');
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
