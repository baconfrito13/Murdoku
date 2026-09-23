// Fetches the live Open-Meteo forecast for every spot and stores it as the
// bundled fallback (surf/data/snapshot.json). The app uses it only when the
// live API and the local cache are both unavailable.
// Run: node surf/scripts/snapshot.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS } from '../js/spots.js';
import { fetchLive } from '../js/forecast.js';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'snapshot.json');
const fc = await fetchLive(SPOTS);
mkdirSync(dirname(out), { recursive: true });
const json = JSON.stringify(fc);
writeFileSync(out, json);
console.log(`snapshot: ${SPOTS.length} spots, ${fc.n} h from ${new Date(fc.t0 * 1000).toISOString()}, ${(json.length / 1024).toFixed(0)} KiB → ${out}`);
