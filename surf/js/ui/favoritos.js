// "Favoritos": your spots with the week at a glance and the next good window —
// the app's zero-setup alerts.

import { dayCount, dayStart, go, isFav, levelOf, ranking, scores, setCursor, spotById, SPORT, state, timeOf, toggleFav, view } from '../core.js';
import { bestWindows, peakIn } from '../insights.js';
import { hourIndex } from '../forecast.js';
import { escapeHtml, fmtDay, fmtDayShort, fmtHourShort } from '../util.js';
import { icon } from '../icons.js';
import { fmtScore, scoreBadge, scoreClass } from './components.js';
import { levelName } from '../model.js';

export function mount(el) {
  function card(s) {
    const sport = state.prefs.sport;
    const suited = s.sports[sport] > 0;
    const v = view(s.id);
    if (!v.ok) return '';
    const sc = scores(s.id);
    const days = dayCount();
    let week = '';
    let best = 0;
    for (let d = 0; d < days; d++) {
      const start = dayStart(d, s.tz);
      let from = hourIndex(state.fc, start);
      const to = hourIndex(state.fc, start + 86400);
      if (d === 0) from = Math.max(from, state.nowIdx);
      const pk = suited ? peakIn(sc, v.day, from, to) : { score: 0, idx: -1 };
      best = Math.max(best, pk.score);
      const lbl = d === 0 ? 'Hoje' : fmtDayShort(start + 43200, s.tz).split(' ')[0];
      week += pk.idx >= 0
        ? `<button type="button" data-open="${s.id}" data-idx="${pk.idx}" aria-label="${lbl}: melhor nota ${fmtScore(pk.score)}"><small>${lbl}</small><span class="cell ${scoreClass(pk.score)}">${Math.round(pk.score)}</span></button>`
        : `<div><small>${lbl}</small><span class="cell sc-0">–</span></div>`;
    }
    const win = suited ? bestWindows(sc, v.day, state.nowIdx, state.fc.n, 5.5, 6).sort((a, b) => a.start - b.start)[0] : null;
    const now = suited ? sc[state.nowIdx] : 0;
    return {
      best,
      html: `<article class="card fav-card">
        <div class="fav-top">
          ${suited ? scoreBadge(now, 'sm') : `<span class="score sm sc-0" aria-label="Não indicado">–</span>`}
          <a class="row-main" href="#spot-${s.id}" data-open="${s.id}" data-idx="${state.nowIdx}" style="text-decoration:none;color:inherit"><div class="row-title"><span class="t">${escapeHtml(s.name)}</span></div><div class="row-sub">${escapeHtml(s.area)} · agora</div></a>
          <button type="button" class="fav-btn" data-unfav="${s.id}" aria-pressed="true" aria-label="Remover ${escapeHtml(s.name)} dos favoritos">${icon('star-fill', { size: 20 })}</button>
        </div>
        <div class="week">${week}</div>
        <div class="fav-next">${!suited ? `${icon('info', { size: 15 })} Não é spot de ${SPORT[sport].name.toLowerCase()}.`
          : win ? `${icon('spark', { size: 15 })} Próxima boa janela: <a href="#spot-${s.id}" data-open="${s.id}" data-idx="${win.peakIdx}"><b>${fmtDay(timeOf(win.start), s.tz, timeOf(state.nowIdx))} ${fmtHourShort(timeOf(win.start), s.tz)}–${fmtHourShort(timeOf(win.end), s.tz)}</b></a> · ${fmtScore(win.peak)}`
            : `${icon('clock', { size: 15 })} Sem janelas acima de 5,5 nos próximos dias.`}</div>
      </article>`,
    };
  }

  function render() {
    if (!state.fc) {
      el.innerHTML = `<div class="skeleton" style="height:300px;margin-top:8px"></div>`;
      return;
    }
    const sport = state.prefs.sport;
    const favs = state.prefs.favs.map((id) => spotById.get(id)).filter(Boolean);
    const head = `<div class="section-head" style="margin-top:4px"><h1 class="section-title" style="font-size:34px">Favoritos</h1><span class="section-sub">${SPORT[sport].name} · ${levelName(levelOf(sport))}</span></div>`;
    if (!favs.length) {
      const sug = ranking({ day: 0, part: 'dia' }).slice(0, 5);
      el.innerHTML = `${head}<div class="card empty"><h3>Ainda sem favoritos</h3><p>Toca na estrela de um spot para o seguires aqui, com a semana à vista e a próxima boa janela.</p></div>
        ${sug.length ? `<section class="section"><div class="section-head"><h2 class="section-title">Sugestões para hoje</h2></div><div class="rows">${sug.map((r) => `<div class="row">${scoreBadge(r.score, 'sm')}<a class="row-main" href="#spot-${r.spot.id}" style="text-decoration:none;color:inherit"><div class="row-title">${escapeHtml(r.spot.name)}</div><div class="row-sub">${escapeHtml(r.spot.area)}</div></a><button type="button" class="fav-btn" data-add="${r.spot.id}" aria-pressed="false" aria-label="Adicionar ${escapeHtml(r.spot.name)} aos favoritos">${icon('star', { size: 20 })}</button></div>`).join('')}</div></section>` : ''}`;
      return;
    }
    const cards = favs.map(card).filter(Boolean).sort((a, b) => b.best - a.best);
    el.innerHTML = `${head}<p class="section-sub" style="margin:-4px 0 14px">Melhor nota de cada dia (só horas de luz). Toca num dia para abrir esse momento.</p><div class="fav-grid">${cards.map((c) => c.html).join('')}</div>`;
  }

  el.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) {
      e.preventDefault();
      setCursor(+open.dataset.idx);
      go('spot', open.dataset.open);
      return;
    }
    const un = e.target.closest('[data-unfav]');
    if (un) {
      toggleFav(un.dataset.unfav);
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add && !isFav(add.dataset.add)) toggleFav(add.dataset.add);
  });

  render();
  return {
    update(what) {
      if (what === 'cursor') return;
      render();
    },
  };
}
