// "Costa": the whole coast × the whole week at a glance. Rows are spots north
// to south, columns are morning / midday / afternoon of each day, cells carry
// the best daylight score in that block. Tap a cell to open that moment.

import { dayCount, dayStart, go, inRegion, isFav, regions, REGION_FILTERS, scores, setCursor, setPref, spots, SPORT, state, view } from '../core.js';
import { peakIn } from '../insights.js';
import { escapeHtml, fmtDayShort, fmtHour } from '../util.js';
import { hourIndex } from '../forecast.js';
import { fmtScore, scoreClass } from './components.js';
import { rating } from '../model.js';

const BLOCKS = [
  { id: 'm', name: 'M', long: 'Manhã', from: 0, to: 11 },
  { id: 'md', name: 'MD', long: 'Meio-dia', from: 11, to: 15 },
  { id: 't', name: 'T', long: 'Tarde', from: 15, to: 24 },
];

export function mount(el) {
  let onlyFavs = false;
  let sortBy = 'coast';

  function render() {
    if (!state.fc) {
      el.innerHTML = `<div class="skeleton" style="height:520px;margin-top:8px"></div>`;
      return;
    }
    const sport = state.prefs.sport;
    const days = dayCount();
    const list = spots.filter((s) => inRegion(s, state.prefs.region) && s.sports[sport] > 0 && view(s.id).ok && (!onlyFavs || isFav(s.id)));

    // Per spot: block peaks.
    const rows = list.map((s) => {
      const sc = scores(s.id);
      const v = view(s.id);
      const cells = [];
      for (let d = 0; d < days; d++) {
        const start = dayStart(d, s.tz);
        for (const b of BLOCKS) {
          let from = hourIndex(state.fc, start + b.from * 3600);
          const to = hourIndex(state.fc, start + b.to * 3600);
          if (d === 0) from = Math.max(from, state.nowIdx);
          cells.push(to <= from ? null : peakIn(sc, v.day, from, to));
        }
      }
      const best = Math.max(0, ...cells.map((c) => (c && c.idx >= 0 ? c.score : 0)));
      return { s, cells, best };
    });

    const byRegion = new Map();
    for (const r of rows) {
      if (!byRegion.has(r.s.region)) byRegion.set(r.s.region, []);
      byRegion.get(r.s.region).push(r);
    }
    for (const arr of byRegion.values()) {
      arr.sort(sortBy === 'best' ? (a, b) => b.best - a.best : (a, b) => b.s.lat - a.s.lat || a.s.lon - b.s.lon);
    }

    let head1 = '<tr><th class="corner" rowspan="2" scope="col">Spot</th>';
    let head2 = '<tr>';
    for (let d = 0; d < days; d++) {
      const t = dayStart(d) + 12 * 3600;
      head1 += `<th class="dayh" colspan="3" scope="colgroup">${d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : fmtDayShort(t, 'Europe/Lisbon')}</th>`;
      head2 += BLOCKS.map((b, k) => `<th class="parth ${k === 0 ? 'first' : ''}" scope="col" title="${b.long}">${b.name}</th>`).join('');
    }
    head1 += '</tr>';
    head2 += '</tr>';

    let body = '';
    for (const r of regions) {
      const arr = byRegion.get(r.id);
      if (!arr?.length) continue;
      body += `<tr class="grp"><th colspan="${1 + days * 3}" scope="rowgroup">${escapeHtml(r.name)}</th></tr>`;
      for (const row of arr) {
        body += `<tr><th class="name" scope="row"><a href="#spot-${row.s.id}">${escapeHtml(row.s.name)}<small>${escapeHtml(row.s.area)}</small></a></th>`;
        row.cells.forEach((c, k) => {
          const first = k % 3 === 0 ? 'first' : '';
          if (!c || c.idx < 0) {
            body += `<td class="c na ${first}"><button type="button" disabled aria-label="Sem dados"></button></td>`;
            return;
          }
          const label = `${row.s.name}, ${fmtDayShort(state.fc.t0 + c.idx * 3600, row.s.tz)} às ${fmtHour(state.fc.t0 + c.idx * 3600, row.s.tz)}: ${fmtScore(c.score)} ${rating(c.score).name}`;
          body += `<td class="c ${first}"><button type="button" class="${scoreClass(c.score)}" data-spot="${row.s.id}" data-idx="${c.idx}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${c.score >= 5 ? Math.round(c.score) : ''}</button></td>`;
        });
        body += '</tr>';
      }
    }

    const regionOpts = REGION_FILTERS.map((r) => `<option value="${r.id}" ${r.id === state.prefs.region ? 'selected' : ''}>${r.name}</option>`).join('');
    el.innerHTML = `
      <div class="section-head" style="margin-top:4px"><h1 class="section-title" style="font-size:34px">A costa esta semana</h1></div>
      <p class="section-sub" style="margin:-4px 0 14px;max-width:62ch">Melhor nota de ${SPORT[sport].name.toLowerCase()} em cada bloco do dia (M manhã · MD meio-dia · T tarde), do norte para sul. Números só a partir de 5. Toca numa célula para abrir esse momento.</p>
      <div class="heat-tools">
        <div class="fchips">
          <select class="fchip" id="costa-region" aria-label="Região">${regionOpts}</select>
          <button type="button" class="fchip" data-favs aria-pressed="${onlyFavs}">Só favoritos</button>
        </div>
        <div class="seg" role="group" aria-label="Ordenar"><button type="button" data-sort="coast" aria-pressed="${sortBy === 'coast'}">Norte → Sul</button><button type="button" data-sort="best" aria-pressed="${sortBy === 'best'}">Melhores</button></div>
      </div>
      ${rows.length ? `<div class="heat-wrap"><table class="heat"><thead>${head1}${head2}</thead><tbody>${body}</tbody></table></div>`
        : `<div class="card empty"><h3>Nada para mostrar</h3><p>${onlyFavs ? 'Ainda não tens favoritos nesta região.' : `Sem spots de ${SPORT[sport].name.toLowerCase()} nesta região.`}</p></div>`}
      <div class="legend-row" style="margin-top:12px;align-items:center"><span class="muted" style="font-size:12.5px">Nota</span>
        ${[0, 2, 4, 6, 8, 10].map((v) => `<span class="item"><span class="score xs ${scoreClass(v)}" aria-hidden="true">${v}</span>${rating(v).name}</span>`).join('')}</div>`;
  }

  el.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-spot]');
    if (cell) {
      setCursor(+cell.dataset.idx);
      go('spot', cell.dataset.spot);
      return;
    }
    if (e.target.closest('[data-favs]')) {
      onlyFavs = !onlyFavs;
      render();
      return;
    }
    const s = e.target.closest('[data-sort]');
    if (s) {
      sortBy = s.dataset.sort;
      render();
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.id === 'costa-region') setPref('region', e.target.value);
  });

  render();
  return {
    update(what) {
      if (what === 'cursor') return;
      render();
    },
  };
}

