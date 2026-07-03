// Suspect/victim dock: cards with avatar, role and live clue status.

import { el } from './dom.js';
import { evalClue, clueText } from '../engine/clues.js';
import { OBJECT_NAMES } from '../roster.js';

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
      const card = el('button', {
        class: `suspect-card ${person.isVictim ? 'victim-card' : ''}`,
        role: 'option',
        'aria-selected': 'false',
        dataset: { pid: person.id },
        onclick: () => this.cb.onArm(person.id),
      },
        el('span', { class: 'avatar', style: { '--pawn-color': person.color ?? '#8a8a8a' }, 'aria-hidden': 'true' }, person.emoji),
        el('span', { class: 'suspect-id' },
          el('span', { class: 'suspect-name' }, person.name + (person.isVictim ? ' †' : '')),
          el('br'),
          el('span', { class: 'suspect-role' }, person.role)),
        el('span', { class: 'suspect-status', 'aria-hidden': 'true' }, ''),
        clues.length
          ? el('ul', { class: 'clue-list' }, clues.map((clue) => el('li', {
            class: 'clue-item',
            dataset: { clue: JSON.stringify(clue) },
          }, el('span', { class: 'clue-quote' }, `“${clueText(this.case, clue, OBJECT_NAMES)}”`))))
          : el('div', { class: 'clue-list no-clue' }, person.isVictim
            ? 'The dead keep their secrets.'
            : 'No statement given.'),
      );
      this.cards.set(person.id, card);
      this.host.append(card);
    }
  }

  update(state, { armed = null, liveCheck = true } = {}) {
    for (const person of this.case.people) {
      const card = this.cards.get(person.id);
      const placed = state.placement.get(person.id) != null;
      card.setAttribute('aria-selected', String(armed === person.id));
      card.classList.toggle('placed-card', placed);
      const status = card.querySelector('.suspect-status');
      status.textContent = state.isGiven(person.id) ? '📌' : placed ? '📍' : '';

      for (const li of card.querySelectorAll('.clue-item')) {
        li.classList.remove('ok', 'bad');
        if (!liveCheck) continue;
        const clue = JSON.parse(li.dataset.clue);
        const verdict = evalClue(this.case, clue, state.placement);
        if (verdict === true) li.classList.add('ok');
        else if (verdict === false) li.classList.add('bad');
      }
    }
  }
}
