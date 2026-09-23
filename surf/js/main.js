// Boot: app shell (sport tabs, navigation, data status), hash routing,
// theme, periodic refresh.

import { emit, levelOf, load, on, setSport, SPORT, SPORTS, state, updateNow } from './core.js';
import { LEVELS } from './model.js';
import { fmtAgo, fmtDay, fmtHour } from './util.js';
import { icon } from './icons.js';
import { closeSheet, openLevelSheet, sheet, toast } from './ui/components.js';
import * as agora from './ui/agora.js';
import * as mapa from './ui/mapa.js';
import * as costa from './ui/costa.js';
import * as spotsList from './ui/spots.js';
import * as spotPage from './ui/spot.js';
import * as favoritos from './ui/favoritos.js';
import * as definicoes from './ui/definicoes.js';

const ROUTES = { agora, mapa, costa, spots: spotsList, favoritos, definicoes, spot: spotPage };
const NAV = [
  { id: 'agora', name: 'Agora', icon: 'now' },
  { id: 'mapa', name: 'Mapa', icon: 'map' },
  { id: 'costa', name: 'Costa', icon: 'grid' },
  { id: 'spots', name: 'Spots', icon: 'list' },
  { id: 'favoritos', name: 'Favoritos', icon: 'star' },
];

const $ = (s) => document.querySelector(s);
const main = $('#main');
let current = null;
const scrollMemo = new Map();

// ------------------------------------------------------------------ theme
const initialTheme = document.documentElement.getAttribute('data-theme');
function applyTheme() {
  const t = state.prefs.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else if (initialTheme) document.documentElement.setAttribute('data-theme', initialTheme);
  else document.documentElement.removeAttribute('data-theme');
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#07111b' : '#eef2f5');
}

// ------------------------------------------------------------------ shell
function renderSportTabs() {
  const cur = state.prefs.sport;
  $('#sport-tabs').innerHTML = SPORTS.map((s) => `<button type="button" role="tab" class="sport-tab" data-sport="${s.id}" aria-selected="${s.id === cur}">${icon(s.id, { size: 18 })}<span>${s.name}</span></button>`).join('');
  $('#level-pill').innerHTML = `${LEVELS[levelOf(cur) - 1].name} ${icon('chev-down', { size: 14 })}`;
  $('#level-pill').setAttribute('aria-label', `Nível de ${SPORT[cur].name}: ${LEVELS[levelOf(cur) - 1].name}. Mudar`);
  const sel = $('#sport-tabs [aria-selected="true"]');
  const scroller = $('#sport-tabs');
  if (sel && scroller.scrollWidth > scroller.clientWidth) {
    scroller.scrollLeft = sel.offsetLeft - scroller.offsetLeft - (scroller.clientWidth - sel.clientWidth) / 2;
  }
}

function renderNav() {
  const route = current?.name ?? 'agora';
  const favN = state.prefs.favs.length;
  const item = (n) => `<a class="tab" href="#${n.id}" ${route === n.id ? 'aria-current="page"' : ''}>${icon(n.icon, { size: 22 })}<span>${n.name}</span>${n.id === 'favoritos' && favN ? `<span class="badge">${favN}</span>` : ''}</a>`;
  $('#tabbar').innerHTML = NAV.map(item).join('');
  $('#rail-nav').innerHTML = `<a class="brand rail-brand" href="#agora" aria-label="Maresia — início">${$('.brand').innerHTML}</a>${NAV.map(item).join('')}`;
  const gear = $('#btn-settings');
  gear.innerHTML = icon('gear', { size: 21 });
  if (route === 'definicoes') gear.setAttribute('aria-current', 'page');
  else gear.removeAttribute('aria-current');
}

function renderStatus() {
  const pill = $('#data-status');
  const txt = pill.querySelector('.txt');
  let st = state.source || 'loading';
  let label = 'A carregar previsão…';
  if (state.loading && !state.fc) st = 'loading';
  else if (!state.fc) {
    st = 'error';
    label = 'Sem dados · tentar de novo';
  } else if (state.stale) {
    st = 'stale';
    label = `Arquivo · ${fmtDay(state.fc.t0 + 43200, 'Europe/Lisbon')}`;
  } else if (state.source === 'live') label = `Ao vivo · ${fmtHour(state.fc.fetchedAt / 1000, 'Europe/Lisbon')}`;
  else if (state.source === 'cache') label = state.error ? `Offline · ${fmtAgo(state.fc.fetchedAt)}` : `Atualizado ${fmtAgo(state.fc.fetchedAt)}`;
  else if (state.source === 'snapshot') label = `Previsão de ${fmtDay(state.fc.fetchedAt / 1000, 'Europe/Lisbon', Date.now() / 1000).toLowerCase()}, ${fmtHour(state.fc.fetchedAt / 1000, 'Europe/Lisbon')}`;
  if (state.loading && state.fc) label = 'A atualizar…';
  pill.dataset.state = st;
  txt.textContent = label;
}

function dataSheet() {
  const fc = state.fc;
  const src = { live: 'Ao vivo (Open-Meteo)', cache: 'Guardada neste dispositivo', snapshot: 'Instantâneo incluído na app' }[state.source] || '—';
  sheet(`<h2>Dados</h2>
    <p class="lead">Ondulação, vento, temperatura da água e marés vêm dos modelos Open-Meteo (ECMWF, Météo-France, DWD e outros), hora a hora, para os próximos 7 dias.</p>
    <div class="card"><div class="set-row"><span class="lbl">Fonte</span><span>${src}</span></div>
    <div class="set-row"><span class="lbl">Obtida</span><span>${fc ? `${fmtDay(fc.fetchedAt / 1000, 'Europe/Lisbon')}, ${fmtHour(fc.fetchedAt / 1000, 'Europe/Lisbon')}` : '—'}</span></div>
    ${state.error ? `<div class="set-row"><span class="lbl">Último erro</span><span class="muted">${state.error}</span></div>` : ''}</div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-primary" type="button" data-refresh>${icon('refresh', { size: 18 })} Atualizar agora</button><button class="btn" type="button" data-close>Fechar</button></div>`, {
    label: 'Estado dos dados',
    onMount(panel) {
      panel.querySelector('[data-refresh]').addEventListener('click', async () => {
        closeSheet();
        toast('A atualizar a previsão…');
        await load(true);
        toast(state.source === 'live' ? 'Previsão atualizada' : 'Sem ligação — a usar dados guardados');
      });
    },
  });
}

// ------------------------------------------------------------------ routing
function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (h.startsWith('spot-')) return { name: 'spot', param: h.slice(5) };
  return { name: ROUTES[h] ? h : 'agora', param: null };
}

function route() {
  const r = parseHash();
  if (current && current.name === r.name && current.param === r.param) return;
  if (current) {
    scrollMemo.set(`${current.name}:${current.param ?? ''}`, window.scrollY);
    current.inst?.unmount?.();
  }
  closeSheet();
  state.navCount++;
  main.innerHTML = '';
  const section = document.createElement('section');
  section.className = `screen screen-${r.name}`;
  main.append(section);
  current = { ...r, inst: null };
  current.inst = ROUTES[r.name].mount(section, r.param);
  document.body.dataset.route = r.name;
  renderNav();
  const y = r.name === 'spot' ? 0 : scrollMemo.get(`${r.name}:${r.param ?? ''}`) ?? 0;
  window.scrollTo(0, y);
  const titles = { agora: 'Agora', mapa: 'Mapa', costa: 'Costa', spots: 'Spots', favoritos: 'Favoritos', definicoes: 'Definições' };
  document.title = r.name === 'spot' ? `${current.inst?.title ?? 'Spot'} · Maresia` : r.name === 'agora' ? 'Maresia' : `${titles[r.name]} · Maresia`;
}

// ------------------------------------------------------------------ events
document.addEventListener('click', (e) => {
  const tab = e.target.closest('#sport-tabs [data-sport]');
  if (tab) setSport(tab.dataset.sport);
  if (e.target.closest('#level-pill')) openLevelSheet();
  if (e.target.closest('#data-status')) dataSheet();
});

on((what, detail) => {
  if (['sport', 'level', 'data', 'prefs'].includes(what)) renderSportTabs();
  if (['data', 'loading', 'error', 'tick'].includes(what)) renderStatus();
  if (what === 'favs') renderNav();
  if (what === 'prefs' && detail === 'theme') applyTheme();
  current?.inst?.update?.(what, detail);
});

window.addEventListener('hashchange', route);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  applyTheme();
  emit('theme');
});

// ------------------------------------------------------------------ boot
applyTheme();
renderSportTabs();
renderStatus();
route();
load();

setInterval(() => {
  if (!state.fc) return;
  const prev = state.nowIdx;
  updateNow();
  if (state.nowIdx !== prev) emit('tick');
  renderStatus();
  const age = Date.now() - state.fc.fetchedAt;
  if (!state.loading && state.source !== 'snapshot' && age > 60 * 60 * 1000 && navigator.onLine !== false) load(true);
}, 60 * 1000);

if (!globalThis.__MARESIA_BUNDLE__ && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
