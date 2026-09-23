// The scoring brain. Turns offshore forecast numbers into what a rider cares
// about at a specific spot: breaking wave face height after the spot's swell
// window/shelter, wind relative to the shoreline (terral / cruzado / maral),
// tide position, and a 0–10 score per sport and level with the reasons behind it.

import { angDist, clamp, compass, compassName, distToArc, fmtHeightRange, inArc, isNum, norm360, smoothstep } from './util.js';
import { tideLabel, tidePrefLabel } from './tide.js';

export const SPORTS = [
  { id: 'surf', name: 'Surf', verb: 'surfar', kind: 'waves' },
  { id: 'bodyboard', name: 'Bodyboard', verb: 'fazer bodyboard', kind: 'waves' },
  { id: 'kitesurf', name: 'Kitesurf', verb: 'fazer kite', kind: 'wind' },
  { id: 'windsurf', name: 'Windsurf', verb: 'fazer windsurf', kind: 'wind' },
  { id: 'wingfoil', name: 'Wing foil', verb: 'fazer wing', kind: 'wind' },
  { id: 'sup', name: 'SUP', verb: 'fazer SUP', kind: 'calm' },
];
export const SPORT = Object.fromEntries(SPORTS.map((s) => [s.id, s]));

export const LEVELS = [
  { id: 1, name: 'Iniciante', short: 'Inic.' },
  { id: 2, name: 'Intermédio', short: 'Interm.' },
  { id: 3, name: 'Avançado', short: 'Avanç.' },
  { id: 4, name: 'Expert', short: 'Expert' },
];
export const levelName = (l) => LEVELS[clamp(l, 1, 4) - 1].name;

// Face height (m) comfort bands per level: [starts being fun, ideal from, ideal to, upper limit]
const SURF_LEVEL = { 1: [0.2, 0.4, 1.0, 1.4], 2: [0.35, 0.7, 1.8, 2.5], 3: [0.5, 1.0, 3.0, 4.2], 4: [0.7, 1.4, 6.0, 12] };
const BB_LEVEL = { 1: [0.2, 0.3, 0.9, 1.3], 2: [0.3, 0.5, 1.6, 2.3], 3: [0.4, 0.8, 2.8, 3.8], 4: [0.5, 1.1, 5.0, 9] };
const SUP_LEVEL = { 1: [0.15, 0.25, 0.6, 0.9], 2: [0.2, 0.35, 1.1, 1.6], 3: [0.25, 0.45, 1.7, 2.4], 4: [0.3, 0.5, 2.4, 3.4] };
// Wind (knots) comfort bands per level.
const KITE_LEVEL = { 1: [11, 13, 18, 23], 2: [11, 14, 24, 30], 3: [11, 15, 28, 35], 4: [12, 16, 32, 42] };
const WS_LEVEL = { 1: [8, 10, 15, 19], 2: [12, 15, 24, 30], 3: [13, 16, 30, 38], 4: [14, 18, 35, 45] };
const WING_LEVEL = { 1: [10, 12, 17, 21], 2: [10, 13, 22, 27], 3: [11, 14, 25, 32], 4: [12, 15, 28, 36] };
const WIND_LEVEL = { kitesurf: KITE_LEVEL, windsurf: WS_LEVEL, wingfoil: WING_LEVEL };
// Max comfortable face height for wind sports in a wave spot, per level.
const WIND_WAVE_CAP = { 1: 1.0, 2: 1.8, 3: 2.8, 4: 4.5 };

/** Trapezoid membership: 0 far below `a`, ramps to 1 over [a,b], plateau to c, eases to 0.55 at d, 0 by 1.35·d. */
export function trap(x, [a, b, c, d]) {
  if (!(x > 0)) return 0;
  if (x < a) return clamp((x - a * 0.5) / (a * 0.5)) * 0.3;
  if (x < b) return 0.3 + (0.7 * (x - a)) / Math.max(b - a, 1e-6);
  if (x <= c) return 1;
  if (x < d) return 1 - (0.45 * (x - c)) / Math.max(d - c, 1e-6);
  return Math.max(0, 0.55 - (0.55 * (x - d)) / (d * 0.35));
}

// ------------------------------------------------------------ swell physics
/** Fraction of a swell's energy that reaches the spot, given its window. Longer periods wrap more. */
export function swellWrap(spot, dir, period) {
  if (!isNum(dir)) return 0;
  const [a, b] = spot.swell;
  const dist = distToArc(dir, a, b);
  if (dist === 0) return 1;
  const width = clamp(18 + 3.5 * ((period || 8) - 6), 16, 60);
  return Math.exp(-((dist / width) ** 2));
}

/** 0.7…1 inside the window (best at `bestSwell`), lower when the swell is wrapping in. */
export function swellAlign(spot, dir, wrap) {
  if (!isNum(dir)) return 0.5;
  const [a, b] = spot.swell;
  if (inArc(dir, a, b)) {
    const half = Math.max(15, norm360(b - a) / 2);
    const off = angDist(dir, spot.bestSwell ?? norm360(a + norm360(b - a) / 2));
    return 1 - 0.3 * clamp(off / half) ** 2;
  }
  return 0.5 + 0.2 * wrap;
}

/** Deep-water height → breaking face height multiplier (longer period = more shoaling). */
export const faceFactor = (period) => clamp(0.55 + 0.055 * (period || 6), 0.8, 1.5);

// ------------------------------------------------------------- wind logic
export const WIND_REL = [
  { max: 35, id: 'offshore', name: 'Terral', short: 'terral' },
  { max: 70, id: 'cross-off', name: 'Cruzado-terral', short: 'cruzado-terral' },
  { max: 110, id: 'cross', name: 'Cruzado', short: 'cruzado' },
  { max: 145, id: 'cross-on', name: 'Cruzado-maral', short: 'cruzado-maral' },
  { max: 181, id: 'onshore', name: 'Maral', short: 'maral' },
];
export function windRelation(spot, dir) {
  if (!isNum(dir)) return { angle: NaN, ...WIND_REL[2] };
  const angle = angDist(dir, norm360(spot.facing + 180)); // 0 = blowing from land (terral)
  return { angle, ...WIND_REL.find((r) => angle < r.max) };
}
function windShelterFactor(spot, dir) {
  let k = 1;
  for (const [a, b, f] of spot.windShelter || []) if (isNum(dir) && inArc(dir, a, b)) k = Math.min(k, f);
  return k;
}
/** Wind quality for wave riding (1 = glassy/light offshore … 0 = howling onshore). */
export function windForWaves(kn, angle) {
  if (!isNum(kn)) return 0.7;
  const on = (1 - Math.cos((angle * Math.PI) / 180)) / 2; // 0 offshore … 1 onshore
  const onPen = on ** 1.2 * smoothstep(3, 12, kn);
  const offPen = (1 - on) * smoothstep(14, 28, kn) * 0.5;
  const galePen = smoothstep(20, 35, kn) * 0.4;
  return clamp(1 - 0.9 * onPen - offPen - galePen);
}

// ---------------------------------------------------------- conditions
/**
 * Everything about one hour at one spot, in rider terms.
 * `d` is the spot's data view: arrays keyed like the forecast module (hs, sh, sd…).
 */
export function conditions(spot, d, i) {
  const comps = [];
  const add = (kind, h, dir, per) => {
    if (!isNum(h) || h <= 0.02) return;
    const wrap = swellWrap(spot, dir, per);
    const atSpot = h * (spot.shelter ?? 1) * wrap;
    comps.push({ kind, h, dir, per, wrap, atSpot, face: atSpot * faceFactor(per) });
  };
  add('swell', d.sh?.[i], d.sd?.[i], d.sp?.[i]);
  add('swell2', d.s2h?.[i], d.s2d?.[i], d.s2p?.[i]);
  add('wind', d.wh?.[i], d.wd?.[i], d.wp?.[i]);

  const faceMid = Math.sqrt(comps.reduce((s, c) => s + c.face ** 2, 0));
  const totalE = comps.reduce((s, c) => s + c.atSpot ** 2, 0);
  const swellE = comps.filter((c) => c.kind !== 'wind').reduce((s, c) => s + c.atSpot ** 2, 0);
  const dom = comps.slice().sort((a, b) => b.atSpot - a.atSpot)[0];
  const primary = comps.filter((c) => c.kind !== 'wind').sort((a, b) => b.h - a.h)[0] || dom;
  const hasWaves = comps.length > 0 || isNum(d.hs?.[i]);

  const wRaw = d.ws?.[i];
  const wDir = d.wdir?.[i];
  const shelterK = windShelterFactor(spot, wDir);
  const rel = windRelation(spot, wDir);

  return {
    i,
    hs: d.hs?.[i],
    comps,
    primary,
    face: hasWaves ? { mid: faceMid, lo: faceMid * 0.85, hi: faceMid * 1.2 } : { mid: NaN, lo: NaN, hi: NaN },
    period: dom?.per ?? NaN,
    swellDir: primary?.dir ?? NaN,
    swellH: primary?.h ?? NaN,
    swellPer: primary?.per ?? NaN,
    dirQ: dom ? swellAlign(spot, dom.dir, dom.wrap) : 0.5,
    swellFrac: totalE > 0 ? swellE / totalE : 1,
    wind: {
      kn: isNum(wRaw) ? wRaw * shelterK : NaN,
      raw: wRaw,
      gust: isNum(d.wg?.[i]) ? d.wg[i] * Math.max(shelterK, 0.75) : NaN,
      dir: wDir,
      sheltered: shelterK < 0.95,
      rel,
    },
    tide: { h: d.tide?.h[i], pos: d.tide?.pos[i], trend: d.tide?.trend[i] },
    sst: d.sst?.[i],
    air: d.ta?.[i],
    wcode: d.wc?.[i],
    cloud: d.cc?.[i],
    precip: d.pr?.[i],
    daylight: d.day ? d.day[i] : true,
  };
}

// ----------------------------------------------------------------- scoring
function tideFit(spot, pos) {
  if (!isNum(pos)) return 0.85;
  const [lo, hi] = spot.tide ?? [0, 1];
  const dist = pos < lo ? lo - pos : pos > hi ? pos - hi : 0;
  return 1 - (spot.tideSens ?? 0.3) * clamp(dist / 0.35);
}

function levelGate(level, spot, face) {
  const diff = (spot.level ?? 1) - level;
  if (diff <= 0) return 1;
  if (diff === 1) return face < (spot.size?.[1] ?? 1) ? 0.7 : 0.45;
  if (diff === 2) return 0.15;
  return 0.05;
}

const stormy = (code) => isNum(code) && code >= 95;

/** How much a spot's suitability for a sport caps its score. */
export function suitFactor(spot, sport) {
  const s = spot.sports?.[sport] ?? 0;
  if (s <= 0) return 0;
  return SPORT[sport]?.kind === 'waves' ? 0.55 + 0.45 * s : s ** 0.7;
}

function waveScore(spot, c, sport, level) {
  const face = c.face.mid;
  const prof = sport === 'bodyboard' ? BB_LEVEL[level] : SURF_LEVEL[level];
  const spotSize = sport === 'bodyboard' ? [spot.size[0] * 0.8, spot.size[1] * 0.85, spot.size[2], spot.size[3]] : spot.size;
  const spotFit = trap(face, spotSize);
  const lvlFit = trap(face, prof);
  const size = Math.min(spotFit, lvlFit);
  const P = clamp((c.period - 5) / 8) ** 0.8 || 0;
  const W = windForWaves(c.wind.kn, c.wind.rel.angle);
  const T = tideFit(spot, c.tide.pos);
  const clean = 0.4 + 0.6 * c.swellFrac;
  const gate = levelGate(level, spot, face);
  // Better riders care more about how good the wave itself can get.
  const quality = 1 - (1 - (spot.quality ?? 0.85)) * [0, 0, 0.35, 0.7, 1][level];
  const bb = sport === 'bodyboard';
  const f = {
    size,
    wind: (bb ? 0.3 : 0.25) + (bb ? 0.7 : 0.75) * W,
    period: (bb ? 0.45 : 0.55) + (bb ? 0.55 : 0.45) * P,
    dir: 0.6 + 0.4 * c.dirQ,
    tide: 0.45 + 0.55 * T,
    clean: (bb ? 0.75 : 0.7) + (bb ? 0.25 : 0.3) * clean,
  };
  const suit = suitFactor(spot, sport);
  let score = 10 * Object.values(f).reduce((a, b) => a * b, 1) * gate * quality * suit;
  if (stormy(c.wcode)) score *= 0.3;
  return { score, f, raw: { spotFit, lvlFit, P, W, T, clean, gate, face, quality, suit } };
}

function kiteDirQuality(spot, dir) {
  if (!isNum(dir)) return { q: 0, danger: false };
  const rel = angDist(dir, spot.facing); // 0 = wind from the sea (onshore), 180 = offshore
  const listed = spot.kiteDirs?.length
    ? Math.max(...spot.kiteDirs.map(([a, b]) => clamp(1 - distToArc(dir, a, b) / 35)))
    : null;
  if (spot.flat) return { q: listed ?? 0.9, danger: false, rel };
  if (rel >= 130) return { q: 0, danger: true, rel };
  let q = rel >= 112 ? 0.4 : rel >= 30 ? 1 : 0.6;
  if (listed != null) q *= 0.55 + 0.45 * listed;
  return { q, danger: false, rel };
}

function windSportScore(spot, c, sport, level) {
  const w = c.wind.kn;
  const speed = trap(w, WIND_LEVEL[sport][level]);
  const dir = kiteDirQuality(spot, c.wind.dir);
  const gustR = isNum(c.wind.gust) && w > 1 ? c.wind.gust / w : 1.3;
  const gust = 1 - 0.6 * clamp((gustR - 1.35) / 0.6);
  const cap = WIND_WAVE_CAP[level];
  const face = c.face.mid || 0;
  const waves = spot.flat ? 1 : face <= cap ? 1 : clamp(1 - (face - cap) / cap, 0.1, 1);
  const f = { speed, dir: dir.q, gust, waves };
  const suit = suitFactor(spot, sport);
  let score = 10 * speed * dir.q * gust * waves * suit;
  if (stormy(c.wcode)) score *= 0.1;
  return { score, f, raw: { w, gustR, danger: dir.danger, rel: dir.rel, cap, face, suit } };
}

function supScore(spot, c, level) {
  const w = c.wind.kn;
  const calm = isNum(w) ? 1 - smoothstep(5, 15, w) : 0.5;
  const face = c.face.mid || 0;
  // Flat-water paddling tops out at "muito bom"; small clean waves can go higher.
  let flatQ = calm * 0.85;
  let surfQ = 0;
  if (!spot.flat) {
    flatQ = calm * (1 - smoothstep(0.25, 0.8, face)) * 0.7;
    const P = clamp((c.period - 5) / 8) ** 0.8 || 0;
    surfQ = trap(face, SUP_LEVEL[level]) * windForWaves(w, c.wind.rel.angle) * (0.6 + 0.4 * P) * levelGate(level, spot, face);
  }
  const best = Math.max(flatQ, surfQ);
  const f = { calm, flat: flatQ, surf: surfQ };
  const suit = suitFactor(spot, 'sup');
  let score = 10 * best * suit;
  if (stormy(c.wcode)) score *= 0.1;
  return { score, f, raw: { w, face, mode: surfQ > flatQ ? 'ondas' : 'plano', suit } };
}

/** 0–10 score for `sport` at `level` for conditions `c` at `spot`. */
export function score(spot, c, sport, level) {
  if (!(spot.sports?.[sport] > 0)) return { score: 0, f: {}, raw: {}, unsuited: true };
  let r;
  if (sport === 'surf' || sport === 'bodyboard') r = waveScore(spot, c, sport, level);
  else if (sport === 'sup') r = supScore(spot, c, level);
  else r = windSportScore(spot, c, sport, level);
  r.score = Math.round(clamp(r.score, 0, 10) * 10) / 10;
  return r;
}

// ----------------------------------------------------------------- ratings
export const RATINGS = [
  { min: 8.5, id: 'epic', name: 'Épico' },
  { min: 7, id: 'great', name: 'Muito bom' },
  { min: 5.5, id: 'good', name: 'Bom' },
  { min: 3.5, id: 'fair', name: 'Razoável' },
  { min: 1.5, id: 'poor', name: 'Fraco' },
  { min: -1, id: 'flat', name: 'Não dá' },
];
export const rating = (s) => RATINGS.find((r) => s >= r.min);

// ----------------------------------------------------------------- reasons
/**
 * Plain-language reasons behind a score, strongest first.
 * kind: 'good' | 'ok' | 'bad' | 'warn'
 */
export function explain(spot, c, sport, level, r, units = 'm') {
  const out = [];
  const push = (kind, text, weight = 1) => out.push({ kind, text, weight });
  if (r.unsuited) {
    push('bad', `${spot.name} não é um spot de ${sportName(sport).toLowerCase()}.`, 3);
    return out;
  }
  if (stormy(c.wcode)) push('warn', 'Trovoada prevista — fica em terra.', 3);
  if (sport === 'surf' || sport === 'bodyboard') {
    const { spotFit, lvlFit, P, W, T, gate, face } = r.raw;
    const range = fmtHeightRange(c.face.lo, c.face.hi, units);
    if (!isNum(face) || face < 0.15) push('bad', 'Mar flat — praticamente sem ondas.', 3);
    else if (spotFit < 0.35 && face < spot.size[0]) push('bad', `Pouca onda (${range}) — este spot precisa de mais tamanho.`, 2.5);
    else if (face > spot.size[3]) push('bad', `Mar grande demais (${range}) — o spot deixa de aguentar.`, 2.5);
    else if (lvlFit < 0.55 && face > (sport === 'bodyboard' ? BB_LEVEL : SURF_LEVEL)[level][2]) push('warn', `Ondas de ${range}: acima do nível ${levelName(level).toLowerCase()}.`, 2.2);
    else if (Math.min(spotFit, lvlFit) > 0.85) push('good', `Tamanho certo: ${range}.`, 1.6);
    else push('ok', `Ondas de ${range}.`, 0.8);

    if (isNum(c.period)) {
      if (P >= 0.8) push('good', `Período longo (${Math.round(c.period)} s) — ondas com força e bem organizadas.`, 1.2);
      else if (P < 0.4) push('bad', `Período curto (${Math.round(c.period)} s) — ondas fracas e desorganizadas.`, 1.4);
    }
    if (isNum(c.swellDir)) {
      const name = compassName(c.swellDir).toLowerCase();
      if (c.dirQ >= 0.85) push('good', `Ondulação de ${name} (${compass(c.swellDir)}) bem apontada ao spot.`, 1);
      else if (c.dirQ < 0.65) push('bad', `Ondulação de ${name} (${compass(c.swellDir)}) entra mal aqui — chega pouca energia.`, 1.3);
    }
    windReason(c, W, push);
    if (T < 0.65) push('bad', `Maré desfavorável — ${tidePrefLabel(spot.tide, spot.tideSens).toLowerCase()} é o ideal.`, 1.1);
    else if (T >= 0.95 && (spot.tideSens ?? 0) > 0.3) push('good', `${tideLabel(c.tide.pos, c.tide.trend)} — boa altura da maré.`, 0.7);
    if (c.swellFrac < 0.5) push('bad', 'Mar de vaga (vento) domina — ondas curtas e picadas.', 1);
    if (gate < 1) push('warn', `Spot para nível ${levelName(spot.level).toLowerCase()} ou acima.`, 2);
  } else if (sport === 'sup') {
    const { w, face, mode } = r.raw;
    if (isNum(w)) {
      if (w < 6) push('good', `Vento fraco (${Math.round(w)} nós) — água calma para remar.`, 1.5);
      else if (w > 12) push('bad', `Vento de ${Math.round(w)} nós — muito difícil em cima da prancha.`, 2);
    }
    if (!spot.flat) {
      if (mode === 'ondas') push('good', `Ondas pequenas (${fmtHeightRange(c.face.lo, c.face.hi, units)}) boas para SUP surf.`, 1);
      else if (face > 1) push('bad', `Mar com ${fmtHeightRange(c.face.lo, c.face.hi, units)} — pouco indicado para SUP.`, 1.2);
    } else push('ok', 'Plano de água abrigado.', 0.6);
  } else {
    const { w, gustR, danger, cap, face } = r.raw;
    const band = WIND_LEVEL[sport][level];
    if (!isNum(w)) push('bad', 'Sem dados de vento.', 2);
    else if (w < band[0]) push('bad', `Vento fraco (${Math.round(w)} nós) — precisa de ${band[0]}+ nós.`, 2.5);
    else if (w > band[3]) push('warn', `Vento muito forte (${Math.round(w)} nós) para nível ${levelName(level).toLowerCase()}.`, 2.4);
    else if (w >= band[1] && w <= band[2]) push('good', `Vento de ${Math.round(w)} nós — na medida certa.`, 1.8);
    else push('ok', `Vento de ${Math.round(w)} nós.`, 1);
    if (danger) push('warn', `Vento terral (${compass(c.wind.dir)}) — perigoso, arrasta para o largo.`, 3);
    else if (r.f.dir >= 0.9) push('good', `Direção ${compass(c.wind.dir)} ${spot.flat ? 'boa para este plano de água' : 'lateral à praia — ideal'}.`, 1);
    else if (r.f.dir < 0.5) push('bad', `Direção ${compass(c.wind.dir)} pouco favorável neste spot.`, 1.4);
    if (gustR > 1.6) push('bad', `Rajadas fortes (até ${Math.round(c.wind.gust)} nós) — vento irregular.`, 1.3);
    if (!spot.flat && face > cap) push('warn', `Mar grande (${fmtHeightRange(c.face.lo, c.face.hi, units)}) para o teu nível.`, 1.5);
  }
  return out.sort((a, b) => b.weight - a.weight);
}

function windReason(c, W, push) {
  const { kn } = c.wind;
  if (!isNum(kn)) return;
  const k = Math.round(kn);
  const rel = c.wind.rel;
  if (kn < 4) push('good', `Sem vento (${k} nós) — mar espelhado.`, 1.4);
  else if (rel.id === 'offshore' || rel.id === 'cross-off') {
    if (kn < 16) push('good', `Vento ${rel.short} de ${k} nós — mar limpo.`, 1.5);
    else push('ok', `Terral forte (${k} nós) — ondas limpas mas difíceis de apanhar.`, 1.2);
  } else if (W < 0.45) push('bad', `Vento ${rel.short} de ${k} nós — mar desarrumado.`, 1.8);
  else if (W < 0.75) push('ok', `Vento ${rel.short} de ${k} nós — alguma textura.`, 1);
  else push('good', `Vento ${rel.short} fraco (${k} nós).`, 0.9);
  if (c.wind.sheltered && kn >= 4) push('ok', 'Abrigado deste vento pela costa.', 0.5);
}

export const sportName = (id) => SPORT[id]?.name ?? id;
