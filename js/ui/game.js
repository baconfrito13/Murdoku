// Game screen controller: wires board, dock, toolbar, timer, dialogs.
//
// The player places SUSPECTS only. When every suspect is on the board with no
// row/column conflict, exactly one row and one column remain free — their
// crossing is revealed as the victim's square (the book's "final V").

import { qs, el, toast, announce, openDialog, confettiBurst } from './dom.js';
import { GameState, progress, settings, transientCases } from './state.js';
import { BoardView } from './board.js';
import { DockView, avatarNode } from './cards.js';
import {
  rowOf, colOf, rowColConflicts, victimOf, impliedMurderer, derivedVictimCell,
} from '../engine/model.js';
import { evalClue } from '../engine/clues.js';
import { nextHint } from '../engine/solver.js';
import { OBJECT_NAMES } from '../roster.js';
import { t, caseTitle, caseIntro, caseReveal, roomLabel, getLang } from '../i18n.js';

export class GameScreen {
  constructor({ onExit }) {
    this.onExit = onExit;
    this.armed = null;
    this.timerId = null;
    this.pendingHint = null;
    this.lastVictimCell = null;

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
      const gameVisible = !qs('#screen-game').hidden;
      const briefOpen = qs('#dlg-story').open;
      if (gameVisible && !briefOpen && this.state && !this.state.finished) this.startTimer();
    });
    this.xMode = false;
  }

  suspects() {
    return this.case.people.filter((p) => !p.isVictim);
  }

  open(cse, { resume = true } = {}) {
    this.case = cse;
    this.state = new GameState(cse);
    if (resume) {
      const restored = this.state.restore();
      if (restored) toast(t('resumed'));
    }
    // the victim is never a player placement in this model
    this.state.placement.set(victimOf(cse).id, null);
    this.armed = null;
    this.xMode = false;
    this.lastVictimCell = null;
    qs('#tool-xmark').setAttribute('aria-pressed', 'false');

    qs('#game-title').textContent = caseTitle(cse);
    const diff = qs('#game-difficulty');
    diff.textContent = `${t('difficulty')[cse.difficulty] ?? cse.difficulty} · ${cse.size}×${cse.size}`;
    diff.className = `chip ${cse.difficulty ?? ''}`;
    qs('#game-progress').textContent = `🕵 0/${this.suspects().length}`;

    this.board = new BoardView(qs('#board'), cse, {
      onCellActivate: (cell, mods) => this.onCell(cell, mods),
    });
    this.dock = new DockView(qs('#dock'), cse, {
      onArm: (pid) => this.arm(pid),
    });
    this.renderChipStrip();
    this.wasReady = false;

    this.refresh();
    this.startTimer();
    if (!this.state.undoStack.length
      && ![...this.state.placement.values()].some((c) => c != null)) {
      this.showStory();
    }
  }

  exit() {
    this.pauseTimer();
    if (this.state && !this.state.finished) this.state.save();
    this.onExit();
  }

  // ---------- victim derivation ----------
  victimCell() {
    return derivedVictimCell(this.case, this.state.placement);
  }

  // placement map including the derived victim square, for clue evaluation
  fullPlacement() {
    const merged = new Map(this.state.placement);
    merged.set(victimOf(this.case).id, this.victimCell());
    return merged;
  }

  // ---------- interactions ----------
  arm(pid) {
    if (this.state.finished) return;
    const person = this.case.people.find((x) => x.id === pid);
    if (person.isVictim) {
      toast(t('victimLocked'));
      return;
    }
    this.armed = this.armed === pid ? null : pid;
    if (this.armed && this.xMode) this.toggleXMode(false);
    announce(this.armed ? t('selectedChoose', person.name) : t('selectionCleared'));
    this.refresh();
  }

  cancelSelection() {
    if (this.armed && this.state.placement.get(this.armed) == null) {
      const last = this.state.undoStack[this.state.undoStack.length - 1];
      if (last && last.type === 'place' && last.pid === this.armed
        && last.cell == null && last.prev != null) {
        this.state.undo();
        this.state.redoStack.length = 0;
        this.state.save();
        announce(t('cancelledBack'));
      }
    }
    this.armed = null;
    this.refresh();
  }

  onCell(cell, { alt = false } = {}) {
    if (this.state.finished) return;
    if (this.case.furniture[cell]) {
      if (!alt) toast(t('blockedSpot'));
      return;
    }
    if (this.victimCell() === cell && !alt) {
      toast(t('victimLocked'));
      return;
    }
    const occupant = this.personAtCell(cell);

    if (alt || this.xMode) {
      if (occupant || this.victimCell() === cell) { toast(t('removeFirst')); return; }
      const on = !this.state.marks.has(cell);
      this.state.apply({ type: 'mark', cell, on });
      announce(on ? t('crossedOut') : t('crossRemoved'));
      this.afterMove();
      return;
    }

    if (this.armed) {
      if (occupant && occupant !== this.armed) {
        toast(t('squareTaken'));
        return;
      }
      const target = occupant === this.armed ? null : cell; // tap own pawn = pick up
      this.state.apply({ type: 'place', pid: this.armed, cell: target });
      const p = this.case.people.find((x) => x.id === this.armed);
      if (target != null) {
        announce(t('placedAt', p.name, rowOf(cell, this.case.size) + 1, colOf(cell, this.case.size) + 1));
        this.armed = null;
      } else {
        announce(t('pickedUp', p.name));
      }
      this.afterMove();
      return;
    }

    if (occupant) {
      this.state.apply({ type: 'place', pid: occupant, cell: null });
      this.armed = occupant;
      const p = this.case.people.find((x) => x.id === occupant);
      announce(t('pickedUp', p.name));
      this.afterMove();
      return;
    }

    toast(t('selectFirst'));
  }

  personAtCell(cell) {
    const victim = victimOf(this.case);
    for (const [pid, c] of this.state.placement) {
      if (pid !== victim.id && c === cell) return pid;
    }
    return null;
  }

  toggleXMode(force) {
    this.xMode = force ?? !this.xMode;
    if (this.xMode) this.armed = null;
    qs('#tool-xmark').setAttribute('aria-pressed', String(this.xMode));
    this.refresh();
  }

  undo() {
    if (this.state.undo()) { announce(t('undone')); this.afterMove(); }
  }

  redo() {
    if (this.state.redo()) { announce(t('redone')); this.afterMove(); }
  }

  restart() {
    qs('#confirm-title').textContent = t('startOver');
    qs('#confirm-text').textContent = t('startOverText');
    const yes = qs('#confirm-yes');
    yes.textContent = t('clearBoard');
    yes.onclick = () => {
      qs('#dlg-confirm').close();
      this.state.clearSave();
      this.state = new GameState(this.case);
      this.state.placement.set(victimOf(this.case).id, null);
      this.armed = null;
      this.wasReady = false;
      this.lastVictimCell = null;
      this.refresh();
      toast(t('freshStart'));
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
    const vCell = this.victimCell();
    const used = [...this.state.placement.values()].filter((c) => c != null);
    if (vCell != null) used.push(vCell);
    for (const cell of used) {
      for (let i = 0; i < n; i++) {
        const rc = rowOf(cell, n) * n + i;
        const cc = i * n + colOf(cell, n);
        for (const target of [rc, cc]) {
          if (target !== cell && !this.case.furniture[target]
            && this.personAtCell(target) == null && target !== vCell) {
            this.state.autoMarks.add(target);
          }
        }
      }
    }
  }

  conflictCells() {
    const out = new Set();
    for (const [pa, pb] of rowColConflicts(this.case, this.state.placement)) {
      const ca = this.state.placement.get(pa);
      const cb = this.state.placement.get(pb);
      if (ca != null) out.add(ca);
      if (cb != null) out.add(cb);
    }
    return out;
  }

  violatedClues() {
    const full = this.fullPlacement();
    return this.case.clues.filter((c) => evalClue(this.case, c, full) === false);
  }

  suspectsPlaced() {
    return this.suspects().filter((p) => this.state.placement.get(p.id) != null).length;
  }

  refresh() {
    const live = settings.get().live;
    const victim = victimOf(this.case);
    const vCell = this.victimCell();
    this.computeAutoMarks();
    const conflicts = live ? this.conflictCells() : new Set();
    this.board.update(this.state, { conflicts, armed: this.armed, victimCell: vCell });
    this.board.host.classList.toggle('arming', this.armed != null);
    this.dock.update(this.state, {
      armed: this.armed, liveCheck: live, placementWithVictim: this.fullPlacement(),
    });
    this.updateChipStrip();

    // victim reveal moment
    if (vCell !== this.lastVictimCell) {
      if (vCell != null && !this.state.finished) {
        const room = roomLabel(this.case.rooms[this.case.roomOf[vCell]].name);
        const loc = t('victimRevealed', victim.name, room);
        toast(loc, 'good');
        announce(t('victimAnnounce', victim.name, room));
        this.board.flashCell(vCell);
      } else if (vCell == null && this.lastVictimCell != null
        && this.suspectsPlaced() === this.suspects().length
        && this.conflictCells().size === 0) {
        toast(t('victimNoRoom'), 'error');
      }
      this.lastVictimCell = vCell;
    }

    const hint = qs('.side-hint');
    if (this.armed) {
      const p = this.case.people.find((x) => x.id === this.armed);
      hint.textContent = t('placing', p.name.split(' ')[0]);
    } else {
      hint.textContent = t('selectThenTap');
    }

    qs('#tool-undo').disabled = this.state.undoStack.length === 0;
    qs('#tool-redo').disabled = this.state.redoStack.length === 0;
    qs('#game-progress').textContent = `🕵 ${this.suspectsPlaced()}/${this.suspects().length}`;

    const ready = vCell != null
      && this.conflictCells().size === 0
      && this.violatedClues().length === 0;
    const accuse = qs('#tool-accuse');
    accuse.setAttribute('aria-disabled', String(!ready));
    accuse.title = ready ? t('accuseReadyTitle') : t('accuseGatedTitle');
    if (ready && !this.wasReady && !this.state.finished) {
      toast(t('allChecksOut'), 'good');
    }
    this.wasReady = ready;
  }

  // ---------- mobile quick-picker strip ----------
  renderChipStrip() {
    const strip = qs('#chip-strip');
    strip.innerHTML = '';
    this.chips = new Map();
    for (const p of this.suspects()) {
      const chip = el('button', {
        class: 'strip-chip', 'aria-pressed': 'false',
        'aria-label': p.name,
        onclick: () => this.arm(p.id),
      },
        avatarNode(p),
        el('span', { class: 'strip-name' }, p.name.split(' ')[0]));
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
    const placed = this.suspectsPlaced();
    const total = this.suspects().length;

    if (conflicts.size === 0 && violated.length === 0) {
      if (this.victimCell() != null) {
        toast(t('allChecksOut'), 'good');
      } else if (verbose) {
        toast(t('noContradictions', placed, total), 'good');
      }
      return;
    }
    if (verbose) {
      const parts = [];
      if (conflicts.size) parts.push(t('rowColConflict'));
      if (violated.length) parts.push(t('cluesBroken', violated.length));
      toast(`${t('notQuite')} ${parts.join(' · ')}.`, 'error');
      this.state.mistakes++;
      this.state.save();
    }
    this.refresh();
  }

  hint() {
    const hint = nextHint(this.case, this.state.placement, OBJECT_NAMES, {
      mistake: (name) => t('hintMistake', name),
      focus: (name, clues) => t('hintFocus', name, clues),
      and: getLang() === 'pt' ? ' e ' : ' and ',
    });
    if (!hint) { toast(t('boardFull')); return; }
    this.state.hintsUsed++;
    this.state.save();
    this.pendingHint = hint;
    qs('#hint-text').textContent = hint.reason;
    qs('#hint-apply').textContent = hint.type === 'mistake' ? t('showMisplaced') : t('showOnMap');
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
      this.afterMove();
    }
    this.pendingHint = null;
  }

  // ---------- story / accusation / verdict ----------
  showStory() {
    this.pauseTimer();
    qs('#dlg-story-title').textContent = caseTitle(this.case);
    qs('#dlg-story-text').textContent = caseIntro(this.case);
    openDialog(qs('#dlg-story'));
  }

  openAccusation() {
    if (qs('#tool-accuse').getAttribute('aria-disabled') === 'true') {
      const placed = this.suspectsPlaced();
      const total = this.suspects().length;
      toast(placed < total
        ? t('placeEveryoneFirst', placed, total)
        : t('fixFirst'), 'error');
      return;
    }
    const lineup = qs('#accuse-lineup');
    lineup.innerHTML = '';
    for (const p of this.suspects()) {
      lineup.append(el('button', {
        class: 'lineup-btn',
        onclick: () => this.accuse(p.id),
      },
        avatarNode(p),
        el('span', { class: 'lineup-name' }, p.name)));
    }
    openDialog(qs('#dlg-accuse'));
  }

  accuse(pid) {
    qs('#dlg-accuse').close();
    const full = this.fullPlacement();
    const correct = pid === this.case.murderer && impliedMurderer(this.case, full) === pid;
    const accusedP = this.case.people.find((p) => p.id === pid);

    if (!correct) {
      this.state.mistakes++;
      this.state.save();
      qs('#verdict-emoji').textContent = '🚔';
      qs('#verdict-title').textContent = t('juryNotConvinced');
      qs('#verdict-text').textContent = t('wrongAccusation', accusedP.name);
      qs('#verdict-stats').innerHTML = '';
      const secondary = qs('#verdict-secondary');
      const primary = qs('#verdict-primary');
      secondary.textContent = t('backToCases');
      secondary.onclick = () => { qs('#dlg-verdict').close(); this.exit(); };
      primary.textContent = t('keepInvestigating');
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

    const text = caseReveal(this.case)
      .replaceAll('{murderer}', accusedP.name)
      .replaceAll('{murdererShort}', accusedP.name.split(' ')[0]);
    const emo = qs('#verdict-emoji');
    emo.innerHTML = '';
    emo.append(avatarNode(accusedP));
    emo.append(document.createTextNode(' ⚖️'));
    qs('#verdict-title').textContent = t('caseClosed');
    qs('#verdict-text').textContent = text;

    const stats = qs('#verdict-stats');
    stats.innerHTML = '';
    stats.append(
      el('span', { class: 'chip mono' }, `⏱ ${formatTime(this.state.elapsed)}`),
      el('span', { class: 'chip' }, t('statHints', this.state.hintsUsed)),
      el('span', { class: 'chip' }, t('statMistakes', this.state.mistakes)),
    );
    const secondary = qs('#verdict-secondary');
    const primary = qs('#verdict-primary');
    secondary.textContent = t('replay');
    secondary.onclick = () => {
      qs('#dlg-verdict').close();
      this.open(this.case, { resume: false });
    };
    primary.textContent = t('moreCases');
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
    const suspects = this.suspects();
    if (num >= 1 && num <= suspects.length) {
      this.arm(suspects[num - 1].id);
    }
  }
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
