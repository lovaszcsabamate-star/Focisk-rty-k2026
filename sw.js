// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v83
// freshCodeOrData: új kód vagy adat kiadásakor a cache-verziót növelni kell.
const CACHE_PREFIX = 'fociskartyak-2026-';
const PWA_CACHE = 'fociskartyak-2026-v84';
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
  './css/visual-system.css',
  './css/visual-settings-persistence.css',
  './css/legal-ui.css',
  './css/visual-hierarchy.css',
  './css/category-picker.css',
  './css/deck-selection-menu.css',
  './css/quick-match-card-controls.css',
  './css/help-popover.css',
  './css/federation-teams.css',
  './css/nationality-flags.css',
  './css/i18n.css',
  './js/app/configuration.js',
  './js/services/storage-service.js',
  './js/services/asset-service.js',
  './js/services/save-service.js',
  './js/services/season-save-service.js',
  './js/services/turn-timing-service.js',
  './js/app/session-lifecycle-service.js',
  './js/branding.js',
  './js/i18n.js',
  './js/bootstrap.js',
  './js/database/season-model.js',
  './js/database/database-registry.js',
  './js/database/database-service.js',
  './js/database/season-service.js',
  './js/models/player-model.js',
  './js/data/federations.js',
  './js/domain/federation-domain.js',
  './js/domain/deck-selection-domain.js',
  './js/domain/quick-match-domain.js',
  './js/services/deck-selection-storage-service.js',
  './js/services/quick-match-storage-service.js',
  './js/services/tournament-storage-service.js',
  './js/ui/deck-selection-menu-component.js',
  './js/quick-match-card-controls.js',
  './js/ui/help-popover-component.js',
  './js/ui/ui-enhancement-pipeline.js',
  './js/deck-selection.js',
  './js/data/nationalities.js',
  './js/data/complete-cards.js',
  './js/data/club-enrichment.js',
  './js/data/club-stat-patches.js',
  './js/data/verified-player-corrections.js',
  './js/data/categories.js',
  './js/data/players.js',
  './js/game/game-mode-factory.js',
  './js/game/game-runtime.js',
  './js/engine.js',
  './js/penalties.js',
  './js/ai.js',
  './js/banter.js',
  './js/ui/dom-primitives.js',
  './js/ui/card-component.js',
  './js/ui/flag-component.js',
  './js/ui/scoreboard-component.js',
  './js/ui/attribute-picker-component.js',
  './js/ui.js',
  './js/ux.js',
  './js/ux-fixes.js',
  './js/nationality-ui-enhancement.js',
  './js/focus-experience.js',
  './js/matchday.js',
  './js/opponents.js',
  './js/pwa.js',
  './js/mobile-experience.js',
  './js/category-picker.js',
  './js/app/menu-controller.js',
  './js/app/result-controller.js',
  './js/app/round-controller.js',
  './js/player-profile.js',
  './js/reliability-fixes.js',
  './js/usability-fixes.js',
  './js/focus-experience.js',
  './js/visual-settings-persistence.js',
  './js/visual-system.js',
  './js/visual-hierarchy.js',
  './js/gameplay-experience.js',
  './js/gameplay-polish.js',
  './js/recent-duels-experience.js',
  './js/legal-ui.js',
  './js/main.js',
  './locales/hu.json',
  './locales/en.json',
  './data/databases/registry.json',
  './data/databases/hungary-nb1-2025-26/manifest.json',
  './data/databases/hungary-nb1-2025-26/players.normalized.json',
  './data/databases/hungary-nb1-2025-26/normalization-report.json',
  './data/databases/hungary-nb1-2025-26/nationality-audit-report.json',
  './data/databases/hungary-nb1-2025-26/federation-audit-report.json',
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
  './data/club-official-enrichment-24-dvtk-heights.json',
  './data/club-official-enrichment-25-all-club-heights.json',
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
  './assets/flags/gb-eng.svg',
  './assets/flags/gb-sct.svg',
  './assets/flags/gb-wls.svg',
  './assets/flags/gb-nir.svg',
  './assets/federations/federation-europe.svg',
  './assets/federations/federation-africa.svg',
  './assets/federations/federation-south-america.svg',
  './assets/federations/federation-concacaf.svg',
  './assets/federations/federation-asia.svg',
  './assets/federations/federation-oceania.svg',
  './src/assets/licenses/assets-licenses.json',
  './src/assets/placeholders/player-silhouette.svg',
  './src/assets/placeholders/club-badge.svg',
  './src/assets/placeholders/app-icon.svg',
  './assets/qr/mobil-eleres.svg'
];

async function cacheResponse(request, response) {
  if (!response?.ok) return response;
  try {
    const cache = await caches.open(PWA_CACHE);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('[pwa] A sikeres hálózati válasz gyorsítótárazása kimaradt:', error);
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await cacheResponse(request, await fetch(request));
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirstWithRefresh(request, event) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(response => cacheResponse(request, response))
    .catch(() => null);
  event?.waitUntil?.(refresh.then(() => undefined));
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
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== PWA_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
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
  const freshCodeOrData = /\.(?:js|css|json|html|webmanifest)$/i.test(url.pathname);
  event.respondWith(freshCodeOrData ? networkFirst(request) : cacheFirstWithRefresh(request, event));
});
