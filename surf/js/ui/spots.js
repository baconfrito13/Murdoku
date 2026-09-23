// "Spots": searchable, filterable list of every spot with its score now and
// the day at a glance.

import { condsOf, driveFrom, fmtDrive, inRegion, isFav, regionName, REGION_FILTERS, scores, setCursor, setPref, spots, SPORT, state, toggleFav, view, windowRange } from '../core.js';
import { LEVELS } from '../model.js';
import { escapeHtml, fmtHeightRange, fmtWind } from '../util.js';
import { icon } from '../icons.js';
import { scoreBadge, sparkBars } from './components.js';

const TYPES = [
  { id: 'all', name: 'Todos os tipos' },
  { id: 'beach', name: 'Beach breaks' },
  { id: 'reef', name: 'Reefs e lajes' },
  { id: 'point', name: 'Points' },
  { id: 'flat', name: 'Planos de água' },
];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function mount(el) {
  let q = '';
  let type = 'all';
  let sort = 'score';
  let maxLevel = 0;

  function matches(s) {
    if (!inRegion(s, state.prefs.region)) return false;
    if (type === 'beach' && !['beach', 'rivermouth', 'jetty', 'bay'].includes(s.type)) return false;
    if (type === 'reef' && !['reef', 'slab'].includes(s.type)) return false;
    if (type === 'point' && s.type !== 'point') return false;
    if (type === 'flat' && !s.flat) return false;
    if (maxLevel && s.level > maxLevel) return false;
    if (q) {
      const hay = norm(`${s.name} ${s.area} ${regionName(s.region)} ${s.desc || ''}`);
      if (!norm(q).split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  function listHtml() {
    if (!state.fc) return `<div class="skeleton" style="height:480px"></div>`;
    const sport = state.prefs.sport;
    const i = state.nowIdx;
    const [dFrom, dTo] = windowRange(0, 'dia');
    const rows = spots.filter(matches).map((s) => {
      const suited = s.sports[sport] > 0 && view(s.id).ok;
      return { s, suited, score: suited ? scores(s.id)[i] : -1, drive: driveFrom(s) };
    });
    if (sort === 'score') rows.sort((a, b) => b.score - a.score);
    else if (sort === 'name') rows.sort((a, b) => a.s.name.localeCompare(b.s.name, 'pt'));
    else if (sort === 'dist') rows.sort((a, b) => (a.drive?.min ?? 9e9) - (b.drive?.min ?? 9e9));
    else rows.sort((a, b) => b.s.lat - a.s.lat);
    if (!rows.length) return `<div class="card empty"><h3>Nenhum spot encontrado</h3><p>Tenta outra pesquisa ou limpa os filtros.</p></div>`;
    const u = state.prefs;
    return `<p class="list-count">${rows.length} spot${rows.length > 1 ? 's' : ''} · nota de ${SPORT[sport].name.toLowerCase()} agora</p>
    <div class="rows" style="margin-top:8px">${rows.map(({ s, suited, score, drive }) => {
      const c = condsOf(s.id)[i];
      const v = view(s.id);
      return `<div class="row" role="group" aria-label="${escapeHtml(s.name)}">
        ${suited ? scoreBadge(score, 'sm') : `<span class="score sm sc-0" title="Não indicado para ${SPORT[sport].name}" aria-label="Não indicado">–</span>`}
        <a class="row-main" href="#spot-${s.id}" style="text-decoration:none;color:inherit">
          <div class="row-title"><span class="t">${escapeHtml(s.name)}</span>${s.famous ? icon('star-fill', { size: 12, cls: 'muted' }) : ''}</div>
          <div class="row-sub">${escapeHtml(s.area)} · ${regionName(s.region)} · ${LEVELS[s.level - 1].name}${drive ? ` · ${fmtDrive(drive)}` : ''}</div>
          ${v.ok ? `<div class="row-meta"><span>${icon('wave', { size: 14 })}${fmtHeightRange(c.face.lo, c.face.hi, u.hUnit)}</span><span>${icon('wind', { size: 14 })}${fmtWind(c.wind.kn, u.wUnit)} ${c.wind.rel.short}</span></div>
          ${suited ? sparkBars(scores(s.id), v.day, dFrom, dTo, { now: i, height: 14 }) : ''}` : '<div class="row-meta">Sem dados</div>'}
        </a>
        <button type="button" class="fav-btn" data-fav="${s.id}" aria-pressed="${isFav(s.id)}" aria-label="${isFav(s.id) ? 'Remover' : 'Adicionar'} ${escapeHtml(s.name)} ${isFav(s.id) ? 'dos' : 'aos'} favoritos">${icon(isFav(s.id) ? 'star-fill' : 'star', { size: 20 })}</button>
      </div>`;
    }).join('')}</div>`;
  }

  function render(keepFocus = false) {
    const regionOpts = REGION_FILTERS.map((r) => `<option value="${r.id}" ${r.id === state.prefs.region ? 'selected' : ''}>${r.name}</option>`).join('');
    const typeOpts = TYPES.map((t) => `<option value="${t.id}" ${t.id === type ? 'selected' : ''}>${t.name}</option>`).join('');
    const lvlOpts = [`<option value="0">Todos os níveis</option>`, ...LEVELS.map((l) => `<option value="${l.id}" ${l.id === maxLevel ? 'selected' : ''}>Até ${l.name.toLowerCase()}</option>`)].join('');
    if (!keepFocus) {
      el.innerHTML = `
        <div class="section-head" style="margin-top:4px"><h1 class="section-title" style="font-size:34px">Spots</h1></div>
        <div class="list-tools">
          <label class="search">${icon('search', { size: 18 })}<input id="spot-q" type="search" placeholder="Procurar spot, praia ou zona" value="${escapeHtml(q)}" autocomplete="off" aria-label="Procurar spot"></label>
          <div class="fchips">
            <select class="fchip" id="f-region" aria-label="Região">${regionOpts}</select>
            <select class="fchip" id="f-type" aria-label="Tipo de onda">${typeOpts}</select>
            <select class="fchip" id="f-level" aria-label="Nível">${lvlOpts}</select>
            <select class="fchip" id="f-sort" aria-label="Ordenar">
              <option value="score" ${sort === 'score' ? 'selected' : ''}>Melhor agora</option>
              <option value="coast" ${sort === 'coast' ? 'selected' : ''}>Norte → Sul</option>
              <option value="name" ${sort === 'name' ? 'selected' : ''}>A–Z</option>
              ${state.prefs.home ? `<option value="dist" ${sort === 'dist' ? 'selected' : ''}>Mais perto</option>` : ''}
            </select>
          </div>
        </div>
        <div data-list></div>`;
    }
    el.querySelector('[data-list]').innerHTML = listHtml();
  }

  el.addEventListener('input', (e) => {
    if (e.target.id === 'spot-q') {
      q = e.target.value;
      render(true);
    }
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'f-region') setPref('region', t.value);
    else if (t.id === 'f-type') type = t.value;
    else if (t.id === 'f-level') maxLevel = +t.value;
    else if (t.id === 'f-sort') sort = t.value;
    render(true);
  });
  el.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fav]');
    if (f) {
      e.preventDefault();
      toggleFav(f.dataset.fav);
      return;
    }
    if (e.target.closest('a.row-main')) setCursor(state.nowIdx);
  });

  render();
  return {
    update(what) {
      if (what === 'cursor') return;
      if (what === 'data' && !el.querySelector('[data-list]')) render();
      else render(true);
    },
  };
}

