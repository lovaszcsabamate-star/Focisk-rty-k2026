// Korábbi cache-verziók: fociskartyak-2026-v30, fociskartyak-2026-v31, fociskartyak-2026-v32, fociskartyak-2026-v33
const PWA_CACHE = 'fociskartyak-2026-v34';
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
