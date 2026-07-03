// Daily + random cases, generated in the browser and always verified unique.
// Browser generation is capped at 6×6 (7×7 generation is precomputed offline
// for the campaign instead — it can take a minute).

import { generateCase } from './engine/generator.js';
import { THEMES, TROUPE, pickTroupe } from './roster.js';
import { Rng } from './engine/rng.js';

const VICTIM_POOL = [
  { id: 'v_daily1', g: 'm', name: 'Mayor Cornelius Vex', role: 'the untouchable mayor', emoji: '🎩' },
  { id: 'v_daily2', g: 'f', name: 'Grand Duchess Milla', role: 'the exiled duchess', emoji: '👑' },
  { id: 'v_daily3', g: 'm', name: 'Silas Copperfield', role: 'the pawnbroker', emoji: '🪙' },
  { id: 'v_daily4', g: 'f', name: 'Nurse Beatrix Hollow', role: 'the night nurse', emoji: '🌙' },
  { id: 'v_daily5', g: 'm', name: 'Redmond Ledger', role: 'the bookmaker', emoji: '📒' },
  { id: 'v_daily6', g: 'f', name: 'Miss Juniper Vale', role: 'the fortune teller', emoji: '🔮' },
];

const INTROS = [
  'The invitation said “an evening to die for”. Somebody took it literally. Reconstruct where every guest stood when the scream rang out.',
  'The doors were locked from the inside and the clock had stopped. Everyone remembers exactly where they were — and they are all telling the truth. That is the problem.',
  'One flash of lightning, one thud, one body. The witnesses agree on everything except who to blame. The map remembers what people forget.',
  'By the time the constable arrived, everyone had a story and nobody had moved. Match every statement to a square and the room itself will point a finger.',
];

const REVEALS = [
  'Confronted with your map, {murderer} stopped smiling. The layout allowed no other truth: only {murderer} was alone with the victim when it happened.',
  'A hush, then a confession. {murderer} had counted on the confusion of the crowd — but rows and columns do not get confused.',
  'The constable tips his hat. Every statement true, every square accounted for, and just one person alone with the victim: {murderer}.',
];

export function dateSeed(d = new Date()) {
  return `daily-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function makeDailyCase(date = new Date()) {
  return makeSeededCase(dateSeed(date), {
    id: `daily-${dateSeed(date)}`,
    kind: 'daily',
  });
}

export function makeRandomCase() {
  const seed = `random-${Math.floor(Math.random() * 1e9)}`;
  return makeSeededCase(seed, { id: seed, kind: 'random' });
}

function makeSeededCase(seed, { id, kind }) {
  const rng = new Rng(`${seed}-meta`);
  const themeKey = rng.pick(Object.keys(THEMES));
  const size = rng.pick([5, 6, 6]); // browser-friendly sizes, bias to 6
  const difficulty = rng.pick(['easy', 'medium', 'medium']);
  const suspects = rng.shuffle(TROUPE.map((t) => t.id)).slice(0, size - 1);
  const victim = { ...rng.pick(VICTIM_POOL), isVictim: true, color: '#94a3b8' };
  const introIdx = rng.int(INTROS.length);
  const revealIdx = rng.int(REVEALS.length);
  const themeName = themeKey[0].toUpperCase() + themeKey.slice(1);

  // English fallback story lives on the case; the UI renders titles/intros/
  // reveals via i18n using `meta`, so generated cases translate too.
  const story = {
    title: `Death at the ${themeName}`,
    intro: INTROS[introIdx],
    reveal: REVEALS[revealIdx],
  };

  // The generator retries internally; try a couple of meta-seeds too so this
  // never fails in practice.
  for (let bump = 0; bump < 5; bump++) {
    const cse = generateCase({
      id: `${id}${bump ? `-${bump}` : ''}`,
      seed: `${seed}-${bump}`,
      size,
      theme: THEMES[themeKey],
      people: [...pickTroupe(suspects), victim],
      story,
      difficulty,
    });
    if (cse) {
      cse.difficulty = difficulty;
      cse.title = story.title;
      cse.meta = { kind, themeKey, introIdx, revealIdx };
      return cse;
    }
  }
  return null;
}
