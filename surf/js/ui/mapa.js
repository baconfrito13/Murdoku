// Interactive coast map: pins coloured by score at the chosen hour, swell and
// wind arrows, clustering at low zoom, pan/zoom (drag, wheel, pinch, buttons)
// and a time scrubber that can play the whole week.

import { condsOf, evalAt, go, scores, setCursor, setPref, spotById, spots, SPORT, state, timeOf, view } from '../core.js';
import { MAP_VIEWS, project } from '../geo.js';
import { marinePoint } from '../forecast.js';
import { clamp, compass, escapeHtml, fmtDay, fmtDayShort, fmtHeightRange, fmtHour, fmtWind, isNum, zoned } from '../util.js';
import { icon } from '../icons.js';
import { fmtScore, scoreBadge, scoreClass } from './components.js';
import { rating } from '../model.js';

const VIEW_ORDER = ['continente', 'madeira', 'acores'];

export function mount(el) {
  let viewId = 'continente';
  let vb = null; // current viewBox {x, y, w, h}
  let selected = null;
  let playing = false;
  let playTimer = 0;
  const focusId = (() => {
    try {
      const v = sessionStorage.getItem('maresia.mapFocus');
      sessionStorage.removeItem('maresia.mapFocus');
      return v;
    } catch {
      return null;
    }
  })();
  if (focusId && spotById.has(focusId)) {
    selected = focusId;
    viewId = spotById.get(focusId).view;
  }

  el.innerHTML = `<div class="map-wrap">
    <svg class="map-svg" role="application" aria-label="Mapa de spots" tabindex="0"></svg>
    <div class="map-ui">
      <div class="map-top">
        <div class="map-float view-switch seg" role="group" aria-label="Zona do mapa">${VIEW_ORDER.map((v) => `<button type="button" data-view="${v}" aria-pressed="${v === viewId}">${MAP_VIEWS[v].name}</button>`).join('')}</div>
        <div class="map-float map-layers" role="group" aria-label="Camadas">
          <button type="button" data-layer="swell" aria-pressed="${state.prefs.layers.swell}">${icon('wave', { size: 15 })}Ondulação</button>
          <button type="button" data-layer="wind" aria-pressed="${state.prefs.layers.wind}">${icon('wind', { size: 15 })}Vento</button>
        </div>
      </div>
      <div class="map-float map-zoom"><button type="button" data-zoom="1.6" aria-label="Aproximar">${icon('plus', { size: 20 })}</button><button type="button" data-zoom="0.625" aria-label="Afastar">${icon('minus', { size: 20 })}</button><button type="button" data-reset aria-label="Ver tudo">${icon('locate', { size: 19 })}</button></div>
      <div class="map-bottom">
        <div class="map-float map-card" data-card hidden></div>
        <div class="map-float scrub">
          <div class="scrub-head">
            <button type="button" class="play" data-play aria-label="Animar a semana">${icon('play', { size: 16 })}</button>
            <div class="scrub-time" data-time aria-live="polite"></div>
            <div class="map-legend" style="margin-left:auto" aria-hidden="true"><span>0</span><span class="legend-ramp">${Array.from({ length: 11 }, (_, k) => `<i class="sc-${Math.round((k / 10) * 12)}"></i>`).join('')}</span><span>10</span></div>
          </div>
          <input class="range" type="range" id="map-range" min="0" max="0" step="1" aria-label="Hora da previsão">
          <div class="scrub-days" data-days aria-hidden="true"></div>
        </div>
      </div>
    </div>
  </div>`;

  const svg = el.querySelector('.map-svg');
  const range = el.querySelector('#map-range');
  const card = el.querySelector('[data-card]');

  function fullBox(v) {
    const m = MAP_VIEWS[v];
    return { x: 0, y: 0, w: m.width, h: m.height };
  }
  // Screen space covered by the floating controls (top bar, zoom, time scrubber).
  function overlayPad() {
    const r = svg.getBoundingClientRect();
    const top = el.querySelector('.map-top')?.getBoundingClientRect();
    const bottom = el.querySelector('.map-bottom')?.getBoundingClientRect();
    return {
      t: top ? Math.max(0, top.bottom - r.top) + 8 : 0,
      b: bottom ? Math.max(0, r.bottom - bottom.top) + 8 : 0,
      l: 8,
      r: 60,
    };
  }
  function fitBox(box, pad = overlayPad()) {
    // Fit `box` inside the part of the map not covered by controls, keeping
    // the element's aspect ratio so nothing is cropped or stretched.
    const r = svg.getBoundingClientRect();
    const aw = Math.max(80, r.width - pad.l - pad.r);
    const ah = Math.max(80, r.height - pad.t - pad.b);
    const ar = aw / ah;
    const b = { ...box };
    if (b.w / b.h > ar) {
      const nh = b.w / ar;
      b.y -= (nh - b.h) / 2;
      b.h = nh;
    } else {
      const nw = b.h * ar;
      b.x -= (nw - b.w) / 2;
      b.w = nw;
    }
    const k = b.w / aw;
    return { x: b.x - pad.l * k, y: b.y - pad.t * k, w: r.width * k, h: r.height * k };
  }
  function applyVB() {
    svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
    drawDynamic();
  }

  // ------------------------------------------------------------ static base
  function drawBase() {
    const m = MAP_VIEWS[viewId];
    const pad = 400;
    let grat = '';
    const [lonMin, latMin, lonMax, latMax] = m.bbox;
    const stepDeg = viewId === 'madeira' ? 0.25 : 1;
    for (let lon = Math.ceil(lonMin / stepDeg) * stepDeg; lon <= lonMax; lon += stepDeg) {
      const [x] = project(m, latMax, lon);
      grat += `<line class="map-grat" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${-pad}" y2="${m.height + pad}"/><text class="map-grat-lbl" x="${(x + 3).toFixed(1)}" y="12">${Math.abs(lon).toFixed(stepDeg < 1 ? 2 : 0)}°W</text>`;
    }
    for (let lat = Math.ceil(latMin / stepDeg) * stepDeg; lat <= latMax; lat += stepDeg) {
      const [, y] = project(m, lat, lonMin);
      grat += `<line class="map-grat" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" x1="${-pad}" x2="${m.width + pad}"/><text class="map-grat-lbl" x="4" y="${(y - 3).toFixed(1)}">${lat.toFixed(stepDeg < 1 ? 2 : 0)}°N</text>`;
    }
    const halo = (w, o) => `<path class="map-halo" d="${m.land}" stroke-width="${w}" opacity="${o}"/>`;
    const labels = m.labels.map((l) => `<text class="map-label" x="${l.x}" y="${l.y}" font-size="${l.kind === 'sea' ? 15 : 18}" ${l.rotate ? `transform="rotate(${l.rotate} ${l.x} ${l.y})"` : ''} text-anchor="middle">${escapeHtml(l.text)}</text>`).join('');
    const cities = m.cities.map((c) => `<g class="map-city"><circle cx="${c.x}" cy="${c.y}" r="2.2"/><text x="${c.x + 5}" y="${c.y + 3.5}">${escapeHtml(c.name)}</text></g>`).join('');
    svg.innerHTML = `<rect class="map-sea" x="${-pad}" y="${-pad}" width="${m.width + pad * 2}" height="${m.height + pad * 2}"/>
      ${grat}
      <g>${halo(26, 0.35)}${halo(14, 0.55)}${halo(6, 0.9)}</g>
      ${m.neighbor ? `<path class="map-neighbor" d="${m.neighbor}"/>` : ''}
      <path class="map-land" d="${m.land}"/>
      <g class="map-cities">${cities}</g>
      ${labels}
      <g class="map-swell"></g><g class="map-wind"></g><g class="map-pins"></g>`;
  }

  // ------------------------------------------------------------ dynamic layer
  function zoomK() {
    return vb.w / svg.getBoundingClientRect().width; // svg units per CSS px
  }

  function drawDynamic() {
    if (!state.fc) return;
    const m = MAP_VIEWS[viewId];
    const k = zoomK();
    const i = state.cursor ?? state.nowIdx;
    const sport = state.prefs.sport;
    const list = spots.filter((s) => s.view === viewId && view(s.id).ok);
    const pts = list.map((s) => {
      const [x, y] = project(m, s.lat, s.lon);
      const sc = s.sports[sport] > 0 ? scores(s.id)[i] : null;
      return { s, x, y, sc, day: view(s.id).day[i] };
    });

    // Screen-space clustering (radius ~26 px).
    const R = 26 * k;
    const clusters = [];
    const sorted = pts.slice().sort((a, b) => (b.sc ?? -1) - (a.sc ?? -1));
    for (const p of sorted) {
      const c = clusters.find((cl) => Math.hypot(cl.x - p.x, cl.y - p.y) < R);
      if (c && p.s.id !== selected && c.lead.s.id !== selected) c.members.push(p);
      else clusters.push({ x: p.x, y: p.y, lead: p, members: [p] });
    }

    const pr = 12 * k;
    const pins = clusters.map((cl) => {
      const p = cl.lead;
      const sel = p.s.id === selected;
      const scTxt = p.sc == null ? '–' : p.sc >= 9.95 ? '10' : Math.round(p.sc).toString();
      const cls = p.sc == null ? 'dim sc-0' : scoreClass(p.sc);
      const r = (sel ? 15 : 12) * k;
      const count = cl.members.length > 1
        ? `<circle class="count" cx="${(cl.x + r * 0.85).toFixed(1)}" cy="${(cl.y - r * 0.85).toFixed(1)}" r="${(7 * k).toFixed(1)}"/><text class="count-t" x="${(cl.x + r * 0.85).toFixed(1)}" y="${(cl.y - r * 0.85).toFixed(1)}" style="font-size:${(9 * k).toFixed(1)}px">${cl.members.length}</text>`
        : '';
      const label = `${p.s.name}${cl.members.length > 1 ? ` e mais ${cl.members.length - 1}` : ''}: nota ${p.sc == null ? 'não indicado' : fmtScore(p.sc)}`;
      return `<g class="pin ${cls} ${sel ? 'sel' : ''} ${p.day ? '' : 'night'}" data-pin="${p.s.id}" data-members="${cl.members.map((mm) => mm.s.id).join(',')}" tabindex="0" role="button" aria-label="${escapeHtml(label)}">
        <circle class="ring" cx="${cl.x.toFixed(1)}" cy="${cl.y.toFixed(1)}" r="${(r + 2.2 * k).toFixed(1)}"/>
        <circle class="fill" cx="${cl.x.toFixed(1)}" cy="${cl.y.toFixed(1)}" r="${r.toFixed(1)}"/>
        <text x="${cl.x.toFixed(1)}" y="${cl.y.toFixed(1)}" style="font-size:${((sel ? 13 : 11) * k).toFixed(1)}px">${scTxt}</text>${count}</g>`;
    }).join('');
    svg.querySelector('.map-pins').innerHTML = pins;

    // Swell arrows at the marine sample points (one per cluster lead to stay readable).
    let sw = '';
    let wd = '';
    const L = state.prefs.layers;
    for (const cl of clusters) {
      const s = cl.lead.s;
      const c = condsOf(s.id)[i];
      if (L.swell && isNum(c.swellDir) && isNum(c.swellH) && !s.flat) {
        const [mlat, mlon] = marinePoint(s);
        const [mx, my] = project(m, mlat, mlon);
        // Push the arrow a bit further offshore for legibility.
        const off = 30 * k;
        const ax = mx + Math.sin((s.facing * Math.PI) / 180) * off;
        const ay = my - Math.cos((s.facing * Math.PI) / 180) * off;
        const len = clamp(10 + c.swellH * 9, 12, 46) * k;
        const wdt = clamp(3 + c.swellH * 1.8, 3.5, 9) * k;
        sw += arrowPath(ax, ay, c.swellDir, len, wdt);
      }
      if (L.wind && isNum(c.wind.dir) && isNum(c.wind.kn) && c.wind.kn >= 2) {
        const len = clamp(8 + c.wind.kn * 1.1, 10, 40) * k;
        wd += windPath(cl.x, cl.y, c.wind.dir, len, pr);
      }
    }
    svg.querySelector('.map-swell').innerHTML = sw;
    svg.querySelector('.map-wind').innerHTML = wd;
    svg.querySelector('.map-wind').style.strokeWidth = `${1.6 * k}`;
    svg.querySelectorAll('.map-city').forEach((g) => {
      const t = g.querySelector('text');
      t.style.fontSize = `${11 * k}px`;
      t.style.strokeWidth = `${3 * k}px`;
      const cx = +g.querySelector('circle').getAttribute('cx');
      const cy = +g.querySelector('circle').getAttribute('cy');
      const hit = clusters.some((cl) => cl.x > cx - 16 * k && cl.x < cx + 110 * k && Math.abs(cl.y - cy) < 16 * k);
      g.style.opacity = hit ? '0' : '';
    });
    svg.querySelectorAll('.map-city circle').forEach((c) => c.setAttribute('r', (2.2 * k).toFixed(2)));
    svg.querySelectorAll('.map-grat-lbl').forEach((t) => {
      t.style.fontSize = `${10 * k}px`;
    });
    svg.querySelectorAll('.map-grat').forEach((l) => {
      l.style.strokeWidth = `${k}`;
    });
    svg.querySelector('.map-land').style.strokeWidth = `${0.8 * k}`;
    drawCard();
  }

  function arrowPath(x, y, fromDeg, len, w) {
    // Arrow centred on (x, y) pointing where the swell travels.
    const to = ((fromDeg + 180) * Math.PI) / 180;
    const dx = Math.sin(to);
    const dy = -Math.cos(to);
    const nx = -dy;
    const ny = dx;
    const tipX = x + (dx * len) / 2;
    const tipY = y + (dy * len) / 2;
    const tailX = x - (dx * len) / 2;
    const tailY = y - (dy * len) / 2;
    const hb = w * 1.4;
    const hx = tipX - dx * hb;
    const hy = tipY - dy * hb;
    const f = (n) => n.toFixed(1);
    return `<path d="M${f(tailX + nx * w * 0.3)} ${f(tailY + ny * w * 0.3)}L${f(hx + nx * w * 0.3)} ${f(hy + ny * w * 0.3)}L${f(hx + nx * w)} ${f(hy + ny * w)}L${f(tipX)} ${f(tipY)}L${f(hx - nx * w)} ${f(hy - ny * w)}L${f(hx - nx * w * 0.3)} ${f(hy - ny * w * 0.3)}L${f(tailX - nx * w * 0.3)} ${f(tailY - ny * w * 0.3)}Z"/>`;
  }
  function windPath(x, y, fromDeg, len, r) {
    // Streamline arriving at the pin from the windward side.
    const from = (fromDeg * Math.PI) / 180;
    const dx = Math.sin(from);
    const dy = -Math.cos(from);
    const sx = x + dx * (r + len);
    const sy = y + dy * (r + len);
    const ex = x + dx * (r + 2);
    const ey = y + dy * (r + 2);
    const hx = -dx * (r * 0.45);
    const hy = -dy * (r * 0.45);
    const nx = -dy * r * 0.3;
    const ny = dx * r * 0.3;
    const f = (n) => n.toFixed(1);
    return `<path d="M${f(sx)} ${f(sy)}L${f(ex)} ${f(ey)}M${f(ex - hx + nx)} ${f(ey - hy + ny)}L${f(ex)} ${f(ey)}L${f(ex - hx - nx)} ${f(ey - hy - ny)}"/>`;
  }

  function drawCard() {
    if (!selected || !spotById.has(selected) || spotById.get(selected).view !== viewId) {
      card.hidden = true;
      return;
    }
    const s = spotById.get(selected);
    const i = state.cursor ?? state.nowIdx;
    const c = condsOf(s.id)[i];
    const suited = s.sports[state.prefs.sport] > 0;
    const sc = suited ? evalAt(s.id, i).score : 0;
    card.hidden = false;
    card.innerHTML = `${suited ? scoreBadge(sc, '') : `<span class="score sc-0" aria-hidden="true">–</span>`}
      <div class="row-main"><div class="row-title"><span class="t">${escapeHtml(s.name)}</span></div>
      <div class="row-sub">${escapeHtml(s.area)} · ${suited ? rating(sc).name : `sem ${SPORT[state.prefs.sport].name.toLowerCase()}`}</div>
      <div class="row-meta"><span>${icon('wave', { size: 14 })}${fmtHeightRange(c.face.lo, c.face.hi, state.prefs.hUnit)}</span><span>${icon('wind', { size: 14 })}${fmtWind(c.wind.kn, state.prefs.wUnit)} ${compass(c.wind.dir)} · ${c.wind.rel.short}</span></div></div>
      <a class="btn btn-sm btn-primary" href="#spot-${s.id}" data-open="${s.id}">Abrir</a>
      <button type="button" class="icon-btn" data-close-card aria-label="Fechar">${icon('close', { size: 18 })}</button>`;
  }

  // ------------------------------------------------------------ time scrubber
  function setupRange() {
    if (!state.fc) return;
    range.max = String(state.fc.n - 1);
    range.value = String(state.cursor ?? state.nowIdx);
    let days = '';
    for (let i = 0; i < state.fc.n; i++) {
      const z = zoned(timeOf(i), 'Europe/Lisbon');
      const pos = (i / (state.fc.n - 1)) * 100;
      if (z.h === 0 && pos < 93) days += `<span style="left:${pos.toFixed(2)}%">${fmtDayShort(timeOf(i), 'Europe/Lisbon')}</span>`;
    }
    el.querySelector('[data-days]').innerHTML = days;
    updateTime();
  }
  function updateTime() {
    const i = state.cursor ?? state.nowIdx;
    range.value = String(i);
    const t = timeOf(i);
    const lisbon = 'Europe/Lisbon';
    el.querySelector('[data-time]').innerHTML = `${fmtDay(t, lisbon, timeOf(state.nowIdx))} · ${fmtHour(t, lisbon)}<small>${SPORT[state.prefs.sport].name}</small>`;
  }
  range.addEventListener('input', () => setCursor(+range.value, 'map'));

  function togglePlay(force) {
    playing = force ?? !playing;
    el.querySelector('[data-play]').innerHTML = icon(playing ? 'pause' : 'play', { size: 16 });
    el.querySelector('[data-play]').setAttribute('aria-label', playing ? 'Parar animação' : 'Animar a semana');
    clearInterval(playTimer);
    if (playing) {
      playTimer = setInterval(() => {
        const next = (state.cursor ?? 0) + 1;
        setCursor(next >= state.fc.n ? state.nowIdx : next, 'play');
      }, 220);
    }
  }

  // ------------------------------------------------------------ pan & zoom
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let moved = false;

  function clientToSvg(cx, cy) {
    const r = svg.getBoundingClientRect();
    return [vb.x + ((cx - r.left) / r.width) * vb.w, vb.y + ((cy - r.top) / r.height) * vb.h];
  }
  function zoomAt(factor, cx, cy) {
    const m = MAP_VIEWS[viewId];
    const minW = m.width / 14;
    const maxW = fitBox(fullBox(viewId)).w * 1.15;
    const nw = clamp(vb.w / factor, minW, maxW);
    const f = vb.w / nw;
    const [px, py] = cx == null ? [vb.x + vb.w / 2, vb.y + vb.h / 2] : clientToSvg(cx, cy);
    vb = { x: px - (px - vb.x) / f, y: py - (py - vb.y) / f, w: nw, h: vb.h / f };
    clampVB();
    applyVB();
  }
  function clampVB() {
    const m = MAP_VIEWS[viewId];
    const mx = m.width * 0.25;
    const my = m.height * 0.25;
    vb.x = clamp(vb.x, -mx - Math.max(0, vb.w - m.width) / 2, m.width + mx - vb.w + Math.max(0, vb.w - m.width) / 2);
    vb.y = clamp(vb.y, -my - Math.max(0, vb.h - m.height) / 2, m.height + my - vb.h + Math.max(0, vb.h - m.height) / 2);
  }

  svg.addEventListener('pointerdown', (e) => {
    svg.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vb: { ...vb } };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), vb: { ...vb }, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag = null;
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      vb = { ...pinch.vb };
      zoomAt(d / pinch.d, pinch.cx, pinch.cy);
      moved = true;
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      svg.classList.add('dragging');
      vb = { ...drag.vb, x: drag.vb.x - (dx / r.width) * drag.vb.w, y: drag.vb.y - (dy / r.height) * drag.vb.h };
      clampVB();
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      svg.classList.remove('dragging');
      if (drag && moved) applyVB();
      else if (!moved) {
        const pin = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-pin]');
        if (pin) selectPin(pin);
        else {
          selected = null;
          drawDynamic();
        }
      }
      drag = null;
    }
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
  }, { passive: false });
  svg.addEventListener('dblclick', (e) => zoomAt(1.8, e.clientX, e.clientY));
  svg.addEventListener('keydown', (e) => {
    const pin = e.target.closest?.('[data-pin]');
    if (pin && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      selectPin(pin);
      return;
    }
    const step = vb.w * 0.12;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key] && !pin) {
      e.preventDefault();
      vb.x += moves[e.key][0];
      vb.y += moves[e.key][1];
      clampVB();
      applyVB();
    } else if (e.key === '+' || e.key === '=') zoomAt(1.5);
    else if (e.key === '-') zoomAt(1 / 1.5);
  });

  function selectPin(pin) {
    const members = pin.dataset.members.split(',');
    if (members.length > 1 && zoomK() > 0.35) {
      // Zoom into the cluster instead of picking one spot.
      const m = MAP_VIEWS[viewId];
      const pts = members.map((id) => project(m, spotById.get(id).lat, spotById.get(id).lon));
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const pad = 30;
      vb = fitBox({ x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(60, Math.max(...xs) - Math.min(...xs) + pad * 2), h: Math.max(60, Math.max(...ys) - Math.min(...ys) + pad * 2) });
      clampVB();
      applyVB();
      return;
    }
    selected = pin.dataset.pin;
    drawDynamic();
  }

  // ------------------------------------------------------------ controls
  el.addEventListener('click', (e) => {
    const t = e.target;
    const v = t.closest('[data-view]');
    if (v) {
      viewId = v.dataset.view;
      el.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === viewId)));
      selected = null;
      drawBase();
      vb = fitBox(fullBox(viewId));
      applyVB();
      return;
    }
    const layer = t.closest('[data-layer]');
    if (layer) {
      const layers = { ...state.prefs.layers, [layer.dataset.layer]: !state.prefs.layers[layer.dataset.layer] };
      layer.setAttribute('aria-pressed', String(layers[layer.dataset.layer]));
      setPref('layers', layers);
      return;
    }
    const z = t.closest('[data-zoom]');
    if (z) {
      zoomAt(+z.dataset.zoom);
      return;
    }
    if (t.closest('[data-reset]')) {
      vb = fitBox(fullBox(viewId));
      applyVB();
      return;
    }
    if (t.closest('[data-play]')) {
      togglePlay();
      return;
    }
    if (t.closest('[data-close-card]')) {
      selected = null;
      drawDynamic();
      return;
    }
    const open = t.closest('[data-open]');
    if (open) {
      e.preventDefault();
      togglePlay(false);
      go('spot', open.dataset.open);
    }
  });

  function init() {
    drawBase();
    if (selected) {
      const s = spotById.get(selected);
      const [x, y] = project(MAP_VIEWS[viewId], s.lat, s.lon);
      vb = fitBox({ x: x - 90, y: y - 90, w: 180, h: 180 });
    } else vb = fitBox(fullBox(viewId));
    lastW = svg.getBoundingClientRect().width;
    applyVB();
    setupRange();
  }

  // Keep the centre and scale when the element resizes (rotation, sidebar…).
  let lastW = 0;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    const r = svg.getBoundingClientRect();
    if (!vb || !r.width || !lastW) {
      lastW = r.width;
      return;
    }
    const k = vb.w / lastW;
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    vb = { x: cx - (r.width * k) / 2, y: cy - (r.height * k) / 2, w: r.width * k, h: r.height * k };
    lastW = r.width;
    applyVB();
  }) : null;

  requestAnimationFrame(() => {
    init();
    ro?.observe(svg);
  });

  return {
    update(what) {
      if (!vb) return;
      if (what === 'data') {
        setupRange();
        drawDynamic();
        return;
      }
      if (what === 'cursor') {
        updateTime();
        drawDynamic();
        return;
      }
      if (['sport', 'level', 'prefs', 'tick', 'theme'].includes(what)) {
        updateTime();
        drawDynamic();
      }
    },
    unmount() {
      togglePlay(false);
      ro?.disconnect();
    },
  };
}
