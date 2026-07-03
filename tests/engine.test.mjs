// Engine test suite. Run: node --test tests/
//
// The heart of it: EVERY shipped case must have exactly one solution, be
// solvable without guessing, and imply exactly one murderer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  idx, neighbors4, rowColConflicts, impliedMurderer, victimOf, floorCells,
} from '../js/engine/model.js';
import { evalClue, clueText } from '../js/engine/clues.js';
import { countSolutions, logicSolve, murdererOfSolution, nextHint } from '../js/engine/solver.js';
import { generateCase } from '../js/engine/generator.js';
import { THEMES, CAMPAIGN_BRIEFS, pickTroupe, OBJECT_NAMES } from '../js/roster.js';
import { CAMPAIGN_CASES } from '../js/cases-data.js';

// ---------------------------------------------------------------------------
// Fixture: a tiny hand-built 3x3 case for precise unit checks.
// Rooms: 0=West hall (col 0), 1=East hall (cols 1-2).
// Furniture: plant at (1,1) center.
// People: a, b, victim v.
// ---------------------------------------------------------------------------
function tinyCase() {
  const size = 3;
  const roomOf = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) roomOf.push(c === 0 ? 0 : 1);
  return {
    id: 'tiny',
    size,
    roomOf,
    rooms: [{ name: 'West Hall', hue: 0 }, { name: 'East Hall', hue: 120 }],
    furniture: { [idx(1, 1, 3)]: { type: 'plant' } },
    people: [
      { id: 'a', name: 'Ada', role: 'guest', emoji: '🅰️' },
      { id: 'b', name: 'Bo', role: 'guest', emoji: '🅱️' },
      { id: 'v', name: 'Vic', role: 'victim', emoji: '💀', isVictim: true },
    ],
    clues: [],
    givens: {},
  };
}

test('geometry helpers', () => {
  assert.deepEqual(neighbors4(idx(0, 0, 3), 3).sort((x, y) => x - y), [1, 3]);
  assert.deepEqual(neighbors4(idx(1, 1, 3), 3).sort((x, y) => x - y), [1, 3, 5, 7]);
});

test('clue evaluation: rooms, beside, directions, edge, alone', () => {
  const cse = tinyCase();
  const place = new Map([
    ['a', idx(0, 0, 3)], // west hall, NW corner
    ['b', idx(1, 2, 3)], // east hall, beside plant (east of it)
    ['v', idx(2, 1, 3)], // east hall, south edge, beside plant (south of it)
  ]);
  const T = (clue) => assert.equal(evalClue(cse, clue, place), true, JSON.stringify(clue));
  const F = (clue) => assert.equal(evalClue(cse, clue, place), false, JSON.stringify(clue));

  T({ owner: 'a', kind: 'in_room', room: 0 });
  F({ owner: 'a', kind: 'in_room', room: 1 });
  T({ owner: 'b', kind: 'not_in_room', room: 0 });
  T({ owner: 'b', kind: 'beside_object', objType: 'plant' });
  T({ owner: 'v', kind: 'beside_object', objType: 'plant' });
  F({ owner: 'a', kind: 'beside_object', objType: 'plant' });
  T({ owner: 'a', kind: 'not_beside_object', objType: 'plant' });
  F({ owner: 'a', kind: 'same_col_object', objType: 'plant' }); // a col 0, plant col 1
  T({ owner: 'v', kind: 'same_col_object', objType: 'plant' });
  T({ owner: 'b', kind: 'same_row_object', objType: 'plant' });
  T({ owner: 'a', kind: 'dir_of_object', objType: 'plant', dir: 'north' });
  T({ owner: 'a', kind: 'dir_of_object', objType: 'plant', dir: 'west' });
  T({ owner: 'v', kind: 'dir_of_object', objType: 'plant', dir: 'south' });
  F({ owner: 'v', kind: 'dir_of_object', objType: 'plant', dir: 'north' });
  T({ owner: 'a', kind: 'edge', dir: 'north' });
  T({ owner: 'a', kind: 'edge', dir: 'west' });
  F({ owner: 'b', kind: 'edge', dir: 'west' });
  T({ owner: 'v', kind: 'edge', dir: 'south' });
  T({ owner: 'a', kind: 'dir_of_person', other: 'b', dir: 'north' });
  T({ owner: 'b', kind: 'dir_of_person', other: 'a', dir: 'south' });
  T({ owner: 'b', kind: 'dir_of_person', other: 'a', dir: 'east' });
  T({ owner: 'b', kind: 'dir_of_person', other: 'v', dir: 'north' }); // b row 1, v row 2
  F({ owner: 'b', kind: 'dir_of_person', other: 'v', dir: 'south' });
});

test('clue evaluation: beside/same-room person and alone', () => {
  const cse = tinyCase();
  const place = new Map([
    ['a', idx(0, 0, 3)],
    ['b', idx(1, 2, 3)],
    ['v', idx(2, 1, 3)],
  ]);
  assert.equal(evalClue(cse, { owner: 'a', kind: 'alone', }, place), true);
  assert.equal(evalClue(cse, { owner: 'b', kind: 'alone' }, place), false); // v also in east hall
  assert.equal(evalClue(cse, { owner: 'b', kind: 'same_room_person', other: 'v' }, place), true);
  assert.equal(evalClue(cse, { owner: 'a', kind: 'not_same_room_person', other: 'b' }, place), true);
  assert.equal(evalClue(cse, { owner: 'v', kind: 'beside_person', other: 'b' }, place), false); // diagonal!
  assert.equal(evalClue(cse, { owner: 'v', kind: 'not_beside_person', other: 'b' }, place), true);
});

test('partial placements evaluate to null (undecidable), not false', () => {
  const cse = tinyCase();
  const place = new Map([['a', idx(0, 0, 3)]]);
  assert.equal(evalClue(cse, { owner: 'b', kind: 'in_room', room: 0 }, place), null);
  assert.equal(evalClue(cse, { owner: 'a', kind: 'beside_person', other: 'b' }, place), null);
  assert.equal(evalClue(cse, { owner: 'a', kind: 'alone' }, place), null); // b, v unknown
});

test('row/column conflict detection', () => {
  const cse = tinyCase();
  const place = new Map([['a', idx(0, 0, 3)], ['b', idx(0, 2, 3)]]);
  assert.equal(rowColConflicts(cse, place).length, 1);
  place.set('b', idx(1, 1, 3));
  assert.equal(rowColConflicts(cse, place).length, 0);
});

test('impliedMurderer requires exactly one suspect with the victim', () => {
  const cse = tinyCase();
  // b alone with v in east hall
  const place = new Map([['a', idx(0, 0, 3)], ['b', idx(1, 2, 3)], ['v', idx(2, 1, 3)]]);
  assert.equal(impliedMurderer(cse, place), 'b');
  // move a into east hall too -> two suspects with victim -> null
  const place2 = new Map([['a', idx(0, 1, 3)], ['b', idx(1, 2, 3)], ['v', idx(2, 1, 3)]]);
  assert.equal(impliedMurderer(cse, place2), null);
});

test('countSolutions enumerates the unconstrained tiny board correctly', () => {
  const cse = tinyCase();
  // 3x3 minus center furniture: permutation matrices of size 3 avoiding center
  // = permutations of {0,1,2} where sigma(1) != 1 -> 4 placements; times 3! person
  // orderings? No: people are distinct, mapping people->cells IS the permutation.
  // 4 cell-patterns x 3! assignments of 3 distinct people = 24.
  const sols = countSolutions(cse, { limit: 1000 });
  assert.equal(sols.length, 24);
});

test('givens constrain the search', () => {
  const cse = tinyCase();
  cse.givens = { v: idx(2, 1, 3) };
  const sols = countSolutions(cse, { limit: 1000 });
  // v fixed at (2,1): remaining 2 people on rows 0,1 & cols 0,2 minus center:
  // (0,0)&(1,2) or (0,2)&(1,0) -> 2 patterns x 2 assignments = 4
  assert.equal(sols.length, 4);
});

test('every campaign case: EXACTLY one solution', () => {
  assert.ok(CAMPAIGN_CASES.length >= 8, 'campaign present');
  for (const cse of CAMPAIGN_CASES) {
    const sols = countSolutions(cse, { limit: 3 });
    assert.equal(sols.length, 1, `${cse.id} must have exactly 1 solution`);
    // Frozen solution matches the enumerated one
    for (const [pid, cell] of sols[0]) {
      assert.equal(cse.solution[pid], cell, `${cse.id}: frozen solution mismatch for ${pid}`);
    }
  }
});

test('every campaign case: solvable by pure logic (no guessing)', () => {
  for (const cse of CAMPAIGN_CASES) {
    const res = logicSolve(cse);
    assert.equal(res.contradiction, false, `${cse.id}: contradiction`);
    assert.equal(res.solved, true, `${cse.id}: requires guessing`);
    // and the logic solution agrees with the frozen one
    for (const [pid, set] of res.cands) {
      assert.equal([...set][0], cse.solution[pid], `${cse.id}: logic vs frozen for ${pid}`);
    }
  }
});

test('every campaign case: murder rule well-defined (exactly one suspect with victim)', () => {
  for (const cse of CAMPAIGN_CASES) {
    const m = murdererOfSolution(cse);
    assert.ok(m, `${cse.id}: murderer undefined`);
    assert.equal(m, cse.murderer, `${cse.id}: murderer mismatch`);
    const victim = victimOf(cse);
    assert.ok(victim, `${cse.id}: no victim`);
    assert.notEqual(m, victim.id);
  }
});

test('every campaign case: structural sanity', () => {
  for (const cse of CAMPAIGN_CASES) {
    assert.equal(cse.people.length, cse.size, `${cse.id}: one person per row/col`);
    assert.equal(cse.roomOf.length, cse.size * cse.size);
    // all solution cells are floor, in-bounds, distinct rows/cols
    const rows = new Set(); const cols = new Set();
    for (const p of cse.people) {
      const cell = cse.solution[p.id];
      assert.ok(cell >= 0 && cell < cse.size * cse.size, `${cse.id}: oob`);
      assert.ok(!cse.furniture[cell], `${cse.id}: person on furniture`);
      rows.add(Math.floor(cell / cse.size)); cols.add(cell % cse.size);
    }
    assert.equal(rows.size, cse.size, `${cse.id}: duplicate rows`);
    assert.equal(cols.size, cse.size, `${cse.id}: duplicate cols`);
    // rooms contiguous
    for (let room = 0; room < cse.rooms.length; room++) {
      const cells = [...Array(cse.size * cse.size).keys()].filter((c) => cse.roomOf[c] === room);
      if (cells.length === 0) continue;
      const seen = new Set([cells[0]]);
      const queue = [cells[0]];
      while (queue.length) {
        const c = queue.pop();
        for (const nb of neighbors4(c, cse.size)) {
          if (cse.roomOf[nb] === room && !seen.has(nb)) { seen.add(nb); queue.push(nb); }
        }
      }
      assert.equal(seen.size, cells.length, `${cse.id}: room ${room} not contiguous`);
    }
    // every clue is TRUE in the frozen solution and readable
    const sol = new Map(Object.entries(cse.solution));
    for (const clue of cse.clues) {
      assert.equal(evalClue(cse, clue, sol), true, `${cse.id}: false clue ${JSON.stringify(clue)}`);
      assert.ok(clueText(cse, clue, OBJECT_NAMES).length > 5);
    }
    // givens match the solution
    for (const [pid, cell] of Object.entries(cse.givens ?? {})) {
      assert.equal(cse.solution[pid], cell, `${cse.id}: given contradicts solution`);
    }
    // no same-room clue pairs victim with murderer (would leak the answer)
    const victim = victimOf(cse);
    for (const clue of cse.clues) {
      if (clue.kind === 'same_room_person') {
        const pair = new Set([clue.owner, clue.other]);
        assert.ok(!(pair.has(victim.id) && pair.has(cse.murderer)),
          `${cse.id}: clue leaks the murderer`);
      }
    }
  }
});

test('difficulty spread and clue economy', () => {
  for (const cse of CAMPAIGN_CASES) {
    assert.ok(cse.clues.length >= 3, `${cse.id}: too few clues`);
    assert.ok(cse.clues.length <= cse.size * 4, `${cse.id}: clue overload`);
  }
});

test('hint engine produces a correct, justified next step', () => {
  const cse = CAMPAIGN_CASES[0];
  const empty = new Map(cse.people.map((p) => [p.id, null]));
  const hint = nextHint(cse, empty, OBJECT_NAMES);
  assert.ok(hint);
  assert.equal(hint.type, 'place');
  assert.equal(cse.solution[hint.personId], hint.cell);
  assert.ok(hint.reason.length > 10);

  // A wrong placement is flagged as a mistake first.
  const floors = floorCells(cse);
  const wrongCell = floors.find((c) => c !== cse.solution[cse.people[0].id]
    && cse.givens[cse.people[0].id] == null);
  const withMistake = new Map(empty);
  withMistake.set(cse.people[0].id, wrongCell);
  const hint2 = nextHint(cse, withMistake, OBJECT_NAMES);
  assert.equal(hint2.type, 'mistake');
});

test('random generation keeps all guarantees (property test, 6 fresh seeds)', () => {
  const briefs = [
    { size: 4, theme: 'manor', suspects: ['vera', 'ash', 'felix'], difficulty: 'easy' },
    { size: 5, theme: 'casino', suspects: ['prudence', 'ash', 'coco', 'basil'], difficulty: 'medium' },
    { size: 6, theme: 'garden', suspects: ['vera', 'prudence', 'wren', 'basil', 'felix'], difficulty: 'medium' },
  ];
  let n = 0;
  for (const brief of briefs) {
    for (const seed of [`prop-${brief.size}-a`, `prop-${brief.size}-b`]) {
      const people = [
        ...pickTroupe(brief.suspects),
        { id: 'vic', name: 'Test Victim', role: 'victim', emoji: '💀', isVictim: true },
      ];
      const cse = generateCase({
        id: `prop-${n++}`, seed, size: brief.size,
        theme: THEMES[brief.theme], people,
        story: { title: 't', intro: 'i', reveal: 'r {murderer}' },
        difficulty: brief.difficulty,
      });
      assert.ok(cse, `generation failed for ${seed}`);
      assert.equal(countSolutions(cse, { limit: 3 }).length, 1, `${seed}: not unique`);
      assert.ok(logicSolve(cse).solved, `${seed}: not logic-solvable`);
      assert.ok(murdererOfSolution(cse), `${seed}: murderer undefined`);
    }
  }
});
