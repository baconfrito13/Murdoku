// Core data model + geometry helpers.
//
// A Case:
// {
//   id, title, size,                       // N (board is N×N)
//   roomOf:   Int[N*N],                    // cell -> room index
//   rooms:    [{name, hue}],               // room metadata
//   furniture: {cellIndex: {type}},        // object map (cell -> furniture)
//   people:   [{id, name, role, emoji, isVictim}],  // length N, one is victim
//   clues:    [{owner, kind, ...params}],  // see clues.js
//   givens:   {personId: cellIndex},       // pre-placed, locked
//   solution: {personId: cellIndex},       // the unique solution
//   murderer: personId,
//   story:    {intro, reveal}
// }
//
// A placement is a Map personId -> cellIndex (partial while playing).

export const idx = (r, c, n) => r * n + c;
export const rowOf = (cell, n) => Math.floor(cell / n);
export const colOf = (cell, n) => cell % n;

export function neighbors4(cell, n) {
  const r = rowOf(cell, n), c = colOf(cell, n);
  const out = [];
  if (r > 0) out.push(cell - n);
  if (r < n - 1) out.push(cell + n);
  if (c > 0) out.push(cell - 1);
  if (c < n - 1) out.push(cell + 1);
  return out;
}

export function isFloor(cse, cell) {
  return !cse.furniture[cell];
}

export function floorCells(cse) {
  const out = [];
  for (let i = 0; i < cse.size * cse.size; i++) if (isFloor(cse, i)) out.push(i);
  return out;
}

export function furnitureCellsOfType(cse, type) {
  const out = [];
  for (const [cell, f] of Object.entries(cse.furniture)) {
    if (f.type === type) out.push(Number(cell));
  }
  return out;
}

export function roomCells(cse, room) {
  const out = [];
  for (let i = 0; i < cse.size * cse.size; i++) if (cse.roomOf[i] === room) out.push(i);
  return out;
}

// Occupants of a room, given a (possibly partial) placement Map.
export function roomOccupants(cse, placement, room) {
  const out = [];
  for (const [pid, cell] of placement) {
    if (cell != null && cse.roomOf[cell] === room) out.push(pid);
  }
  return out;
}

export function personById(cse, pid) {
  return cse.people.find((p) => p.id === pid);
}

export function victimOf(cse) {
  return cse.people.find((p) => p.isVictim);
}

// The victim's square is never placed by the player: with every suspect on
// the board (one per row and column), exactly one row and one column remain
// free — their crossing is where the body lies. Returns the derived cell, or
// null while suspects are missing/conflicting or the crossing is blocked.
export function derivedVictimCell(cse, placement) {
  const n = cse.size;
  const victim = victimOf(cse);
  const rows = new Array(n).fill(false);
  const cols = new Array(n).fill(false);
  let placed = 0;
  for (const [pid, cell] of placement) {
    if (pid === victim.id || cell == null) continue;
    const r = rowOf(cell, n), c = colOf(cell, n);
    if (rows[r] || cols[c]) return null; // conflict — no unique free line
    rows[r] = true; cols[c] = true;
    placed++;
  }
  if (placed !== cse.people.length - 1) return null;
  const freeRow = rows.indexOf(false);
  const freeCol = cols.indexOf(false);
  const cell = idx(freeRow, freeCol, n);
  if (cse.furniture[cell]) return null; // blocked crossing — a placement is wrong
  return cell;
}

// The murderer implied by a full placement: the single suspect sharing the
// victim's room. Returns null if not exactly one suspect is with the victim.
export function impliedMurderer(cse, placement) {
  const victim = victimOf(cse);
  const vCell = placement.get(victim.id);
  if (vCell == null) return null;
  const room = cse.roomOf[vCell];
  const others = [];
  for (const [pid, cell] of placement) {
    if (pid !== victim.id && cell != null && cse.roomOf[cell] === room) others.push(pid);
  }
  return others.length === 1 ? others[0] : null;
}

// Row/column conflicts in a (partial) placement -> list of [pidA, pidB].
export function rowColConflicts(cse, placement) {
  const n = cse.size;
  const entries = [...placement].filter(([, cell]) => cell != null);
  const conflicts = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [pa, ca] = entries[i];
      const [pb, cb] = entries[j];
      if (rowOf(ca, n) === rowOf(cb, n) || colOf(ca, n) === colOf(cb, n) || ca === cb) {
        conflicts.push([pa, pb]);
      }
    }
  }
  return conflicts;
}
