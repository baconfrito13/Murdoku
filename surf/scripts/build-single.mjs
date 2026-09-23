// Bundles Maresia into ONE self-contained HTML file: every ES module wrapped in
// its own function scope (imports/exports rewired through a module table, in
// dependency order), CSS inlined and the forecast snapshot embedded as the
// offline fallback. No build tools needed.
//
//   node surf/scripts/build-single.mjs            → surf/dist/maresia.html (full document)
//   node surf/scripts/build-single.mjs --fragment → surf/dist/maresia-fragment.html
//     (no <html>/<head>/<body> wrappers, for hosts that supply their own skeleton)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fragment = process.argv.includes('--fragment');
const read = (p) => readFileSync(join(root, p), 'utf8');

const IMPORT_RE = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm;
const BARE_IMPORT_RE = /^import\s+['"]([^'"]+)['"];?[ \t]*$/gm;

function resolve(from, spec) {
  return normalize(join(dirname(from), spec)).replace(/\\/g, '/');
}

// ---- collect modules in dependency order (DFS post-order), reject cycles
const order = [];
const state = new Map();
function visit(path, stack = []) {
  if (state.get(path) === 'done') return;
  if (state.get(path) === 'active') throw new Error(`import cycle: ${[...stack, path].join(' → ')}`);
  state.set(path, 'active');
  const src = read(path);
  for (const m of src.matchAll(IMPORT_RE)) visit(resolve(path, m[2]), [...stack, path]);
  for (const m of src.matchAll(BARE_IMPORT_RE)) visit(resolve(path, m[1]), [...stack, path]);
  state.set(path, 'done');
  order.push(path);
}
visit('js/main.js');

// ---- rewrite one module into a factory body
function transform(path, src) {
  const exported = [];
  let code = src.replace(IMPORT_RE, (_, clause, spec) => {
    const dep = JSON.stringify(resolve(path, spec));
    clause = clause.trim();
    const ns = clause.match(/^\*\s+as\s+(\w+)$/);
    if (ns) return `const ${ns[1]} = __m[${dep}];`;
    const named = clause.match(/^\{([\s\S]*)\}$/);
    if (!named) throw new Error(`${path}: unsupported import "${clause}"`);
    const parts = named[1].split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => {
        const [a, b] = s.split(/\s+as\s+/);
        return b ? `${a}: ${b}` : a;
      });
    return `const { ${parts.join(', ')} } = __m[${dep}];`;
  });
  code = code.replace(BARE_IMPORT_RE, '');
  code = code.replace(/^export\s+(async\s+function|function|const|let|class)\s+(\w+)/gm, (_, kind, name) => {
    exported.push([name, name]);
    return `${kind} ${name}`;
  });
  code = code.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_, list) => {
    for (const s of list.split(',').map((x) => x.trim()).filter(Boolean)) {
      const [a, b] = s.split(/\s+as\s+/);
      exported.push([b || a, a]);
    }
    return '';
  });
  if (/^\s*(import|export)\s/m.test(code)) throw new Error(`${path}: leftover import/export syntax`);
  const ret = exported.map(([pub, local]) => (pub === local ? pub : `${pub}: ${local}`)).join(', ');
  return `// ---- ${path}\n__m[${JSON.stringify(path)}] = (function () {\n${code}\nreturn { ${ret} };\n})();\n`;
}

const bundle = `(function () {\n'use strict';\nconst __m = Object.create(null);\n${order.map((p) => transform(p, read(p))).join('\n')}\n})();`;
new Function(bundle); // syntax check (throws on error)

// ---- assemble HTML
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script type="module" src="js\/main.js"><\/script>/, '')
  .trim();
const css = read('css/app.css');
const iconSvg = existsSync(join(root, 'icon.svg')) ? read('icon.svg') : '';
const iconHref = iconSvg ? `data:image/svg+xml,${encodeURIComponent(iconSvg)}` : '';
const snapPath = join(root, 'data', 'snapshot.json');
const snapshot = existsSync(snapPath) ? readFileSync(snapPath, 'utf8') : 'null';
const safeJson = snapshot.replace(/</g, '\\u003c');

const head = `<title>Maresia</title>
<meta name="description" content="Onde surfar hoje em Portugal: previsão de ondas, vento e marés spot a spot, com notas para surf, bodyboard, kitesurf, windsurf, wing foil e SUP.">
${iconHref ? `<link rel="icon" href="${iconHref}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Big+Shoulders+Display:wght@600;800;900&display=swap">
<style>
${css}
</style>`;

const scripts = `<script>window.__MARESIA_BUNDLE__ = true;</script>
<script id="maresia-snapshot" type="application/json">${safeJson}</script>
<script>try { window.__MARESIA_SNAPSHOT__ = JSON.parse(document.getElementById('maresia-snapshot').textContent); } catch (e) { window.__MARESIA_SNAPSHOT__ = null; }</script>
<script>
${bundle}
</script>`;

const doc = fragment
  ? `${head}\n${body}\n${scripts}\n`
  : `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
${head}
</head>
<body>
${body}
${scripts}
</body>
</html>
`;

const outDir = join(root, 'dist');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, fragment ? 'maresia-fragment.html' : 'maresia.html');
writeFileSync(outFile, doc);
console.log(`${relative(process.cwd(), outFile)}: ${order.length} modules, ${(doc.length / 1024).toFixed(0)} KiB (snapshot ${(snapshot.length / 1024).toFixed(0)} KiB)`);
