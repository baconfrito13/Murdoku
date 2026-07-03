// Game screen controller: wires board, dock, toolbar, timer, dialogs.

import { qs, el, toast, announce, openDialog, confettiBurst } from './dom.js';
import { GameState, progress, settings, transientCases } from './state.js';
import { BoardView } from './board.js';
import { DockView } from './cards.js';
import { rowOf, colOf, rowColConflicts, victimOf, impliedMurderer } from '../engine/model.js';
import { evalClue } from '../engine/clues.js';
import { nextHint } from '../engine/solver.js';
import { OBJECT_NAMES } from '../roster.js';

export class GameScreen {
  constructor({ onExit }) {
    this.onExit = onExit;
    this.armed = null;
    this.timerId = null;
    this.pendingHint = null;

    // toolbar
    qs('#btn-back').addEventListener('click', () => this.exit());
    qs('#btn-story').addEventListener('click', () => this.showStory());
    qs('#tool-xmark').addEventListener('click', () => this.toggleXMode());
    qs('#tool-undo').addEventListener('click', () => this.undo());
    qs('#tool-redo').addEventListener('click', () => this.redo());
    qs('#tool-check').addEventListener('click', () => this.check(true));
    qs('#tool-hint').addEventListener('click', () => this.hint());
    qs('#tool-restart').addEventListener('click', () => this.restart());
    qs('#tool-accuse').addEventListener('click', () => this.openAccusation());
    qs('#hint-apply').addEventListener('click', () => this.applyHint());

    const opts = settings.get();
    const live = qs('#opt-live'); const autox = qs('#opt-autox');
    live.checked = opts.live; autox.checked = opts.autox;
    live.addEventListener('change', () => { settings.set({ live: live.checked }); this.refresh(); });
    autox.addEventListener('change', () => { settings.set({ autox: autox.checked }); this.refresh(); });

    // pause the clock while the brief is open
    qs('#dlg-story').addEventListener('close', () => {
      if (this.state && !this.state.finished && !qs('#screen-game').hidden) this.startTimer();
    });

    document.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.pauseTimer(); return; }
      // only resume when the game screen is actually up and the brief closed
      const gameVisible = !qs('#screen-game').hidden;
      const briefOpen = qs('#dlg-story').open;
      if (gameVisible && !briefOpen && this.state && !this.state.finished) this.startTimer();
    });
    this.xMode = false;
  }

  open(cse, { resume = true } = {}) {
    this.case = cse;
    this.state = new GameState(cse);
    if (resume) {
      const restored = this.state.restore();
      if (restored) toast('Investigation resumed where you left off.');
    }
    this.armed = null;
    this.xMode = false;
    qs('#tool-xmark').setAttribute('aria-pressed', 'false');

    qs('#game-title').textContent = cse.title;
    const diff = qs('#game-difficulty');
    diff.textContent = `${cse.difficulty ?? 'case'} · ${cse.size}×${cse.size}`;
    diff.className = `chip ${cse.difficulty ?? ''}`;

    this.board = new BoardView(qs('#board'), cse, {
      onCellActivate: (cell, mods) => this.onCell(cell, mods),
    });
    this.board.renderLegend(qs('#board-legend'));
    this.dock = new DockView(qs('#dock'), cse, {
      onArm: (pid) => this.arm(pid),
    });
    this.renderChipStrip();
    this.wasReady = false;

    this.refresh();
    this.startTimer();
    if (!this.state.undoStack.length && ![...this.state.placement.values()].some((c, i) => c != null && !Object.values(cse.givens ?? {}).includes(c))) {
      this.showStory();
    }
  }

  exit() {
    this.pauseTimer();
    if (this.state && !this.state.finished) this.state.save();
    this.onExit();
  }

  // ---------- interactions ----------
  arm(pid) {
    if (this.state.finished) return;
    if (this.state.isGiven(pid)) {
      toast('That position is part of the case file — it cannot move.');
      return;
    }
    this.armed = this.armed === pid ? null : pid;
    if (this.armed && this.xMode) this.toggleXMode(false);
    const p = this.case.people.find((x) => x.id === pid);
    announce(this.armed ? `${p.name} selected. Choose a square.` : 'Selection cleared.');
    this.refresh();
  }

  // Cancel the current selection; if the selected person was just picked up
  // off the board, put them back where they were.
  cancelSelection() {
    if (this.armed && this.state.placement.get(this.armed) == null) {
      const last = this.state.undoStack[this.state.undoStack.length - 1];
      if (last && last.type === 'place' && last.pid === this.armed
        && last.cell == null && last.prev != null) {
        this.state.undo();
        this.state.redoStack.length = 0;
        this.state.save();
        announce('Selection cancelled — returned to their square.');
      }
    }
    this.armed = null;
    this.refresh();
  }

  onCell(cell, { alt = false } = {}) {
    if (this.state.finished) return;
    if (this.case.furniture[cell]) {
      if (!alt) toast('Nobody can stand there — the spot is blocked.');
      return;
    }
    const occupant = this.state.personAt(cell);

    if (alt || this.xMode) {
      if (occupant) { toast('Remove the person first to cross that square out.'); return; }
      const on = !this.state.marks.has(cell);
      this.state.apply({ type: 'mark', cell, on });
      announce(on ? 'Square crossed out.' : 'Cross removed.');
      this.afterMove();
      return;
    }

    if (this.armed) {
      if (occupant && occupant !== this.armed) {
        toast('That square is taken.');
        return;
      }
      const target = occupant === this.armed ? null : cell; // tap own pawn = pick up
      this.state.apply({ type: 'place', pid: this.armed, cell: target });
      const p = this.case.people.find((x) => x.id === this.armed);
      if (target != null) {
        announce(`${p.name} placed at row ${rowOf(cell, this.case.size) + 1}, column ${colOf(cell, this.case.size) + 1}.`);
        this.armed = null;
      } else {
        announce(`${p.name} picked up.`);
      }
      this.afterMove();
      return;
    }

    if (occupant) {
      if (this.state.isGiven(occupant)) {
        toast('That position is part of the case file — it cannot move.');
        return;
      }
      // pick up: arm and remove
      this.state.apply({ type: 'place', pid: occupant, cell: null });
      this.armed = occupant;
      const p = this.case.people.find((x) => x.id === occupant);
      announce(`${p.name} picked up. Choose a new square.`);
      this.afterMove();
      return;
    }

    toast('Select a suspect card first, or use ✕ to cross squares out.');
  }

  toggleXMode(force) {
    this.xMode = force ?? !this.xMode;
    if (this.xMode) this.armed = null;
    qs('#tool-xmark').setAttribute('aria-pressed', String(this.xMode));
    this.refresh();
  }

  undo() {
    if (this.state.undo()) { announce('Undone.'); this.afterMove(); }
  }

  redo() {
    if (this.state.redo()) { announce('Redone.'); this.afterMove(); }
  }

  restart() {
    qs('#confirm-title').textContent = 'Start over?';
    qs('#confirm-text').textContent = 'This clears every placement and ✕ on the board. The case stays the same.';
    const yes = qs('#confirm-yes');
    yes.textContent = 'Clear the board';
    yes.onclick = () => {
      qs('#dlg-confirm').close();
      this.state.clearSave();
      this.state = new GameState(this.case);
      this.armed = null;
      this.wasReady = false;
      this.refresh();
      toast('A fresh start. The truth is still in there.');
    };
    openDialog(qs('#dlg-confirm'));
  }

  afterMove() {
    this.state.save();
    this.refresh();
  }

  // ---------- derived state & rendering ----------
  computeAutoMarks() {
    this.state.autoMarks.clear();
    if (!settings.get().autox) return;
    const n = this.case.size;
    for (const [, cell] of this.state.placement) {
      if (cell == null) continue;
      for (let i = 0; i < n; i++) {
        const rc = rowOf(cell, n) * n + i;
        const cc = i * n + colOf(cell, n);
        for (const target of [rc, cc]) {
          if (target !== cell && !this.case.furniture[target] && this.state.personAt(target) == null) {
            this.state.autoMarks.add(target);
          }
        }
      }
    }
  }

  conflictCells() {
    const out = new Set();
    for (const [pa, pb] of rowColConflicts(this.case, this.state.placement)) {
      out.add(this.state.placement.get(pa));
      out.add(this.state.placement.get(pb));
    }
    return out;
  }

  violatedClues() {
    return this.case.clues.filter((c) => evalClue(this.case, c, this.state.placement) === false);
  }

  refresh() {
    const live = settings.get().live;
    this.computeAutoMarks();
    const conflicts = live ? this.conflictCells() : new Set();
    this.board.update(this.state, { conflicts, armed: this.armed });
    this.board.host.classList.toggle('arming', this.armed != null);
    this.dock.update(this.state, { armed: this.armed, liveCheck: live });
    this.updateChipStrip();

    // dock header doubles as a "holding …" indicator
    const hint = qs('.side-hint');
    if (this.armed) {
      const p = this.case.people.find((x) => x.id === this.armed);
      hint.textContent = `placing ${p.name.split(' ')[0]} — tap a square (Esc cancels)`;
    } else {
      hint.textContent = 'select, then tap the map';
    }

    qs('#tool-undo').disabled = this.state.undoStack.length === 0;
    qs('#tool-redo').disabled = this.state.redoStack.length === 0;

    const ready = this.state.allPlaced()
      && this.conflictCells().size === 0
      && this.violatedClues().length === 0;
    const accuse = qs('#tool-accuse');
    // aria-disabled (not disabled) so touch users still get feedback on tap
    accuse.setAttribute('aria-disabled', String(!ready));
    accuse.title = ready
      ? 'Name the murderer'
      : 'Place everyone with no conflicts and no broken clues first';
    if (ready && !this.wasReady && !this.state.finished) {
      toast('Everything checks out. Time to point a finger…', 'good');
    }
    this.wasReady = ready;
  }

  // ---------- mobile quick-picker strip ----------
  renderChipStrip() {
    const strip = qs('#chip-strip');
    strip.innerHTML = '';
    this.chips = new Map();
    for (const p of this.case.people) {
      const chip = el('button', {
        class: 'strip-chip', 'aria-pressed': 'false',
        'aria-label': `Select ${p.name}`,
        onclick: () => this.arm(p.id),
      },
        el('span', { class: 'avatar', style: { '--pawn-color': p.color ?? '#8a8a8a' }, 'aria-hidden': 'true' }, p.emoji),
        el('span', { class: 'strip-name' }, p.name.split(' ')[0] + (p.isVictim ? ' †' : '')));
      this.chips.set(p.id, chip);
      strip.append(chip);
    }
  }

  updateChipStrip() {
    if (!this.chips) return;
    for (const [pid, chip] of this.chips) {
      chip.setAttribute('aria-pressed', String(this.armed === pid));
      chip.classList.toggle('placed-chip', this.state.placement.get(pid) != null);
    }
  }

  // ---------- check / hint ----------
  check(verbose) {
    const conflicts = this.conflictCells();
    const violated = this.violatedClues();
    const placed = [...this.state.placement.values()].filter((c) => c != null).length;

    if (conflicts.size === 0 && violated.length === 0) {
      if (this.state.allPlaced()) {
        toast('Everything checks out. Time to point a finger…', 'good');
      } else if (verbose) {
        toast(`No contradictions so far — ${placed}/${this.case.people.length} placed.`, 'good');
      }
      return;
    }
    if (verbose) {
      const bits = [];
      if (conflicts.size) bits.push('two people share a row or column');
      if (violated.length) bits.push(`${violated.length} clue${violated.length > 1 ? 's are' : ' is'} broken`);
      toast(`Not quite: ${bits.join(' and ')}.`, 'error');
      this.state.mistakes++;
      this.state.save();
    }
    this.refresh();
  }

  hint() {
    const hint = nextHint(this.case, this.state.placement, OBJECT_NAMES);
    if (!hint) { toast('The board is full — press Check or make your accusation.'); return; }
    this.state.hintsUsed++;
    this.state.save();
    this.pendingHint = hint;
    qs('#hint-text').textContent = hint.reason;
    qs('#hint-apply').textContent = hint.type === 'mistake' ? 'Show me the misplaced person' : 'Show me on the map';
    openDialog(qs('#dlg-hint'));
  }

  applyHint() {
    qs('#dlg-hint').close();
    const hint = this.pendingHint;
    if (!hint) return;
    if (hint.type === 'mistake') {
      this.board.flashCell(hint.cell);
    } else {
      this.state.apply({ type: 'place', pid: hint.personId, cell: hint.cell });
      this.board.flashCell(hint.cell);
      const p = this.case.people.find((x) => x.id === hint.personId);
      announce(`${p.name} placed by deduction.`);
      this.afterMove();
    }
    this.pendingHint = null;
  }

  // ---------- story / accusation / verdict ----------
  showStory() {
    this.pauseTimer();
    qs('#dlg-story-title').textContent = this.case.title;
    qs('#dlg-story-text').textContent = this.case.story?.intro ?? '';
    openDialog(qs('#dlg-story'));
  }

  openAccusation() {
    if (qs('#tool-accuse').getAttribute('aria-disabled') === 'true') {
      const placed = [...this.state.placement.values()].filter((c) => c != null).length;
      toast(placed < this.case.people.length
        ? `Place everyone first — ${placed}/${this.case.people.length} on the map.`
        : 'Fix the conflicts and broken clues first — the jury wants a flawless map.', 'error');
      return;
    }
    const lineup = qs('#accuse-lineup');
    lineup.innerHTML = '';
    for (const p of this.case.people) {
      if (p.isVictim) continue;
      lineup.append(el('button', {
        class: 'lineup-btn',
        onclick: () => this.accuse(p.id),
      },
        el('span', { class: 'avatar', style: { '--pawn-color': p.color }, 'aria-hidden': 'true' }, p.emoji),
        el('span', { class: 'lineup-name' }, p.name)));
    }
    openDialog(qs('#dlg-accuse'));
  }

  accuse(pid) {
    qs('#dlg-accuse').close();
    const correct = pid === this.case.murderer
      && impliedMurderer(this.case, this.state.placement) === pid;
    const accusedP = this.case.people.find((p) => p.id === pid);

    if (!correct) {
      this.state.mistakes++;
      this.state.save();
      qs('#verdict-emoji').textContent = '🚔';
      qs('#verdict-title').textContent = 'The jury is not convinced';
      qs('#verdict-text').textContent =
        `${accusedP.name} produces an alibi and walks free. Someone in this room is smiling. ` +
        'Re-examine who was truly alone with the victim.';
      qs('#verdict-stats').innerHTML = '';
      const secondary = qs('#verdict-secondary');
      const primary = qs('#verdict-primary');
      secondary.textContent = 'Back to cases';
      secondary.onclick = () => { qs('#dlg-verdict').close(); this.exit(); };
      primary.textContent = 'Keep investigating';
      primary.onclick = () => qs('#dlg-verdict').close();
      openDialog(qs('#dlg-verdict'));
      return;
    }

    // WIN
    this.state.finished = true;
    this.pauseTimer();
    progress.markSolved(this.case.id);
    this.state.clearSave();
    if (transientCases.load()?.id === this.case.id) transientCases.clear();

    const story = this.case.story?.reveal ?? '{murderer} did it.';
    const text = story
      .replaceAll('{murderer}', accusedP.name)
      .replaceAll('{murdererShort}', accusedP.name.split(' ')[0]);
    qs('#verdict-emoji').textContent = '⚖️';
    qs('#verdict-title').textContent = 'Case closed!';
    qs('#verdict-text').textContent = text;

    const stats = qs('#verdict-stats');
    stats.innerHTML = '';
    stats.append(
      el('span', { class: 'chip mono' }, `⏱ ${formatTime(this.state.elapsed)}`),
      el('span', { class: 'chip' }, `💡 ${this.state.hintsUsed} hint${this.state.hintsUsed === 1 ? '' : 's'}`),
      el('span', { class: 'chip' }, `✗ ${this.state.mistakes} mistake${this.state.mistakes === 1 ? '' : 's'}`),
    );
    const secondary = qs('#verdict-secondary');
    const primary = qs('#verdict-primary');
    secondary.textContent = 'Replay';
    secondary.onclick = () => {
      qs('#dlg-verdict').close();
      this.open(this.case, { resume: false });
    };
    primary.textContent = 'More cases';
    primary.onclick = () => { qs('#dlg-verdict').close(); this.exit(); };
    confettiBurst();
    openDialog(qs('#dlg-verdict'));
  }

  // ---------- timer ----------
  startTimer() {
    this.pauseTimer();
    this.renderTime();
    this.timerId = setInterval(() => {
      this.state.elapsed++;
      this.renderTime();
      if (this.state.elapsed % 15 === 0) this.state.save();
    }, 1000);
  }

  pauseTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  }

  renderTime() {
    qs('#game-timer').textContent = formatTime(this.state.elapsed);
  }

  // ---------- keyboard ----------
  onKey(e) {
    if (qs('#screen-game').hidden || this.state?.finished) return;
    if (e.target.matches('input, textarea')) return;
    if (document.querySelector('dialog[open]')) return;

    if (e.key === 'Escape') { this.cancelSelection(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); return; }
    if (e.key.toLowerCase() === 'h') { this.hint(); return; }
    if (e.key.toLowerCase() === 'm') { this.toggleXMode(); return; }
    const num = Number(e.key);
    if (num >= 1 && num <= this.case.people.length) {
      this.arm(this.case.people[num - 1].id);
    }
  }
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
