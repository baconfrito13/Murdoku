// Inline SVG icon set (24×24, stroke = currentColor). Sport pictograms are
// drawn for this app: board shapes, kite canopy, sail, wing, paddle.

const P = {
  now: '<path d="M3 16c2 0 2.5-2 4.5-2S10 16 12 16s2.5-2 4.5-2 2.5 2 4.5 2"/><path d="M3 20c2 0 2.5-2 4.5-2S10 20 12 20s2.5-2 4.5-2 2.5 2 4.5 2"/><circle cx="12" cy="8" r="3"/><path d="M12 2.5v1.2M6.3 4.8l.9.9M17.7 4.8l-.9.9M4 9.5h1.3M18.7 9.5H20"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><circle cx="4.5" cy="6.5" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17.5" r="1"/>',
  star: '<path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  'star-fill': '<path fill="currentColor" d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2.6-1.5L14.2 2.6h-4l-.3 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.3-1c.8.7 1.6 1.2 2.6 1.5l.3 2.5h4l.3-2.5c1-.3 1.8-.8 2.6-1.5l2.3 1 2-3.4z"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  'chev-right': '<path d="m9 5 7 7-7 7"/>',
  'chev-down': '<path d="m5 9 7 7 7-7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
  play: '<path fill="currentColor" stroke="none" d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  share: '<path d="M12 3.5v11M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
  external: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 3.8v4.6h-4.6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.2"/>',
  wave: '<path d="M2.5 15.5c3.2 0 3.6-7.5 8.6-7.5 3 0 4.1 2.6 3 4.2-.9 1.3-3 .8-2.9-.9"/><path d="M2.5 19.5c2.2 0 2.6-1.6 4.7-1.6s2.5 1.6 4.8 1.6 2.6-1.6 4.8-1.6 2.5 1.6 4.7 1.6"/>',
  wind: '<path d="M3 9h11.5a2.8 2.8 0 1 0-2.8-2.8"/><path d="M3 13.5h15.5a2.8 2.8 0 1 1-2.8 2.8"/><path d="M3 18h7"/>',
  tide: '<path d="M3 13c3 0 3.5-3 6-3s3 6 6 6 3.5-3 6-3"/><path d="M12 3v4M10 5l2 2 2-2"/><path d="M3 20h18"/>',
  thermo: '<path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  sunrise: '<path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0"/><path d="M12 3.5v5M9.5 6 12 3.5 14.5 6M4 11.5l1.3 1.3M20 11.5l-1.3 1.3"/>',
  sunset: '<path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0"/><path d="M12 8.5v-5M9.5 6 12 8.5 14.5 6M4 11.5l1.3 1.3M20 11.5l-1.3 1.3"/>',
  cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 18.5z"/>',
  'sun-cloud': '<path d="M8.5 19h9a3.5 3.5 0 0 0 .5-7 4.8 4.8 0 0 0-9.2 1A3 3 0 0 0 8.5 19z"/><path d="M6.2 11.3A3.5 3.5 0 1 1 11 6.8M6.5 2.8v1.2M2 7.3h1.2M3.3 4.1l.8.8"/>',
  rain: '<path d="M7 15.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 15.5z"/><path d="m8.5 18.5-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2"/>',
  storm: '<path d="M7 15h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 15z"/><path d="m12.5 15.5-2 3.5h3l-2 3.5"/>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 0 1 5.5 5"/>',
  board: '<path d="M12 2.8c3 3.2 3.6 8.4 2.6 13-.5 2.2-1.4 4-2.6 5.4-1.2-1.4-2.1-3.2-2.6-5.4-1-4.6-.4-9.8 2.6-13z"/><path d="M12 5.5v13"/>',
  suit: '<path d="M9 3.5h6l1.5 3 2 13.5h-4.2L12 11l-2.3 9H5.5l2-13.5z"/><path d="M12 3.5v3"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m14.8 9.2-1.9 3.7-3.7 1.9 1.9-3.7z"/>',
  layers: '<path d="m12 3.5 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
  // ---- sports
  surf: '<path d="M5.2 18.8C7.3 12.6 12.4 6.6 18.6 3.6c.9-.4 1.6.3 1.3 1.2-2.4 6.3-7.7 11.8-14 14.6-.5.2-.9-.2-.7-.6z"/><path d="M8.8 15.2l3 3"/><path d="M2.5 21.5c1.4 0 1.9-.9 3.3-.9s1.9.9 3.3.9"/>',
  bodyboard: '<path d="M7.5 3.5h9a2.5 2.5 0 0 1 2.5 2.5v11.5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2.5 2.5 0 0 1 2.5-2.5z"/><path d="M5 8.2c2.3 1 11.7 1 14 0"/><path d="M12 17.5v3"/>',
  kitesurf: '<path d="M3.5 8.5C6 4.8 9 3.5 12 3.5s6 1.3 8.5 5l-2.6 1.2C16 7.5 14 6.7 12 6.7s-4 .8-5.9 3L3.5 8.5z"/><path d="M4.8 9.1 12 19.5l7.2-10.4"/><path d="M10 20.5h4"/>',
  windsurf: '<path d="M11 3v14"/><path d="M11 3.5c3.6 3.2 5.8 7.4 6.5 12.5H11"/><path d="M11 6.5 6.5 13"/><path d="M4 19.5h15.5a1 1 0 0 1-.8 1H5a1 1 0 0 1-1-1z"/>',
  wingfoil: '<path d="M3.5 12.5C4.2 7.3 8 4 12 4s7.8 3.3 8.5 8.5c-2.4-1.5-5.2-2.3-8.5-2.3s-6.1.8-8.5 2.3z"/><path d="M12 10.2v6.3"/><path d="M8 17.5h8M12 16.5v3.5M9.5 20h5"/>',
  sup: '<path d="M3 17.5h15.5c1.4 0 2.5-.6 2.5-1.2s-1.1-1.3-2.5-1.3H3z"/><path d="M15.5 3 11 15"/><path d="M14.7 2.2 16.6 3l-.9 2.5-1.9-.7z"/>',
};

export function icon(name, { size = 20, cls = '', label = '', stroke = 1.8 } = {}) {
  const body = P[name] || P.info;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}

/** Direction arrow pointing where the flow is GOING (from `deg` + 180). */
export function dirArrow(deg, { size = 16, cls = '', label = '' } = {}) {
  const rot = Number.isFinite(deg) ? (deg + 180) % 360 : 0;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="dir-arrow ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" ${a11y}><g transform="rotate(${rot.toFixed(0)} 12 12)"><path d="M12 3.5 17.5 18 12 14.8 6.5 18z" fill="currentColor"/></g></svg>`;
}
