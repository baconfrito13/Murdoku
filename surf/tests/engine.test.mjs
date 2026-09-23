// Engine tests for Maresia: geometry helpers, sun, tide analysis, the scoring
// model and spot-database integrity. Run: node --test surf/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { angDist, compass, compassName16, distanceKm, distToArc, fmtHeightRange, inArc, localMidnight, offsetPoint, zoned } from '../js/util.js';
import { sunEvents } from '../js/sun.js';
import { analyseTide, tidePrefLabel } from '../js/tide.js';
import { conditions, score, swellWrap, trap, windForWaves, windRelation } from '../js/model.js';
import { bestWindows, peakIn, wetsuit, windGear } from '../js/insights.js';
import { REGIONS, SPOTS } from '../js/spots.js';
import { MAP_VIEWS, project, viewForSpot } from '../js/geo.js';

// ------------------------------------------------------------------ util
test('angles: distance, arcs and wrap-around', () => {
  assert.equal(angDist(350, 10), 20);
  assert.equal(angDist(90, 270), 180);
  assert.ok(inArc(10, 300, 40), 'arc wrapping through north');
  assert.ok(!inArc(200, 300, 40));
  assert.equal(distToArc(320, 300, 40), 0);
  assert.equal(distToArc(280, 300, 40), 20);
  assert.equal(compass(305), 'NW');
  assert.equal(compass(340), 'NNW');
  assert.equal(compass(352), 'N');
  assert.equal(compassName16(292), 'Oés-noroeste');
});

test('geodesy: 3 km offshore point is 3 km away on the right bearing', () => {
  const [lat, lon] = offsetPoint(39.3452, -9.3638, 235, 3);
  assert.ok(Math.abs(distanceKm(39.3452, -9.3638, lat, lon) - 3) < 0.01);
  assert.ok(lat < 39.3452 && lon < -9.3638, 'south-west of the beach');
});

test('time zones: Lisbon, Madeira and Azores wall clocks', () => {
  const t = Date.UTC(2026, 8, 23, 12, 0) / 1000; // 12:00 UTC, summer time
  assert.equal(zoned(t, 'Europe/Lisbon').h, 13);
  assert.equal(zoned(t, 'Atlantic/Madeira').h, 13);
  assert.equal(zoned(t, 'Atlantic/Azores').h, 12);
  assert.equal(localMidnight(t, 'Europe/Lisbon'), Date.UTC(2026, 8, 22, 23, 0) / 1000);
});

test('formatting: face height ranges in pt-PT', () => {
  assert.equal(fmtHeightRange(1.23, 1.8), '1,2–1,8 m');
  assert.equal(fmtHeightRange(0.02, 0.1), 'flat');
});

// ------------------------------------------------------------------ sun
test('sun: Guincho 23 Sep 2026 matches published times (±3 min)', () => {
  const e = sunEvents(Date.UTC(2026, 8, 23, 13) / 1000, 38.73, -9.47);
  const hm = (s) => {
    const z = zoned(s, 'Europe/Lisbon');
    return z.h * 60 + z.mi;
  };
  assert.ok(Math.abs(hm(e.rise) - (7 * 60 + 26)) <= 3, `sunrise ${hm(e.rise)}`);
  assert.ok(Math.abs(hm(e.set) - (19 * 60 + 33)) <= 3, `sunset ${hm(e.set)}`);
  assert.ok(e.dawn < e.rise && e.set < e.dusk);
});

// ------------------------------------------------------------------ tide
test('tide: extremes, 0–1 position and trend on a synthetic semidiurnal curve', () => {
  const t0 = Date.UTC(2026, 8, 23) / 1000;
  const period = 12.42;
  const series = Array.from({ length: 72 }, (_, i) => 1.2 * Math.cos((2 * Math.PI * (i - 3)) / period));
  const tide = analyseTide(series, t0);
  const highs = tide.extremes.filter((e) => e.type === 'high');
  const lows = tide.extremes.filter((e) => e.type === 'low');
  assert.ok(highs.length >= 5 && lows.length >= 5);
  // First high water at 03:00 UTC, refined within 10 minutes.
  assert.ok(Math.abs(highs[0].t - (t0 + 3 * 3600)) < 600, 'high water time');
  assert.ok(tide.pos[3] > 0.95, 'position at high water ≈ 1');
  const lowIdx = Math.round(3 + period / 2);
  assert.ok(tide.pos[lowIdx] < 0.08, 'position at low water ≈ 0');
  assert.equal(tide.trend[5], -1, 'falling after high water');
  assert.equal(tide.trend[lowIdx + 2], 1, 'rising after low water');
});

test('tide: preference labels read naturally', () => {
  assert.equal(tidePrefLabel([0, 1], 0.5), 'Qualquer maré');
  assert.equal(tidePrefLabel([0, 0.45], 0.7), 'Vazia a meia-maré');
  assert.equal(tidePrefLabel([0.55, 1], 0.7), 'Meia-maré a cheia');
});

// ------------------------------------------------------------------ model
const beach = {
  id: 't', name: 'Teste', region: 'centro', lat: 39.3, lon: -9.4, facing: 270, swell: [240, 320], bestSwell: 285, shelter: 1,
  type: 'beach', size: [0.5, 0.9, 2.0, 3.0], tide: [0, 1], tideSens: 0.2, level: 2, quality: 0.9,
  sports: { surf: 1, bodyboard: 0.8, kitesurf: 1, windsurf: 1, sup: 0.3, wingfoil: 1 }, kiteDirs: [], windShelter: [],
};
const hour = (o) => {
  const d = {
    sh: [o.sh ?? 1.4], sd: [o.sd ?? 290], sp: [o.sp ?? 12], s2h: [0], s2d: [0], s2p: [0],
    wh: [o.wh ?? 0.1], wd: [o.wdd ?? 300], wp: [3], hs: [o.sh ?? 1.4],
    ws: [o.ws ?? 3], wdir: [o.wdir ?? 90], wg: [o.wg ?? (o.ws ?? 3) * 1.3], wc: [o.wc ?? 1], ta: [20], sst: [17],
    tide: { h: [2], pos: [o.tide ?? 0.5], trend: [1] }, day: [true],
  };
  return conditions(beach, d, 0);
};

test('model: swell window wraps more for long periods', () => {
  assert.equal(swellWrap(beach, 280, 10), 1);
  assert.ok(swellWrap(beach, 200, 16) > swellWrap(beach, 200, 8), 'long period wraps further');
  assert.ok(swellWrap(beach, 90, 14) < 0.01, 'no swell from behind the beach');
});

test('model: wind relative to the beach', () => {
  assert.equal(windRelation(beach, 90).id, 'offshore');
  assert.equal(windRelation(beach, 270).id, 'onshore');
  assert.equal(windRelation(beach, 0).id, 'cross');
  assert.ok(windForWaves(6, 0) > 0.95, 'light offshore is ideal');
  assert.ok(windForWaves(18, 180) < 0.2, 'strong onshore ruins it');
});

test('model: trapezoid membership', () => {
  assert.equal(trap(1.2, [0.5, 0.9, 2, 3]), 1);
  assert.equal(trap(0.1, [0.5, 0.9, 2, 3]), 0);
  assert.ok(trap(2.5, [0.5, 0.9, 2, 3]) < 1 && trap(2.5, [0.5, 0.9, 2, 3]) > 0.5);
});

test('model: surf scores rank clean, onshore and flat days sensibly', () => {
  const clean = score(beach, hour({ sh: 1.3, sp: 13, ws: 4, wdir: 90 }), 'surf', 2).score;
  const onshore = score(beach, hour({ sh: 1.3, sp: 13, ws: 20, wdir: 270, wh: 1.2 }), 'surf', 2).score;
  const flat = score(beach, hour({ sh: 0.1, sp: 6, ws: 2 }), 'surf', 2).score;
  assert.ok(clean >= 7.5, `clean day ${clean}`);
  assert.ok(onshore < 3.5, `onshore day ${onshore}`);
  assert.ok(flat < 1, `flat day ${flat}`);
});

test('model: level gates big waves and expert spots', () => {
  const big = hour({ sh: 2.0, sp: 13, ws: 4, wdir: 90 });
  assert.ok(score(beach, big, 'surf', 1).score < 1.5, 'beginner in 2.5 m surf');
  assert.ok(score(beach, big, 'surf', 4).score > score(beach, big, 'surf', 1).score);
  const expertSpot = { ...beach, level: 4 };
  const ok = hour({ sh: 1.4, sp: 13, ws: 4, wdir: 90 });
  assert.ok(score(expertSpot, ok, 'surf', 1).score < 1, 'beginner at an expert-only spot');
});

test('model: kitesurf needs wind, and offshore wind scores zero', () => {
  const side = score(beach, hour({ ws: 18, wdir: 0 }), 'kitesurf', 2);
  const off = score(beach, hour({ ws: 18, wdir: 90 }), 'kitesurf', 2);
  const calm = score(beach, hour({ ws: 5, wdir: 0 }), 'kitesurf', 2);
  assert.ok(side.score >= 7, `side-shore 18 kn ${side.score}`);
  assert.equal(off.score, 0);
  assert.ok(off.raw.danger, 'offshore flagged as dangerous');
  assert.ok(calm.score < 1.5, `no wind ${calm.score}`);
});

test('model: thunderstorms kill the score', () => {
  const s = score(beach, hour({ sh: 1.3, sp: 13, ws: 4, wdir: 90, wc: 95 }), 'surf', 2).score;
  assert.ok(s < 3);
});

// ------------------------------------------------------------------ insights
test('insights: best windows are contiguous daylight runs', () => {
  const s = [0, 0, 6, 7, 8, 7, 2, 0, 6.5, 6.6, 0];
  const day = s.map((_, i) => i !== 9);
  const w = bestWindows(s, day, 0, s.length, 6);
  assert.equal(w[0].start, 2);
  assert.equal(w[0].end, 6);
  assert.equal(w[0].peakIdx, 4);
  assert.ok(w.every((x) => x.end - x.start >= 1));
  assert.deepEqual(peakIn(s, day, 0, s.length), { score: 8, idx: 4 });
});

test('insights: wetsuit and kite size advice', () => {
  assert.equal(wetsuit(24, 25, 5).label, 'Lycra ou calções');
  assert.equal(wetsuit(14, 13, 10).label, 'Fato 4/3');
  assert.match(windGear('kitesurf', 75, 18).label, /Kite de ~9 m²/);
});

// ------------------------------------------------------------------ data integrity
test('spots: database is complete and physically coherent', () => {
  const regions = new Set(REGIONS.map((r) => r.id));
  const ids = new Set();
  assert.ok(SPOTS.length >= 40, `only ${SPOTS.length} spots`);
  for (const s of SPOTS) {
    assert.match(s.id, /^[a-z0-9-]+$/, s.id);
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`);
    ids.add(s.id);
    assert.ok(regions.has(s.region), `${s.id} region`);
    assert.ok(s.name && s.area && s.desc, `${s.id} text`);
    for (const k of ['facing', 'bestSwell']) assert.ok(s[k] >= 0 && s[k] < 360, `${s.id} ${k}`);
    assert.equal(s.swell.length, 2, `${s.id} swell window`);
    assert.ok(s.size.every((v, i) => i === 0 || v >= s.size[i - 1]), `${s.id} size ascending`);
    assert.ok(s.tide[0] >= 0 && s.tide[1] <= 1 && s.tide[0] <= s.tide[1], `${s.id} tide`);
    assert.ok(s.level >= 1 && s.level <= 4, `${s.id} level`);
    for (const sp of ['surf', 'bodyboard', 'kitesurf', 'windsurf', 'sup', 'wingfoil']) {
      assert.ok(s.sports[sp] >= 0 && s.sports[sp] <= 1, `${s.id} sports.${sp}`);
    }
    // Every spot sits inside its map view.
    const v = MAP_VIEWS[viewForSpot(s)];
    const [x, y] = project(v, s.lat, s.lon);
    assert.ok(x > 0 && x < v.width && y > 0 && y < v.height, `${s.id} outside ${v.id} map`);
  }
});
