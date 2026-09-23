// App state, derived data (conditions and scores per spot/hour, time windows,
// rankings) and the actions every screen uses. No DOM here.

import { REGIONS, SPOTS } from './spots.js';
import { hourIndex, loadForecast, spotView } from './forecast.js';
import { conditions, score as scoreOf, SPORT, SPORTS } from './model.js';
import { clamp, distanceKm, driveMinutes, localMidnight, norm360, store } from './util.js';
import { peakIn } from './insights.js';

// ------------------------------------------------------------------ spots
function enrich(s) {
  const derivedQuality = s.famous ? 1
    : ['reef', 'point', 'slab'].includes(s.type) ? 0.95
      : s.level === 1 && (s.shelter ?? 1) < 0.7 ? 0.75 : 0.85;
  return {
    ...s,
    quality: s.quality ?? derivedQuality,
    offshore: norm360(s.facing + 180),
    view: s.region === 'madeira' ? 'madeira' : s.region === 'acores' ? 'acores' : 'continente',
    tz: s.tz || 'Europe/Lisbon',
    kiteDirs: s.kiteDirs || [],
    windShelter: s.windShelter || [],
  };
}
export const spots = SPOTS.map(enrich);
export const spotById = new Map(spots.map((s) => [s.id, s]));
export const regions = REGIONS;
export const regionName = (id) => REGIONS.find((r) => r.id === id)?.name ?? id;
export const MAINLAND = ['norte', 'centro', 'lisboa', 'alentejo', 'algarve'];

export const REGION_FILTERS = [
  { id: 'continente', name: 'Continente' },
  ...REGIONS.map((r) => ({ id: r.id, name: r.name })),
];
export function inRegion(spot, filter) {
  if (!filter || filter === 'todos') return true;
  if (filter === 'continente') return MAINLAND.includes(spot.region);
  return spot.region === filter;
}

export const HOMES = [
  { id: 'viana', name: 'Viana do Castelo', lat: 41.694, lon: -8.832 },
  { id: 'braga', name: 'Braga', lat: 41.545, lon: -8.426 },
  { id: 'porto', name: 'Porto', lat: 41.150, lon: -8.611 },
  { id: 'aveiro', name: 'Aveiro', lat: 40.641, lon: -8.654 },
  { id: 'coimbra', name: 'Coimbra', lat: 40.211, lon: -8.429 },
  { id: 'leiria', name: 'Leiria', lat: 39.744, lon: -8.807 },
  { id: 'santarem', name: 'Santarém', lat: 39.236, lon: -8.686 },
  { id: 'lisboa', name: 'Lisboa', lat: 38.722, lon: -9.139 },
  { id: 'setubal', name: 'Setúbal', lat: 38.524, lon: -8.889 },
  { id: 'evora', name: 'Évora', lat: 38.571, lon: -7.909 },
  { id: 'beja', name: 'Beja', lat: 38.015, lon: -7.863 },
  { id: 'lagos', name: 'Lagos', lat: 37.102, lon: -8.674 },
  { id: 'faro', name: 'Faro', lat: 37.019, lon: -7.930 },
  { id: 'funchal', name: 'Funchal', lat: 32.650, lon: -16.908 },
  { id: 'pdelgada', name: 'Ponta Delgada', lat: 37.741, lon: -25.668 },
];
const homeView = (h) => (h.lon < -20 ? 'acores' : h.lon < -15 ? 'madeira' : 'continente');

// ------------------------------------------------------------------ prefs
const PREFS_KEY = 'maresia.prefs.v1';
const DEFAULT_PREFS = {
  sport: 'surf',
  levels: { surf: 2, bodyboard: 2, kitesurf: 2, windsurf: 2, wingfoil: 2, sup: 1 },
  weight: 75,
  hUnit: 'm',
  wUnit: 'kn',
  home: null,
  maxDrive: 0,
  region: 'continente',
  theme: 'auto',
  favs: ['supertubos', 'ribeira-dilhas', 'carcavelos', 'guincho'],
  layers: { swell: true, wind: true },
  seenIntro: false,
};
function loadPrefs() {
  const saved = store.get(PREFS_KEY, {}) || {};
  return {
    ...DEFAULT_PREFS,
    ...saved,
    levels: { ...DEFAULT_PREFS.levels, ...(saved.levels || {}) },
    layers: { ...DEFAULT_PREFS.layers, ...(saved.layers || {}) },
    favs: Array.isArray(saved.favs) ? saved.favs : DEFAULT_PREFS.favs,
  };
}

// ------------------------------------------------------------------ state
export const state = {
  prefs: loadPrefs(),
  fc: null,
  source: null,
  error: null,
  loading: true,
  nowIdx: 0,
  stale: false,
  day: 0,
  part: 'agora',
  cursor: null,
  navCount: 0,
};
export const savePrefs = () => store.set(PREFS_KEY, state.prefs);

const listeners = new Set();
export function on(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emit(what, detail) {
  for (const fn of [...listeners]) fn(what, detail);
}

// -------------------------------------------------------------- data cache
let views = new Map();
let conds = new Map();
const scoreCache = new Map();

export function view(id) {
  if (!views.has(id)) views.set(id, spotView(state.fc, spotById.get(id)));
  return views.get(id);
}
export function condsOf(id) {
  if (!conds.has(id)) {
    const s = spotById.get(id);
    const v = view(id);
    const arr = new Array(state.fc.n);
    for (let i = 0; i < state.fc.n; i++) arr[i] = conditions(s, v, i);
    conds.set(id, arr);
  }
  return conds.get(id);
}
export const cond = (id, i) => condsOf(id)[clamp(i, 0, state.fc.n - 1)];
export const levelOf = (sport = state.prefs.sport) => state.prefs.levels[sport] ?? 2;

/** Hourly scores (Float32Array) of spot `id` for `sport` at `level`. */
export function scores(id, sport = state.prefs.sport, level = levelOf(sport)) {
  const key = `${sport}|${level}|${id}`;
  if (!scoreCache.has(key)) {
    const s = spotById.get(id);
    const cs = condsOf(id);
    const out = new Float32Array(state.fc.n);
    if (view(id).ok) for (let i = 0; i < cs.length; i++) out[i] = scoreOf(s, cs[i], sport, level).score;
    scoreCache.set(key, out);
  }
  return scoreCache.get(key);
}
export function evalAt(id, i, sport = state.prefs.sport, level = levelOf(sport)) {
  return scoreOf(spotById.get(id), cond(id, i), sport, level);
}

// ------------------------------------------------------------------ time
export const timeOf = (i) => state.fc.t0 + i * 3600;
export const nowSec = () => Date.now() / 1000;

export function updateNow() {
  if (!state.fc) return;
  const i = hourIndex(state.fc, nowSec());
  state.stale = i >= state.fc.n || i < -24;
  state.nowIdx = state.stale ? firstDaylightIdx() : clamp(i, 0, state.fc.n - 1);
}
function firstDaylightIdx() {
  const v = view(spots[0].id);
  const k = v.day.findIndex(Boolean);
  return k < 0 ? 0 : k;
}

/** Hour-index range [from, to) for `day` (0 = today) and part of day, in zone `tz`. */
export function windowRange(day, part, tz = 'Europe/Lisbon') {
  const fc = state.fc;
  if (part === 'agora' && day === 0) return [state.nowIdx, Math.min(fc.n, state.nowIdx + 3)];
  const base = localMidnight(timeOf(state.nowIdx), tz);
  const start = localMidnight(base + day * 86400 + 12 * 3600, tz);
  const i0 = hourIndex(fc, start);
  const mid = hourIndex(fc, start + 12 * 3600);
  const end = hourIndex(fc, localMidnight(start + 36 * 3600, tz));
  let [from, to] = part === 'manha' ? [i0, mid] : part === 'tarde' ? [mid, end] : [i0, end];
  if (day === 0) from = Math.max(from, state.nowIdx);
  return [clamp(from, 0, fc.n), clamp(to, 0, fc.n)];
}
export function dayCount() {
  if (!state.fc) return 0;
  const last = timeOf(state.fc.n - 1);
  const base = localMidnight(timeOf(state.nowIdx), 'Europe/Lisbon');
  return clamp(Math.floor((last - base) / 86400) + 1, 1, 7);
}
export const dayStart = (day, tz = 'Europe/Lisbon') => localMidnight(localMidnight(timeOf(state.nowIdx), tz) + day * 86400 + 12 * 3600, tz);

// ------------------------------------------------------------------ distance
export function driveFrom(spot) {
  const h = state.prefs.home;
  if (!h) return null;
  if (homeView(h) !== spot.view) return null;
  const km = distanceKm(h.lat, h.lon, spot.lat, spot.lon);
  return { km, min: driveMinutes(km) };
}
export function fmtDrive(d) {
  if (!d) return '';
  if (d.min < 60) return `${d.min} min`;
  const h = Math.floor(d.min / 60);
  const m = Math.round((d.min % 60) / 5) * 5;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// ------------------------------------------------------------------ ranking
/** Spots ranked by peak daylight score inside the selected window. */
export function ranking({ day = state.day, part = state.part, sport = state.prefs.sport, region = state.prefs.region, maxDrive = state.prefs.maxDrive } = {}) {
  const level = levelOf(sport);
  const rows = [];
  for (const s of spots) {
    if (!inRegion(s, region)) continue;
    if (!(s.sports[sport] > 0)) continue;
    const v = view(s.id);
    if (!v.ok) continue;
    const drive = driveFrom(s);
    if (maxDrive && state.prefs.home && (!drive || drive.min > maxDrive)) continue;
    const [from, to] = windowRange(day, part, s.tz);
    const pk = peakIn(scores(s.id, sport, level), v.day, from, to);
    if (pk.idx < 0) continue;
    rows.push({ spot: s, score: pk.score, idx: pk.idx, drive });
  }
  rows.sort((a, b) => b.score - a.score || (a.drive?.min ?? 0) - (b.drive?.min ?? 0));
  return rows;
}

// ------------------------------------------------------------------ actions
export function setSport(id) {
  if (!SPORT[id] || state.prefs.sport === id) return;
  state.prefs.sport = id;
  savePrefs();
  emit('sport');
}
export function setLevel(sport, level) {
  state.prefs.levels[sport] = clamp(level, 1, 4);
  savePrefs();
  emit('level');
}
export function setPref(key, value) {
  state.prefs[key] = value;
  savePrefs();
  emit('prefs', key);
}
export function setWhen(day, part) {
  state.day = day;
  state.part = part;
  emit('when');
}
export function setCursor(i, source) {
  if (!state.fc) return;
  const c = clamp(Math.round(i), 0, state.fc.n - 1);
  if (c === state.cursor) return;
  state.cursor = c;
  emit('cursor', source);
}
export const isFav = (id) => state.prefs.favs.includes(id);
export function toggleFav(id) {
  const f = state.prefs.favs;
  state.prefs.favs = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
  savePrefs();
  emit('favs', id);
}

export function go(name, param) {
  const hash = name === 'spot' ? `#spot-${param}` : `#${name}`;
  if (location.hash !== hash) location.hash = hash;
}

// ------------------------------------------------------------------ loading
export async function load(force = false) {
  state.loading = true;
  emit('loading');
  try {
    const { fc, source, error } = await loadForecast(spots, { force });
    // Keep the chosen moment (not the index) across refreshes: t0 moves daily.
    const prevT = state.fc && state.cursor != null ? state.fc.t0 + state.cursor * 3600 : null;
    views = new Map();
    conds = new Map();
    scoreCache.clear();
    state.fc = fc;
    state.source = source;
    state.error = error || null;
    state.loading = false;
    updateNow();
    const kept = prevT == null ? -1 : Math.round((prevT - fc.t0) / 3600);
    state.cursor = kept >= state.nowIdx && kept < fc.n ? kept : state.nowIdx;
    emit('data');
  } catch (err) {
    state.loading = false;
    state.error = String(err?.message || err);
    emit('error');
  }
}

export { SPORTS, SPORT };
