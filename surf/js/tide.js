// Tide analysis on the hourly sea-level series (Open-Meteo `sea_level_height_msl`):
// finds high/low waters (parabolic refinement between samples), expresses every
// hour as a 0…1 position between the surrounding low and high water, and the
// trend (rising/falling). Heights are re-referenced to an approximate chart datum
// so they read like a Portuguese tide table.

import { isNum } from './util.js';

// Approximate height of mean sea level above chart datum (Zero Hidrográfico).
const DATUM = { continente: 2.0, madeira: 1.4, acores: 1.0 };

export function analyseTide(series, t0, region = 'continente') {
  const n = series.length;
  const vals = series.map((v) => (isNum(v) ? v : NaN));
  const good = vals.filter((v) => !Number.isNaN(v));
  if (good.length < 12) return null;
  const mean = good.reduce((a, b) => a + b, 0) / good.length;
  const datum = DATUM[region] ?? 2.0;
  const h = vals.map((v) => (Number.isNaN(v) ? NaN : v - mean + datum));

  // Extremes with parabolic interpolation.
  const ext = [];
  for (let i = 1; i < n - 1; i++) {
    const a = h[i - 1];
    const b = h[i];
    const c = h[i + 1];
    if ([a, b, c].some(Number.isNaN)) continue;
    const isHigh = b >= a && b > c;
    const isLow = b <= a && b < c;
    if (!isHigh && !isLow) continue;
    const den = a - 2 * b + c;
    const off = den === 0 ? 0 : (0.5 * (a - c)) / den;
    const height = b - 0.25 * (a - c) * off;
    const e = { t: t0 + (i + off) * 3600, h: height, type: isHigh ? 'high' : 'low' };
    // Guard against double-detections on flat tops (keep the more extreme).
    const last = ext[ext.length - 1];
    if (last && last.type === e.type) {
      if ((e.type === 'high' && e.h > last.h) || (e.type === 'low' && e.h < last.h)) ext[ext.length - 1] = e;
      continue;
    }
    ext.push(e);
  }

  // Position between surrounding extremes → 0 (low) … 1 (high), plus trend.
  const pos = new Array(n).fill(NaN);
  const trend = new Array(n).fill(0);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * 3600;
    while (k < ext.length && ext[k].t <= t) k++;
    let prev = ext[k - 1];
    let next = ext[k];
    if (Number.isNaN(h[i]) || ext.length < 2) continue;
    // Edges of the series: borrow the nearest pair of extremes for the range.
    if (!prev) prev = ext[1];
    if (!next) next = ext[ext.length - 2];
    const lo = prev.type === 'low' ? prev.h : next.h;
    const hi = prev.type === 'high' ? prev.h : next.h;
    pos[i] = hi - lo > 0.05 ? Math.min(1, Math.max(0, (h[i] - lo) / (hi - lo))) : 0.5;
    const up = k < ext.length ? ext[k].type === 'high' : ext[ext.length - 1].type === 'low';
    trend[i] = up ? 1 : -1;
  }
  return { h, pos, trend, extremes: ext };
}

/** Human label for a normalised tide position + trend. */
export function tideLabel(pos, trend) {
  if (!isNum(pos)) return '—';
  if (pos >= 0.85) return 'Preia-mar';
  if (pos <= 0.15) return 'Baixa-mar';
  const stage = pos < 0.4 ? 'baixa' : pos > 0.6 ? 'alta' : 'meia';
  const dir = trend > 0 ? 'a encher' : 'a vazar';
  return stage === 'meia' ? `Meia-maré, ${dir}` : `Maré ${stage}, ${dir}`;
}

/** Describe a preferred tide window [lo, hi] in words. */
export function tidePrefLabel([lo, hi], sens = 0.5) {
  if (sens < 0.15 || (lo <= 0.05 && hi >= 0.95)) return 'Qualquer maré';
  if (hi - lo >= 0.6) return 'Quase todas as marés';
  const name = (v) => (v <= 0.25 ? 'vazia' : v >= 0.75 ? 'cheia' : 'meia');
  const a = name(lo);
  const b = name(hi);
  const LBL = { vazia: 'Maré vazia', meia: 'Meia-maré', cheia: 'Maré cheia' };
  if (a === b) return LBL[a];
  if (a === 'vazia' && b === 'meia') return 'Vazia a meia-maré';
  if (a === 'meia' && b === 'cheia') return 'Meia-maré a cheia';
  return 'Vazia a cheia';
}
