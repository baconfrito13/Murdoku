// Clue system: constructors, full evaluation, candidate filtering and prose.
//
// Every clue has an `owner` (person id) and a `kind`. Clues are *rules*: all of
// them must hold in the final layout.
//
// Kinds:
//   in_room          {room}                owner is in room
//   not_in_room      {room}
//   beside_object    {objType}             orthogonally adjacent to ≥1 such
//                                          object IN THE SAME ROOM (book rule:
//                                          "beside" never crosses a room wall)
//   not_beside_object{objType}
//   same_row_object  {objType}             shares a row with ≥1 such object
//   same_col_object  {objType}
//   dir_of_object    {objType, dir}        strictly N/S/E/W of EVERY such object
//   dir_of_person    {other, dir}          strictly N/S/E/W of `other`
//   beside_person    {other}
//   not_beside_person{other}
//   same_room_person {other}
//   not_same_room_person {other}
//   alone            {}                    only person in their room
//   edge             {dir}                 against that wall
//
// Directions: north = smaller row (top of the map), south = larger row,
// west = smaller column, east = larger column. Always strict.

import {
  rowOf, colOf, neighbors4, furnitureCellsOfType, roomCells,
} from './model.js';

export const DIRS = ['north', 'south', 'east', 'west'];

function dirHolds(cellA, cellB, dir, n) {
  // true if A is <dir> of B
  switch (dir) {
    case 'north': return rowOf(cellA, n) < rowOf(cellB, n);
    case 'south': return rowOf(cellA, n) > rowOf(cellB, n);
    case 'west': return colOf(cellA, n) < colOf(cellB, n);
    case 'east': return colOf(cellA, n) > colOf(cellB, n);
    default: throw new Error(`bad dir ${dir}`);
  }
}

// "Beside" in Murdoku = directly left/right/above/below AND in the same area.
// Two squares can touch across a room wall without being "beside" each other.
function besideCells(cse, cell) {
  return neighbors4(cell, cse.size).filter((nb) => cse.roomOf[nb] === cse.roomOf[cell]);
}

function onEdge(cell, dir, n) {
  switch (dir) {
    case 'north': return rowOf(cell, n) === 0;
    case 'south': return rowOf(cell, n) === n - 1;
    case 'west': return colOf(cell, n) === 0;
    case 'east': return colOf(cell, n) === n - 1;
    default: throw new Error(`bad dir ${dir}`);
  }
}

// ---------------------------------------------------------------------------
// Full evaluation against a *complete* placement (Map pid -> cell).
// Returns true/false. Partial placements: returns null when undecidable.
// ---------------------------------------------------------------------------
export function evalClue(cse, clue, placement) {
  const n = cse.size;
  const cell = placement.get(clue.owner);
  if (cell == null) return null;

  switch (clue.kind) {
    case 'in_room':
      return cse.roomOf[cell] === clue.room;
    case 'not_in_room':
      return cse.roomOf[cell] !== clue.room;
    case 'beside_object':
      return besideCells(cse, cell).some((nb) => cse.furniture[nb]?.type === clue.objType);
    case 'not_beside_object':
      return !besideCells(cse, cell).some((nb) => cse.furniture[nb]?.type === clue.objType);
    case 'same_row_object':
      return furnitureCellsOfType(cse, clue.objType).some((f) => rowOf(f, n) === rowOf(cell, n));
    case 'same_col_object':
      return furnitureCellsOfType(cse, clue.objType).some((f) => colOf(f, n) === colOf(cell, n));
    case 'dir_of_object': {
      const objs = furnitureCellsOfType(cse, clue.objType);
      if (objs.length === 0) return false;
      return objs.every((f) => dirHolds(cell, f, clue.dir, n));
    }
    case 'edge':
      return onEdge(cell, clue.dir, n);
    case 'dir_of_person': {
      const other = placement.get(clue.other);
      if (other == null) return null;
      return dirHolds(cell, other, clue.dir, n);
    }
    case 'beside_person': {
      const other = placement.get(clue.other);
      if (other == null) return null;
      return besideCells(cse, cell).includes(other);
    }
    case 'not_beside_person': {
      const other = placement.get(clue.other);
      if (other == null) return null;
      return !besideCells(cse, cell).includes(other);
    }
    case 'same_room_person': {
      const other = placement.get(clue.other);
      if (other == null) return null;
      return cse.roomOf[cell] === cse.roomOf[other];
    }
    case 'not_same_room_person': {
      const other = placement.get(clue.other);
      if (other == null) return null;
      return cse.roomOf[cell] !== cse.roomOf[other];
    }
    case 'alone': {
      const myRoom = cse.roomOf[cell];
      let undecided = false;
      for (const p of cse.people) {
        if (p.id === clue.owner) continue;
        const c = placement.get(p.id);
        if (c == null) { undecided = true; continue; }
        if (cse.roomOf[c] === myRoom) return false;
      }
      return undecided ? null : true;
    }
    default:
      throw new Error(`unknown clue kind ${clue.kind}`);
  }
}

// A clue is "violated" (definitively false) under a partial placement.
export function clueViolated(cse, clue, placement) {
  return evalClue(cse, clue, placement) === false;
}

// ---------------------------------------------------------------------------
// Candidate filtering (for the logic engine / hints).
// `cands` is a Map pid -> Set(cell). Unary clues shrink the owner's set
// directly; binary clues do AC-3 style pruning; `alone` uses room reasoning.
// Returns true if anything changed.
// ---------------------------------------------------------------------------
export function isUnary(clue) {
  return ['in_room', 'not_in_room', 'beside_object', 'not_beside_object',
    'same_row_object', 'same_col_object', 'dir_of_object', 'edge'].includes(clue.kind);
}

export function unaryAllows(cse, clue, cell) {
  const one = new Map([[clue.owner, cell]]);
  return evalClue(cse, clue, one) !== false;
}

function pairAllows(cse, clue, cellA, cellB) {
  const m = new Map([[clue.owner, cellA], [clue.other, cellB]]);
  return evalClue(cse, clue, m) !== false;
}

export function filterUnary(cse, clue, cands) {
  const set = cands.get(clue.owner);
  let changed = false;
  for (const cell of [...set]) {
    if (!unaryAllows(cse, clue, cell)) { set.delete(cell); changed = true; }
  }
  return changed;
}

export function reviseBinary(cse, clue, cands) {
  // Remove owner-candidates with no compatible other-candidate, and vice versa.
  let changed = false;
  const a = cands.get(clue.owner);
  const b = cands.get(clue.other);
  for (const ca of [...a]) {
    let ok = false;
    for (const cb of b) if (ca !== cb && pairAllows(cse, clue, ca, cb)) { ok = true; break; }
    if (!ok) { a.delete(ca); changed = true; }
  }
  for (const cb of [...b]) {
    let ok = false;
    for (const ca of a) if (ca !== cb && pairAllows(cse, clue, ca, cb)) { ok = true; break; }
    if (!ok) { b.delete(cb); changed = true; }
  }
  return changed;
}

export function filterAlone(cse, clue, cands) {
  // If some other person can ONLY be in room R, the `alone` owner can't be in R.
  let changed = false;
  const ownerSet = cands.get(clue.owner);
  for (const p of cse.people) {
    if (p.id === clue.owner) continue;
    const set = cands.get(p.id);
    if (set.size === 0) continue;
    const rooms = new Set([...set].map((c) => cse.roomOf[c]));
    if (rooms.size === 1) {
      const forced = [...rooms][0];
      for (const cell of [...ownerSet]) {
        if (cse.roomOf[cell] === forced) { ownerSet.delete(cell); changed = true; }
      }
    }
  }
  // And nobody else may sit in a room that is the alone-owner's only option.
  const ownerRooms = new Set([...ownerSet].map((c) => cse.roomOf[c]));
  if (ownerRooms.size === 1) {
    const room = [...ownerRooms][0];
    for (const p of cse.people) {
      if (p.id === clue.owner) continue;
      const set = cands.get(p.id);
      for (const cell of [...set]) {
        if (cse.roomOf[cell] === room) { set.delete(cell); changed = true; }
      }
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Prose rendering — original wording.
// ---------------------------------------------------------------------------
const DIR_WORD = { north: 'north', south: 'south', east: 'east', west: 'west' };

export function clueText(cse, clue, objectNames) {
  const name = (pid) => cse.people.find((p) => p.id === pid).name;
  const room = (r) => cse.rooms[r].name;
  const obj = (t) => objectNames?.[t]?.label || t;
  const objPlural = (t) => objectNames?.[t]?.plural || `${obj(t)}s`;

  switch (clue.kind) {
    case 'in_room': return `was in the ${room(clue.room)}`;
    case 'not_in_room': return `was not in the ${room(clue.room)}`;
    case 'beside_object': return `was beside a ${obj(clue.objType)}`;
    case 'not_beside_object': return `was not beside any ${obj(clue.objType)}`;
    case 'same_row_object': return `was in the same row as a ${obj(clue.objType)}`;
    case 'same_col_object': return `was in the same column as a ${obj(clue.objType)}`;
    case 'dir_of_object': {
      const count = furnitureCellsOfType(cse, clue.objType).length;
      return count > 1
        ? `was ${DIR_WORD[clue.dir]} of every ${obj(clue.objType)}`
        : `was ${DIR_WORD[clue.dir]} of the ${obj(clue.objType)}`;
    }
    case 'dir_of_person': return `was ${DIR_WORD[clue.dir]} of ${name(clue.other)}`;
    case 'beside_person': return `was beside ${name(clue.other)}`;
    case 'not_beside_person': return `was not beside ${name(clue.other)}`;
    case 'same_room_person': return `was in the same room as ${name(clue.other)}`;
    case 'not_same_room_person': return `was not in the same room as ${name(clue.other)}`;
    case 'alone': return `was alone in a room`;
    case 'edge': return `was against the ${DIR_WORD[clue.dir]} wall`;
    default: return JSON.stringify(clue);
  }
}
