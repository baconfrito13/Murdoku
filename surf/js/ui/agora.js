// "Agora" — where to go: pick a day and part of day, get the best spot for
// your sport and level with the reasons, the runners-up, the national sea
// synopsis and the best windows of the week.

import {
  condsOf, dayCount, dayStart, driveFrom, evalAt, fmtDrive, go, HOMES, inRegion, levelOf, MAINLAND, ranking,
  REGION_FILTERS, regionName, scores, setCursor, setLevel, setPref, setSport, setWhen, spots, SPORT, SPORTS,
  state, timeOf, view, windowRange,
} from '../core.js';
import { explain, LEVELS } from '../model.js';
import { bestWindows, synopsis } from '../insights.js';
import { escapeHtml, fmtDay, fmtDayShort, fmtHour, fmtHourShort, fmtHeightRange, fmtWind, isNum, zoned } from '../util.js';
import { icon } from '../icons.js';
import { condStats, faceText, fmtScore, reasonsList, scoreBadge, scoreClass, scoreWithLabel, sparkBars } from './components.js';
import { createOcean, oceanParams } from './ocean.js';

const PARTS = [
  { id: 'agora', name: 'Agora' },
  { id: 'manha', name: 'Manhã' },
  { id: 'tarde', name: 'Tarde' },
  { id: 'dia', name: 'Todo o dia' },
];
const PART_PHRASE = { agora: 'agora', manha: 'de manhã', tarde: 'à tarde', dia: '' };

function whenPhrase(day, part) {
  const d = day === 0 ? 'hoje' : day === 1 ? 'amanhã' : fmtDay(dayStart(day) + 12 * 3600, 'Europe/Lisbon').toLowerCase();
  if (part === 'agora') return 'agora';
  if (part === 'dia') return d;
  return `${d} ${PART_PHRASE[part]}`;
}

export function mount(el) {
  let ocean = null;

  function dayChips() {
    const n = dayCount();
    const sport = state.prefs.sport;
    let html = '';
    for (let d = 0; d < n; d++) {
      const t = dayStart(d) + 12 * 3600;
      const best = ranking({ day: d, part: 'dia', sport })[0];
      const z = zoned(t, 'Europe/Lisbon');
      const top = d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : fmtDayShort(t, 'Europe/Lisbon').split(' ')[0];
      html += `<button type="button" class="day ${scoreClass(best?.score ?? 0)}" data-day="${d}" aria-pressed="${state.day === d}" title="Melhor nota do dia: ${fmtScore(best?.score ?? 0)}">
        <b>${top}</b><small>${z.d}/${z.mo}</small><span class="dot" aria-hidden="true"></span></button>`;
    }
    return html;
  }

  function effectiveWhen() {
    let { day, part } = state;
    if (day !== 0 && part === 'agora') part = 'manha';
    let rows = ranking({ day, part });
    let shifted = null;
    if (!rows.length && day === 0) {
      // Night or the day is over: jump to the next morning.
      const z = zoned(timeOf(state.nowIdx), 'Europe/Lisbon');
      const next = z.h < 12 ? { day: 0, part: 'manha' } : { day: 1, part: 'manha' };
      rows = ranking(next);
      shifted = next;
      ({ day, part } = next);
    }
    return { day, part, rows, shifted };
  }

  function hero(top, when) {
    const s = top.spot;
    const sport = state.prefs.sport;
    const level = levelOf(sport);
    const c = condsOf(s.id)[top.idx];
    const r = evalAt(s.id, top.idx);
    const reasons = explain(s, c, sport, level, r, state.prefs.hUnit);
    const v = view(s.id);
    const [dFrom, dTo] = windowRange(when.day, 'dia', s.tz);
    const drive = driveFrom(s);
    const t = timeOf(top.idx);
    const eyebrow = `Melhor aposta · ${whenPhrase(when.day, when.part)}`;
    return `<article class="hero" aria-labelledby="hero-name">
      <div class="hero-ocean"><canvas aria-hidden="true"></canvas>
        <div class="over"><span class="glass">${icon('clock', { size: 14 })} ${when.day < 2 ? fmtDay(t, s.tz, timeOf(state.nowIdx)) : fmtDayShort(t, s.tz)} · ${fmtHour(t, s.tz)}</span>
        <span class="glass">${icon(sport, { size: 14 })} ${SPORT[sport].name} · ${LEVELS[level - 1].name}</span></div>
      </div>
      <div class="hero-body">
        <div class="hero-top">
          <div><div class="eyebrow">${escapeHtml(eyebrow)}</div>
            <h2 class="hero-name display" id="hero-name" style="--fit:${Math.min(11, 150 / s.name.length).toFixed(2)}">${escapeHtml(s.name)}</h2>
            <div class="hero-where">${icon('pin', { size: 15 })} ${escapeHtml(s.area)} · ${regionName(s.region)}${drive ? ` · ${icon('route', { size: 15 })} ${fmtDrive(drive)}` : ''}</div>
          </div>
          ${scoreWithLabel(top.score, 'xl', `às ${fmtHour(t, s.tz)}`)}
        </div>
        ${condStats(c)}
        ${reasonsList(reasons, 4)}
        <div class="hero-best">
          <div class="lbl"><span>Nota ao longo do dia</span><span>${fmtHourShort(timeOf(dFrom), s.tz)}–${fmtHourShort(timeOf(Math.max(dFrom, dTo - 1)), s.tz)}</span></div>
          ${sparkBars(scores(s.id), v.day, dFrom, dTo, { now: top.idx, height: 30, label: `Nota hora a hora em ${s.name}` })}
        </div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#spot-${s.id}" data-open="${s.id}" data-idx="${top.idx}">${icon('chev-right', { size: 18 })} Ver previsão completa</a>
          <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">${icon('route', { size: 18 })} Direções</a>
        </div>
      </div>
    </article>`;
  }

  function others(rows) {
    if (rows.length < 2) return '';
    const u = state.prefs;
    const list = rows.slice(1, 9).map((row, k) => {
      const s = row.spot;
      const c = condsOf(s.id)[row.idx];
      const d = row.drive;
      return `<a class="row" href="#spot-${s.id}" data-open="${s.id}" data-idx="${row.idx}">
        <span class="rank">${k + 2}</span>
        <div class="row-main">
          <div class="row-title"><span class="t">${escapeHtml(s.name)}</span></div>
          <div class="row-sub">${escapeHtml(s.area)} · às ${fmtHour(timeOf(row.idx), s.tz)}${d ? ` · ${fmtDrive(d)}` : ''}</div>
          <div class="row-meta"><span>${icon('wave', { size: 14 })}${faceText(c, u.hUnit)}</span><span>${icon('wind', { size: 14 })}${isNum(c.wind.kn) ? `${fmtWind(c.wind.kn, u.wUnit)} ${c.wind.rel.short}` : '—'}</span></div>
        </div>
        ${scoreBadge(row.score, 'sm')}
      </a>`;
    }).join('');
    return `<section class="section"><div class="section-head"><h2 class="section-title">Outras opções</h2><a class="section-sub" href="#spots">Todos os spots</a></div><div class="rows">${list}</div></section>`;
  }

  function otherSportHint(when, best) {
    const cur = state.prefs.sport;
    let alt = null;
    for (const sp of SPORTS) {
      if (sp.id === cur) continue;
      const r = ranking({ day: when.day, part: when.part, sport: sp.id })[0];
      if (r && r.score >= 5.5 && r.score > (best ?? 0) + 2 && (!alt || r.score > alt.row.score)) alt = { sp, row: r };
    }
    if (!alt) return '';
    return `<div class="notice" style="margin-top:12px">${icon('spark', { size: 18 })}<span>Hoje está melhor para <b>${alt.sp.name.toLowerCase()}</b>: ${escapeHtml(alt.row.spot.name)} com ${fmtScore(alt.row.score)}.</span><button class="btn btn-sm" type="button" data-sport="${alt.sp.id}">Mudar</button></div>`;
  }

  function synopsisCard(when) {
    const idx = windowRange(when.day, when.part === 'agora' ? 'agora' : when.part)[0] ?? state.nowIdx;
    const rows = spots.filter((s) => MAINLAND.includes(s.region)).map((s) => ({ spot: s, view: view(s.id) }));
    const syn = synopsis(rows, Math.min(idx, state.fc.n - 1), state.fc);
    if (!syn) return '';
    const u = state.prefs;
    return `<section class="section"><div class="section-head"><h2 class="section-title">O mar ${when.day === 0 ? 'hoje' : whenPhrase(when.day, 'dia')}</h2><span class="section-sub">Continente</span></div>
      <div class="card pad synopsis"><p>${escapeHtml(syn.text)}</p>
      <div class="regions">${syn.regions.map((g) => `<div class="region-cell"><small>${g.name}</small><b>${fmtHeightRange(g.h * 0.9, g.h * 1.1, u.hUnit)}</b> <span class="muted num">${isNum(g.p) ? `${Math.round(g.p)} s` : ''}</span></div>`).join('')}</div></div></section>`;
  }

  function weekWindows() {
    const sport = state.prefs.sport;
    const all = [];
    for (const s of spots) {
      if (!inRegion(s, state.prefs.region) || !(s.sports[sport] > 0)) continue;
      const v = view(s.id);
      if (!v.ok) continue;
      const d = driveFrom(s);
      if (state.prefs.maxDrive && state.prefs.home && (!d || d.min > state.prefs.maxDrive)) continue;
      for (const w of bestWindows(scores(s.id), v.day, state.nowIdx, state.fc.n, 6, 4)) all.push({ ...w, spot: s });
    }
    all.sort((a, b) => b.peak - a.peak);
    const picked = [];
    const perDay = new Map();
    const seen = new Set();
    for (const w of all) {
      const dk = zoned(timeOf(w.peakIdx), 'Europe/Lisbon').key;
      const key = `${w.spot.id}|${dk}`;
      if (seen.has(key) || (perDay.get(dk) || 0) >= 3) continue;
      seen.add(key);
      perDay.set(dk, (perDay.get(dk) || 0) + 1);
      picked.push(w);
      if (picked.length >= 8) break;
    }
    if (!picked.length) {
      return `<section class="section"><div class="section-head"><h2 class="section-title">Janelas da semana</h2></div>
        <div class="card empty"><h3>Semana fraca para ${SPORT[sport].name.toLowerCase()}</h3><p>Nenhum spot chega a 6 nesta região e nível nos próximos dias. Experimenta outra região ou desporto.</p></div></section>`;
    }
    picked.sort((a, b) => a.peakIdx - b.peakIdx);
    const u = state.prefs;
    const cards = picked.map((w) => {
      const s = w.spot;
      const c = condsOf(s.id)[w.peakIdx];
      const t0 = timeOf(w.start);
      const t1 = timeOf(w.end);
      return `<a class="win" href="#spot-${s.id}" data-open="${s.id}" data-idx="${w.peakIdx}">
        <div class="win-top"><span class="win-when">${fmtDay(t0, s.tz, timeOf(state.nowIdx))} · ${fmtHourShort(t0, s.tz)}–${fmtHourShort(t1, s.tz)}</span>${scoreBadge(w.peak, 'sm')}</div>
        <div class="win-spot">${escapeHtml(s.name)}</div>
        <div class="win-meta">${escapeHtml(s.area)} · ${faceText(c, u.hUnit)} · ${isNum(c.wind.kn) ? `${fmtWind(c.wind.kn, u.wUnit)} ${c.wind.rel.short}` : ''}</div>
      </a>`;
    }).join('');
    return `<section class="section"><div class="section-head"><h2 class="section-title">Janelas da semana</h2><span class="section-sub">Nota ≥ 6 · ${SPORT[sport].name}</span></div><div class="windows">${cards}</div></section>`;
  }

  function intro() {
    if (state.prefs.seenIntro) return '';
    const p = state.prefs;
    return `<div class="intro" role="group" aria-label="Personalizar">
      <div class="intro-row"><b>Personaliza as notas:</b></div>
      <div class="intro-row">Faço
        <select id="intro-sport" aria-label="Desporto">${SPORTS.map((s) => `<option value="${s.id}" ${s.id === p.sport ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
        nível <select id="intro-level" aria-label="Nível">${LEVELS.map((l) => `<option value="${l.id}" ${l.id === levelOf() ? 'selected' : ''}>${l.name}</option>`).join('')}</select>
        e parto de <select id="intro-home" aria-label="Cidade de partida"><option value="">— sem cidade —</option>${HOMES.map((h) => `<option value="${h.id}" ${p.home?.name === h.name ? 'selected' : ''}>${h.name}</option>`).join('')}</select>
        <button type="button" class="btn btn-sm btn-primary" data-intro-done>Feito</button>
      </div></div>`;
  }

  function render() {
    ocean?.destroy();
    ocean = null;
    if (!state.fc) {
      el.innerHTML = `<div class="skeleton" style="height:44px;margin-top:6px"></div><div class="skeleton" style="height:420px;margin-top:14px"></div><div class="skeleton" style="height:200px;margin-top:14px"></div>`;
      return;
    }
    const when = effectiveWhen();
    const top = when.rows[0];
    const sport = state.prefs.sport;
    const parts = PARTS.filter((p) => p.id !== 'agora' || state.day === 0);
    const regionOpts = REGION_FILTERS.map((r) => `<option value="${r.id}" ${r.id === state.prefs.region ? 'selected' : ''}>${r.name}</option>`).join('');
    const driveOpts = [[0, 'Qualquer distância'], [45, 'Até 45 min'], [75, 'Até 1h15'], [120, 'Até 2h']]
      .map(([v, l]) => `<option value="${v}" ${+state.prefs.maxDrive === v ? 'selected' : ''}>${l}</option>`).join('');

    el.innerHTML = `
      <div class="when">
        <div class="days" role="group" aria-label="Dia">${dayChips()}</div>
        <div class="when-row">
          <div class="seg" role="group" aria-label="Parte do dia">${parts.map((p) => `<button type="button" data-part="${p.id}" aria-pressed="${state.part === p.id || (p.id === 'manha' && state.part === 'agora' && state.day !== 0)}">${p.name}</button>`).join('')}</div>
          <div class="fchips">
            <select class="fchip" id="agora-region" aria-label="Região">${regionOpts}</select>
            ${state.prefs.home ? `<select class="fchip" id="agora-drive" aria-label="Distância de ${escapeHtml(state.prefs.home.name)}">${driveOpts}</select>` : ''}
          </div>
        </div>
      </div>
      ${intro()}
      ${when.shifted ? `<div class="notice" style="margin-top:12px">${icon('moon', { size: 18 })}<span>Já não há luz para ${SPORT[sport].verb} hoje — a mostrar ${whenPhrase(when.day, when.part)}.</span></div>` : ''}
      ${state.stale ? `<div class="notice" style="margin-top:12px">${icon('info', { size: 18 })}<span>Sem ligação à previsão ao vivo: estás a ver dados guardados de ${fmtDay(state.fc.t0 + 12 * 3600, 'Europe/Lisbon')}.</span></div>` : ''}
      <div class="agora-grid">
        <div>
          ${top ? hero(top, when) : `<div class="card empty" style="margin-top:14px"><h3>Sem spots para mostrar</h3><p>Nenhum spot de ${SPORT[sport].name.toLowerCase()} nesta região${state.prefs.maxDrive ? ' e distância' : ''}. Alarga a pesquisa.</p></div>`}
          ${top && top.score < 3.5 ? `<div class="notice" style="margin-top:12px">${icon('info', { size: 18 })}<span>Dia fraco para ${SPORT[sport].name.toLowerCase()} ${whenPhrase(when.day, when.part)} — nenhum spot passa de ${fmtScore(top.score)}.</span></div>` : ''}
          ${otherSportHint(when, top?.score)}
          ${others(when.rows)}
        </div>
        <div>
          ${synopsisCard(when)}
          ${weekWindows()}
        </div>
      </div>`;

    if (top) {
      const canvas = el.querySelector('.hero-ocean canvas');
      const c = condsOf(top.spot.id)[top.idx];
      ocean = createOcean(canvas, oceanParams(top.spot, c, timeOf(top.idx)));
    }
  }

  el.addEventListener('click', (e) => {
    const day = e.target.closest('[data-day]');
    if (day) {
      const d = +day.dataset.day;
      setWhen(d, d === 0 ? state.part : state.part === 'agora' ? 'manha' : state.part);
      return;
    }
    const part = e.target.closest('[data-part]');
    if (part) {
      setWhen(state.day, part.dataset.part);
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) {
      e.preventDefault();
      setCursor(+open.dataset.idx);
      go('spot', open.dataset.open);
      return;
    }
    const sp = e.target.closest('[data-sport]');
    if (sp) {
      setSport(sp.dataset.sport);
      return;
    }
    if (e.target.closest('[data-intro-done]')) setPref('seenIntro', true);
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'agora-region') setPref('region', t.value);
    else if (t.id === 'agora-drive') setPref('maxDrive', +t.value);
    else if (t.id === 'intro-sport') setSport(t.value);
    else if (t.id === 'intro-level') setLevel(state.prefs.sport, +t.value);
    else if (t.id === 'intro-home') {
      const h = HOMES.find((x) => x.id === t.value);
      setPref('home', h ? { name: h.name, lat: h.lat, lon: h.lon } : null);
      if (h && ['funchal'].includes(h.id)) setPref('region', 'madeira');
      if (h && ['pdelgada'].includes(h.id)) setPref('region', 'acores');
    }
  });

  render();
  return {
    update(what) {
      if (what === 'cursor') return;
      render();
    },
    unmount() {
      ocean?.destroy();
    },
  };
}
