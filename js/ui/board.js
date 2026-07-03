// Board renderer + interaction. Renders the crime-scene map as an ARIA grid
// of buttons; delegates game logic decisions to the controller via callbacks.

import { el } from './dom.js';
import { rowOf, colOf } from '../engine/model.js';
import { OBJECT_NAMES } from '../roster.js';

const ROOM_SATURATION = 46;

export function roomColor(hue, dark) {
  return dark
    ? `hsl(${hue} ${ROOM_SATURATION}% 82%)`
    : `hsl(${hue} ${ROOM_SATURATION + 8}% 86%)`;
}

export class BoardView {
  constructor(host, cse, callbacks) {
    this.host = host;
    this.case = cse;
    this.cb = callbacks; // {onCellActivate(cell, {alt}), onCellHoverInfo(cell)}
    this.cells = [];
    this.render();
  }

  render() {
    const { size: n } = this.case;
    this.host.innerHTML = '';
    this.host.style.gridTemplateColumns = `repeat(${n}, var(--cell-size))`;
    this.cells = [];

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = r * n + c;
        const room = this.case.roomOf[cell];
        const furn = this.case.furniture[cell];
        const hue = this.case.rooms[room].hue;

        const btn = el('button', {
          class: `cell ${furn ? 'furniture' : 'floor'}`,
          role: 'gridcell',
          dataset: { cell: String(cell) },
          'aria-label': this.cellLabel(cell),
          tabindex: r === 0 && c === 0 ? '0' : '-1',
        });
        btn.style.setProperty('--room-bg', roomColor(hue, true));

        // Walls: thick border where the neighboring cell is a different room
        // or the board edge.
        const wallW = '3px';
        const wallC = 'rgba(42, 33, 24, .85)';
        const setWall = (side, neighborCell, isEdge) => {
          const diff = isEdge || this.case.roomOf[neighborCell] !== room;
          btn.style.setProperty(`--b${side}`, diff ? wallW : '1px');
          if (diff) btn.style.setProperty(`--wall-${side}`, wallC);
        };
        setWall('t', cell - n, r === 0);
        setWall('b', cell + n, r === n - 1);
        setWall('l', cell - 1, c === 0);
        setWall('r', cell + 1, c === n - 1);

        if (furn) {
          const meta = OBJECT_NAMES[furn.type];
          btn.append(el('span', { class: 'furn', 'aria-hidden': 'true', title: meta?.label }, meta?.emoji ?? '▪️'));
          btn.disabled = false; // keep focusable for grid nav, but inert to actions
        }

        btn.addEventListener('click', () => this.cb.onCellActivate(cell, { alt: false }));
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.cb.onCellActivate(cell, { alt: true });
        });
        // long-press = alt action on touch
        let pressTimer = null;
        btn.addEventListener('touchstart', () => {
          pressTimer = setTimeout(() => {
            pressTimer = null;
            this.cb.onCellActivate(cell, { alt: true, fromLongPress: true });
          }, 480);
        }, { passive: true });
        const cancel = () => { if (pressTimer) clearTimeout(pressTimer); };
        btn.addEventListener('touchend', (e) => {
          if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
          else e.preventDefault(); // long-press already handled; swallow click
        });
        btn.addEventListener('touchmove', cancel, { passive: true });

        this.cells.push(btn);
        this.host.append(btn);
      }
    }

    // Roving tabindex arrow navigation.
    this.host.addEventListener('keydown', (e) => {
      const active = document.activeElement;
      if (!active?.classList?.contains('cell')) return;
      const cell = Number(active.dataset.cell);
      const r = rowOf(cell, n), c = colOf(cell, n);
      let target = null;
      if (e.key === 'ArrowRight') target = c < n - 1 ? cell + 1 : null;
      else if (e.key === 'ArrowLeft') target = c > 0 ? cell - 1 : null;
      else if (e.key === 'ArrowDown') target = r < n - 1 ? cell + n : null;
      else if (e.key === 'ArrowUp') target = r > 0 ? cell - n : null;
      else if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        this.cb.onCellActivate(cell, { alt: true });
        return;
      } else return;
      if (target != null) {
        e.preventDefault();
        this.focusCell(target);
      }
    });
  }

  focusCell(cell) {
    for (const btn of this.cells) btn.tabIndex = -1;
    const btn = this.cells[cell];
    btn.tabIndex = 0;
    btn.focus();
  }

  cellLabel(cell) {
    const n = this.case.size;
    const room = this.case.rooms[this.case.roomOf[cell]].name;
    const furn = this.case.furniture[cell];
    const base = `Row ${rowOf(cell, n) + 1}, column ${colOf(cell, n) + 1}, ${room}`;
    if (furn) return `${base}, blocked by ${OBJECT_NAMES[furn.type]?.label ?? 'furniture'}`;
    return base;
  }

  // Update dynamic layers: pawns, marks, conflicts, arming state.
  update(state, { conflicts = new Set(), armed = null } = {}) {
    const byCell = new Map();
    for (const [pid, cell] of state.placement) if (cell != null) byCell.set(cell, pid);

    for (let cell = 0; cell < this.cells.length; cell++) {
      const btn = this.cells[cell];
      const furn = this.case.furniture[cell];
      btn.querySelector('.pawn')?.remove();
      btn.querySelector('.xmark')?.remove();
      btn.classList.remove('conflict', 'armed-target', 'givenlock');

      if (furn) continue;

      const pid = byCell.get(cell);
      if (pid) {
        const person = this.case.people.find((p) => p.id === pid);
        const pawn = el('span', {
          class: 'pawn',
          style: { '--pawn-color': person.color ?? '#8a8a8a' },
        }, el('span', { class: 'pawn-emoji', 'aria-hidden': 'true' }, person.emoji));
        btn.append(pawn);
        if (state.isGiven(pid)) btn.classList.add('givenlock');
        if (conflicts.has(cell)) btn.classList.add('conflict');
        btn.setAttribute('aria-label', `${this.cellLabel(cell)}, ${person.name}${state.isGiven(pid) ? ' (given)' : ''}`);
      } else {
        if (state.marks.has(cell) || state.autoMarks.has(cell)) {
          btn.append(el('span', { class: 'xmark', 'aria-hidden': 'true' }, '✕'));
          btn.setAttribute('aria-label', `${this.cellLabel(cell)}, crossed out`);
        } else {
          btn.setAttribute('aria-label', `${this.cellLabel(cell)}, empty`);
        }
        if (armed) btn.classList.add('armed-target');
      }
    }
  }

  flashCell(cell) {
    const btn = this.cells[cell];
    btn.classList.remove('hintflash');
    void btn.offsetWidth; // restart animation
    btn.classList.add('hintflash');
    btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  renderLegend(host) {
    host.innerHTML = '';
    this.case.rooms.forEach((room) => {
      host.append(el('span', { class: 'legend-room' },
        el('span', { class: 'legend-swatch', style: { background: roomColor(room.hue, true) } }),
        room.name));
    });
  }
}
