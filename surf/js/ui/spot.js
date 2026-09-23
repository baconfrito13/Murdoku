// Spot page: live conditions at the time cursor, per-sport scores with the
// reasons, 7-day chart, best windows, orientation compass, spot guide, gear,
// sun times and nearby alternatives.

import {
  condsOf, driveFrom, evalAt, fmtDrive, go, isFav, levelOf, regionName, scores, setCursor, setSport, spotById,
  spots, SPORT, SPORTS, state, timeOf, toggleFav, view,
} from '../core.js';
import { explain, LEVELS, levelName, rating } from '../model.js';
import { boardAdvice, bestWindows, crowd, weatherIcon, weatherLabel, wetsuit, windGear } from '../insights.js';
import { sunFor } from '../forecast.js';
import { tideLabel, tidePrefLabel } from '../tide.js';
import {
  clamp, compass, compassName16, distanceKm, escapeHtml, fmtDateTime, fmtDay, fmtHeight, fmtHeightRange,
  fmtHour, fmtHourShort, fmtTemp, fmtWind, isNum,
} from '../util.js';
import { dirArrow, icon } from '../icons.js';
import { fmtScore, reasonsList, scoreBadge, sparkBars, toast } from './components.js';
import { createOcean, oceanParams } from './ocean.js';
import { compassSvg } from './compass.js';
import { createChart } from './chart.js';

const TYPE = { beach: 'Beach break', reef: 'Reef break', point: 'Point break', rivermouth: 'Foz de rio', jetty: 'Junto ao molhe', lagoon: 'Lagoa', bay: 'Baía', slab: 'Laje' };
const BOTTOM = { sand: 'Areia', rock: 'Rocha', reef: 'Recife', mixed: 'Areia e rocha', boulders: 'Calhau' };
const BREAKS = { left: 'Esquerdas', right: 'Direitas', both: 'Direitas e esquerdas', peaks: 'Vários picos' };
const HAZ = {
  rocks: 'Rochas', reef: 'Fundo de recife', currents: 'Correntes', shorebreak: 'Shorebreak', crowd: 'Crowd', localism: 'Localismo',
  'big-waves': 'Ondas grandes', remote: 'Acesso remoto', cold: 'Água fria', jetty: 'Molhe', shallow: 'Pouca água',
};

export function mount(el, id) {
  const spot = spotById.get(id);
  let ocean = null;
  let chart = null;
  const api = { title: spot?.name ?? 'Spot' };
  if (!spot) {
    el.innerHTML = `<div class="card empty" style="margin-top:20px"><h3>Spot não encontrado</h3><p>Este spot não existe na base de dados.</p><p style="margin-top:12px"><a class="btn" href="#spots">Ver todos os spots</a></p></div>`;
    return api;
  }

  const units = () => ({ hUnit: state.prefs.hUnit, wUnit: state.prefs.wUnit });

  function staticHtml() {
    const lvl = LEVELS[spot.level - 1]?.name ?? '';
    const drive = driveFrom(spot);
    return `
      <div class="spot-head">
        <div class="spot-head-bar">
          <button type="button" class="btn btn-ghost btn-sm" data-back>${icon('back', { size: 18 })} Voltar</button>
          <div style="display:flex;gap:4px">
            <button type="button" class="fav-btn" data-fav aria-pressed="${isFav(spot.id)}" aria-label="${isFav(spot.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">${icon(isFav(spot.id) ? 'star-fill' : 'star', { size: 22 })}</button>
            <button type="button" class="fav-btn" data-share aria-label="Partilhar">${icon('share', { size: 21 })}</button>
          </div>
        </div>
        <div class="eyebrow">${escapeHtml(spot.area)} · ${regionName(spot.region)}${drive ? ` · ${fmtDrive(drive)} de ${escapeHtml(state.prefs.home.name)}` : ''}</div>
        <h1 class="spot-name display" style="--fit:${Math.min(13, 170 / spot.name.length).toFixed(2)}">${escapeHtml(spot.name)}</h1>
        <div class="chips">
          <span class="chip">${TYPE[spot.type] || spot.type}</span>
          <span class="chip">${BOTTOM[spot.bottom] || spot.bottom}</span>
          ${spot.breaks ? `<span class="chip">${BREAKS[spot.breaks] || spot.breaks}</span>` : ''}
          <span class="chip ${spot.level >= 3 ? 'warn' : ''}">Nível ${lvl.toLowerCase()}+</span>
          ${spot.famous ? `<span class="chip">${icon('star-fill', { size: 12 })} Mítico</span>` : ''}
        </div>
      </div>
      <div class="spot-hero"><canvas aria-hidden="true"></canvas><div class="over" data-hero-over></div></div>
      <div class="cursor-bar">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Hora anterior">${icon('back', { size: 20 })}</button>
        <div class="when-txt" data-when aria-live="polite"></div>
        <span data-when-score></span>
        <button type="button" class="icon-btn" data-step="1" aria-label="Hora seguinte">${icon('chev-right', { size: 20 })}</button>
        <button type="button" class="btn btn-sm" data-now>Agora</button>
      </div>
      <section class="section" style="margin-top:14px"><div class="sport-scores" data-sports></div></section>
      <section class="section"><div class="tiles" data-tiles></div></section>
      <section class="section why"><div class="section-head"><h2 class="section-title">Porquê esta nota</h2><span class="section-sub" data-why-sub></span></div>
        <div class="card pad" style="display:grid;gap:16px"><div data-reasons></div><div class="factors" data-factors></div></div></section>
      <section class="section"><div class="section-head"><h2 class="section-title">Previsão 7 dias</h2><span class="section-sub">Toca no gráfico para escolher a hora</span></div>
        <div class="fchart-wrap" data-chart></div>
        <div class="chart-legend">
          <span><i class="lg-wave"></i>Ondas na praia (faixa mín.–máx.)</span>
          <span><i class="lg-good"></i>Vento terral</span><span><i class="lg-mid"></i>Cruzado</span><span><i class="lg-bad"></i>Maral</span>
          <span><i class="lg-tide"></i>Maré</span><span><i class="lg-night"></i>Noite</span>
        </div></section>
      <section class="section"><div class="section-head"><h2 class="section-title">Melhores janelas</h2><span class="section-sub" data-win-sub></span></div><div data-windows></div></section>
      <div class="spot-body">
        <section class="section"><div class="section-head"><h2 class="section-title">Orientação</h2></div><div class="card pad" data-compass></div></section>
        <section class="section"><div class="section-head"><h2 class="section-title">O spot</h2></div>
          <p class="desc">${escapeHtml(spot.desc || '')}</p>
          ${spot.tips ? `<p class="tip">${icon('spark', { size: 18 })}<span>${escapeHtml(spot.tips)}</span></p>` : ''}
          <div class="facts" style="margin-top:16px">
            <div class="fact"><small>Ondulação ideal</small><b>${compassName16(spot.bestSwell)} (${compass(spot.bestSwell)})</b></div>
            <div class="fact"><small>Vento ideal</small><b>Terral de ${compass(spot.offshore)}</b></div>
            <div class="fact"><small>Maré</small><b>${tidePrefLabel(spot.tide, spot.tideSens)}</b></div>
            <div class="fact"><small>Tamanho ideal</small><b>${fmtHeightRange(spot.size[1], spot.size[2], state.prefs.hUnit)}</b></div>
            <div class="fact"><small>Aguenta até</small><b>${fmtHeight(spot.size[3], state.prefs.hUnit)}</b></div>
            <div class="fact"><small>Melhor época</small><b>${escapeHtml(spot.season || '—')}</b></div>
          </div>
          ${spot.hazards?.length ? `<div class="chips" style="margin-top:12px">${spot.hazards.map((h) => `<span class="chip warn">${icon('alert', { size: 13 })} ${HAZ[h] || h}</span>`).join('')}</div>` : ''}
        </section>
        <section class="section"><div class="section-head"><h2 class="section-title">Equipamento</h2><span class="section-sub" data-gear-sub></span></div><div class="gear" data-gear></div></section>
        <section class="section"><div class="section-head"><h2 class="section-title">Sol</h2><span class="section-sub" data-sun-sub></span></div><div class="sun-row" data-sun></div></section>
        <section class="section span"><div class="section-head"><h2 class="section-title">Aqui perto</h2><span class="section-sub" data-near-sub></span></div><div class="rows" data-near></div></section>
        <section class="section span"><div class="links">
          <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}" target="_blank" rel="noopener">${icon('map', { size: 18 })} Ver no mapa</a>
          <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}" target="_blank" rel="noopener">${icon('route', { size: 18 })} Direções</a>
          <a class="btn" href="#mapa" data-onmap>${icon('pin', { size: 18 })} No mapa da Maresia</a>
        </div></section>
      </div>`;
  }

  const q = (sel) => el.querySelector(sel);

  function dynamic() {
    const i = state.cursor ?? state.nowIdx;
    const c = condsOf(spot.id)[i];
    const t = timeOf(i);
    const sport = state.prefs.sport;
    const level = levelOf(sport);
    const r = evalAt(spot.id, i);
    const v = view(spot.id);
    const u = units();
    const sun = sunFor(v, t);
    const daylight = v.day[i];

    // Hero overlay & ocean
    q('[data-hero-over]').innerHTML = `<span class="glass">${icon(weatherIcon(c.wcode, daylight), { size: 15 })} ${weatherLabel(c.wcode)}${isNum(c.air) ? ` · ${fmtTemp(c.air)}` : ''}</span>
      <span class="glass">${icon('thermo', { size: 14 })} Água ${fmtTemp(c.sst)}</span>`;
    ocean?.set(oceanParams(spot, c, t));

    // Cursor bar
    const tideTxt = isNum(c.tide.pos) ? tideLabel(c.tide.pos, c.tide.trend) : '';
    q('[data-when]').innerHTML = `${fmtDateTime(t, spot.tz, timeOf(state.nowIdx))}${daylight ? '' : ' · noite'}<small>${tideTxt}${i === state.nowIdx ? ' · agora' : ''}</small>`;
    q('[data-when-score]').innerHTML = scoreBadge(r.score, 'sm');

    // Sport scores
    q('[data-sports]').innerHTML = SPORTS.map((sp) => {
      const suited = spot.sports[sp.id] > 0;
      const s = suited ? evalAt(spot.id, i, sp.id).score : 0;
      return `<button type="button" class="sport-score ${suited ? '' : 'na'}" data-sport="${sp.id}" aria-pressed="${sp.id === sport}" title="${sp.name}${suited ? `: ${fmtScore(s)}` : ' — não indicado'}">
        ${suited ? scoreBadge(s, 'xs', { title: false }) : `<span class="score xs sc-0" aria-hidden="true">–</span>`}<span>${sp.name}</span></button>`;
    }).join('');

    // Tiles
    const sw = c.comps.filter((k) => k.kind !== 'wind').sort((a, b) => b.h - a.h);
    const ww = c.comps.find((k) => k.kind === 'wind');
    const ext = (v.tide?.extremes || []).filter((e) => e.t > t).slice(0, 2);
    const suit = wetsuit(c.sst, c.air, c.wind.kn);
    q('[data-tiles]').innerHTML = `
      <div class="tile"><div class="tile-head">${icon('wave', { size: 15 })} Ondas</div>
        <div class="tile-big">${fmtHeightRange(c.face.lo, c.face.hi, u.hUnit)}</div>
        <div class="tile-sub">${sw.map((k, n) => `${n ? '2ª ' : ''}${fmtHeight(k.h, u.hUnit)} · ${Math.round(k.per)} s · ${compass(k.dir)} ${dirArrow(k.dir, { size: 12 })}`).join('<br>') || 'Sem ondulação'}${ww ? `<br><span class="muted">Vaga ${fmtHeight(ww.h, u.hUnit)} · ${Math.round(ww.per)} s</span>` : ''}</div></div>
      <div class="tile"><div class="tile-head">${icon('wind', { size: 15 })} Vento</div>
        <div class="tile-big">${fmtWind(c.wind.kn, u.wUnit)} ${isNum(c.wind.dir) ? dirArrow(c.wind.dir, { size: 18 }) : ''}<small>${compass(c.wind.dir)}</small></div>
        <div class="tile-sub"><span class="tag ${c.wind.rel.id}">${c.wind.rel.name}</span> · rajadas ${fmtWind(c.wind.gust, u.wUnit)}${c.wind.sheltered ? '<br>Spot abrigado deste vento' : ''}</div></div>
      <div class="tile"><div class="tile-head">${icon('tide', { size: 15 })} Maré</div>
        <div class="tile-big">${isNum(c.tide.pos) ? `${Math.round(c.tide.pos * 100)}%<small>${c.tide.trend > 0 ? 'a encher' : 'a vazar'}</small>` : '—'}</div>
        ${tideMini(v, i)}
        <div class="tile-sub">${ext.map((e) => `${e.type === 'high' ? 'Preia-mar' : 'Baixa-mar'} <b>${fmtHour(e.t, spot.tz)}</b> · ${fmtHeight(e.h, 'm')}`).join('<br>')}</div></div>
      <div class="tile"><div class="tile-head">${icon('thermo', { size: 15 })} Água</div>
        <div class="tile-big">${fmtTemp(c.sst)}<small>ar ${fmtTemp(c.air)}</small></div>
        <div class="tile-sub"><b>${suit.label}</b><br>${suit.detail}</div></div>`;

    // Why
    const reasons = explain(spot, c, sport, level, r, u.hUnit);
    const cr = crowd(spot, t, r.score, spot.tz);
    q('[data-why-sub]').textContent = `${SPORT[sport].name} · ${levelName(level)}`;
    q('[data-reasons]').innerHTML = `<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">${scoreBadge(r.score, 'lg')}<div><b style="font-size:18px">${rating(r.score).name}</b><div class="muted" style="font-size:13px">${icon('users', { size: 14, cls: 'inline' })} Crowd previsto: ${cr.name.toLowerCase()} <span title="Estimativa pela popularidade, dia da semana, hora e qualidade do mar">(estimativa)</span></div></div></div>
      ${daylight ? '' : `<div class="notice" style="margin-bottom:10px">${icon('moon', { size: 18 })}<span>É de noite a esta hora — a nota é só indicativa.</span></div>`}
      ${reasonsList(reasons, 6)}`;
    q('[data-factors]').innerHTML = factorBars(sport, r);

    // Gear
    const gear = [];
    const board = boardAdvice(sport, c.face.mid, level, c.period);
    if (board) gear.push(['board', board.label, board.detail]);
    const wg = windGear(sport, state.prefs.weight, c.wind.kn);
    if (wg) gear.push(['wind', wg.label, wg.detail]);
    gear.push(['suit', suit.label, `Água a ${fmtTemp(c.sst)}${isNum(c.air) ? `, ar a ${fmtTemp(c.air)}` : ''}. ${suit.detail}`]);
    q('[data-gear]').innerHTML = gear.map(([ic, a, b]) => `<div class="tile"><div class="tile-head">${icon(ic, { size: 15 })} ${ic === 'suit' ? 'Fato' : ic === 'board' ? 'Prancha' : 'Tamanho'}</div><div class="tile-big">${escapeHtml(a)}</div><div class="tile-sub">${escapeHtml(b)}</div></div>`).join('');
    q('[data-gear-sub]').textContent = SPORT[sport].kind === 'wind' ? `Para ${state.prefs.weight} kg · muda em Definições` : '';

    // Sun
    if (sun) {
      q('[data-sun-sub]').textContent = fmtDay(sun.noon, spot.tz, timeOf(state.nowIdx));
      q('[data-sun]').innerHTML = [['Primeira luz', sun.dawn], ['Nascer', sun.rise], ['Pôr do sol', sun.set], ['Última luz', sun.dusk]]
        .map(([l, s]) => `<div><small>${l}</small><b>${fmtHour(s, spot.tz)}</b></div>`).join('');
    }

    // Nearby
    const near = spots.filter((s) => s.id !== spot.id && s.view === spot.view && s.sports[sport] > 0)
      .map((s) => ({ s, km: distanceKm(spot.lat, spot.lon, s.lat, s.lon) }))
      .filter((x) => x.km < 45)
      .map((x) => ({ ...x, score: view(x.s.id).ok ? scores(x.s.id)[i] : 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    q('[data-near-sub]').textContent = `${SPORT[sport].name} · ${fmtHourShort(t, spot.tz)}`;
    q('[data-near]').innerHTML = near.length ? near.map((x) => {
      const cc = condsOf(x.s.id)[i];
      return `<a class="row" href="#spot-${x.s.id}"><div class="row-main"><div class="row-title"><span class="t">${escapeHtml(x.s.name)}</span></div>
        <div class="row-sub">${Math.round(x.km)} km · ${fmtHeightRange(cc.face.lo, cc.face.hi, u.hUnit)} · ${fmtWind(cc.wind.kn, u.wUnit)} ${cc.wind.rel.short}</div></div>${scoreBadge(x.score, 'sm')}</a>`;
    }).join('') : `<div class="empty">Sem outros spots de ${SPORT[sport].name.toLowerCase()} num raio de 45 km.</div>`;

    // Compass
    q('[data-compass]').innerHTML = compassSvg(spot, c, u);
    chart?.setCursor(i, { reveal: true });
  }

  function tideMini(v, i) {
    const h = v.tide?.h;
    if (!h) return '';
    const from = clamp(i - 6, 0, h.length - 1);
    const to = clamp(i + 7, 1, h.length);
    const seg = h.slice(from, to);
    const vals = seg.filter(isNum);
    if (!vals.length) return '';
    const all = h.filter(isNum);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const X = (k) => (k / (seg.length - 1)) * 100;
    const Y = (val) => 36 - ((val - lo) / Math.max(0.1, hi - lo)) * 32;
    const d = seg.map((val, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)} ${Y(val).toFixed(1)}`).join('');
    const ci = i - from;
    return `<svg class="tide-mini" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="${d}L100 40L0 40Z"/><path class="curve" d="${d}" vector-effect="non-scaling-stroke"/>
      <line x1="${X(ci)}" x2="${X(ci)}" y1="0" y2="40" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function factorBars(sport, r) {
    const f = r.f || {};
    const rows = [];
    const add = (name, val) => {
      if (!isNum(val)) return;
      const v = clamp(val);
      rows.push(`<div class="factor"><span>${name}</span><div class="bar"><i class="${v < 0.45 ? 'lo' : v < 0.75 ? 'mid' : 'hi'}" style="width:${Math.round(v * 100)}%"></i></div><b>${Math.round(v * 10)}</b></div>`);
    };
    if (SPORT[sport].kind === 'waves') {
      const raw = r.raw || {};
      add('Tamanho', f.size);
      add('Vento', raw.W);
      add('Período', raw.P);
      add('Direção', (f.dir - 0.6) / 0.4);
      add('Maré', raw.T);
      add('Limpeza', (raw.clean - 0.4) / 0.6);
      add('Spot', raw.quality * raw.suit);
      if (raw.gate < 1) add('Teu nível', raw.gate);
    } else if (sport === 'sup') {
      add('Calma', f.calm);
      add('Plano', f.flat);
      add('Ondas', f.surf);
      add('Spot', r.raw?.suit);
    } else {
      add('Força', f.speed);
      add('Direção', f.dir);
      add('Regularidade', f.gust);
      add('Mar', f.waves);
      add('Spot', r.raw?.suit);
    }
    return rows.join('') + `<p class="muted" style="font-size:12px;margin-top:4px">Cada fator de 0 a 10. A nota multiplica-os: um só fator fraco chega para baixar muito a nota.</p>`;
  }

  function windowsHtml() {
    const sport = state.prefs.sport;
    const v = view(spot.id);
    const ws = bestWindows(scores(spot.id), v.day, state.nowIdx, state.fc.n, 5, 6).sort((a, b) => a.start - b.start);
    q('[data-win-sub]').textContent = `${SPORT[sport].name} · nota ≥ 5,5`;
    if (!ws.length) {
      q('[data-windows]').innerHTML = `<div class="card empty"><h3>Sem boas janelas esta semana</h3><p>${escapeHtml(spot.name)} não passa de ${fmtScore(Math.max(...scores(spot.id)))} para ${SPORT[sport].name.toLowerCase()} (${levelName(levelOf(sport)).toLowerCase()}) nos próximos dias.</p></div>`;
      return;
    }
    q('[data-windows]').innerHTML = `<div class="rows">${ws.map((w) => {
      const c = condsOf(spot.id)[w.peakIdx];
      const t0 = timeOf(w.start);
      return `<button type="button" class="row" data-goto="${w.peakIdx}">
        <div class="row-main"><div class="row-title">${fmtDay(t0, spot.tz, timeOf(state.nowIdx))} · ${fmtHourShort(t0, spot.tz)}–${fmtHourShort(timeOf(w.end), spot.tz)}</div>
        <div class="row-sub">Pico às ${fmtHour(timeOf(w.peakIdx), spot.tz)} · ${fmtHeightRange(c.face.lo, c.face.hi, state.prefs.hUnit)} · ${fmtWind(c.wind.kn, state.prefs.wUnit)} ${c.wind.rel.short}</div>
        ${sparkBars(scores(spot.id), v.day, Math.max(0, w.start - 2), Math.min(state.fc.n, w.end + 2), { height: 14 })}</div>
        ${scoreBadge(w.peak, 'sm')}</button>`;
    }).join('')}</div>`;
  }

  function buildChart() {
    chart?.destroy();
    chart = createChart(q('[data-chart]'), {
      spot,
      fc: state.fc,
      conds: condsOf(spot.id),
      view: view(spot.id),
      getScores: () => scores(spot.id),
      units: units(),
      nowIdx: state.nowIdx,
      onCursor: (i) => setCursor(i, 'chart'),
    });
  }

  function render() {
    ocean?.destroy();
    ocean = null;
    if (!state.fc) {
      el.innerHTML = `<div class="skeleton" style="height:120px;margin-top:8px"></div><div class="skeleton" style="height:168px;margin-top:14px"></div><div class="skeleton" style="height:300px;margin-top:14px"></div>`;
      return;
    }
    if (!view(spot.id).ok) {
      el.innerHTML = `${staticHtml()}`;
      q('.cursor-bar').insertAdjacentHTML('afterend', `<div class="notice" style="margin-top:12px">${icon('info', { size: 18 })}<span>Sem dados de previsão para este spot neste momento.</span></div>`);
      return;
    }
    el.innerHTML = staticHtml();
    const i = state.cursor ?? state.nowIdx;
    ocean = createOcean(q('.spot-hero canvas'), oceanParams(spot, condsOf(spot.id)[i], timeOf(i)));
    buildChart();
    windowsHtml();
    dynamic();
    chart.scrollTo(i);
  }

  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-back]')) {
      if (state.navCount > 1) history.back();
      else go('agora');
      return;
    }
    if (t.closest('[data-fav]')) {
      toggleFav(spot.id);
      toast(isFav(spot.id) ? `${spot.name} adicionado aos favoritos` : `${spot.name} removido dos favoritos`);
      return;
    }
    if (t.closest('[data-share]')) {
      share();
      return;
    }
    const step = t.closest('[data-step]');
    if (step) {
      setCursor((state.cursor ?? state.nowIdx) + +step.dataset.step, 'step');
      return;
    }
    if (t.closest('[data-now]')) {
      setCursor(state.nowIdx, 'now');
      return;
    }
    const sp = t.closest('[data-sport]');
    if (sp) {
      setSport(sp.dataset.sport);
      return;
    }
    const gt = t.closest('[data-goto]');
    if (gt) {
      setCursor(+gt.dataset.goto, 'window');
      q('.cursor-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (t.closest('[data-onmap]')) {
      e.preventDefault();
      sessionStorageSet('maresia.mapFocus', spot.id);
      go('mapa');
    }
  });

  const onKey = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      setCursor((state.cursor ?? state.nowIdx) + (e.key === 'ArrowLeft' ? -1 : 1), 'key');
    }
  };
  document.addEventListener('keydown', onKey);

  async function share() {
    const i = state.cursor ?? state.nowIdx;
    const c = condsOf(spot.id)[i];
    const r = evalAt(spot.id, i);
    const sport = state.prefs.sport;
    const text = `${spot.name} (${spot.area}) · ${fmtDateTime(timeOf(i), spot.tz, timeOf(state.nowIdx))}\n${SPORT[sport].name}: ${fmtScore(r.score)}/10 (${rating(r.score).name})\nOndas ${fmtHeightRange(c.face.lo, c.face.hi, state.prefs.hUnit)} · ${Math.round(c.swellPer)} s ${compass(c.swellDir)} · vento ${fmtWind(c.wind.kn, state.prefs.wUnit)} ${c.wind.rel.short}\n— Maresia`;
    const url = location.href.split('#')[0] + `#spot-${spot.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${spot.name} · Maresia`, text, url });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('Resumo copiado — cola onde quiseres');
    } catch {
      toast('Não foi possível copiar neste navegador');
    }
  }

  render();
  return Object.assign(api, {
    update(what, detail) {
      if (!state.fc) return render();
      if (what === 'data') return render();
      if (what === 'cursor') {
        dynamic();
        return;
      }
      if (what === 'sport' || what === 'level' || what === 'prefs' || what === 'theme') {
        chart?.rebuild({ units: units() });
        windowsHtml();
        dynamic();
        return;
      }
      if (what === 'favs') {
        const b = q('[data-fav]');
        if (b) {
          b.setAttribute('aria-pressed', String(isFav(spot.id)));
          b.innerHTML = icon(isFav(spot.id) ? 'star-fill' : 'star', { size: 22 });
        }
        return;
      }
      if (what === 'tick') dynamic();
    },
    unmount() {
      ocean?.destroy();
      chart?.destroy();
      document.removeEventListener('keydown', onKey);
    },
  });
}

function sessionStorageSet(k, v) {
  try {
    sessionStorage.setItem(k, v);
  } catch { /* ignore */ }
}
