// Suspect/victim dock: cards with monogram avatar, role and live clue status.
// The victim card is informational — the body is revealed by deduction, so it
// is never selectable for placement.

import { el } from './dom.js';
import { evalClue, clueText } from '../engine/clues.js';
import { OBJECT_NAMES, monogramOf } from '../roster.js';
import { ICONS } from '../icons.js';
import { t, roleLabel } from '../i18n.js';

function avatarNode(person, { victimStyle = false } = {}) {
  const av = el('span', {
    class: `avatar ${victimStyle ? 'victim-avatar' : ''}`,
    style: { '--pawn-color': person.color ?? '#8a8a8a' },
    'aria-hidden': 'true',
  });
  if (victimStyle) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', 'icon avatar-skull');
    svg.innerHTML = ICONS.victim;
    av.append(svg);
  } else {
    av.append(el('span', { class: 'avatar-mono' }, monogramOf(person)));
  }
  return av;
}

export class DockView {
  constructor(host, cse, callbacks) {
    this.host = host;
    this.case = cse;
    this.cb = callbacks; // {onArm(pid)}
    this.cards = new Map();
    this.render();
  }

  render() {
    this.host.innerHTML = '';
    this.cards.clear();
    for (const person of this.case.people) {
      const clues = this.case.clues.filter((c) => c.owner === person.id);
      const isV = !!person.isVictim;
      const card = el('button', {
        class: `suspect-card ${isV ? 'victim-card' : ''}`,
        'aria-pressed': 'false',
        dataset: { pid: person.id },
        onclick: () => this.cb.onArm(person.id),
      },
        avatarNode(person, { victimStyle: isV }),
        el('span', { class: 'suspect-id' },
          el('span', { class: 'suspect-name' }, person.name + (isV ? ' †' : '')),
          el('br'),
          el('span', { class: 'suspect-role' }, roleLabel(person.role))),
        el('span', { class: 'suspect-status' }, ''),
        el('span', { class: 'clue-wrap' },
          // The victim's card carries the murder rule, never positional clues.
          isV ? el('div', { class: 'clue-item victim-rule' },
            el('span', { class: 'clue-quote' }, `“${t('victimCard')}”`)) : null,
          isV ? el('div', { class: 'no-clue victim-note' }, t('victimRevealHint')) : null,
          !isV && clues.length
            ? el('ul', { class: 'clue-list' }, clues.map((clue) => el('li', {
              class: 'clue-item',
              dataset: { clue: JSON.stringify(clue) },
            },
              el('span', { class: 'clue-state', 'aria-hidden': 'true' }, ''),
              el('span', { class: 'visually-hidden clue-sr' }, ''),
              el('span', { class: 'clue-quote' }, `“${clueText(this.case, clue, OBJECT_NAMES)}”`))))
            : (!isV ? el('div', { class: 'no-clue' }, t('noStatement')) : null)),
      );
      this.cards.set(person.id, card);
      this.host.append(card);
    }
  }

  update(state, { armed = null, liveCheck = true, placementWithVictim = null } = {}) {
    const evalMap = placementWithVictim ?? state.placement;
    for (const person of this.case.people) {
      const card = this.cards.get(person.id);
      const placed = evalMap.get(person.id) != null;
      card.setAttribute('aria-pressed', String(armed === person.id));
      card.classList.toggle('placed-card', placed && !person.isVictim);
      card.classList.toggle('revealed-card', placed && !!person.isVictim);
      const status = card.querySelector('.suspect-status');
      status.textContent = person.isVictim ? (placed ? '†' : '') : (placed ? '📍' : '');

      for (const li of card.querySelectorAll('.clue-item')) {
        if (!li.dataset.clue) continue; // the victim's fixed rule line has no state
        li.classList.remove('ok', 'bad');
        const stateGlyph = li.querySelector('.clue-state');
        const sr = li.querySelector('.clue-sr');
        stateGlyph.textContent = '';
        sr.textContent = '';
        if (!liveCheck) continue;
        const clue = JSON.parse(li.dataset.clue);
        const verdict = evalClue(this.case, clue, evalMap);
        if (verdict === true) {
          li.classList.add('ok');
          stateGlyph.textContent = '✓';
          sr.textContent = t('stmtHolds');
        } else if (verdict === false) {
          li.classList.add('bad');
          stateGlyph.textContent = '✗';
          sr.textContent = t('stmtBroken');
        }
      }
    }
  }
}

export { avatarNode };
