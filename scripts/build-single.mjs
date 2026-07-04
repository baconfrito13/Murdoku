// Bundles the whole game into ONE self-contained HTML file (no build tools):
// flattens the ES modules in dependency order, strips import/export syntax,
// and inlines the CSS. Output: dist/murdoku-standalone.html
// Run: node scripts/build-single.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// Dependency order: leaves first.
const MODULES = [
  'js/engine/rng.js',
  'js/engine/model.js',
  'js/i18n.js',
  'js/icons.js',
  'js/engine/clues.js',
  'js/engine/solver.js',
  'js/engine/generator.js',
  'js/roster.js',
  'js/cases-data.js',
  'js/daily.js',
  'js/ui/dom.js',
  'js/ui/state.js',
  'js/ui/board.js',
  'js/ui/cards.js',
  'js/ui/game.js',
  'js/main.js',
];

function flatten(src, name) {
  const out = src
    // drop import lines (single or multi-line)
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];\s*$/gm, '')
    // strip export keywords but keep declarations
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+(const|let|var|function|class|async function)/gm, '$1')
    // drop bare re-export statements like `export { a, b };`
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  return `// ---------- ${name} ----------\n${out}`;
}

const bundle = MODULES.map((m) => flatten(read(m), m)).join('\n');

// Sanity: no import/export syntax left.
if (/^\s*(import|export)\s/m.test(bundle)) {
  throw new Error('bundle still contains import/export syntax');
}
// Sanity: parses as a <script> (non-module) program.
new Function(bundle); // throws on syntax error

// Extract the <body> content of index.html (minus the module script tag).
const html = read('index.html');
const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script type="module" src="js\/main.js"><\/script>/, '')
  .trim();

const css = read('css/font.css') + '\n' + read('css/style.css');

const single = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<title>Murdoku — Murder Mystery Logic Puzzles</title>
<style>
${css}
</style>
</head>
<body>
${body}
<script>
(function () {
${bundle}
})();
</script>
</body>
</html>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'murdoku-standalone.html'), single);
console.log(`dist/murdoku-standalone.html written (${(single.length / 1024).toFixed(0)} KiB)`);
