// Korábbi cache-verziók: fociskartyak-2026-v30, fociskartyak-2026-v31, fociskartyak-2026-v32, fociskartyak-2026-v33, fociskartyak-2026-v34, fociskartyak-2026-v35, fociskartyak-2026-v36, fociskartyak-2026-v37, fociskartyak-2026-v38, fociskartyak-2026-v39, fociskartyak-2026-v40, fociskartyak-2026-v41, fociskartyak-2026-v42
const PWA_CACHE = 'fociskartyak-2026-v43';
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
  './css/focus-experience.css',
  './css/mobile-selection-fix.css',
  './css/duel-emphasis.css',
  './css/phase-refinements.css',
  './js/bootstrap.js',
  './js/data/complete-cards.js',
  './js/data/club-enrichment.js',
  './js/data/club-stat-patches.js',
  './js/data/verified-player-corrections.js',
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
  './js/reliability-fixes.js',
  './js/usability-fixes.js',
  './js/focus-experience.js',
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
  './data/club-official-enrichment-12-dvtk-completion.json',
  './data/club-official-enrichment-13-mtk-completion.json',
  './data/club-official-enrichment-14-nyiregyhaza-completion.json',
  './data/club-official-enrichment-15-nyiregyhaza-nationalities.json',
  './data/club-official-enrichment-16-kazincbarcika-completion.json',
  './data/club-official-enrichment-17-ujpest-completion.json',
  './data/club-official-enrichment-18-paks-completion.json',
  './data/club-official-enrichment-19-zte-completion.json',
  './data/club-official-enrichment-20-puskas-completion.json',
  './data/club-official-enrichment-21-eto-completion.json',
  './data/club-official-enrichment-22-kisvarda-nationalities.json',
  './data/club-official-enrichment-23-final-missing-basic.json',
  './data/club-official-corrections.json',
  './data/club-official-corrections-2.json',
  './data/club-official-corrections-3.json',
  './data/club-official-corrections-4-kisvarda-selected10-2.json',
  './data/club-official-corrections-5-puskas.json',
  './data/club-official-stat-patches-kisvarda.json',
  './data/club-official-stat-patches-kisvarda-selected10.json',
  './data/club-official-stat-patches-kisvarda-selected10-2.json',
  './data/club-official-stat-patches-kisvarda-selected10-3.json',
  './data/club-official-stat-patches-kisvarda-final8.json',
  './data/club-official-stat-patches-ferencvaros.json',
  './data/club-official-stat-patches-dvtk.json',
  './data/club-official-stat-patches-mtk.json',
  './data/club-official-stat-patches-nyiregyhaza.json',
  './data/club-official-stat-patches-kazincbarcika.json',
  './data/club-official-stat-patches-ujpest.json',
  './data/club-official-stat-patches-zte.json',
  './data/club-official-stat-patches-puskas.json',
  './data/club-official-sources.json',
  './assets/icons/icon.svg',
  './assets/qr/mobil-eleres.svg'
];

async function cacheResponse(request, response) {
  if (!response?.ok) return response;
  const cache = await caches.open(PWA_CACHE);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    return await cacheResponse(request, await fetch(request));
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirstWithRefresh(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(response => cacheResponse(request, response))
    .catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(PWA_CACHE);
    const results = await Promise.allSettled(PWA_SHELL.map(resource => cache.add(resource)));
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed) console.warn(`[pwa] ${failed} erőforrás előtöltése kimaradt; az online játék ettől még elindul.`);
    await self.skipWaiting();
  })());
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
    event.respondWith((async () => {
      const response = await networkFirst(request);
      if (response.ok) return response;
      return (await caches.match(request)) || (await caches.match('./index.html')) || response;
    })());
    return;
  }

  const freshCodeOrData = ['script', 'style', 'worker', 'manifest'].includes(request.destination)
    || url.pathname.endsWith('.json');

  event.respondWith(freshCodeOrData ? networkFirst(request) : cacheFirstWithRefresh(request));
});
