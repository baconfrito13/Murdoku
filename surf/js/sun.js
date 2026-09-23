// Sunrise / sunset and civil twilight (first & last light) from the standard
// sunrise equation (≈1 min accuracy at Portuguese latitudes). Epoch seconds.

const rad = Math.PI / 180;
const J2000 = 2451545.0;

function solarTransit(dayJd, lon) {
  const n = Math.round(dayJd - J2000 + 0.0008);
  const jStar = n - lon / 360; // lon east-positive
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = J2000 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const dec = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad));
  return { transit, dec };
}

const jdToSec = (jd) => (jd - 2440587.5) * 86400;

function hourAngle(altDeg, lat, dec) {
  const c = (Math.sin(altDeg * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
  if (c <= -1) return 180; // never sets below that altitude
  if (c >= 1) return 0; // never rises above it
  return Math.acos(c) / rad;
}

/**
 * Sun events for the local day whose (UTC) noon is near `noonSec`.
 * Returns epoch seconds: { dawn, rise, noon, set, dusk }.
 */
export function sunEvents(noonSec, lat, lon) {
  const dayJd = noonSec / 86400 + 2440587.5;
  const { transit, dec } = solarTransit(dayJd, lon);
  const w0 = hourAngle(-0.833, lat, dec);
  const w6 = hourAngle(-6, lat, dec);
  return {
    dawn: jdToSec(transit - w6 / 360),
    rise: jdToSec(transit - w0 / 360),
    noon: jdToSec(transit),
    set: jdToSec(transit + w0 / 360),
    dusk: jdToSec(transit + w6 / 360),
  };
}

/** Solar elevation (degrees) at an instant — used to tint the ocean hero. */
export function sunAltitude(sec, lat, lon) {
  const d = sec / 86400 + 2440587.5 - J2000;
  const M = (357.5291 + 0.98560028 * d) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const ra = Math.atan2(Math.sin(L * rad) * Math.cos(23.4397 * rad), Math.cos(L * rad));
  const theta = (280.16 + 360.9856235 * d + lon) * rad; // sidereal time
  const H = theta - ra;
  const alt = Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(H));
  return alt / rad;
}
