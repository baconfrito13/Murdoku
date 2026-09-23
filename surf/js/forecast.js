// Forecast data: one Open-Meteo Marine call + one Weather call for every spot
// (multi-location requests), cached locally, with a bundled snapshot as the
// last-resort fallback so the app always has real numbers to show.

import { offsetPoint, round, store } from './util.js';
import { analyseTide } from './tide.js';
import { sunEvents } from './sun.js';

export const MARINE = [
  ['hs', 'wave_height', 2], ['sh', 'swell_wave_height', 2], ['sd', 'swell_wave_direction', 0], ['sp', 'swell_wave_period', 1],
  ['s2h', 'secondary_swell_wave_height', 2], ['s2d', 'secondary_swell_wave_direction', 0], ['s2p', 'secondary_swell_wave_period', 1],
  ['wh', 'wind_wave_height', 2], ['wd', 'wind_wave_direction', 0], ['wp', 'wind_wave_period', 1],
  ['sst', 'sea_surface_temperature', 1], ['sl', 'sea_level_height_msl', 2],
];
export const WEATHER = [
  ['ws', 'wind_speed_10m', 1], ['wdir', 'wind_direction_10m', 0], ['wg', 'wind_gusts_10m', 1],
  ['ta', 'temperature_2m', 1], ['wc', 'weather_code', 0], ['cc', 'cloud_cover', 0], ['pr', 'precipitation', 1],
];

const CACHE_KEY = 'maresia.forecast.v2';
const MAX_AGE_MS = 60 * 60 * 1000; // re-fetch after an hour
const DAYS = 7;

/** Marine sample point: ~3 km out to sea in front of the break (flat-water spots use the spot itself). */
export function marinePoint(spot) {
  if (spot.flat) return [spot.lat, spot.lon];
  return offsetPoint(spot.lat, spot.lon, spot.facing, 3);
}

function uniquePoints(spots, pick) {
  const pts = [];
  const index = new Map();
  const map = {};
  for (const s of spots) {
    const [lat, lon] = pick(s);
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (!index.has(key)) {
      index.set(key, pts.length);
      pts.push([+lat.toFixed(4), +lon.toFixed(4)]);
    }
    map[s.id] = index.get(key);
  }
  return { pts, map };
}

function buildUrl(base, pts, vars, extra) {
  const lat = pts.map((p) => p[0]).join(',');
  const lon = pts.map((p) => p[1]).join(',');
  return `${base}?latitude=${lat}&longitude=${lon}&hourly=${vars.map((v) => v[1]).join(',')}` +
    `&timezone=GMT&timeformat=unixtime&forecast_days=${DAYS}&cell_selection=sea${extra}`;
}

async function getJson(url, timeoutMs = 20000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function compactSeries(loc, vars) {
  const out = {};
  for (const [key, name, digits] of vars) {
    const arr = loc.hourly?.[name] || [];
    out[key] = arr.map((v) => (v == null ? null : round(v, digits)));
  }
  return out;
}

/** Fetches live data for `spots`. Returns the compact, serialisable forecast. */
export async function fetchLive(spots) {
  const marine = uniquePoints(spots, marinePoint);
  const weather = uniquePoints(spots, (s) => [s.lat, s.lon]);
  const [m, w] = await Promise.all([
    getJson(buildUrl('https://marine-api.open-meteo.com/v1/marine', marine.pts, MARINE, '')),
    getJson(buildUrl('https://api.open-meteo.com/v1/forecast', weather.pts, WEATHER, '&wind_speed_unit=kn')),
  ]);
  const ml = Array.isArray(m) ? m : [m];
  const wl = Array.isArray(w) ? w : [w];
  const t0 = ml[0]?.hourly?.time?.[0] ?? wl[0]?.hourly?.time?.[0];
  const n = ml[0]?.hourly?.time?.length ?? 0;
  if (!t0 || !n) throw new Error('Resposta sem dados');
  // Align weather to the marine time axis (both are hourly UTC; guard anyway).
  const wt0 = wl[0]?.hourly?.time?.[0];
  const shift = Math.round((t0 - wt0) / 3600);
  const weatherSeries = wl.map((loc) => {
    const s = compactSeries(loc, WEATHER);
    if (shift) for (const k of Object.keys(s)) s[k] = s[k].slice(shift > 0 ? shift : 0);
    return s;
  });
  return {
    v: 2,
    fetchedAt: Date.now(),
    t0,
    n,
    marine: ml.map((loc) => compactSeries(loc, MARINE)),
    weather: weatherSeries,
    map: Object.fromEntries(spots.map((s) => [s.id, [marine.map[s.id], weather.map[s.id]]])),
  };
}

function usable(fc, spots) {
  return fc && fc.v === 2 && fc.t0 && fc.n && fc.map && spots.every((s) => fc.map[s.id]);
}

async function loadSnapshot() {
  if (globalThis.__MARESIA_SNAPSHOT__) return globalThis.__MARESIA_SNAPSHOT__;
  try {
    const base = new URL('data/snapshot.json', globalThis.location?.href ?? 'http://localhost/');
    return await getJson(base.href, 8000);
  } catch {
    return null;
  }
}

/**
 * Best available forecast: fresh cache → live → stale cache → bundled snapshot.
 * Resolves `{ fc, source, error }` where source ∈ live | cache | snapshot.
 */
export async function loadForecast(spots, { force = false } = {}) {
  const cached = store.get(CACHE_KEY);
  const cacheOk = usable(cached, spots);
  if (!force && cacheOk && Date.now() - cached.fetchedAt < MAX_AGE_MS) return { fc: cached, source: 'cache' };
  try {
    const live = await fetchLive(spots);
    store.set(CACHE_KEY, live);
    return { fc: live, source: 'live' };
  } catch (err) {
    const msg = String(err?.message || err);
    const error = err?.name === 'AbortError' ? 'Tempo esgotado'
      : /fetch|network|load failed|blocked/i.test(msg) ? 'Sem ligação à previsão ao vivo' : msg;
    if (cacheOk) return { fc: cached, source: 'cache', error };
    const snap = await loadSnapshot();
    if (snap && snap.v === 2) return { fc: snap, source: 'snapshot', error };
    throw new Error(error);
  }
}

// ------------------------------------------------------------- spot views
const REGION_VIEW = { madeira: 'madeira', acores: 'acores' };

/**
 * Per-spot data view (arrays shared with the compact forecast) + derived tide
 * and daylight mask. Missing spots get empty arrays (rendered as "sem dados").
 */
export function spotView(fc, spot) {
  const [mi, wi] = fc.map[spot.id] ?? [-1, -1];
  const m = fc.marine[mi] || {};
  const w = fc.weather[wi] || {};
  const d = { ...m, ...w };
  d.tide = m.sl ? analyseTide(m.sl, fc.t0, REGION_VIEW[spot.region] || 'continente') : null;
  d.sun = sunDays(fc, spot);
  d.day = daylightMask(fc, d.sun);
  d.ok = !!(m.sh || m.hs) && !!w.ws;
  return d;
}

/** Sun events per local day covering the forecast. */
function sunDays(fc, spot) {
  const days = [];
  const start = fc.t0 - 86400;
  for (let k = 0; k <= Math.ceil(fc.n / 24) + 1; k++) {
    // Solar noon in Portugal is ~13:30 UTC+… — sample the UTC day at 13:00.
    const noon = Math.floor(start / 86400) * 86400 + k * 86400 + 13 * 3600;
    days.push(sunEvents(noon, spot.lat, spot.lon));
  }
  return days;
}

function daylightMask(fc, days) {
  const mask = new Array(fc.n).fill(false);
  for (let i = 0; i < fc.n; i++) {
    const t = fc.t0 + i * 3600 + 1800; // middle of the hour
    mask[i] = days.some((d) => t >= d.dawn && t <= d.dusk);
  }
  return mask;
}

/** Sun events of the day containing instant `t` (or null). */
export function sunFor(view, t) {
  return view.sun.find((d) => t >= d.dawn - 6 * 3600 && t <= d.dusk + 6 * 3600) || null;
}

export const hourIndex = (fc, sec) => Math.floor((sec - fc.t0) / 3600);
export const hourTime = (fc, i) => fc.t0 + i * 3600;
