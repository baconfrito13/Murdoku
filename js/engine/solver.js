// Two solvers:
//
// 1. countSolutions(): exhaustive backtracking enumeration of all valid
//    layouts. This is the ground truth used to guarantee every case has
//    EXACTLY ONE solution. N ≤ 8 keeps this instant.
//
// 2. logicSolve(): a deterministic constraint-propagation engine that only
//    performs human-explainable deductions. Used to (a) guarantee shipped
//    cases never require guessing, (b) grade difficulty, (c) power hints.

import { rowOf, colOf, floorCells, victimOf } from './model.js';
import {
  evalClue, isUnary, filterUnary, reviseBinary, filterAlone, unaryAllows, clueText,
} from './clues.js';

// ---------------------------------------------------------------------------
// Exhaustive enumeration
// ---------------------------------------------------------------------------
export function countSolutions(cse, { limit = 2, extra = null } = {}) {
  const n = cse.size;
  const people = cse.people.map((p) => p.id);
  const floors = floorCells(cse);

  // Initial per-person candidates: floor cells passing unary clues + givens.
  const unaries = new Map(people.map((pid) => [pid, []]));
  const binaries = [];
  const alones = [];
  for (const clue of cse.clues) {
    if (isUnary(clue)) unaries.get(clue.owner).push(clue);
    else if (clue.kind === 'alone') alones.push(clue);
    else binaries.push(clue);
  }

  const cands = new Map();
  for (const pid of people) {
    const given = cse.givens?.[pid];
    let cells = given != null ? [given] : floors.slice();
    cells = cells.filter((c) => !cse.furniture[c]
      && unaries.get(pid).every((cl) => unaryAllows(cse, cl, c)));
    cands.set(pid, cells);
  }

  // Order people by fewest candidates first (static heuristic).
  const order = people.slice().sort((a, b) => cands.get(a).length - cands.get(b).length);

  const placement = new Map();
  const usedRow = new Array(n).fill(false);
  const usedCol = new Array(n).fill(false);
  const solutions = [];

  const binByPerson = new Map(people.map((pid) => [pid, []]));
  for (const b of binaries) {
    binByPerson.get(b.owner).push(b);
    binByPerson.get(b.other).push(b);
  }

  function ok(pid, cell) {
    placement.set(pid, cell);
    // binary clues where both endpoints are placed
    for (const b of binByPerson.get(pid)) {
      if (evalClue(cse, b, placement) === false) { placement.delete(pid); return false; }
    }
    // alone clues that are already decidable
    for (const a of alones) {
      if (evalClue(cse, a, placement) === false) { placement.delete(pid); return false; }
    }
    placement.delete(pid);
    return true;
  }

  function rec(k) {
    if (solutions.length >= limit) return;
    if (k === order.length) {
      // full check (paranoia: everything should already hold)
      for (const clue of cse.clues) {
        if (evalClue(cse, clue, placement) !== true) return;
      }
      if (extra && !extra(placement)) return;
      solutions.push(new Map(placement));
      return;
    }
    const pid = order[k];
    for (const cell of cands.get(pid)) {
      const r = rowOf(cell, n), c = colOf(cell, n);
      if (usedRow[r] || usedCol[c]) continue;
      if (!ok(pid, cell)) continue;
      usedRow[r] = true; usedCol[c] = true;
      placement.set(pid, cell);
      rec(k + 1);
      placement.delete(pid);
      usedRow[r] = false; usedCol[c] = false;
      if (solutions.length >= limit) return;
    }
  }

  rec(0);
  return solutions;
}

// ---------------------------------------------------------------------------
// Logic engine
// ---------------------------------------------------------------------------
// State: Map pid -> Set(candidate cells). A person is "fixed" when their set
// has exactly one cell. Techniques, in escalation order:
//   T1 unary clue filtering (incl. givens)          — "their card says so"
//   T2 row/column elimination from fixed people     — sudoku pressure
//   T3 naked single (one candidate left)            — forced placement
//   T4 hidden single (only person who can take row/col/cell)
//   T5 AC-3 revision over binary clues
//   T6 `alone` room reasoning
// logicSolve() runs to fixpoint; solvable ⇔ all sets become singletons.

export function initialCandidates(cse) {
  const floors = floorCells(cse);
  const cands = new Map();
  for (const p of cse.people) {
    const given = cse.givens?.[p.id];
    const base = given != null ? [given] : floors;
    const set = new Set(base);
    for (const clue of cse.clues) {
      if (clue.owner === p.id && isUnary(clue)) {
        for (const cell of [...set]) if (!unaryAllows(cse, clue, cell)) set.delete(cell);
      }
    }
    cands.set(p.id, set);
  }
  return cands;
}

function propagateOnce(cse, cands) {
  const n = cse.size;
  let changed = false;
  const people = cse.people.map((p) => p.id);

  // T2: row/col/cell elimination from fixed people
  for (const pid of people) {
    const set = cands.get(pid);
    if (set.size !== 1) continue;
    const cell = [...set][0];
    const r = rowOf(cell, n), c = colOf(cell, n);
    for (const qid of people) {
      if (qid === pid) continue;
      const qs = cands.get(qid);
      for (const qc of [...qs]) {
        if (qc === cell || rowOf(qc, n) === r || colOf(qc, n) === c) {
          qs.delete(qc); changed = true;
        }
      }
    }
  }

  // T4 hidden singles: if within a row (or column) only one person has any
  // candidate, that row must be theirs — but that alone doesn't fix a cell.
  // Stronger, sound version: each person must occupy exactly one row and one
  // column overall; if for person P a row r is the ONLY row where some other
  // person Q could go... (complex). We implement the classic sound variant:
  // if a row/column has candidates from exactly one person, that person's
  // candidates shrink to that row/column.
  for (let axis = 0; axis < 2; axis++) {
    for (let line = 0; line < n; line++) {
      const owners = new Set();
      for (const pid of people) {
        for (const cell of cands.get(pid)) {
          const l = axis === 0 ? rowOf(cell, n) : colOf(cell, n);
          if (l === line) { owners.add(pid); break; }
        }
      }
      if (owners.size === 1) {
        const pid = [...owners][0];
        const set = cands.get(pid);
        for (const cell of [...set]) {
          const l = axis === 0 ? rowOf(cell, n) : colOf(cell, n);
          if (l !== line) { set.delete(cell); changed = true; }
        }
      }
    }
  }

  // T5: binary clue revision
  for (const clue of cse.clues) {
    if (isUnary(clue) || clue.kind === 'alone') continue;
    if (reviseBinary(cse, clue, cands)) changed = true;
  }

  // T6: alone reasoning
  for (const clue of cse.clues) {
    if (clue.kind === 'alone' && filterAlone(cse, clue, cands)) changed = true;
  }

  return changed;
}

export function logicSolve(cse) {
  const cands = initialCandidates(cse);
  let rounds = 0;
  for (;;) {
    rounds++;
    const changed = propagateOnce(cse, cands);
    if (!changed) break;
    if (rounds > 500) break;
  }
  const solved = [...cands.values()].every((s) => s.size === 1);
  const contradiction = [...cands.values()].some((s) => s.size === 0);
  return { solved, contradiction, cands, rounds };
}

// Difficulty grade for generator: rounds of propagation needed (proxy for
// human effort), plus board size.
export function gradeDifficulty(cse) {
  const { solved, rounds } = logicSolve(cse);
  if (!solved) return { solvable: false, score: Infinity };
  return { solvable: true, score: rounds + cse.size * 2 + cse.clues.length * 0.3 };
}

// ---------------------------------------------------------------------------
// Hint engine: given the player's current placements/marks, produce the next
// justified deduction as {personId, cell, reason} or an error correction.
// ---------------------------------------------------------------------------
export function nextHint(cse, playerPlacement, objectNames, strings = null) {
  const victim = victimOf(cse);
  const mistakeText = strings?.mistake
    ?? ((name) => `${name} is misplaced — re-check the clues on that card.`);
  const focusText = strings?.focus
    ?? ((name, clues) => clues
      ? `Focus on ${name}: ${clues}. Combined with the one-per-row-and-column rule, only one square works.`
      : `Focus on ${name}: after everyone else's clues and the one-per-row-and-column rule, only one square remains.`);

  // 1. If a player placement contradicts the unique solution, flag it first.
  //    (The victim is derived, never player-placed — skip it.)
  for (const [pid, cell] of playerPlacement) {
    if (pid === victim.id) continue;
    if (cell != null && cse.solution[pid] !== cell && cse.givens?.[pid] == null) {
      const person = cse.people.find((p) => p.id === pid);
      return { type: 'mistake', personId: pid, cell, reason: mistakeText(person.name) };
    }
  }

  // 2. Run the logic engine, then suggest the easiest SUSPECT to fix next.
  const { cands } = logicSolve(cse);
  const unplaced = cse.people
    .filter((p) => !p.isVictim && playerPlacement.get(p.id) == null)
    .map((p) => p.id);

  let best = null;
  for (const pid of unplaced) {
    const set = cands.get(pid);
    if (set.size === 1) { best = pid; break; }
    if (!best || set.size < cands.get(best).size) best = pid;
  }
  if (!best) return null;

  const cell = cse.solution[best];
  const person = cse.people.find((p) => p.id === best);
  const ownClues = cse.clues.filter((c) => c.owner === best);
  const clueBits = ownClues.map((c) => `“${clueText(cse, c, objectNames)}”`).join(strings?.and ?? ' and ');
  return { type: 'place', personId: best, cell, reason: focusText(person.name, ownClues.length ? clueBits : null) };
}

// Validate the murder rule for a case's frozen solution.
export function murdererOfSolution(cse) {
  const victim = victimOf(cse);
  const vCell = cse.solution[victim.id];
  const room = cse.roomOf[vCell];
  const withVictim = cse.people.filter(
    (p) => !p.isVictim && cse.roomOf[cse.solution[p.id]] === room,
  );
  return withVictim.length === 1 ? withVictim[0].id : null;
}
