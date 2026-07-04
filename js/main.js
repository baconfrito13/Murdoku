// App bootstrap: home screen, routing between screens, theme, language.

import { qs, el, toast, wireDialogClose, openDialog } from './ui/dom.js';
import { settings, progress, transientCases, pruneStaleSaves } from './ui/state.js';
import { GameScreen } from './ui/game.js';
import { CAMPAIGN_CASES } from './cases-data.js';
import { makeDailyCase, makeRandomCase } from './daily.js';
import { ICONS } from './icons.js';
import { roomColor } from './ui/board.js';
import { t, getLang, setLang, caseTitle } from './i18n.js';

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

// ---------- language ----------
qs('#btn-lang').addEventListener('click', () => {
  setLang(getLang() === 'pt' ? 'en' : 'pt');
  location.reload(); // simplest correct way to retranslate every surface
});

// ---------- static text (i18n) ----------
function svg(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function applyStaticText() {
  const taglineParts = t('tagline').split('\n');
  const heroTitle = qs('.hero-title');
  heroTitle.innerHTML = '';
  taglineParts.forEach((part, i) => {
    if (i) heroTitle.append(document.createElement('br'));
    heroTitle.append(part);
  });
  qs('.hero-sub').textContent = t('heroSub');
  qs('#btn-daily').innerHTML = `${svg('search')} ${t('daily')}`;
  qs('#btn-random').innerHTML = `🎲 ${t('random')}`;
  qs('#btn-tutorial').innerHTML = `🎓 ${t('learn')}`;
  qs('#home-section-title').textContent = t('caseFiles');
  qs('#btn-help').textContent = t('howToPlay');
  qs('#btn-back').textContent = t('cases');
  qs('#btn-story').innerHTML = `${svg('brief')} ${t('brief')}`;
  qs('#dock-title').textContent = t('suspectsVictim');
  qs('.side-hint').textContent = t('selectThenTap');

  const tool = (id, icon, label) => {
    qs(id).innerHTML = `${svg(icon)}<span class="tool-label">${label}</span>`;
  };
  tool('#tool-xmark', 'mark', t('mark'));
  tool('#tool-undo', 'undo', t('undo'));
  tool('#tool-redo', 'redo', t('redo'));
  tool('#tool-check', 'check', t('checkBtn'));
  tool('#tool-hint', 'hint', t('hint'));
  tool('#tool-restart', 'reset', t('reset'));
  qs('#tool-accuse').innerHTML = `${svg('accuse')} ${t('accuse')}`;

  qs('#opt-live-label').textContent = t('liveCheck');
  qs('#opt-autox-label').textContent = t('autoX');

  qs('#dlg-accuse h2').textContent = t('whoDidIt');
  qs('#dlg-accuse .dlg-sub').textContent = t('accuseSub');
  qs('#accuse-close').textContent = t('notYet');
  qs('#dlg-hint h2').textContent = t('deduction');
  qs('#hint-close').textContent = t('keepToMyself');
  qs('#hint-apply').textContent = t('showOnMap');
  qs('#story-close').textContent = t('beginInvestigation');
  qs('#help-close').textContent = t('gotIt');
  qs('#confirm-cancel').textContent = t('cancel');

  // help dialog
  qs('#dlg-help h2').textContent = t('helpTitle');
  const steps = qs('.help-steps');
  steps.innerHTML = '';
  for (const [strong, rest] of t('helpSteps')) {
    steps.append(el('li', {}, el('strong', {}, strong), rest));
  }
  qs('.help-note').textContent = t('helpNote');
  qs('.help-kbd').textContent = t('helpKbd');

  const langBtn = qs('#btn-lang');
  langBtn.textContent = t('langName');
  langBtn.setAttribute('aria-label', t('langLabel'));
  qs('#btn-theme').setAttribute('aria-label', t('themeLabel'));
  document.documentElement.lang = getLang() === 'pt' ? 'pt-PT' : 'en';
}

// ---------- home ----------
function miniMap(cse) {
  const map = el('span', { class: 'mini-map', 'aria-hidden': 'true' });
  map.style.gridTemplateColumns = `repeat(${cse.size}, 1fr)`;
  for (let cell = 0; cell < cse.size * cse.size; cell++) {
    const sq = el('span', { class: cse.furniture[cell] ? 'mini-furn' : '' });
    sq.style.background = roomColor(cse.rooms[cse.roomOf[cell]].hue, true);
    map.append(sq);
  }
  return map;
}

function caseCard(cse, num, tags) {
  return el('button', {
    class: 'case-card', role: 'listitem',
    onclick: () => startCase(cse),
  },
    el('span', { class: 'case-num' }, num),
    el('span', { class: 'case-name' }, caseTitle(cse)),
    miniMap(cse),
    el('span', { class: 'case-tags' }, tags));
}

function renderHome() {
  const list = qs('#campaign-list');
  list.innerHTML = '';
  const solved = progress.solvedSet();

  const transient = transientCases.load();
  if (transient && progress.hasUnfinished(transient.id)) {
    list.append(caseCard(transient, t('openInvestigation'), [
      el('span', { class: `chip ${transient.difficulty}` }, t('difficulty')[transient.difficulty]),
      el('span', { class: 'chip' }, `${transient.size}×${transient.size}`),
      el('span', { class: 'chip medium' }, t('inProgress')),
    ]));
  }

  CAMPAIGN_CASES.forEach((cse, i) => {
    list.append(caseCard(cse, t('caseFileNo', String(i + 1).padStart(2, '0')), [
      el('span', { class: `chip ${cse.difficulty}` }, t('difficulty')[cse.difficulty]),
      el('span', { class: 'chip' }, `${cse.size}×${cse.size}`),
      solved.has(cse.id) ? el('span', { class: 'chip solved' }, t('solved'))
        : progress.hasUnfinished(cse.id) ? el('span', { class: 'chip medium' }, t('inProgress')) : null,
    ]));
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
  btn.disabled = true; btn.textContent = `🔍 ${t('dailyBusy')}`;
  setTimeout(() => {
    try {
      const cse = makeDailyCase();
      if (cse) { transientCases.save(cse); startCase(cse); }
      else toast(t('couldNotBuild'), 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = `${svg('search')} ${t('daily')}`;
    }
  }, 30);
});

qs('#btn-random').addEventListener('click', () => {
  const btn = qs('#btn-random');
  btn.disabled = true; btn.textContent = `🔍 ${t('randomBusy')}`;
  setTimeout(() => {
    try {
      const cse = makeRandomCase();
      if (cse) { transientCases.save(cse); startCase(cse, { resume: false }); }
      else toast(t('genEmpty'), 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = `🎲 ${t('random')}`;
    }
  }, 30);
});

qs('#btn-tutorial').addEventListener('click', () => openDialog(qs('#dlg-help')));
qs('#btn-help').addEventListener('click', () => openDialog(qs('#dlg-help')));

// ---------- boot ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode is a bonus */ });
}
pruneStaleSaves();
wireDialogClose();
applyTheme(settings.get().theme ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
applyStaticText();
renderHome();
show('home');
