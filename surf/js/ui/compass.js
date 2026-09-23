// Spot compass: which way the beach faces, the swell window it is open to,
// the offshore (terral) wind sector, and the current swell and wind arrows.

import { compass, fmtHeight, fmtWind, isNum, norm360 } from '../util.js';

const C = 110;
const R = 84;
const pt = (deg, r) => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)];
const f = (n) => n.toFixed(1);

function wedge(from, to, r0, r1) {
  const span = norm360(to - from) || 360;
  const large = span > 180 ? 1 : 0;
  const [x0, y0] = pt(from, r1);
  const [x1, y1] = pt(from + span, r1);
  const [x2, y2] = pt(from + span, r0);
  const [x3, y3] = pt(from, r0);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${large} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
}

/** Arrow coming FROM `deg`, from the rim towards the centre. */
function inArrow(deg, width, cls, rOut = R + 2, rIn = 30) {
  const [tx, ty] = pt(deg, rIn);
  const [bx, by] = pt(deg, rOut);
  const nx = Math.cos((deg * Math.PI) / 180);
  const ny = Math.sin((deg * Math.PI) / 180);
  const w = width / 2;
  const [hx, hy] = pt(deg, rIn + 16);
  return `<path class="${cls}" d="M${f(bx + nx * w * 0.55)} ${f(by + ny * w * 0.55)}L${f(hx + nx * w * 0.55)} ${f(hy + ny * w * 0.55)}L${f(hx + nx * (w + 5))} ${f(hy + ny * (w + 5))}L${f(tx)} ${f(ty)}L${f(hx - nx * (w + 5))} ${f(hy - ny * (w + 5))}L${f(hx - nx * w * 0.55)} ${f(hy - ny * w * 0.55)}L${f(bx - nx * w * 0.55)} ${f(by - ny * w * 0.55)}Z"/>`;
}

export function compassSvg(spot, c, units) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let ticks = '';
  for (let d = 0; d < 360; d += 22.5) {
    const [x0, y0] = pt(d, R);
    const [x1, y1] = pt(d, R - (d % 45 === 0 ? 7 : 4));
    ticks += `<line class="tick" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"/>`;
  }
  const lbl = labels.map((l, k) => {
    const [x, y] = pt(k * 45, R + 13);
    return `<text class="lbl" x="${f(x)}" y="${f(y)}">${l}</text>`;
  }).join('');
  const [a, b] = spot.swell;
  const off = spot.offshore;
  // Land: half-disc on the offshore side, shoreline across the centre.
  const [lx0, ly0] = pt(off - 90, 26);
  const [lx1, ly1] = pt(off + 90, 26);
  const land = `<path class="beach" d="M${f(lx0)} ${f(ly0)}A26 26 0 0 1 ${f(lx1)} ${f(ly1)}Z"/>`;
  const swellW = isNum(c?.swellH) ? Math.max(5, Math.min(18, 4 + c.swellH * 4)) : 0;
  const windW = isNum(c?.wind.kn) ? Math.max(4, Math.min(14, 3 + c.wind.kn * 0.4)) : 0;
  const arrows = (swellW && isNum(c.swellDir) ? inArrow(c.swellDir, swellW, 'swell-arrow') : '')
    + (windW && isNum(c.wind.dir) && c.wind.kn >= 2 ? inArrow(c.wind.dir, windW, 'wind-arrow', R - 6, 36) : '');
  const svg = `<svg class="compass" viewBox="0 0 220 220" role="img" aria-label="Orientação de ${spot.name}: virada a ${compass(spot.facing)}, janela de ondulação ${compass(a)} a ${compass(b)}, vento terral de ${compass(off)}">
    <circle class="ring" cx="${C}" cy="${C}" r="${R}"/>
    <path class="window" d="${wedge(a, b, 30, R)}"/>
    <path class="window-edge" d="${wedge(a, b, 30, R)}"/>
    <path class="offshore" d="${wedge(off - 35, off + 35, 30, R)}"/>
    ${ticks}${lbl}${land}
    ${arrows}
  </svg>`;
  const legend = `<div class="compass-legend">
    <div><i style="background:var(--series-wave);opacity:.35"></i><span>Janela de ondulação: <b>${compass(a)}–${compass(b)}</b> (ideal ${compass(spot.bestSwell)})</span></div>
    <div><i style="background:var(--good);opacity:.35"></i><span>Vento terral (offshore): <b>${compass(off)}</b></span></div>
    <div><i style="background:var(--land)"></i><span>Praia virada a <b>${compass(spot.facing)}</b> (${Math.round(spot.facing)}°)</span></div>
    ${c && isNum(c.swellDir) ? `<div><i style="background:var(--series-wave)"></i><span>Ondulação: <b>${fmtHeight(c.swellH, units.hUnit)} de ${compass(c.swellDir)}</b></span></div>` : ''}
    ${c && isNum(c.wind.dir) ? `<div><i style="background:var(--series-wind)"></i><span>Vento: <b>${fmtWind(c.wind.kn, units.wUnit)} de ${compass(c.wind.dir)}</b></span></div>` : ''}
  </div>`;
  return `<div class="compass-wrap">${svg}${legend}</div>`;
}
