// App bootstrap: home screen, routing between screens, theme, dialogs.

import { qs, el, toast, wireDialogClose, openDialog } from './ui/dom.js';
import { settings, progress, transientCases, pruneStaleSaves } from './ui/state.js';
import { GameScreen } from './ui/game.js';
import { CAMPAIGN_CASES } from './cases-data.js';
import { makeDailyCase, makeRandomCase } from './daily.js';

const screens = {
  home: qs('#screen-home'),
  game: qs('#screen-game'),
};

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
  qs('#confetti').innerHTML = ''; // never let a celebration bleed into the next screen
  window.scrollTo({ top: 0 });
}

// ---------- theme ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  settings.set({ theme });
}

qs('#btn-theme').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(cur);
});

// ---------- home ----------
function difficultyLabel(d) {
  return { easy: 'gentle', medium: 'tricky', hard: 'devious' }[d] ?? d;
}

function renderHome() {
  const list = qs('#campaign-list');
  list.innerHTML = '';
  const solved = progress.solvedSet();

  // Unfinished generated case? Offer to pick it back up.
  const transient = transientCases.load();
  if (transient && progress.hasUnfinished(transient.id)) {
    list.append(el('button', {
      class: 'case-card', role: 'listitem',
      onclick: () => startCase(transient),
    },
      el('span', { class: 'case-num' }, 'OPEN INVESTIGATION'),
      el('span', { class: 'case-name' }, transient.title),
      el('span', { class: 'case-tags' },
        el('span', { class: `chip ${transient.difficulty}` }, difficultyLabel(transient.difficulty)),
        el('span', { class: 'chip' }, `${transient.size}×${transient.size}`),
        el('span', { class: 'chip medium' }, '⏳ in progress')),
    ));
  }

  CAMPAIGN_CASES.forEach((cse, i) => {
    const card = el('button', {
      class: 'case-card', role: 'listitem',
      onclick: () => startCase(cse),
    },
      el('span', { class: 'case-num' }, `CASE FILE №${String(i + 1).padStart(2, '0')}`),
      el('span', { class: 'case-name' }, cse.title),
      el('span', { class: 'case-tags' },
        el('span', { class: `chip ${cse.difficulty}` }, difficultyLabel(cse.difficulty)),
        el('span', { class: 'chip' }, `${cse.size}×${cse.size}`),
        solved.has(cse.id) ? el('span', { class: 'chip solved' }, '✓ solved')
          : progress.hasUnfinished(cse.id) ? el('span', { class: 'chip medium' }, '⏳ in progress') : null),
    );
    list.append(card);
  });
}

// ---------- game ----------
const game = new GameScreen({
  onExit: () => { renderHome(); show('home'); },
});

function startCase(cse, opts) {
  show('game');
  game.open(cse, opts);
}

qs('#btn-home').addEventListener('click', () => {
  if (!screens.game.hidden) game.exit();
  else { renderHome(); show('home'); }
});

qs('#btn-daily').addEventListener('click', () => {
  const btn = qs('#btn-daily');
  btn.disabled = true; btn.textContent = '🔍 Building today’s scene…';
  // generation can take a moment on 6x6 — let the UI paint first
  setTimeout(() => {
    try {
      const cse = makeDailyCase();
      if (cse) { transientCases.save(cse); startCase(cse); }
      else toast('Could not build today’s case — try a random one.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🗓️ Today’s Case';
    }
  }, 30);
});

qs('#btn-random').addEventListener('click', () => {
  const btn = qs('#btn-random');
  btn.disabled = true; btn.textContent = '🔍 Shuffling suspects…';
  setTimeout(() => {
    try {
      const cse = makeRandomCase();
      if (cse) { transientCases.save(cse); startCase(cse, { resume: false }); }
      else toast('The generator came up empty — try again.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🎲 Random Case';
    }
  }, 30);
});

qs('#btn-tutorial').addEventListener('click', () => {
  openDialog(qs('#dlg-help'));
});

qs('#btn-help').addEventListener('click', () => openDialog(qs('#dlg-help')));

// ---------- boot ----------
pruneStaleSaves();
wireDialogClose();
applyTheme(settings.get().theme ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
renderHome();
show('home');
