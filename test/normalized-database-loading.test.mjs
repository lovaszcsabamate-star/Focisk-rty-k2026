import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const readJson = relative => JSON.parse(read(relative));

const manifest = readJson('../data/databases/hungary-nb1-2025-26/manifest.json');
const normalized = readJson(`../${manifest.files.normalizedPlayers}`);
const report = readJson(`../${manifest.files.normalizationReport}`);
const bootstrap = read('../js/bootstrap.js');
const registry = read('../js/database/database-registry.js');
const serviceWorker = read('../sw.js');

assert.equal(manifest.version, '3.0.0');
assert.equal(manifest.normalization.primaryFile, 'normalizedPlayers');
assert.equal(manifest.normalization.playerModelVersion, 1);
assert.equal(manifest.normalization.reproducible, true);
assert.equal(manifest.normalization.fallback, 'legacy-layered-database');

assert.equal(normalized.databaseId, manifest.id);
assert.equal(normalized.databaseVersion, manifest.version);
assert.equal(normalized.playerModel.version, manifest.normalization.playerModelVersion);
assert.equal(normalized.playerModel.validation.errorCount, 0);
assert.equal(normalized.players.length, 440);
assert.equal(new Set(normalized.players.map(player => player.id)).size, 440);
assert.equal(report.playerCount, 440);
assert.equal(report.registrationRecords, 464);
assert.equal(report.validation.errorCount, 0);
assert.equal(report.playersDigest, normalized.migration.playersDigest);
assert.equal(report.sourceDigest, normalized.migration.sourceDigest);

assert.match(registry, /normalizedPlayers/);
assert.match(registry, /normalizationReport/);
assert.match(registry, /playerModelVersion/);
assert.match(bootstrap, /fetchJson\(files\.normalizedPlayers\)/);
assert.match(bootstrap, /source: 'normalized'/);
assert.match(bootstrap, /source: 'legacy-fallback'/);
assert.match(bootstrap, /Visszaállás a régi forrásrétegekre/);
assert.match(serviceWorker, /players\.normalized\.json/);
assert.match(serviceWorker, /normalization-report\.json/);
assert.match(serviceWorker, /fociskartyak-2026-v50/);

console.log('✓ Normalizált adatbázis az elsődleges forrás, validált és offline elérhető; a régi réteges visszaállás megmaradt');
