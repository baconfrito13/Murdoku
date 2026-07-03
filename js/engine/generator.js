// Seeded case generator.
//
// Pipeline:
//   1. buildScene()   — contiguous room partition + themed furniture, keeping
//                       every row/column playable.
//   2. pickSolution() — a random one-per-row/column placement on floor cells
//                       where the victim shares a room with EXACTLY one suspect.
//   3. cluePool()     — every true statement about that solution across all
//                       clue kinds (bounded per kind).
//   4. selectClues()  — greedy random build-up until the exhaustive solver
//                       proves EXACTLY ONE solution *and* the logic engine can
//                       solve it without guessing; then greedy minimization.
//   5. Optional givens for easier grades.
//
// The generator retries internally until all guarantees hold.

import { Rng } from './rng.js';
import {
  idx, rowOf, colOf, neighbors4, floorCells, victimOf, roomCells,
} from './model.js';
import { DIRS } from './clues.js';
import { countSolutions, logicSolve, murdererOfSolution } from './solver.js';

// ---------------------------------------------------------------------------
// Scene construction
// ---------------------------------------------------------------------------
function buildRooms(rng, n, roomCount) {
  // Seeded multi-source region growth; guarantees contiguous rooms.
  const total = n * n;
  const roomOf = new Array(total).fill(-1);
  const seeds = rng.shuffle([...Array(total).keys()]).slice(0, roomCount);
  const frontiers = seeds.map((s, i) => { roomOf[s] = i; return [s]; });
  let assigned = roomCount;
  while (assigned < total) {
    let progressed = false;
    for (let i = 0; i < roomCount && assigned < total; i++) {
      const frontier = frontiers[i];
      // random growth step for room i
      const growable = frontier.filter((c) => neighbors4(c, n).some((nb) => roomOf[nb] === -1));
      if (growable.length === 0) continue;
      const from = rng.pick(growable);
      const options = neighbors4(from, n).filter((nb) => roomOf[nb] === -1);
      const cell = rng.pick(options);
      roomOf[cell] = i;
      frontier.push(cell);
      assigned++;
      progressed = true;
    }
    if (!progressed) break; // shouldn't happen, but never hang
  }
  // Fill any stragglers with a touching room (keeps contiguity).
  for (let c = 0; c < total; c++) {
    if (roomOf[c] === -1) {
      const nb = neighbors4(c, n).find((x) => roomOf[x] !== -1);
      roomOf[c] = nb != null ? roomOf[nb] : 0;
    }
  }
  return roomOf;
}

function placeFurniture(rng, n, roomOf, objTypes, targetCount) {
  // Furniture blocks cells. Keep at least (n - 1) floor cells per... actually:
  // a valid permutation needs ≥1 floor cell available per row AND per column,
  // and a perfect matching. We enforce ≥2 floor cells per row/column and let
  // the solution-search retry handle rare matching failures.
  const furniture = {};
  const perRowBlocked = new Array(n).fill(0);
  const perColBlocked = new Array(n).fill(0);
  const cells = rng.shuffle([...Array(n * n).keys()]);
  let placed = 0;
  for (const cell of cells) {
    if (placed >= targetCount) break;
    const r = rowOf(cell, n), c = colOf(cell, n);
    if (perRowBlocked[r] >= n - 2 || perColBlocked[c] >= n - 2) continue;
    furniture[cell] = { type: rng.pick(objTypes) };
    perRowBlocked[r]++; perColBlocked[c]++;
    placed++;
  }
  return furniture;
}

function pickSolution(rng, cse, tries = 400) {
  // Random permutation restricted to floor cells; victim must end up with
  // exactly one suspect in their room.
  const n = cse.size;
  const people = cse.people.map((p) => p.id);
  const victim = victimOf(cse);
  const floorsByRow = [];
  for (let r = 0; r < n; r++) {
    floorsByRow.push(
      [...Array(n).keys()].map((c) => idx(r, c, n)).filter((cell) => !cse.furniture[cell]),
    );
  }
  for (let t = 0; t < tries; t++) {
    const rowsOrder = rng.shuffle([...Array(n).keys()]);
    const peopleOrder = rng.shuffle(people);
    const usedCol = new Array(n).fill(false);
    const placement = new Map();
    let ok = true;
    for (let i = 0; i < n; i++) {
      const row = rowsOrder[i];
      const options = floorsByRow[row].filter((cell) => !usedCol[colOf(cell, n)]);
      if (options.length === 0) { ok = false; break; }
      const cell = rng.pick(options);
      usedCol[colOf(cell, n)] = true;
      placement.set(peopleOrder[i], cell);
    }
    if (!ok) continue;
    // murder rule: victim's room has exactly 2 occupants
    const vRoom = cse.roomOf[placement.get(victim.id)];
    const occupants = people.filter((pid) => cse.roomOf[placement.get(pid)] === vRoom);
    if (occupants.length !== 2) continue;
    return placement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Clue pool: true statements about the solution
// ---------------------------------------------------------------------------
function buildCluePool(rng, cse, solution, objTypes) {
  const n = cse.size;
  const pool = [];
  const people = cse.people;
  const roomCount = cse.rooms.length;
  const at = (pid) => solution.get(pid);

  const push = (clue) => pool.push(clue);

  for (const p of people) {
    const cell = at(p.id);
    const myRoom = cse.roomOf[cell];

    // rooms
    push({ owner: p.id, kind: 'in_room', room: myRoom });
    const notRooms = rng.shuffle([...Array(roomCount).keys()].filter((r) => r !== myRoom));
    for (const r of notRooms.slice(0, 2)) push({ owner: p.id, kind: 'not_in_room', room: r });

    // objects
    const adjTypes = new Set(
      neighbors4(cell, n).filter((nb) => cse.furniture[nb]).map((nb) => cse.furniture[nb].type),
    );
    for (const t of adjTypes) push({ owner: p.id, kind: 'beside_object', objType: t });
    for (const t of objTypes) {
      if (!adjTypes.has(t) && Object.values(cse.furniture).some((f) => f.type === t)) {
        push({ owner: p.id, kind: 'not_beside_object', objType: t });
      }
    }
    for (const t of objTypes) {
      const cells = Object.entries(cse.furniture)
        .filter(([, f]) => f.type === t).map(([c]) => Number(c));
      if (cells.length === 0) continue;
      if (cells.some((f) => rowOf(f, n) === rowOf(cell, n))) {
        push({ owner: p.id, kind: 'same_row_object', objType: t });
      }
      if (cells.some((f) => colOf(f, n) === colOf(cell, n))) {
        push({ owner: p.id, kind: 'same_col_object', objType: t });
      }
      for (const dir of DIRS) {
        const holds = cells.every((f) => {
          switch (dir) {
            case 'north': return rowOf(cell, n) < rowOf(f, n);
            case 'south': return rowOf(cell, n) > rowOf(f, n);
            case 'west': return colOf(cell, n) < colOf(f, n);
            case 'east': return colOf(cell, n) > colOf(f, n);
            default: return false;
          }
        });
        if (holds) push({ owner: p.id, kind: 'dir_of_object', objType: t, dir });
      }
    }

    // edges
    if (rowOf(cell, n) === 0) push({ owner: p.id, kind: 'edge', dir: 'north' });
    if (rowOf(cell, n) === n - 1) push({ owner: p.id, kind: 'edge', dir: 'south' });
    if (colOf(cell, n) === 0) push({ owner: p.id, kind: 'edge', dir: 'west' });
    if (colOf(cell, n) === n - 1) push({ owner: p.id, kind: 'edge', dir: 'east' });

    // people relations
    for (const q of people) {
      if (q.id === p.id) continue;
      const other = at(q.id);
      if (rowOf(cell, n) < rowOf(other, n)) push({ owner: p.id, kind: 'dir_of_person', other: q.id, dir: 'north' });
      if (rowOf(cell, n) > rowOf(other, n)) push({ owner: p.id, kind: 'dir_of_person', other: q.id, dir: 'south' });
      if (colOf(cell, n) < colOf(other, n)) push({ owner: p.id, kind: 'dir_of_person', other: q.id, dir: 'west' });
      if (colOf(cell, n) > colOf(other, n)) push({ owner: p.id, kind: 'dir_of_person', other: q.id, dir: 'east' });
      if (neighbors4(cell, n).includes(other)) push({ owner: p.id, kind: 'beside_person', other: q.id });
      else if (rng.chance(0.5)) push({ owner: p.id, kind: 'not_beside_person', other: q.id });
      if (cse.roomOf[other] === myRoom) push({ owner: p.id, kind: 'same_room_person', other: q.id });
      else if (rng.chance(0.5)) push({ owner: p.id, kind: 'not_same_room_person', other: q.id });
    }

    // alone
    const occupants = people.filter((q) => cse.roomOf[at(q.id)] === myRoom);
    if (occupants.length === 1) push({ owner: p.id, kind: 'alone' });
  }

  // Never leak the murder directly: drop same_room_person clues that pair the
  // victim with the murderer (in either direction) — finding that pair IS the game.
  const victim = victimOf(cse);
  const vRoom = cse.roomOf[at(victim.id)];
  const murderer = people.find((p) => !p.isVictim && cse.roomOf[at(p.id)] === vRoom);
  return pool.filter((c) => {
    if (c.kind !== 'same_room_person') return true;
    const pair = new Set([c.owner, c.other]);
    return !(pair.has(victim.id) && pair.has(murderer.id));
  });
}

// ---------------------------------------------------------------------------
// Clue selection with uniqueness + no-guessing guarantee
// ---------------------------------------------------------------------------
function cluesKey(c) {
  return JSON.stringify(c);
}

function selectClues(rng, cse, pool, { maxPerPerson = 3, restarts = 10 } = {}) {
  for (let attempt = 0; attempt < restarts; attempt++) {
    // Later attempts relax the per-person cap so hard boards stay generable.
    const cap = attempt < restarts / 2 ? maxPerPerson : maxPerPerson + 1;
    const shuffled = rng.shuffle(pool);
    const perPerson = new Map(cse.people.map((p) => [p.id, 0]));
    const chosen = [];

    const uniqueAndFair = () => {
      const trial = { ...cse, clues: chosen };
      const sols = countSolutions(trial, { limit: 2 });
      if (sols.length !== 1) return false;
      return logicSolve(trial).solved;
    };

    // Greedy build-up: keep adding informative clues until unique + logic-solvable.
    let done = false;
    for (const clue of shuffled) {
      if (perPerson.get(clue.owner) >= cap) continue;
      chosen.push(clue);
      perPerson.set(clue.owner, perPerson.get(clue.owner) + 1);
      if (chosen.length >= 3 && uniqueAndFair()) { done = true; break; }
    }
    if (!done && !uniqueAndFair()) continue;

    // Minimization: drop any clue whose removal preserves both guarantees.
    for (const clue of rng.shuffle(chosen.slice())) {
      const i = chosen.indexOf(clue);
      chosen.splice(i, 1);
      if (!uniqueAndFair()) chosen.splice(i, 0, clue);
    }

    return chosen;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------
export function generateCase(config) {
  const {
    seed, size, theme, people, story, difficulty = 'medium',
  } = config;
  const rng = new Rng(seed);
  const roomCount = Math.max(3, Math.min(theme.roomNames.length, size - 1));
  const furnitureTarget = {
    4: 3, 5: 4, 6: 6, 7: 8, 8: 10,
  }[size] ?? size;

  for (let attempt = 0; attempt < 200; attempt++) {
    const roomOf = buildRooms(rng, size, roomCount);
    const usedRooms = [...new Set(roomOf)].sort((a, b) => a - b);
    // Compact room ids in case growth starved a seed.
    const remap = new Map(usedRooms.map((r, i) => [r, i]));
    const roomOfC = roomOf.map((r) => remap.get(r));
    const names = rng.shuffle(theme.roomNames).slice(0, usedRooms.length);
    const rooms = names.map((name, i) => ({ name, hue: (360 / names.length) * i }));

    const furniture = placeFurniture(rng, size, roomOfC, theme.objTypes, furnitureTarget);

    const cse = {
      id: config.id,
      title: story?.title ?? 'Untitled Case',
      size,
      roomOf: roomOfC,
      rooms,
      furniture,
      people,
      clues: [],
      givens: {},
      story,
      theme: { objectNames: theme.objectNames },
    };

    const solutionMap = pickSolution(rng, cse);
    if (!solutionMap) continue;

    const pool = buildCluePool(rng, cse, solutionMap, theme.objTypes);
    const maxPerPerson = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 3 : 2;
    const clues = selectClues(rng, cse, pool, { maxPerPerson });
    if (!clues) continue;
    cse.clues = clues;

    // Givens: easy cases pre-place the victim (classic "the body was found in…").
    if (difficulty === 'easy') {
      const victim = victimOf(cse);
      cse.givens[victim.id] = solutionMap.get(victim.id);
      // Remove clues that became redundant, re-checking guarantees.
      for (const clue of rng.shuffle(cse.clues.slice())) {
        const i = cse.clues.indexOf(clue);
        cse.clues.splice(i, 1);
        const sols = countSolutions(cse, { limit: 2 });
        if (sols.length !== 1 || !logicSolve(cse).solved) cse.clues.splice(i, 0, clue);
      }
    }

    // FINAL verification of every guarantee (belt and braces).
    const sols = countSolutions(cse, { limit: 2 });
    if (sols.length !== 1) continue;
    cse.solution = Object.fromEntries(sols[0]);
    if (!logicSolve(cse).solved) continue;
    const murderer = murdererOfSolution(cse);
    if (!murderer) continue;
    cse.murderer = murderer;
    return cse;
  }
  return null;
}
