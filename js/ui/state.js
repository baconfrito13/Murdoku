// Game state store: placements, marks, undo/redo history, persistence, stats.

const LS_PREFIX = 'murdoku.v1.';

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function saveJSON(key, value) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch { /* private mode */ }
}

export const settings = {
  get() {
    return loadJSON('settings', { theme: 'dark', live: true, autox: false });
  },
  set(patch) {
    saveJSON('settings', { ...this.get(), ...patch });
  },
};

export const progress = {
  solvedSet() { return new Set(loadJSON('solved', [])); },
  markSolved(caseId) {
    const s = this.solvedSet(); s.add(caseId);
    saveJSON('solved', [...s]);
  },
  hasUnfinished(caseId) {
    const data = loadJSON(`game.${caseId}`, null);
    if (!data || data.finished) return false;
    return Object.values(data.placement ?? {}).some((c) => c != null)
      || (data.marks ?? []).length > 0;
  },
};

// Generated (daily/random) cases are stored whole so an unfinished one can be
// picked up again from the home screen.
export const transientCases = {
  save(cse) { saveJSON('transient', cse); },
  load() { return loadJSON('transient', null); },
  clear() { try { localStorage.removeItem(`${LS_PREFIX}transient`); } catch { /* ok */ } },
};

// Housekeeping: generated cases get unique ids, so their per-game saves would
// pile up forever. Keep only the save belonging to the current transient case.
export function pruneStaleSaves() {
  try {
    const keep = transientCases.load()?.id;
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const m = key?.startsWith(`${LS_PREFIX}game.`) && key.slice(`${LS_PREFIX}game.`.length);
      if (!m) continue;
      const isGenerated = m.startsWith('random-') || m.startsWith('daily-');
      if (isGenerated && m !== keep) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch { /* private mode */ }
}

export class GameState {
  constructor(cse) {
    this.case = cse;
    this.placement = new Map(cse.people.map((p) => [p.id, null]));
    this.marks = new Set(); // cells with player ✕
    this.autoMarks = new Set(); // machine-added ✕ (auto-X option)
    this.undoStack = [];
    this.redoStack = [];
    this.hintsUsed = 0;
    this.mistakes = 0;
    this.elapsed = 0; // seconds
    this.finished = false;
    for (const [pid, cell] of Object.entries(cse.givens ?? {})) {
      this.placement.set(pid, cell);
    }
  }

  isGiven(pid) { return this.case.givens?.[pid] != null; }

  personAt(cell) {
    for (const [pid, c] of this.placement) if (c === cell) return pid;
    return null;
  }

  // ---- actions (all undoable) ----
  apply(action, { record = true } = {}) {
    switch (action.type) {
      case 'place': {
        const prev = this.placement.get(action.pid);
        this.placement.set(action.pid, action.cell);
        action.prev = prev;
        break;
      }
      case 'mark': {
        if (action.on) this.marks.add(action.cell); else this.marks.delete(action.cell);
        break;
      }
      default: throw new Error(`bad action ${action.type}`);
    }
    if (record) {
      this.undoStack.push(action);
      this.redoStack.length = 0;
    }
  }

  undo() {
    const action = this.undoStack.pop();
    if (!action) return null;
    switch (action.type) {
      case 'place': this.placement.set(action.pid, action.prev ?? null); break;
      case 'mark': {
        if (action.on) this.marks.delete(action.cell); else this.marks.add(action.cell);
        break;
      }
    }
    this.redoStack.push(action);
    return action;
  }

  redo() {
    const action = this.redoStack.pop();
    if (!action) return null;
    switch (action.type) {
      case 'place': this.placement.set(action.pid, action.cell); break;
      case 'mark': {
        if (action.on) this.marks.add(action.cell); else this.marks.delete(action.cell);
        break;
      }
    }
    this.undoStack.push(action);
    return action;
  }

  allPlaced() {
    return [...this.placement.values()].every((c) => c != null);
  }

  // Board fingerprint: a save written against a different layout (e.g. the
  // case data was regenerated under the same id) must be ignored, not
  // half-restored onto a board it doesn't fit.
  signature() {
    const c = this.case;
    return `${c.size}|${Object.keys(c.furniture).sort().join(',')}|${c.roomOf.join('')}`;
  }

  // ---- persistence ----
  save() {
    saveJSON(`game.${this.case.id}`, {
      sig: this.signature(),
      placement: Object.fromEntries(this.placement),
      marks: [...this.marks],
      hintsUsed: this.hintsUsed,
      mistakes: this.mistakes,
      elapsed: this.elapsed,
      finished: this.finished,
    });
  }

  restore() {
    const data = loadJSON(`game.${this.case.id}`, null);
    if (!data || data.finished) return false;
    if (data.sig !== this.signature()) { this.clearSave(); return false; }

    const total = this.case.size * this.case.size;
    const taken = new Set(Object.values(this.case.givens ?? {}));
    for (const [pid, cell] of Object.entries(data.placement ?? {})) {
      if (!this.placement.has(pid)) continue;
      if (this.isGiven(pid)) continue; // givens always win
      if (cell == null) continue;
      // validate: in bounds, on the floor, not colliding
      if (!Number.isInteger(cell) || cell < 0 || cell >= total) continue;
      if (this.case.furniture[cell]) continue;
      if (taken.has(cell)) continue;
      this.placement.set(pid, cell);
      taken.add(cell);
    }
    this.marks = new Set((data.marks ?? []).filter(
      (m) => Number.isInteger(m) && m >= 0 && m < total && !this.case.furniture[m],
    ));
    this.hintsUsed = data.hintsUsed ?? 0;
    this.mistakes = data.mistakes ?? 0;
    this.elapsed = data.elapsed ?? 0;
    return true;
  }

  clearSave() {
    try { localStorage.removeItem(`${LS_PREFIX}game.${this.case.id}`); } catch { /* ok */ }
  }
}
