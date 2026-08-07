// Atomikus, build-azonosítós PWA-cache. A cache-nevet a service worker tartalma határozza meg.
const LEGACY_CACHE_PREFIX = 'fociskartyak-2026-';
const CACHE_PREFIX = 'fociskartyak-2026-build-';
const META_CACHE = 'fociskartyak-2026-meta';
const ACTIVE_META_KEY = new URL('./__pwa-active-cache__', self.location.href).href;
const PENDING_META_KEY = new URL('./__pwa-pending-cache__', self.location.href).href;

const CORE_SHELL = Object.freeze([
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
  './css/tournament-mode.css',
  './css/i18n.css',
  './js/app/configuration.js',
  './js/services/storage-service.js',
  './js/services/asset-service.js',
  './js/services/save-service.js',
  './js/services/season-save-service.js',
  './js/services/turn-timing-service.js',
  './js/app/session-lifecycle-service.js',
  './js/app/menu-controller.js',
  './js/app/result-controller.js',
  './js/app/round-controller.js',
  './js/branding.js',
  './js/i18n.js',
  './js/pwa.js',
  './js/bootstrap.js',
  './js/database/season-model.js',
  './js/database/database-registry.js',
  './js/database/database-service.js',
  './js/database/season-service.js',
  './js/models/player-model.js',
  './js/data/federations.js',
  './js/data/nationalities.js',
  './js/data/complete-cards.js',
  './js/data/club-enrichment.js',
  './js/data/club-stat-patches.js',
  './js/data/verified-player-corrections.js',
  './js/data/categories.js',
  './js/data/height.js',
  './js/data/players.js',
  './js/domain/federation-domain.js',
  './js/domain/deck-selection-domain.js',
  './js/domain/quick-match-domain.js',
  './js/tournament/tournament-domain.js',
  './js/services/deck-selection-storage-service.js',
  './js/services/quick-match-storage-service.js',
  './js/services/tournament-storage-service.js',
  './js/ui/deck-selection-menu-component.js',
  './js/ui/help-popover-component.js',
  './js/ui/ui-enhancement-pipeline.js',
  './js/quick-match-card-controls.js',
  './js/deck-selection.js',
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
  './js/mobile-experience.js',
  './js/category-picker.js',
  './js/player-profile.js',
  './js/reliability-fixes.js',
  './js/usability-fixes.js',
  './js/visual-settings-persistence.js',
  './js/visual-system.js',
  './js/visual-hierarchy.js',
  './js/gameplay-experience.js',
  './js/recent-duels-experience.js',
  './js/gameplay-polish.js',
  './js/playability-visual-upgrade.js',
  './js/legal-ui.js',
  './js/tournament-mode.js',
  './js/tournament-cup-experience.js',
  './js/tournament/cup-atmosphere.js',
  './js/tournament-rapid-upgrade.js',
  './js/tournament-flow-upgrade.js',
  './js/tournament/tournament-flow-runtime.js',
  './js/tournament/tournament-flow-shared.js',
  './js/tournament/tournament-flow-wizard.js',
  './js/tournament-experience-v2.js',
  './js/tournament/tournament-experience-v2-runtime.js',
  './js/tournament/tournament-experience-v2-shared.js',
  './js/tournament/tournament-experience-v2-wizard.js',
  './js/tournament/tournament-experience-v2-presets.js',
  './js/main.js',
  './locales/hu.json',
  './locales/en.json',
  './data/databases/registry.json',
  './data/databases/hungary-nb1-2025-26/manifest.json',
  './data/databases/hungary-nb1-2025-26/players.normalized.json',
  './src/assets/placeholders/player-silhouette.svg',
  './src/assets/placeholders/club-badge.svg',
  './src/assets/placeholders/app-icon.svg'
]);

const OPTIONAL_ASSETS = Object.freeze([
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
  './data/club-official-enrichment-26-height-1-reviewed.json',
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
  './assets/qr/mobil-eleres.svg'
]);

let currentCacheName = null;

const managedCache = name => name !== META_CACHE && name.startsWith(LEGACY_CACHE_PREFIX);
const responseText = async response => response ? response.text() : null;

async function readMeta(key) {
  const cache = await caches.open(META_CACHE);
  return responseText(await cache.match(key));
}

async function writeMeta(key, value) {
  const cache = await caches.open(META_CACHE);
  await cache.put(key, new Response(String(value), { headers: { 'content-type': 'text/plain' } }));
}

async function clearMeta(key) {
  const cache = await caches.open(META_CACHE);
  await cache.delete(key);
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function candidateCacheName() {
  const response = await fetch(new Request(self.location.href, { cache: 'no-store' }));
  if (!response.ok) throw new Error(`A service worker buildazonosítója nem olvasható: ${response.status}`);
  const source = await response.text();
  const signature = JSON.stringify({ source, core: CORE_SHELL, optional: OPTIONAL_ASSETS });
  return `${CACHE_PREFIX}${(await sha256Hex(signature)).slice(0, 16)}`;
}

async function resolveActiveCacheName() {
  if (currentCacheName) return currentCacheName;
  const mapped = await readMeta(ACTIVE_META_KEY);
  const keys = await caches.keys();
  if (mapped && keys.includes(mapped)) {
    currentCacheName = mapped;
    return mapped;
  }
  const candidates = keys.filter(name => name.startsWith(CACHE_PREFIX));
  currentCacheName = candidates.at(-1) ?? null;
  return currentCacheName;
}

async function matchActive(request) {
  const name = await resolveActiveCacheName();
  if (!name) return null;
  return (await caches.open(name)).match(request);
}

async function cacheResponse(request, response) {
  if (!response?.ok) return response;
  try {
    const name = await resolveActiveCacheName();
    if (name) await (await caches.open(name)).put(request, response.clone());
  } catch (error) {
    console.warn('[pwa] A sikeres hálózati válasz gyorsítótárazása kimaradt:', error);
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await cacheResponse(request, await fetch(request));
  } catch {
    return (await matchActive(request)) || Response.error();
  }
}

async function cacheFirstWithRefresh(request, event) {
  const cached = await matchActive(request);
  const refresh = fetch(request)
    .then(response => cacheResponse(request, response))
    .catch(() => null);
  event?.waitUntil?.(refresh.then(() => undefined));
  return cached || (await refresh) || Response.error();
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    let candidate = null;
    try {
      candidate = await candidateCacheName();
      const active = await readMeta(ACTIVE_META_KEY);
      if (candidate !== active) {
        const cache = await caches.open(candidate);
        await cache.addAll(CORE_SHELL);
        const optionalResults = await Promise.allSettled(OPTIONAL_ASSETS.map(resource => cache.add(resource)));
        const failed = optionalResults.filter(result => result.status === 'rejected').length;
        if (failed) console.warn(`[pwa] ${failed} opcionális erőforrás előtöltése kimaradt.`);
      }
      await writeMeta(PENDING_META_KEY, candidate);
      await self.skipWaiting();
    } catch (error) {
      const active = await readMeta(ACTIVE_META_KEY).catch(() => null);
      if (candidate && candidate !== active) await caches.delete(candidate).catch(() => false);
      await clearMeta(PENDING_META_KEY).catch(() => false);
      console.error('[pwa] A kötelező offline mag nem telepíthető; a korábbi verzió marad aktív.', error);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const pending = await readMeta(PENDING_META_KEY);
    const keys = await caches.keys();
    if (!pending || !keys.includes(pending)) {
      throw new Error('Az új PWA-cache nem aktiválható: hiányzik a teljes, ellenőrzött build-cache.');
    }
    await writeMeta(ACTIVE_META_KEY, pending);
    currentCacheName = pending;
    const cleanup = await Promise.allSettled(keys
      .filter(name => managedCache(name) && name !== pending)
      .map(name => caches.delete(name)));
    const failedDeletes = cleanup.filter(result => result.status === 'rejected').length;
    if (failedDeletes) console.warn(`[pwa] ${failedDeletes} régi cache törlése későbbre maradt.`);
    await clearMeta(PENDING_META_KEY);
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
      return (await matchActive(request)) || (await matchActive('./index.html')) || response;
    })());
    return;
  }
  const freshCodeOrData = /\.(?:js|css|json|html|webmanifest)$/i.test(url.pathname);
  event.respondWith(freshCodeOrData ? networkFirst(request) : cacheFirstWithRefresh(request, event));
});