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
};

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

  // ---- persistence ----
  save() {
    saveJSON(`game.${this.case.id}`, {
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
    for (const [pid, cell] of Object.entries(data.placement ?? {})) {
      if (this.placement.has(pid)) this.placement.set(pid, cell);
    }
    // givens always win
    for (const [pid, cell] of Object.entries(this.case.givens ?? {})) {
      this.placement.set(pid, cell);
    }
    this.marks = new Set(data.marks ?? []);
    this.hintsUsed = data.hintsUsed ?? 0;
    this.mistakes = data.mistakes ?? 0;
    this.elapsed = data.elapsed ?? 0;
    return true;
  }

  clearSave() {
    try { localStorage.removeItem(`${LS_PREFIX}game.${this.case.id}`); } catch { /* ok */ }
  }
}
