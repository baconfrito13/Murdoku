// Maresia service worker: the app shell is served stale-while-revalidate so the
// app opens instantly (and offline); forecast data lives in localStorage and
// cross-origin requests (Open-Meteo, fonts) go straight to the network.
const CACHE = 'maresia-v1';
const CORE = [
  './', 'index.html', 'manifest.json', 'icon.svg', 'css/app.css',
  'js/main.js', 'js/core.js', 'js/util.js', 'js/sun.js', 'js/tide.js', 'js/model.js', 'js/insights.js',
  'js/forecast.js', 'js/spots.js', 'js/geo.js', 'js/icons.js',
  'js/ui/components.js', 'js/ui/ocean.js', 'js/ui/chart.js', 'js/ui/compass.js', 'js/ui/agora.js',
  'js/ui/mapa.js', 'js/ui/costa.js', 'js/ui/spots.js', 'js/ui/spot.js', 'js/ui/favoritos.js', 'js/ui/definicoes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('maresia-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const fresh = fetch(e.request).then(async (res) => {
    if (res.ok) await (await caches.open(CACHE)).put(e.request, res.clone());
    return res;
  });
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fresh));
  e.waitUntil(fresh.then(() => {}, () => {}));
});
