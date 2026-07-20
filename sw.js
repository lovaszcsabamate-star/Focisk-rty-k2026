const PWA_CACHE = 'fociskartyak-2026-v18';
const PWA_SHELL = [
  './',
  './index.html',
  './mobil.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/ux.css',
  './css/matchday.css',
  './css/opponents.css',
  './css/pwa.css',
  './css/mobile-experience.css',
  './css/mobile-overlay-fix.css',
  './css/player-profile.css',
  './js/bootstrap.js',
  './js/data/club-enrichment.js',
  './js/data/club-stat-patches.js',
  './js/data/players.js',
  './js/engine.js',
  './js/penalties.js',
  './js/ai.js',
  './js/banter.js',
  './js/ui.js',
  './js/ux.js',
  './js/ux-fixes.js',
  './js/matchday.js',
  './js/opponents.js',
  './js/pwa.js',
  './js/mobile-experience.js',
  './js/player-profile.js',
  './js/main.js',
  './data/players.json',
  './data/club-official-enrichment.json',
  './data/club-official-enrichment-2.json',
  './data/club-official-enrichment-3-paks-nyir.json',
  './data/club-official-enrichment-4-ujpest.json',
  './data/club-official-enrichment-5-other.json',
  './data/club-official-enrichment-6-eto-puskas.json',
  './data/club-official-enrichment-7-kisvarda-selected10.json',
  './data/club-official-enrichment-8-kisvarda-selected10.json',
  './data/club-official-enrichment-9-kisvarda-selected10.json',
  './data/club-official-enrichment-10-kisvarda-final8.json',
  './data/club-official-enrichment-11-kisvarda-completion.json',
  './data/club-official-corrections.json',
  './data/club-official-corrections-2.json',
  './data/club-official-corrections-3.json',
  './data/club-official-corrections-4-kisvarda-selected10-2.json',
  './data/club-official-stat-patches-kisvarda.json',
  './data/club-official-stat-patches-kisvarda-selected10.json',
  './data/club-official-stat-patches-kisvarda-selected10-2.json',
  './data/club-official-stat-patches-kisvarda-selected10-3.json',
  './data/club-official-stat-patches-kisvarda-final8.json',
  './data/club-official-stat-patches-ferencvaros.json',
  './data/club-official-sources.json',
  './assets/icons/icon.svg',
  './assets/qr/mobil-eleres.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PWA_CACHE)
      .then(cache => cache.addAll(PWA_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== PWA_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(PWA_CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PWA_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
