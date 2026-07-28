import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAvailableSeasons,
  getDatabaseBySeason,
  getDefaultSeason,
  normaliseDatabaseManifest,
  validateDatabaseManifest,
  validateDatabaseRegistry,
} from '../js/database/database-registry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => readJson(String(url)),
});

const registry = validateDatabaseRegistry(readJson('data/databases/registry.json'));
assert.equal(registry.schemaVersion, 2);
assert.equal(registry.defaultDatabaseId, 'hungary-nb1-2025-26');
assert.equal(registry.defaultSeasonId, '2025-26');
assert.equal(registry.databases.length, 1);
assert.equal(registry.databases[0].enabled, true);
assert.equal(registry.databases[0].competitionId, 'hungary-nb1');
assert.equal(registry.databases[0].seasonId, '2025-26');

const entry = registry.databases[0];
const rawManifest = readJson(entry.manifest);
const manifest = validateDatabaseManifest(rawManifest, entry.manifest);
assert.equal(manifest.schemaVersion, 2);
assert.equal(manifest.id, entry.id);
assert.equal(manifest.name, 'Magyar NB I 2025/26');
assert.equal(manifest.version, '3.1.0');
assert.equal(manifest.competitionId, 'hungary-nb1');
assert.equal(manifest.season, '2025/26');
assert.equal(manifest.seasonId, '2025-26');
assert.deepEqual(manifest.seasonMeta, {
  id: '2025-26',
  label: '2025/26',
  startYear: 2025,
  endYear: 2026,
  status: 'current',
  sortOrder: 20252026,
});
assert.equal(manifest.files.players, 'data/players.json');
assert.equal(
  manifest.files.normalizedPlayers,
  'data/databases/hungary-nb1-2025-26/players.normalized.json',
);
assert.equal(
  manifest.files.normalizationReport,
  'data/databases/hungary-nb1-2025-26/normalization-report.json',
);
assert.equal(manifest.files.clubDirectory, 'data/club-official-sources.json');
assert.equal(manifest.files.enrichments.length, 24);
assert.equal(manifest.files.corrections.length, 5);
assert.equal(manifest.files.statPatches.length, 13);
assert.equal(manifest.normalization.schemaVersion, 1);
assert.equal(manifest.normalization.playerModelVersion, 1);
assert.equal(manifest.normalization.primaryFile, 'normalizedPlayers');
assert.equal(manifest.normalization.reproducible, true);
assert.equal(manifest.normalization.fallback, 'legacy-layered-database');
assert.deepEqual(manifest.supportedModes, ['classic', 'penalties']);
assert.deepEqual(manifest.supportedDeckSelections, ['random', 'club', 'nation']);

for (const relative of [
  manifest.files.players,
  manifest.files.normalizedPlayers,
  manifest.files.normalizationReport,
  manifest.files.clubDirectory,
  ...manifest.files.enrichments,
  ...manifest.files.corrections,
  ...manifest.files.statPatches,
]) {
  assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `Hiányzó manifest-fájl: ${relative}`);
}

const normalized = readJson(manifest.files.normalizedPlayers);
const report = readJson(manifest.files.normalizationReport);
assert.equal(normalized.databaseId, manifest.id);
assert.equal(normalized.databaseVersion, manifest.version);
assert.equal(normalized.competitionId, manifest.competitionId);
assert.equal(normalized.seasonId, manifest.seasonId);
assert.equal(normalized.players.length, 440);
assert.equal(report.databaseId, manifest.id);
assert.equal(report.databaseVersion, manifest.version);
assert.equal(report.seasonId, manifest.seasonId);
assert.equal(report.playerCount, 440);

const availableSeasons = await getAvailableSeasons();
assert.equal(availableSeasons.length, 1);
assert.equal(availableSeasons[0].id, '2025-26');
assert.equal(availableSeasons[0].databaseId, 'hungary-nb1-2025-26');
assert.equal((await getDatabaseBySeason('2025/26', { competitionId: 'hungary-nb1' })).id, manifest.id);
assert.equal((await getDefaultSeason()).id, '2025-26');
globalThis.fetch = originalFetch;

assert.throws(
  () => validateDatabaseRegistry({
    schemaVersion: 1,
    defaultDatabaseId: 'missing',
    databases: [{ id: 'one', manifest: 'one.json', enabled: true }],
  }),
  /alapértelmezett adatbázis nem elérhető/,
);

assert.throws(
  () => validateDatabaseRegistry({
    schemaVersion: 1,
    defaultDatabaseId: 'same',
    databases: [
      { id: 'same', manifest: 'one.json', enabled: true },
      { id: 'same', manifest: 'two.json', enabled: true },
    ],
  }),
  /duplikált adatbázis-azonosító/,
);

assert.throws(
  () => validateDatabaseRegistry({
    schemaVersion: 2,
    defaultDatabaseId: 'one',
    defaultSeasonId: '2025-26',
    databases: [{ id: 'one', manifest: 'one.json', competitionId: 'test', seasonId: '2024-25' }],
  }),
  /alapértelmezett adatbázis és szezon nem egyezik/,
);

const incomplete = normaliseDatabaseManifest({
  schemaVersion: 1,
  id: 'incomplete',
  name: 'Hiányos',
  competition: 'Tesztliga',
  season: '2025/26',
  minimumPlayers: 22,
  supportedModes: ['classic'],
  files: {},
});
assert.deepEqual(incomplete.files.enrichments, []);
assert.throws(() => validateDatabaseManifest(incomplete), /hiányzó játékosadat-fájl/);

const missingNormalized = {
  ...rawManifest,
  files: { ...rawManifest.files, normalizedPlayers: '' },
};
assert.throws(
  () => validateDatabaseManifest(missingNormalized),
  /hiányzó normalizált játékosadat-fájl/,
);

console.log('✓ Adatbázis- és szezonregiszter, normalizált manifest és fájlhivatkozások: sikeresek');
