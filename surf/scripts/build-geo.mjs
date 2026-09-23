// Builds surf/js/geo.js — projected SVG outlines of mainland Portugal (with the
// Spanish border region for context), Madeira and the Azores.
// Source: Eurostat GISCO country polygons, 1:1 million (EPSG:4326).
// Run: node surf/scripts/build-geo.mjs   (downloads the sources once into .cache/)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '.cache');
const outFile = join(here, '..', 'js', 'geo.js');
const SRC = (c) => `https://gisco-services.ec.europa.eu/distribution/v2/countries/distribution/${c}-region-01m-4326-2020.geojson`;

async function load(code) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, `${code}-01m.geojson`);
  if (!existsSync(file)) {
    const res = await fetch(SRC(code));
    if (!res.ok) throw new Error(`download ${code}: HTTP ${res.status}`);
    writeFileSync(file, await res.text());
  }
  const fc = JSON.parse(readFileSync(file, 'utf8'));
  const polys = [];
  for (const f of fc.features) {
    const g = f.geometry;
    for (const p of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) polys.push(p);
  }
  return polys;
}

// View definitions: bbox = [lonMin, latMin, lonMax, latMax]; scale = SVG units per degree of latitude.
const VIEWS = {
  continente: {
    name: 'Continente', bbox: [-10.35, 36.72, -6.05, 42.2], scale: 200, tol: 0.18, neighborTol: 0.6,
    cities: [
      ['Viana do Castelo', 41.694, -8.832], ['Porto', 41.150, -8.611], ['Aveiro', 40.641, -8.654],
      ['Figueira da Foz', 40.151, -8.861], ['Leiria', 39.744, -8.807],
      ['Nazaré', 39.601, -9.071], ['Peniche', 39.356, -9.381], ['Ericeira', 38.963, -9.417],
      ['Lisboa', 38.722, -9.139], ['Setúbal', 38.524, -8.889], ['Sines', 37.956, -8.869],
      ['Évora', 38.571, -7.909], ['Lagos', 37.102, -8.674], ['Sagres', 37.009, -8.940],
      ['Faro', 37.019, -7.930], ['Braga', 41.545, -8.426],
    ],
    labels: [
      { text: 'ESPANHA', lat: 40.0, lon: -6.55, kind: 'country' },
      { text: 'OCEANO ATLÂNTICO', lat: 38.4, lon: -9.95, kind: 'sea', rotate: -90 },
    ],
  },
  madeira: {
    name: 'Madeira', bbox: [-17.36, 32.36, -16.18, 33.16], scale: 900, tol: 0.25,
    cities: [['Funchal', 32.650, -16.908], ['Porto Santo', 33.061, -16.341], ['São Vicente', 32.797, -17.043]],
    labels: [{ text: 'OCEANO ATLÂNTICO', lat: 32.46, lon: -17.05, kind: 'sea' }],
  },
  acores: {
    name: 'Açores', bbox: [-31.45, 36.78, -24.85, 39.86], scale: 160, tol: 0.12,
    cities: [
      ['Ponta Delgada', 37.741, -25.668], ['Ribeira Grande', 37.822, -25.519], ['Angra do Heroísmo', 38.655, -27.221],
      ['Horta', 38.535, -28.627], ['Velas', 38.681, -28.214], ['Santa Cruz das Flores', 39.453, -31.128],
    ],
    labels: [{ text: 'OCEANO ATLÂNTICO', lat: 37.3, lon: -28.9, kind: 'sea' }],
  },
};

const rad = (d) => (d * Math.PI) / 180;

function projector(view) {
  const [lonMin, latMin, lonMax, latMax] = view.bbox;
  const k = Math.cos(rad((latMin + latMax) / 2));
  const s = view.scale;
  return {
    k,
    width: +((lonMax - lonMin) * k * s).toFixed(1),
    height: +((latMax - latMin) * s).toFixed(1),
    p: ([lon, lat]) => [(lon - lonMin) * k * s, (latMax - lat) * s],
  };
}

// Sutherland–Hodgman clip of a ring against an axis-aligned rectangle (projected units).
function clipRing(ring, x0, y0, x1, y1) {
  const edges = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ];
  const cut = [
    (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; },
    (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; },
    (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; },
    (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; },
  ];
  let out = ring;
  for (let e = 0; e < 4; e++) {
    const input = out;
    out = [];
    if (!input.length) break;
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const inC = edges[e](cur);
      const inP = edges[e](prev);
      if (inC) {
        if (!inP) out.push(cut[e](prev, cur));
        out.push(cur);
      } else if (inP) out.push(cut[e](prev, cur));
    }
  }
  return out;
}

// Douglas–Peucker (iterative) on an open polyline.
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let best = -1;
    let bestD = t2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function ringPath(ring) {
  if (ring.length < 3) return '';
  let d = '';
  let px = null;
  let py = null;
  ring.forEach(([x, y], i) => {
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    if (i === 0) d += `M${rx} ${ry}`;
    else {
      if (rx === px && ry === py) return;
      d += `l${+(rx - px).toFixed(1)} ${+(ry - py).toFixed(1)}`;
    }
    px = rx;
    py = ry;
  });
  return `${d}z`;
}

function buildPath(polys, view, proj, tol, clip) {
  const [lonMin, latMin, lonMax, latMax] = view.bbox;
  const parts = [];
  for (const poly of polys) {
    // Quick reject by bbox.
    let bx0 = Infinity; let by0 = Infinity; let bx1 = -Infinity; let by1 = -Infinity;
    for (const [x, y] of poly[0]) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    if (bx1 < lonMin || bx0 > lonMax || by1 < latMin || by0 > latMax) continue;
    for (const ring of poly) {
      let pts = ring.map(proj.p);
      // Clip the neighbour well outside the view so its cut edges never show.
      if (clip) pts = clipRing(pts, -400, -400, proj.width + 600, proj.height + 300);
      // close-safe simplification: treat ring as polyline from first point back to itself
      pts = simplify(pts, tol);
      if (pts.length >= 3) parts.push(ringPath(pts));
    }
  }
  return parts.join('');
}

const PT = await load('PT');
const ES = await load('ES');

const out = {};
for (const [id, view] of Object.entries(VIEWS)) {
  const proj = projector(view);
  const land = buildPath(PT, view, proj, view.tol, false);
  const neighbor = id === 'continente' ? buildPath(ES, view, proj, view.neighborTol, true) : '';
  const r = (v) => Math.round(v * 10) / 10;
  out[id] = {
    id,
    name: view.name,
    bbox: view.bbox,
    scale: view.scale,
    k: +proj.k.toFixed(6),
    width: proj.width,
    height: proj.height,
    land,
    neighbor,
    cities: view.cities.map(([name, lat, lon]) => {
      const [x, y] = proj.p([lon, lat]);
      return { name, x: r(x), y: r(y) };
    }),
    labels: view.labels.map((l) => {
      const [x, y] = proj.p([l.lon, l.lat]);
      return { ...l, x: r(x), y: r(y) };
    }),
  };
  console.log(`${id}: ${proj.width}×${proj.height}, land ${land.length} chars, neighbor ${neighbor.length} chars`);
}

const src = `// GENERATED by surf/scripts/build-geo.mjs — do not edit by hand.
// Outlines © EuroGeographics / Eurostat GISCO (1:1M), simplified and projected
// (equirectangular, cos(mid-latitude) scaled) into SVG user units.

export const MAP_VIEWS = ${JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"')};

// Same projection the outlines were built with — keeps pins and coastline aligned.
export function project(view, lat, lon) {
  const [lonMin, , , latMax] = view.bbox;
  return [(lon - lonMin) * view.k * view.scale, (latMax - lat) * view.scale];
}

export function unproject(view, x, y) {
  const [lonMin, , , latMax] = view.bbox;
  return [latMax - y / view.scale, lonMin + x / (view.k * view.scale)];
}

export function viewForSpot(spot) {
  if (spot.region === 'madeira') return 'madeira';
  if (spot.region === 'acores') return 'acores';
  return 'continente';
}
`;
writeFileSync(outFile, src);
console.log(`wrote ${outFile} (${(src.length / 1024).toFixed(1)} KiB)`);
