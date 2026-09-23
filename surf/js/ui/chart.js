// 7-day hourly forecast chart for one spot: score strip, wave face height with
// swell arrows and period, wind speed/gusts with direction arrows coloured by
// terral/cruzado/maral, and the tide curve with high/low times. Row labels and
// y-ticks live in a fixed left axis; the plot scrolls horizontally. Hover (mouse)
// or tap moves the shared time cursor.

import { clamp, compass, escapeHtml, fmtDayShort, fmtHour, fmtHeight, fmtHeightRange, fmtWind, isNum, UNITS, zoned } from '../util.js';
import { fmtScore, scoreClass } from './components.js';

const HEAD = 44;
const ROWS = {
  score: { top: HEAD + 6, h: 38, title: 'Nota' },
  wave: { top: HEAD + 62, h: 92, pad: 26, title: 'Ondas' },
  wind: { top: HEAD + 172, h: 78, pad: 20, title: 'Vento' },
  tide: { top: HEAD + 270, h: 58, pad: 14, title: 'Maré' },
};
const HEIGHT = HEAD + 340;

function niceMax(v, steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100]) {
  return steps.find((s) => s >= v) ?? Math.ceil(v);
}
const tri = (x, y, deg, size, cls) => {
  const s = size;
  return `<path class="${cls}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((deg + 180) % 360).toFixed(0)})" d="M0 ${-s} L${s * 0.62} ${s * 0.8} L0 ${s * 0.38} L${-s * 0.62} ${s * 0.8}Z"/>`;
};
const REL_CLASS = { offshore: 'rel-good', 'cross-off': 'rel-good', cross: 'rel-mid', 'cross-on': 'rel-bad', onshore: 'rel-bad' };

export function createChart(wrap, { spot, fc, conds, view, getScores, units, nowIdx, onCursor }) {
  const hw = wrap.clientWidth > 900 ? 12 : 10;
  const n = fc.n;
  const W = n * hw;
  let cursor = 0;
  wrap.innerHTML = `<svg class="fchart-axis" width="48" height="${HEIGHT}" aria-hidden="true"></svg>
    <div class="fchart-scroll" tabindex="0" aria-label="Previsão hora a hora — desliza para ver a semana"><svg class="fchart" width="${W}" height="${HEIGHT}" role="img" aria-label="Gráfico de previsão de 7 dias para ${escapeHtml(spot.name)}"></svg></div>
    <div class="tooltip" hidden></div>`;
  const axis = wrap.querySelector('.fchart-axis');
  const scroll = wrap.querySelector('.fchart-scroll');
  const svg = wrap.querySelector('.fchart');
  const tip = wrap.querySelector('.tooltip');
  const x = (i) => i * hw;
  const tz = spot.tz;

  function build() {
    const scores = getScores();
    const hU = UNITS.height[units.hUnit] || UNITS.height.m;
    const wU = UNITS.wind[units.wUnit] || UNITS.wind.kn;
    let g = '';

    // Night shading (merged runs) and day separators.
    let runStart = -1;
    for (let i = 0; i <= n; i++) {
      const night = i < n && !view.day[i];
      if (night && runStart < 0) runStart = i;
      if (!night && runStart >= 0) {
        g += `<rect class="night" x="${x(runStart)}" y="${HEAD}" width="${x(i) - x(runStart)}" height="${HEIGHT - HEAD}"/>`;
        runStart = -1;
      }
    }
    let header = '';
    for (let i = 0; i < n; i++) {
      const z = zoned(fc.t0 + i * 3600, tz);
      if (z.h === 0) {
        g += `<line class="dayline" x1="${x(i)}" x2="${x(i)}" y1="4" y2="${HEIGHT}"/>`;
        header += `<text class="day-t" x="${x(i) + 6}" y="17">${fmtDayShort(fc.t0 + i * 3600, tz)}</text>`;
      }
      if (i === 0 && z.h > 0 && z.h < 21) header += `<text class="day-t" x="6" y="17">${fmtDayShort(fc.t0, tz)}</text>`;
      if (z.h % 6 === 0 && z.h !== 0) header += `<text class="axis-t" x="${x(i)}" y="36" text-anchor="middle">${String(z.h).padStart(2, '0')}h</text>`;
    }

    // Score strip.
    const sr = ROWS.score;
    for (let i = 0; i < n; i++) {
      if (!view.day[i]) continue;
      const s = scores[i];
      const h = Math.max(2, (clamp(s, 0, 10) / 10) * sr.h);
      g += `<rect class="sbar ${scoreClass(s)}" x="${x(i) + 1}" y="${(sr.top + sr.h - h).toFixed(1)}" width="${hw - 2}" height="${h.toFixed(1)}" rx="2"/>`;
    }

    // Waves: lo–hi band + mid line, swell arrows & period every 3 h.
    const wr = ROWS.wave;
    const his = conds.map((c) => c.face.hi).filter(isNum);
    const hMax = niceMax(Math.max(1, ...his) * hU.k) / hU.k;
    const wy = (v) => wr.top + wr.pad + (wr.h - wr.pad) * (1 - clamp(v / hMax, 0, 1.05));
    let band = '';
    let bandBack = '';
    let line = '';
    conds.forEach((c, i) => {
      if (!isNum(c.face.mid)) return;
      const cx = x(i) + hw / 2;
      band += `${band ? 'L' : 'M'}${cx.toFixed(1)} ${wy(c.face.hi).toFixed(1)}`;
      bandBack = `L${cx.toFixed(1)} ${wy(c.face.lo).toFixed(1)}${bandBack}`;
      line += `${line ? 'L' : 'M'}${cx.toFixed(1)} ${wy(c.face.mid).toFixed(1)}`;
    });
    const ticksW = [];
    for (let k = 0; k <= 4; k++) ticksW.push((hMax * k) / 4);
    for (const v of ticksW.slice(1)) g += `<line class="grid" x1="0" x2="${W}" y1="${wy(v).toFixed(1)}" y2="${wy(v).toFixed(1)}"/>`;
    if (band) g += `<path class="wave-area" d="${band}${bandBack}Z"/><path class="wave-line" d="${line}"/>`;
    for (let i = 1; i < n; i += 3) {
      const c = conds[i];
      if (!isNum(c.swellDir)) continue;
      const size = clamp(3.5 + (c.swellH || 0) * 1.6, 4, 8.5);
      g += tri(x(i) + hw / 2, wr.top + 9, c.swellDir, size, 'wave-arr');
      if ((i - 1) % 6 === 0 && isNum(c.swellPer)) g += `<text class="val-t" x="${x(i) + hw / 2}" y="${wr.top + 26}" text-anchor="middle">${Math.round(c.swellPer)}s</text>`;
    }

    // Wind: gust band + speed line, arrows every 3 h coloured by relation.
    const wi = ROWS.wind;
    const gusts = conds.map((c) => c.wind.gust).filter(isNum);
    const wMax = niceMax(Math.max(15, ...gusts) * wU.k, [10, 15, 20, 25, 30, 40, 50, 60, 80, 100]) / wU.k;
    const vy = (v) => wi.top + wi.pad + (wi.h - wi.pad) * (1 - clamp(v / wMax, 0, 1.05));
    let gb = '';
    let gbBack = '';
    let wl = '';
    conds.forEach((c, i) => {
      if (!isNum(c.wind.kn)) return;
      const cx = x(i) + hw / 2;
      gb += `${gb ? 'L' : 'M'}${cx.toFixed(1)} ${vy(isNum(c.wind.gust) ? c.wind.gust : c.wind.kn).toFixed(1)}`;
      gbBack = `L${cx.toFixed(1)} ${vy(c.wind.kn).toFixed(1)}${gbBack}`;
      wl += `${wl ? 'L' : 'M'}${cx.toFixed(1)} ${vy(c.wind.kn).toFixed(1)}`;
    });
    const ticksV = [wMax / 2, wMax];
    for (const v of ticksV) g += `<line class="grid" x1="0" x2="${W}" y1="${vy(v).toFixed(1)}" y2="${vy(v).toFixed(1)}"/>`;
    if (gb) g += `<path class="wind-band" d="${gb}${gbBack}Z"/><path class="wind-line" d="${wl}"/>`;
    for (let i = 1; i < n; i += 3) {
      const c = conds[i];
      if (!isNum(c.wind.dir) || !isNum(c.wind.kn)) continue;
      g += tri(x(i) + hw / 2, wi.top + 8, c.wind.dir, clamp(3.5 + c.wind.kn * 0.18, 4, 8), `wind-arr ${REL_CLASS[c.wind.rel.id] || ''}`);
    }

    // Tide curve + extremes.
    const tr = ROWS.tide;
    const th = view.tide?.h || [];
    const tv = th.filter(isNum);
    if (tv.length) {
      const lo = Math.min(...tv);
      const hi = Math.max(...tv);
      const ty = (v) => tr.top + tr.pad + (tr.h - tr.pad * 2) * (1 - (v - lo) / Math.max(0.1, hi - lo));
      let tl = '';
      th.forEach((v, i) => {
        if (!isNum(v)) return;
        tl += `${tl ? 'L' : 'M'}${(x(i) + hw / 2).toFixed(1)} ${ty(v).toFixed(1)}`;
      });
      g += `<path class="tide-area" d="${tl}L${W} ${tr.top + tr.h}L0 ${tr.top + tr.h}Z"/><path class="tide-line" d="${tl}"/>`;
      for (const e of view.tide.extremes) {
        const ex = ((e.t - fc.t0) / 3600) * hw + hw / 2;
        if (ex < 12 || ex > W - 12) continue;
        const up = e.type === 'high';
        g += `<text class="tide-t" x="${ex.toFixed(1)}" y="${(up ? ty(e.h) - 5 : ty(e.h) + 12).toFixed(1)}" text-anchor="middle">${fmtHour(e.t, tz)}</text>`;
      }
      axis.dataset.tide = `${lo.toFixed(1)}|${hi.toFixed(1)}`;
    }

    // Now marker.
    if (nowIdx >= 0) g += `<line class="now" x1="${x(nowIdx) + hw / 2}" x2="${x(nowIdx) + hw / 2}" y1="${HEAD}" y2="${HEIGHT}"/>`;

    svg.innerHTML = `${g}${header}<g class="cursor-g"></g><rect class="hit" x="0" y="0" width="${W}" height="${HEIGHT}"/>`;

    // Fixed axis: row titles + y ticks.
    const at = (v, y) => `<text class="axis-t" x="42" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
    let ax = '';
    ax += `<text class="row-t" x="6" y="${ROWS.score.top + 12}">${ROWS.score.title}</text>`;
    ax += `<text class="row-t" x="6" y="${ROWS.wave.top + 12}">${ROWS.wave.title}</text>`;
    ax += `<text class="axis-t" x="6" y="${ROWS.wave.top + 24}">${hU.label}</text>`;
    for (const v of ticksW.slice(1)) ax += at(hU === UNITS.height.m ? (v * hU.k).toFixed(v * hU.k < 10 && hMax * hU.k < 6 ? 1 : 0).replace('.', ',') : Math.round(v * hU.k), wy(v));
    ax += `<text class="row-t" x="6" y="${ROWS.wind.top + 12}">${ROWS.wind.title}</text>`;
    ax += `<text class="axis-t" x="6" y="${ROWS.wind.top + 24}">${wU.short}</text>`;
    for (const v of ticksV) ax += at(Math.round(v * wU.k), vy(v));
    ax += `<text class="row-t" x="6" y="${ROWS.tide.top + 12}">${ROWS.tide.title}</text>`;
    axis.innerHTML = ax;
    drawCursor();
  }

  function drawCursor() {
    const gc = svg.querySelector('.cursor-g');
    if (!gc) return;
    const cx = x(cursor) + hw / 2;
    const label = fmtHour(fc.t0 + cursor * 3600, tz);
    gc.innerHTML = `<line class="cursor" x1="${cx}" x2="${cx}" y1="${HEAD - 2}" y2="${HEIGHT}"/>
      <rect class="cursor-cap" x="${cx - 21}" y="${HEAD - 18}" width="42" height="17" rx="8.5"/>
      <text x="${cx}" y="${HEAD - 5.5}" text-anchor="middle" style="fill:#1c1300;font-size:10.5px;font-weight:750">${label}</text>`;
  }

  function idxFromEvent(e) {
    const r = svg.getBoundingClientRect();
    return clamp(Math.floor((e.clientX - r.left) / hw), 0, n - 1);
  }

  function showTip(e, i) {
    const c = conds[i];
    const s = getScores()[i];
    const t = fc.t0 + i * 3600;
    tip.innerHTML = `<b>${fmtDayShort(t, tz)} · ${fmtHour(t, tz)}</b> · nota ${fmtScore(s)}${view.day[i] ? '' : ' (noite)'}<br>
      Ondas ${fmtHeightRange(c.face.lo, c.face.hi, units.hUnit)} · ${isNum(c.swellPer) ? `${Math.round(c.swellPer)} s ${compass(c.swellDir)}` : ''}<br>
      Vento ${fmtWind(c.wind.kn, units.wUnit)} ${compass(c.wind.dir)} (${c.wind.rel.short})${isNum(c.tide.h) ? ` · maré ${fmtHeight(c.tide.h, 'm')}` : ''}`;
    tip.hidden = false;
    const wr = wrap.getBoundingClientRect();
    const tw = tip.offsetWidth;
    let left = e.clientX - wr.left + 14;
    if (left + tw > wr.width - 6) left = e.clientX - wr.left - tw - 14;
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${Math.max(4, e.clientY - wr.top - 70)}px`;
  }

  let downX = 0;
  let raf = 0;
  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const i = idxFromEvent(e);
    showTip(e, i);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => onCursor(i));
  };
  const onDown = (e) => {
    downX = e.clientX;
  };
  const onUp = (e) => {
    if (Math.abs(e.clientX - downX) < 8) onCursor(idxFromEvent(e));
  };
  const onLeave = () => {
    tip.hidden = true;
  };
  scroll.addEventListener('pointermove', onMove);
  scroll.addEventListener('pointerdown', onDown);
  scroll.addEventListener('pointerup', onUp);
  scroll.addEventListener('pointerleave', onLeave);

  build();

  return {
    rebuild(next = {}) {
      Object.assign(units, next.units || {});
      build();
    },
    setCursor(i, { reveal = false } = {}) {
      cursor = i;
      drawCursor();
      if (reveal) {
        const cx = x(i);
        const vw = scroll.clientWidth;
        if (cx < scroll.scrollLeft + 20 || cx > scroll.scrollLeft + vw - 40) scroll.scrollTo({ left: Math.max(0, cx - vw * 0.3), behavior: 'smooth' });
      }
    },
    scrollTo(i) {
      scroll.scrollLeft = Math.max(0, x(i) - scroll.clientWidth * 0.3);
    },
    destroy() {
      cancelAnimationFrame(raf);
    },
  };
}
