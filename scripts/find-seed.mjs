// One-off: search working seeds for a brief that fails to generate.
// Usage: node scripts/find-seed.mjs c08
import { generateCase } from '../js/engine/generator.js';
import { countSolutions, logicSolve, murdererOfSolution } from '../js/engine/solver.js';
import { THEMES, CAMPAIGN_BRIEFS, pickTroupe } from '../js/roster.js';

const id = process.argv[2] ?? 'c08';
const brief = CAMPAIGN_BRIEFS.find((b) => b.id === id);
const people = [...pickTroupe(brief.suspects), brief.victim];

for (let i = 0; i < 40; i++) {
  const seed = `${brief.seed}-v${i}`;
  const t0 = Date.now();
  const cse = generateCase({
    id: brief.id, seed, size: brief.size, theme: THEMES[brief.theme],
    people, story: brief.story, difficulty: brief.difficulty,
  });
  const ms = Date.now() - t0;
  if (!cse) { console.log(`${seed}: fail (${ms}ms)`); continue; }
  const unique = countSolutions(cse, { limit: 3 }).length === 1;
  const fair = logicSolve(cse).solved;
  const murderer = murdererOfSolution(cse);
  console.log(`${seed}: OK ${cse.clues.length} clues, unique=${unique}, fair=${fair}, murderer=${murderer} (${ms}ms)`);
  if (unique && fair && murderer) { console.log(`WINNER: ${seed}`); process.exit(0); }
}
console.log('no seed found');
process.exit(1);
