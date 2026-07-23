import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_MANIFEST_FILE,
  PROJECT_ROOT,
  buildNormalizedDatabase,
  writeNormalizedDatabase,
} from '../scripts/migrate-normalized-database.mjs';
import {
  CANONICAL_PLAYER_FIELDS,
  PLAYER_MODEL_VERSION,
} from '../js/models/player-model.js';

const result = buildNormalizedDatabase({
  root: PROJECT_ROOT,
  manifestFile: DEFAULT_MANIFEST_FILE,
});
const outputFile = result.manifest.files.normalizedPlayers;
const reportFile = result.manifest.files.normalizationReport;

assert.equal(result.output.schemaVersion, 1);
assert.equal(result.output.databaseId, 'hungary-nb1-2025-26');
assert.equal(result.output.databaseVersion, '3.0.0');
assert.equal(result.output.playerModel.version, PLAYER_MODEL_VERSION);
assert.equal(result.output.players.length, 440);
assert.equal(new Set(result.output.players.map(player => player.id)).size, 440);
assert.equal(result.report.validation.errorCount, 0);
assert.equal(result.report.preservation.stablePlayerCount, true);
assert.equal(result.report.preservation.stableIds, true);
assert.equal(result.report.preservation.unchangedNames, true);
assert.equal(result.report.preservation.unchangedStatsObjects, true);
assert.deepEqual(result.report.sourceLayerCounts, {
  enrichments: 23,
  corrections: 5,
  statPatches: 13,
});

for (const player of result.output.players) {
  assert.equal(player.playerModelVersion, PLAYER_MODEL_VERSION, `${player.name}: hibás modellverzió`);
  for (const field of CANONICAL_PLAYER_FIELDS) {
    assert.equal(Object.hasOwn(player, field), true, `${player.name}: hiányzó kanonikus mező: ${field}`);
  }
  assert.ok(player.id);
  assert.ok(player.name);
  assert.ok(player.clubName);
  assert.ok(player.dataCompleteness);
  assert.equal(typeof player.dataCompleteness.ratio, 'number');
  assert.ok(player.dataCompleteness.ratio >= 0 && player.dataCompleteness.ratio <= 1);
}

const outputPath = path.join(PROJECT_ROOT, outputFile);
const reportPath = path.join(PROJECT_ROOT, reportFile);
assert.equal(fs.existsSync(outputPath), true);
assert.equal(fs.existsSync(reportPath), true);

const committedOutput = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const committedReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
assert.equal(committedOutput.players.length, 440);
assert.equal(committedReport.playerCount, 440);
assert.equal(committedOutput.migration.playersDigest, committedReport.playersDigest);
assert.equal(committedOutput.migration.sourceDigest, committedReport.sourceDigest);
assert.deepEqual(result.output, committedOutput, 'A commitolt adatbázis eltér a reprodukálható migrációtól');
assert.deepEqual(result.report, committedReport, 'A commitolt jelentés eltér a reprodukálható migrációtól');

writeNormalizedDatabase({
  root: PROJECT_ROOT,
  manifestFile: DEFAULT_MANIFEST_FILE,
  check: true,
});

console.log('✓ Normalizált adatbázis: 440 stabil játékos, 30 kanonikus mező, változatlan név és stats, determinisztikus újragenerálás');
