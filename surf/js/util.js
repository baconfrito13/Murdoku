// Small shared helpers: math, angles, compass names, formatting (pt-PT), time zones.

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const round = (v, d = 0) => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------- angles
export const norm360 = (a) => ((a % 360) + 360) % 360;
/** Smallest absolute difference between two bearings (0..180). */
export const angDist = (a, b) => {
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
};
/** Is bearing `a` inside the clockwise arc from `from` to `to`? */
export const inArc = (a, from, to) => {
  const span = norm360(to - from);
  return norm360(a - from) <= span;
};
export const arcSpan = (from, to) => norm360(to - from);
/** Angular distance from `a` to the arc [from→to] (0 when inside). */
export const distToArc = (a, from, to) => (inArc(a, from, to) ? 0 : Math.min(angDist(a, from), angDist(a, to)));

const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const COMPASS_8_NAMES = ['Norte', 'Nordeste', 'Leste', 'Sudeste', 'Sul', 'Sudoeste', 'Oeste', 'Noroeste'];
const COMPASS_16_NAMES = ['Norte', 'Nor-nordeste', 'Nordeste', 'Lés-nordeste', 'Leste', 'Lés-sudeste', 'Sudeste', 'Su-sudeste',
  'Sul', 'Su-sudoeste', 'Sudoeste', 'Oés-sudoeste', 'Oeste', 'Oés-noroeste', 'Noroeste', 'Nor-noroeste'];
/** IPMA-style 16-point abbreviation (N, NNE … NW, NNW). */
export const compass = (deg) => (isNum(deg) ? COMPASS_16[Math.round(norm360(deg) / 22.5) % 16] : '—');
export const compass8 = (deg) => (isNum(deg) ? COMPASS_16[(Math.round(norm360(deg) / 45) % 8) * 2] : '—');
export const compassName = (deg) => (isNum(deg) ? COMPASS_8_NAMES[Math.round(norm360(deg) / 45) % 8] : '—');
export const compassName16 = (deg) => (isNum(deg) ? COMPASS_16_NAMES[Math.round(norm360(deg) / 22.5) % 16] : '—');

// --------------------------------------------------------------- geodesy
const R_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
export function distanceKm(aLat, aLon, bLat, bLon) {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}
/** Point `km` away from (lat, lon) along compass `bearing`. */
export function offsetPoint(lat, lon, bearing, km) {
  const d = km / R_KM;
  const b = rad(bearing);
  const p1 = rad(lat);
  const l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [(p2 * 180) / Math.PI, (l2 * 180) / Math.PI];
}
/** Rough door-to-door driving estimate from straight-line distance. */
export const driveMinutes = (km) => Math.round((km * 1.3) / 70 * 60 + 8);

// ------------------------------------------------------------ formatting
const nf = new Map();
function numFmt(d) {
  if (!nf.has(d)) nf.set(d, new Intl.NumberFormat('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nf.get(d);
}
export const fmtNum = (v, d = 0) => (isNum(v) ? numFmt(d).format(v) : '—');

export const UNITS = {
  height: { m: { label: 'm', k: 1, d: 1 }, ft: { label: 'ft', k: 3.28084, d: 0 } },
  wind: {
    kn: { label: 'nós', short: 'kn', k: 1, d: 0 },
    kmh: { label: 'km/h', short: 'km/h', k: 1.852, d: 0 },
    ms: { label: 'm/s', short: 'm/s', k: 0.514444, d: 0 },
  },
};

export function fmtHeight(m, units = 'm', withUnit = true) {
  const u = UNITS.height[units] || UNITS.height.m;
  if (!isNum(m)) return '—';
  const v = m * u.k;
  const d = units === 'm' ? (v < 10 ? 1 : 0) : 0;
  return `${fmtNum(v, d)}${withUnit ? ` ${u.label}` : ''}`;
}
export function fmtHeightRange(lo, hi, units = 'm') {
  const u = UNITS.height[units] || UNITS.height.m;
  if (!isNum(lo) || !isNum(hi)) return '—';
  const a = lo * u.k;
  const b = hi * u.k;
  const d = units === 'm' ? (b < 10 ? 1 : 0) : 0;
  if (b < (units === 'm' ? 0.15 : 0.5)) return `flat`;
  return `${fmtNum(a, d)}–${fmtNum(b, d)} ${u.label}`;
}
export function fmtWind(kn, units = 'kn', withUnit = true) {
  const u = UNITS.wind[units] || UNITS.wind.kn;
  if (!isNum(kn)) return '—';
  return `${fmtNum(kn * u.k, 0)}${withUnit ? ` ${u.short}` : ''}`;
}
export const fmtPeriod = (s) => (isNum(s) ? `${fmtNum(s, 0)} s` : '—');
export const fmtTemp = (c) => (isNum(c) ? `${fmtNum(c, 0)}°` : '—');
export const fmtDeg = (d) => (isNum(d) ? `${Math.round(norm360(d))}°` : '—');

// ------------------------------------------------------------- time zones
// All forecast timestamps are UTC epoch seconds; display happens in a spot's
// own zone (Lisboa / Madeira / Açores) through Intl.
const dtf = new Map();
function partsFmt(tz) {
  if (!dtf.has(tz)) {
    dtf.set(tz, new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }));
  }
  return dtf.get(tz);
}
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
/** Wall-clock parts of an epoch-seconds instant in zone `tz`. */
export function zoned(sec, tz = 'Europe/Lisbon') {
  const o = {};
  for (const p of partsFmt(tz).formatToParts(new Date(sec * 1000))) o[p.type] = p.value;
  return {
    y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, wd: WD[o.weekday] ?? 0,
    key: `${o.year}-${o.month}-${o.day}`,
  };
}
/** Offset (seconds) of zone `tz` from UTC at instant `sec`. */
export function tzOffset(sec, tz) {
  const z = zoned(sec, tz);
  const asUtc = Date.UTC(z.y, z.mo - 1, z.d, z.h, z.mi) / 1000;
  return asUtc - Math.floor(sec / 60) * 60;
}
/** Epoch seconds of local midnight (in `tz`) of the day containing `sec`. */
export function localMidnight(sec, tz) {
  const z = zoned(sec, tz);
  const guess = Date.UTC(z.y, z.mo - 1, z.d) / 1000;
  return guess - tzOffset(guess + 12 * 3600, tz);
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const weekday = (wd, short = false) => (short ? WEEKDAYS_SHORT : WEEKDAYS)[wd];
export const monthShort = (mo) => MONTHS_SHORT[mo - 1];
export const pad2 = (n) => String(n).padStart(2, '0');
export const fmtHour = (sec, tz) => {
  const z = zoned(sec, tz);
  return `${pad2(z.h)}:${pad2(z.mi)}`;
};
export const fmtHourShort = (sec, tz) => `${pad2(zoned(sec, tz).h)}h`;
export function fmtDay(sec, tz, nowSec) {
  const z = zoned(sec, tz);
  if (nowSec != null) {
    const n = zoned(nowSec, tz);
    const diff = Math.round((Date.UTC(z.y, z.mo - 1, z.d) - Date.UTC(n.y, n.mo - 1, n.d)) / 864e5);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    if (diff === -1) return 'Ontem';
  }
  return `${weekday(z.wd)}, ${z.d} ${monthShort(z.mo)}`;
}
export function fmtDayShort(sec, tz) {
  const z = zoned(sec, tz);
  return `${weekday(z.wd, true)} ${z.d}`;
}
export function fmtDateTime(sec, tz, nowSec) {
  return `${fmtDay(sec, tz, nowSec)} · ${fmtHour(sec, tz)}`;
}
export function fmtAgo(ms, nowMs = Date.now()) {
  const m = Math.round((nowMs - ms) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

// ----------------------------------------------------------------- misc
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const slugOk = (s) => /^[a-z0-9-]+$/.test(s);

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/** localStorage wrapper that never throws (private mode, sandboxed frames…). */
export const store = {
  get(key, fallback = null) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  del(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch { /* ignore */ }
  },
};
