// Animated ocean vignette: the sky follows the sun's real altitude at the spot,
// swell lines take their height and spacing from the forecast face height and
// period, and wind shows up as streaks, whitecaps or offshore spray.

import { clamp, isNum, lerp } from '../util.js';
import { sunAltitude } from '../sun.js';

/** Ocean parameters for a spot's conditions `c` at instant `t` (epoch s). */
export function oceanParams(spot, c, t) {
  const flow = (c.wind.dir ?? 0) + 180; // where the wind blows to
  const cross = Math.sin(((flow - spot.facing) * Math.PI) / 180); // + = left→right looking out to sea
  const ang = c.wind.rel?.angle;
  return {
    face: isNum(c.face.mid) ? c.face.mid : 0,
    period: isNum(c.period) ? c.period : 8,
    windKn: isNum(c.wind.kn) ? c.wind.kn : 0,
    windCross: cross,
    offshore: isNum(ang) ? (1 + Math.cos((ang * Math.PI) / 180)) / 2 : 0.5,
    sunAlt: sunAltitude(t, spot.lat, spot.lon),
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const PALETTES = {
  night: { skyTop: '#050d17', skyLow: '#0f2236', seaFar: '#11283f', seaNear: '#07121e', sun: '#dfe8f2', foam: 0.35 },
  twilight: { skyTop: '#1d3150', skyLow: '#f0a45c', seaFar: '#3b5a7a', seaNear: '#10263d', sun: '#ffd28a', foam: 0.7 },
  day: { skyTop: '#6ea8d8', skyLow: '#dcebf3', seaFar: '#5598e7', seaNear: '#123f78', sun: '#fff6d8', foam: 0.95 },
};
function palette(alt) {
  const P = {};
  const pick = (a, b, t) => {
    for (const k of Object.keys(PALETTES.day)) {
      if (k === 'foam') P[k] = lerp(PALETTES[a][k], PALETTES[b][k], t);
      else P[k] = mix(hex(PALETTES[a][k]), hex(PALETTES[b][k]), t);
    }
  };
  if (alt <= -8) pick('night', 'night', 0);
  else if (alt <= -2) pick('night', 'twilight', (alt + 8) / 6);
  else if (alt <= 8) pick('twilight', 'day', (alt + 2) / 10);
  else pick('day', 'day', 0);
  return P;
}

export function createOcean(canvas, initial = {}) {
  const ctx = canvas.getContext('2d');
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const p = { face: 1, period: 10, windKn: 6, windCross: 0.3, offshore: 0.5, sunAlt: 30, ...initial };
  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let visible = true;
  let alive = true;
  const start = performance.now();
  const streaks = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), l: 0.4 + Math.random() * 0.6, s: 0.6 + Math.random() * 0.8 }));
  const caps = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * 6.28 }));

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    if (!W) resize();
    const P = palette(p.sunAlt);
    const horizon = H * 0.4;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, rgb(P.skyTop));
    sky.addColorStop(1, rgb(P.skyLow));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 1);

    // Sun or moon
    const up = p.sunAlt > -4;
    const sx = W * 0.8;
    const sy = up ? horizon - clamp((p.sunAlt + 4) / 55, 0, 1) * horizon * 0.82 + 6 : horizon * 0.32;
    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, up ? 60 : 36);
    glow.addColorStop(0, rgb(P.sun, up ? 0.55 : 0.25));
    glow.addColorStop(1, rgb(P.sun, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 70, sy - 70, 140, 140);
    ctx.fillStyle = rgb(P.sun, up ? 0.95 : 0.8);
    ctx.beginPath();
    ctx.arc(sx, sy, up ? 11 : 8, 0, Math.PI * 2);
    ctx.fill();

    // Wind streaks in the sky (direction = cross-shore component)
    const wk = clamp(p.windKn / 25, 0, 1);
    if (p.windKn > 3) {
      ctx.strokeStyle = rgb([255, 255, 255], 0.12 + wk * 0.3);
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      const dir = p.windCross >= 0 ? 1 : -1;
      for (const s of streaks) {
        const v = (0.02 + wk * 0.12) * s.s;
        const x = (((s.x + dir * v * t) % 1) + 1) % 1;
        const y = s.y * horizon * 0.85 + 4;
        const len = (14 + wk * 40) * s.l;
        ctx.beginPath();
        ctx.moveTo(x * (W + 80) - 40, y);
        ctx.lineTo(x * (W + 80) - 40 - dir * len, y);
        ctx.stroke();
      }
    }

    // Sea base
    const sea = ctx.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, rgb(P.seaFar));
    sea.addColorStop(1, rgb(P.seaNear));
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, W, H - horizon);

    // Swell lines, far → near
    const face = clamp(p.face || 0, 0, 5);
    const per = clamp(p.period || 8, 4, 20);
    const baseA = (0.8 + face * 5.2) * (H / 180);
    const layers = 6;
    for (let k = 0; k < layers; k++) {
      const depth = k / (layers - 1);
      const yb = horizon + (H - horizon) * (0.08 + 0.17 * k);
      const A = baseA * (0.18 + 0.82 * depth ** 1.3);
      const lambda = W * (0.16 + per / 55) * (0.55 + 0.6 * depth);
      const speed = (10 + 26 * depth) * (per / 10) ** 0.5;
      const phase = (t * speed) / lambda;
      const col = mix(P.seaFar, P.seaNear, 0.15 + depth * 0.85);
      ctx.beginPath();
      ctx.moveTo(0, H);
      const step = Math.max(3, W / 120);
      const pts = [];
      for (let x = 0; x <= W + step; x += step) {
        const u = x / lambda - phase + k * 0.37;
        const s = (1 + Math.sin(u * Math.PI * 2)) / 2;
        const y = yb - A * s ** 2.2 + Math.sin(u * 5.1 + k) * A * 0.06;
        pts.push([x, y, s]);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = rgb(col);
      ctx.fill();
      // Foam on crests of the nearer lines
      if (face > 0.35 && depth > 0.3) {
        ctx.strokeStyle = rgb([255, 255, 255], P.foam * clamp(face / 2.2, 0.15, 0.85) * depth);
        ctx.lineWidth = 1 + depth * 1.6;
        ctx.beginPath();
        let on = false;
        for (const [x, y, s] of pts) {
          if (s > 0.86) {
            if (!on) ctx.moveTo(x, y + 0.5);
            else ctx.lineTo(x, y + 0.5);
            on = true;
          } else on = false;
        }
        ctx.stroke();
        // Offshore spray blown back off the crests
        if (p.offshore > 0.6 && p.windKn > 7 && depth > 0.55) {
          ctx.fillStyle = rgb([255, 255, 255], 0.28 * P.foam);
          for (const [x, y, s] of pts) {
            if (s > 0.93 && ((x * 7.3) | 0) % 3 === 0) {
              const lift = 4 + wk * 10;
              ctx.beginPath();
              ctx.ellipse(x - 3, y - lift * 0.6, 6 + wk * 6, 1.6, -0.3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    // Whitecaps when the wind is strong
    if (p.windKn > 12) {
      const n = Math.round(caps.length * clamp((p.windKn - 12) / 18, 0, 1));
      ctx.fillStyle = rgb([255, 255, 255], 0.5 * P.foam);
      for (let i = 0; i < n; i++) {
        const c = caps[i];
        const a = (Math.sin(t * 1.3 + c.ph) + 1) / 2;
        if (a < 0.55) continue;
        const x = c.x * W;
        const y = horizon + 6 + c.y * (H - horizon - 10);
        ctx.fillRect(x, y, 3 + a * 6, 1.4);
      }
    }
  }

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    if (now - last < 33) return; // ~30 fps is plenty
    last = now;
    draw((now - start) / 1000);
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    resize();
    draw((performance.now() - start) / 1000);
  }) : null;
  ro?.observe(canvas);
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
  }) : null;
  io?.observe(canvas);

  resize();
  draw(0);
  if (!reduced) raf = requestAnimationFrame(frame);

  return {
    set(next) {
      Object.assign(p, next);
      if (reduced) draw(0);
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
    },
  };
}
