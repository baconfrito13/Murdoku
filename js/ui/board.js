// Board renderer + interaction. Renders the crime-scene map; delegates game
// logic decisions to the controller via callbacks.

import { el } from './dom.js';
import { rowOf, colOf, victimOf } from '../engine/model.js';
import { OBJECT_NAMES } from '../roster.js';
import { monogramOf } from '../roster.js';
import { ICONS } from '../icons.js';
import { roomLabel, roleLabel, getLang } from '../i18n.js';

const ROOM_SATURATION = 46;

export function roomColor(hue, dark) {
  return dark
    ? `hsl(${hue} ${ROOM_SATURATION}% 82%)`
    : `hsl(${hue} ${ROOM_SATURATION + 8}% 86%)`;
}

function iconSvg(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon ${cls}`);
  svg.innerHTML = ICONS[name] ?? '';
  return svg;
}

export function pawnNode(person, { victimStyle = false } = {}) {
  const pawn = el('span', {
    class: `pawn ${victimStyle ? 'victim-pawn' : ''}`,
    style: { '--pawn-color': person.color ?? '#8a8a8a' },
  });
  if (victimStyle) {
    pawn.append(iconSvg('victim', 'pawn-skull'));
  } else {
    pawn.append(el('span', { class: 'pawn-mono', 'aria-hidden': 'true' }, monogramOf(person)));
  }
  return pawn;
}

export class BoardView {
  constructor(host, cse, callbacks) {
    this.host = host;
    this.case = cse;
    this.cb = callbacks; // {onCellActivate(cell, {alt})}
    this.cells = [];
    this.render();
  }

  render() {
    const { size: n } = this.case;
    this.host.innerHTML = '';
    this.host.style.gridTemplateColumns = `repeat(${n}, var(--cell-size))`;
    this.cells = [];

    // top-left-most cell of each room hosts its small name label
    const labelCell = new Map();
    for (let cell = 0; cell < n * n; cell++) {
      const room = this.case.roomOf[cell];
      if (!labelCell.has(room)) labelCell.set(room, cell);
    }

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = r * n + c;
        const room = this.case.roomOf[cell];
        const furn = this.case.furniture[cell];
        const hue = this.case.rooms[room].hue;

        const btn = el('button', {
          class: `cell ${furn ? 'furniture' : 'floor'}`,
          dataset: { cell: String(cell) },
          'aria-label': this.cellLabel(cell),
          tabindex: r === 0 && c === 0 ? '0' : '-1',
        });
        btn.style.setProperty('--room-bg', roomColor(hue, true));

        // Walls: thick border where the neighboring cell is a different room
        // or the board edge.
        const wallW = 'var(--wall-w)';
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

        if (labelCell.get(room) === cell) {
          btn.append(el('span', { class: 'room-tag', 'aria-hidden': 'true' },
            roomLabel(this.case.rooms[room].name)));
        }

        if (furn) {
          const icon = iconSvg(furn.type, 'furn');
          icon.setAttribute('title', OBJECT_NAMES[furn.type]?.label ?? furn.type);
          btn.append(icon);
        }

        btn.addEventListener('click', () => this.cb.onCellActivate(cell, { alt: false }));
        // Long-press = alt action on touch. Android also fires `contextmenu`
        // at ~500ms during a long-press, so the two paths must not both run:
        // the timer sets `longPressAt` and the contextmenu handler ignores
        // events arriving shortly after it.
        let pressTimer = null;
        let longPressAt = 0;
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (Date.now() - longPressAt < 900) return; // already handled by long-press
          this.cb.onCellActivate(cell, { alt: true });
        });
        btn.addEventListener('touchstart', () => {
          pressTimer = setTimeout(() => {
            pressTimer = null;
            longPressAt = Date.now();
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

    // Roving tabindex arrow navigation. Property assignment (not
    // addEventListener) so re-opening a case replaces the handler instead of
    // stacking a second one on the shared #board element.
    this.host.onkeydown = (e) => {
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
    };
  }

  focusCell(cell) {
    for (const btn of this.cells) btn.tabIndex = -1;
    const btn = this.cells[cell];
    btn.tabIndex = 0;
    btn.focus();
  }

  cellLabel(cell) {
    const n = this.case.size;
    const room = roomLabel(this.case.rooms[this.case.roomOf[cell]].name);
    const furn = this.case.furniture[cell];
    const pt = getLang() === 'pt';
    const base = pt
      ? `Linha ${rowOf(cell, n) + 1}, coluna ${colOf(cell, n) + 1}, ${room}`
      : `Row ${rowOf(cell, n) + 1}, column ${colOf(cell, n) + 1}, ${room}`;
    if (furn) {
      return pt ? `${base}, bloqueada por mobília` : `${base}, blocked by furniture`;
    }
    return base;
  }

  // Update dynamic layers: pawns, marks, conflicts, arming state, revealed
  // victim (victimCell may be null while undetermined).
  update(state, { conflicts = new Set(), armed = null, victimCell = null } = {}) {
    const victim = victimOf(this.case);
    const byCell = new Map();
    for (const [pid, cell] of state.placement) {
      if (pid !== victim.id && cell != null) byCell.set(cell, pid);
    }

    for (let cell = 0; cell < this.cells.length; cell++) {
      const btn = this.cells[cell];
      const furn = this.case.furniture[cell];
      btn.querySelector('.pawn')?.remove();
      btn.querySelector('.xmark')?.remove();
      btn.classList.remove('conflict', 'armed-target', 'victim-cell');

      if (furn) continue;

      const pid = byCell.get(cell);
      if (pid) {
        const person = this.case.people.find((p) => p.id === pid);
        btn.append(pawnNode(person));
        if (conflicts.has(cell)) btn.classList.add('conflict');
        btn.setAttribute('aria-label', `${this.cellLabel(cell)}, ${person.name}`);
      } else if (victimCell === cell) {
        btn.append(pawnNode(victim, { victimStyle: true }));
        btn.classList.add('victim-cell');
        btn.setAttribute('aria-label', `${this.cellLabel(cell)}, ${victim.name} †`);
      } else {
        if (state.marks.has(cell) || state.autoMarks.has(cell)) {
          btn.append(el('span', { class: 'xmark', 'aria-hidden': 'true' }, '✕'));
          btn.setAttribute('aria-label', `${this.cellLabel(cell)}, ✕`);
        } else {
          btn.setAttribute('aria-label', this.cellLabel(cell));
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
}
