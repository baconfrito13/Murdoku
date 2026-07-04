// Offline-first service worker: cache-first for same-origin assets, with the
// cache name versioned so deploys invalidate cleanly.
const CACHE = 'murdoku-v3';
const CORE = [
  './', 'index.html', 'manifest.json', 'icon.svg',
  'css/font.css', 'css/style.css',
  'js/main.js', 'js/daily.js', 'js/roster.js', 'js/cases-data.js',
  'js/i18n.js', 'js/icons.js',
  'js/engine/rng.js', 'js/engine/model.js', 'js/engine/clues.js',
  'js/engine/solver.js', 'js/engine/generator.js',
  'js/ui/dom.js', 'js/ui/state.js', 'js/ui/board.js', 'js/ui/cards.js',
  'js/ui/game.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit
      ?? fetch(e.request).then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })),
  );
});
