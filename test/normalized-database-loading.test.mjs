import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const registry = read('../data/databases/registry.json');
const bootstrap = read('../js/bootstrap.js');
const databaseService = read('../js/database/database-service.js');
const standaloneBuilder = read('../scripts/build-standalone.mjs');
const serviceWorker = read('../sw.js');

assert.match(registry, /normalizedPlayers/);
assert.match(registry, /normalizationReport/);
assert.match(registry, /playerModelVersion/);
assert.match(bootstrap, /loadDatabase/);
assert.doesNotMatch(bootstrap, /fetchJson\(files\.normalizedPlayers\)/);
assert.match(databaseService, /fetchCached\(files\.normalizedPlayers/);
assert.match(databaseService, /source: 'normalized'/);
assert.match(databaseService, /source: 'legacy-fallback'/);
assert.match(databaseService, /Visszaállás a régi forrásrétegekre/);
assert.match(standaloneBuilder, /normalizedPlayerFile/);
assert.match(standaloneBuilder, /buildDataSource = 'normalized'/);
assert.match(standaloneBuilder, /buildDataSource = 'legacy-layered'/);
assert.match(standaloneBuilder, /standaloneDataSource: buildDataSource/);
assert.match(serviceWorker, /players\.normalized\.json/);
assert.match(serviceWorker, /normalization-report\.json/);
assert.match(serviceWorker, /const PWA_CACHE = 'fociskartyak-2026-v\d+';/);

console.log('✓ Normalizált adatbázis az elsődleges böngészős, önálló és mobilos forrás; a betöltést a központi szolgáltatás kezeli, a régi réteges visszaállás megmaradt');
