import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const index = read('index.html');
const serviceWorker = read('sw.js');
const experience = read('js/recent-duels-experience.js');
const packageWorkflow = read('.github/workflows/build-download-package.yml');

assert.match(index, /js\/recent-duels-experience\.js/, 'Az új játékélmény-modul nincs betöltve az index.html-ben.');
assert.match(serviceWorker, /const CACHE_PREFIX = 'fociskartyak-2026-build-'/, 'A service workerből hiányzik a determinisztikus build-cache prefix.');
assert.match(serviceWorker, /managedCache = name => name !== META_CACHE && name\.startsWith\(LEGACY_CACHE_PREFIX\)/, 'A service worker nem csak a saját régi cache-eit kezeli.');
assert.match(serviceWorker, /cache\.addAll\(CORE_SHELL\)/, 'A kötelező offline mag nem atomikusan települ.');
assert.match(serviceWorker, /matchActive\('\.\/index\.html'\)/, 'Hiányzik az aktív offline cache index-fallbackje.');
assert.match(serviceWorker, /js\/recent-duels-experience\.js/, 'Az új játékélmény-modul nincs a PWA shellben.');
assert.match(experience, /Legutóbbi párbajok/, 'Hiányzik a legutóbbi párbajok felülete.');
assert.match(experience, /A mérkőzés játékosa/, 'Hiányzik a mérkőzés játékosa blokk.');
assert.match(experience, /RECENT_DUELS_LIMIT = 3/, 'A párbajelőzmény nem három elemre korlátozott.');
assert.match(packageWorkflow, /npm run build/, 'A letölthető csomag workflow nem készít friss buildet.');
assert.match(packageWorkflow, /Fociskartyak2026-legujabb\.html/, 'A workflow nem exportálja az önálló HTML-játékot.');
assert.match(packageWorkflow, /Fociskartyak2026-teljes-legujabb\.zip/, 'A workflow nem exportálja a teljes ZIP-csomagot.');

console.log('Release-, UX- és PWA-integrációs ellenőrzések rendben.');
