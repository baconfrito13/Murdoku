// Shared UI pieces rendered as HTML strings (score badges, bar strips, stats,
// reasons) plus the bottom sheet and toast.

import { clamp, compass, escapeHtml, fmtHeightRange, fmtPeriod, fmtWind, isNum } from '../util.js';
import { dirArrow, icon } from '../icons.js';
import { LEVELS, rating, SPORTS } from '../model.js';
import { levelOf, setLevel, state } from '../core.js';

export const scoreClass = (s) => `sc-${Math.round((clamp(isNum(s) ? s : 0, 0, 10) / 10) * 12)}`;
export const fmtScore = (s) => (isNum(s) ? (s >= 9.95 ? '10' : s.toFixed(1).replace('.', ',')) : '—');

export function scoreBadge(s, size = '', { title = true } = {}) {
  const r = rating(isNum(s) ? s : 0);
  const star = s >= 8.5 ? `<span class="star">${icon('star-fill', { size: 11 })}</span>` : '';
  const t = title ? ` title="${r.name}"` : '';
  return `<span class="score ${size} ${scoreClass(s)}"${t} role="img" aria-label="Nota ${fmtScore(s)} de 10, ${r.name}">${fmtScore(s)}${star}</span>`;
}

export function scoreWithLabel(s, size = 'lg', sub = '') {
  const r = rating(s);
  return `<div class="score-wrap">${scoreBadge(s, size)}<div class="score-label"><b>${r.name}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
}

/**
 * Hourly score bars for [from, to). Night hours are drawn flat and muted.
 * Values ≥ 0 map to height; each bar carries its ramp class.
 */
export function sparkBars(scores, daylight, from, to, { now = -1, height = 22, gap = 1, label = '' } = {}) {
  const n = Math.max(1, to - from);
  const w = 100 / n;
  let bars = '';
  for (let i = from; i < to; i++) {
    const x = (i - from) * w;
    const s = scores[i] ?? 0;
    if (!daylight[i]) {
      bars += `<rect class="night" x="${x.toFixed(2)}" y="${height - 2}" width="${Math.max(0.1, w - gap * 0.2).toFixed(2)}" height="2"/>`;
      continue;
    }
    const h = Math.max(2, (clamp(s, 0, 10) / 10) * height);
    bars += `<rect class="${scoreClass(s)}" x="${x.toFixed(2)}" y="${(height - h).toFixed(2)}" width="${Math.max(0.1, w - gap * 0.35).toFixed(2)}" height="${h.toFixed(2)}" rx="0.6"/>`;
  }
  const nowLine = now >= from && now < to ? `<line class="now-line" x1="${((now - from + 0.5) * w).toFixed(2)}" x2="${((now - from + 0.5) * w).toFixed(2)}" y1="0" y2="${height}" vector-effect="non-scaling-stroke"/>` : '';
  const a11y = label ? `role="img" aria-label="${escapeHtml(label)}"` : 'aria-hidden="true"';
  return `<svg class="spark" viewBox="0 0 100 ${height}" preserveAspectRatio="none" height="${height}" ${a11y}>${bars}${nowLine}</svg>`;
}

export function stat(ico, big, small, title = '') {
  return `<div class="stat"${title ? ` title="${escapeHtml(title)}"` : ''}>${icon(ico, { size: 20 })}<div><b>${big}</b><span>${small}</span></div></div>`;
}

const MARK = { good: 'check', ok: 'minus', bad: 'close', warn: 'alert' };
export function reasonsList(reasons, max = 4) {
  if (!reasons.length) return '';
  return `<ul class="reasons">${reasons.slice(0, max).map((r) => `<li class="${r.kind}"><span class="mk">${icon(MARK[r.kind], { size: 13, stroke: 2.4 })}</span><span>${escapeHtml(r.text)}</span></li>`).join('')}</ul>`;
}

export function windText(c, units = state.prefs.wUnit) {
  if (!isNum(c.wind.kn)) return '—';
  return `${fmtWind(c.wind.kn, units)} ${compass(c.wind.dir)}`;
}
export function swellText(c) {
  if (!isNum(c.swellH)) return '—';
  return `${fmtPeriod(c.swellPer)} ${compass(c.swellDir)}`;
}
export const faceText = (c, units = state.prefs.hUnit) => fmtHeightRange(c.face.lo, c.face.hi, units);

/** Compact stat row used in hero/cards: waves, swell, wind, tide. */
export function condStats(c) {
  const u = state.prefs;
  const tide = isNum(c.tide.pos) ? `${Math.round(c.tide.pos * 100)}% ${c.tide.trend > 0 ? '↑' : '↓'}` : '—';
  return `<div class="stats">
    ${stat('wave', faceText(c, u.hUnit), 'Ondas na praia')}
    ${stat('compass', `${swellText(c)} ${isNum(c.swellDir) ? dirArrow(c.swellDir, { size: 14 }) : ''}`, `Ondulação ${isNum(c.swellH) ? `${c.swellH.toFixed(1).replace('.', ',')} m` : ''}`)}
    ${stat('wind', `${windText(c, u.wUnit)} ${isNum(c.wind.dir) ? dirArrow(c.wind.dir, { size: 14 }) : ''}`, `Vento ${c.wind.rel.short}`)}
    ${stat('tide', tide, c.tide.trend > 0 ? 'Maré a encher' : 'Maré a vazar')}
  </div>`;
}

export function sportIcon(id, size = 18) {
  return icon(id, { size });
}

// ------------------------------------------------------------------ toast
let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, ms);
}

// ------------------------------------------------------------------ sheet
let openSheet = null;
export function sheet(html, { label = 'Painel', onMount } = {}) {
  closeSheet();
  const root = document.getElementById('sheet-root');
  const prevFocus = document.activeElement;
  root.innerHTML = `<div class="sheet-backdrop" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}" tabindex="-1"><div class="grab" aria-hidden="true"></div>${html}</div>`;
  const panel = root.querySelector('.sheet');
  const onKey = (e) => {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeSheet();
  });
  document.addEventListener('keydown', onKey);
  openSheet = () => {
    document.removeEventListener('keydown', onKey);
    root.innerHTML = '';
    prevFocus?.focus?.();
  };
  onMount?.(panel);
  (panel.querySelector('[autofocus]') || panel).focus();
  return closeSheet;
}
export function closeSheet() {
  if (openSheet) {
    const f = openSheet;
    openSheet = null;
    f();
  }
}

const LEVEL_HINT = {
  surf: ['Espuma e ondas pequenas, sempre com supervisão', 'Já apanhas ondas verdes e fazes a parede', 'Manobras, tubos e mar com tamanho', 'Mar grande e ondas pesadas'],
  bodyboard: ['Espuma e shorebreak pequeno', 'Ondas verdes e manobras básicas', 'Rolos, tubos e lajes', 'Lajes pesadas e mar grande'],
  kitesurf: ['A aprender a controlar a asa (com escola)', 'Andas nos dois bordos com confiança', 'Saltos e ondas', 'Vento forte e mar grande'],
  windsurf: ['Primeiros bordos com pouco vento', 'Planas e fazes jibes', 'Waterstart, ondas', 'Vento forte e ondas grandes'],
  wingfoil: ['A aprender a subir no foil', 'Voas nos dois bordos', 'Transições e ondas', 'Vento forte e downwinders'],
  sup: ['Remada em água calma', 'Algum mar e vento fraco', 'SUP surf em ondas pequenas', 'Ondas com tamanho'],
};

export function openLevelSheet(sport = state.prefs.sport) {
  const cur = levelOf(sport);
  const sp = SPORTS.find((s) => s.id === sport);
  const html = `<h2>Nível · ${sp.name}</h2><p class="lead">As notas ajustam-se ao teu nível: o tamanho ideal, os spots perigosos e o vento que aguentas.</p>
  <div class="opt-list">${LEVELS.map((l, k) => `<button type="button" class="opt" data-level="${l.id}" aria-pressed="${l.id === cur}">
    <div><b>${l.name}</b><span>${LEVEL_HINT[sport][k]}</span></div>${icon('check', { cls: 'check' })}</button>`).join('')}</div>`;
  sheet(html, {
    label: `Nível de ${sp.name}`,
    onMount(panel) {
      panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-level]');
        if (!b) return;
        setLevel(sport, +b.dataset.level);
        closeSheet();
        toast(`Nível de ${sp.name.toLowerCase()}: ${LEVELS[+b.dataset.level - 1].name.toLowerCase()}`);
      });
    },
  });
}
