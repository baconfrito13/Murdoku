// Higher-level reading of the numbers: best time windows, a national sea
// synopsis in plain Portuguese, gear advice (wetsuit, board, kite/sail/wing
// size) and a crowd estimate.

import { clamp, compass, compassName, fmtHeightRange, isNum, zoned } from './util.js';

// ------------------------------------------------------------- windows
/**
 * Contiguous daylight runs where `scores[i] >= min`, between hour indices [from, to).
 * Returns [{ start, end (exclusive), peak, peakIdx, avg }] sorted by quality.
 */
export function bestWindows(scores, daylight, from, to, min = 5.5, maxOut = 6) {
  const out = [];
  let run = null;
  const close = () => {
    if (run && run.end - run.start >= 1) out.push(run);
    run = null;
  };
  for (let i = Math.max(0, from); i < Math.min(to, scores.length); i++) {
    const s = scores[i];
    if (daylight[i] && s >= min) {
      if (!run) run = { start: i, end: i + 1, peak: s, peakIdx: i, sum: s };
      else {
        run.end = i + 1;
        run.sum += s;
        if (s > run.peak) {
          run.peak = s;
          run.peakIdx = i;
        }
      }
    } else close();
  }
  close();
  for (const r of out) r.avg = r.sum / (r.end - r.start);
  return out.sort((a, b) => b.peak + b.avg * 0.3 + Math.min(b.end - b.start, 4) * 0.15 - (a.peak + a.avg * 0.3 + Math.min(a.end - a.start, 4) * 0.15)).slice(0, maxOut);
}

/** Max score within [from, to) over daylight hours → { score, idx }. */
export function peakIn(scores, daylight, from, to) {
  let best = { score: -1, idx: -1 };
  for (let i = Math.max(0, from); i < Math.min(to, scores.length); i++) {
    if (!daylight[i]) continue;
    if (scores[i] > best.score) best = { score: scores[i], idx: i };
  }
  return best;
}

// ------------------------------------------------------------- synopsis
const GROUPS = [
  { id: 'norte', name: 'Norte', regions: ['norte'] },
  { id: 'centro', name: 'Centro', regions: ['centro'] },
  { id: 'lisboa', name: 'Lisboa', regions: ['lisboa'] },
  { id: 'sul', name: 'Alentejo e Algarve', regions: ['alentejo', 'algarve'] },
];

function median(arr) {
  const a = arr.filter(isNum).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
const circularMean = (degs) => {
  const v = degs.filter(isNum);
  if (!v.length) return NaN;
  const x = v.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
  const y = v.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

function windWord(kn) {
  if (kn < 5) return 'fraco';
  if (kn < 12) return 'fraco a moderado';
  if (kn < 18) return 'moderado';
  if (kn < 25) return 'fresco';
  return 'forte';
}

/**
 * National synopsis for the mainland at hour `i` (plus trend over the next day).
 * `rows` = [{ spot, view }] for mainland spots.
 */
export function synopsis(rows, i, fc) {
  const exposed = rows.filter((r) => (r.spot.shelter ?? 1) >= 0.85 && !r.spot.flat && r.view.ok);
  if (!exposed.length) return null;
  const at = (k, j) => exposed.map((r) => r.view[k]?.[j]);
  const H = median(at('sh', i));
  const T = median(at('sp', i));
  const D = circularMean(at('sd', i));
  const j24 = Math.min(fc.n - 1, i + 24);
  const H24 = median(at('sh', j24));
  const W = median(rows.map((r) => r.view.ws?.[i]));
  const WD = circularMean(rows.map((r) => r.view.wdir?.[i]));
  // Afternoon wind (Nortada check) for the same local day.
  const z = zoned(fc.t0 + i * 3600, 'Europe/Lisbon');
  const pmIdx = i + clamp(16 - z.h, -24, 24);
  const Wpm = median(rows.map((r) => r.view.ws?.[clamp(pmIdx, 0, fc.n - 1)]));
  const WDpm = circularMean(rows.map((r) => r.view.wdir?.[clamp(pmIdx, 0, fc.n - 1)]));

  const parts = [];
  if (!isNum(H) || H < 0.3) parts.push('Mar praticamente flat na costa oeste');
  else parts.push(`Ondulação de ${compassName(D).toLowerCase()} com ${fmtHeightRange(H * 0.9, H * 1.1).replace(' ', ' ')} e ${Math.round(T)} s ao largo`);
  if (isNum(H24) && isNum(H) && H > 0.3) {
    const d = H24 - H;
    if (d > 0.35) parts.push('a subir nas próximas 24 h');
    else if (d < -0.35) parts.push('a baixar nas próximas 24 h');
    else parts.push('estável nas próximas 24 h');
  }
  let text = `${parts.join(', ')}.`;
  if (isNum(W)) {
    text += ` Vento ${windWord(W)} de ${compassName(WD).toLowerCase()}`;
    if (isNum(Wpm) && pmIdx !== i && Math.abs(Wpm - W) > 4) {
      const northerly = isNum(WDpm) && (WDpm >= 315 || WDpm <= 30);
      text += Wpm > W ? `, a intensificar à tarde${northerly && Wpm >= 12 ? ' (nortada)' : ''}` : ', a acalmar à tarde';
    }
    text += '.';
  }
  const regions = GROUPS.map((g) => {
    const rs = exposed.filter((r) => g.regions.includes(r.spot.region));
    return { ...g, h: median(rs.map((r) => r.view.sh?.[i])), p: median(rs.map((r) => r.view.sp?.[i])) };
  }).filter((g) => isNum(g.h));
  return { text, H, T, D, W, WD, regions };
}

// ------------------------------------------------------------ gear advice
export function wetsuit(sst, air, windKn) {
  if (!isNum(sst)) return { label: '—', detail: 'Sem dados da temperatura da água.' };
  // Wind chill nudges the recommendation one step warmer.
  const feel = sst - (isNum(windKn) && windKn > 15 ? 1 : 0) - (isNum(air) && air < 12 ? 0.8 : 0);
  if (feel >= 23) return { label: 'Lycra ou calções', detail: 'Água quente — fato dispensável.', level: 0 };
  if (feel >= 20) return { label: 'Fato 2 mm / shorty', detail: 'Água amena.', level: 1 };
  if (feel >= 17.5) return { label: 'Fato 3/2', detail: 'O clássico de verão e início de outono.', level: 2 };
  if (feel >= 15.5) return { label: 'Fato 4/3 ou 3/2', detail: 'Água fresca — o 4/3 para sessões longas.', level: 3 };
  if (feel >= 13.5) return { label: 'Fato 4/3', detail: 'Água fria — botas se fores friorento.', level: 4 };
  if (feel >= 12) return { label: 'Fato 4/3 + botas', detail: 'Água fria — capuz em dias de vento.', level: 5 };
  return { label: 'Fato 5/4 + botas + capuz', detail: 'Água muito fria — luvas ajudam em sessões longas.', level: 6 };
}

export function boardAdvice(sport, face, level, period) {
  if (!isNum(face)) return null;
  if (sport === 'bodyboard') {
    if (face > 2.5) return { label: 'Bodyboard + leash de bíceps', detail: 'Ondas grandes: pés de pato bem presos e leash reforçado.' };
    return { label: 'Bodyboard + pés de pato', detail: face < 0.7 ? 'Prancha com mais volume para ondas pequenas.' : 'Setup normal.' };
  }
  if (sport !== 'surf') return null;
  if (level === 1) {
    if (face > 1.3) return { label: 'Fica na areia', detail: 'Mar acima do recomendado para iniciação.' };
    return { label: 'Softboard / longboard', detail: 'Volume e estabilidade para apanhar mais ondas.' };
  }
  if (face < 0.6) return { label: 'Longboard ou fish', detail: 'Ondas pequenas pedem volume e remada.' };
  if (face < 1.1) return { label: 'Fish / hybrid', detail: 'Um pouco mais de volume ajuda.' };
  if (face < 2.1) return { label: 'Shortboard', detail: isNum(period) && period >= 13 ? 'Período longo: ondas com força.' : 'A prancha do dia a dia.' };
  if (face < 3.2) return { label: 'Shortboard / step-up', detail: 'Um step-up dá mais controlo na remada.' };
  return { label: 'Step-up ou gun', detail: 'Mar grande — prancha maior, leash grosso e respeito.' };
}

/** Sail/kite/wing size (m²) from rider weight (kg) and wind (kn). */
export function windGear(sport, weightKg, kn) {
  if (!isNum(kn) || kn < 6) return null;
  const w = clamp(weightKg || 75, 35, 130);
  if (sport === 'kitesurf') {
    const m2 = clamp(Math.round(((w * 2.2) / kn) * 1), 5, 17);
    return { label: `Kite de ~${m2} m²`, detail: `Para ${Math.round(w)} kg com ${Math.round(kn)} nós (twin-tip).` };
  }
  if (sport === 'windsurf') {
    const m2 = clamp(Math.round(((w * 1.34) / kn) * 10) / 10, 3.3, 9.5);
    return { label: `Vela de ~${m2.toFixed(1).replace('.', ',')} m²`, detail: `Para ${Math.round(w)} kg com ${Math.round(kn)} nós.` };
  }
  if (sport === 'wingfoil') {
    const m2 = clamp(Math.round(((w * 1.05) / kn) * 2) / 2, 2.5, 7);
    return { label: `Wing de ~${String(m2).replace('.', ',')} m²`, detail: `Para ${Math.round(w)} kg com ${Math.round(kn)} nós.` };
  }
  return null;
}

// ------------------------------------------------------------ crowd
// Heuristic only: popularity × weekend × time of day × season × quality.
const HOLIDAYS = new Set(['01-01', '04-25', '05-01', '06-10', '08-15', '10-05', '11-01', '12-01', '12-08', '12-25']);
export function crowd(spot, t, score, tz = 'Europe/Lisbon') {
  const z = zoned(t, tz);
  const md = `${String(z.mo).padStart(2, '0')}-${String(z.d).padStart(2, '0')}`;
  const weekend = z.wd === 0 || z.wd === 6 || HOLIDAYS.has(md);
  const summer = z.mo >= 7 && z.mo <= 8;
  let v = (spot.crowd ?? 0.5) * (weekend ? 1 : 0.55);
  if (summer) v *= 1.25;
  if (z.h < 8) v *= 0.6;
  else if (z.h >= 11 && z.h < 16) v *= summer ? 1.1 : 0.85;
  else if (z.h >= 17 && !weekend) v *= 1.15; // after work
  v *= 0.6 + 0.08 * clamp(score, 0, 10);
  const levels = [
    { max: 0.2, id: 1, name: 'Tranquilo' },
    { max: 0.4, id: 2, name: 'Pouca gente' },
    { max: 0.65, id: 3, name: 'Movimentado' },
    { max: 9, id: 4, name: 'Muito crowd' },
  ];
  return levels.find((l) => v < l.max);
}

// ------------------------------------------------------------ weather
export function weatherLabel(code) {
  if (!isNum(code)) return '';
  if (code === 0) return 'Céu limpo';
  if (code <= 2) return 'Pouco nublado';
  if (code === 3) return 'Nublado';
  if (code <= 48) return 'Nevoeiro';
  if (code <= 57) return 'Chuvisco';
  if (code <= 67) return 'Chuva';
  if (code <= 77) return 'Neve';
  if (code <= 82) return 'Aguaceiros';
  if (code <= 86) return 'Aguaceiros de neve';
  return 'Trovoada';
}
export function weatherIcon(code, isDay = true) {
  if (!isNum(code)) return 'cloud';
  if (code === 0) return isDay ? 'sun' : 'moon';
  if (code <= 2) return isDay ? 'sun-cloud' : 'moon';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'fog';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 95) return 'storm';
  return 'cloud';
}

export const dirArrow = (deg) => compass(deg);
