import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';
import { assertRegisteredDataFile } from './database-manifest-assertions.mjs';

const CLUB_ID = 'kisvarda-master-good';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const basePayload = readJson('../data/players.json');
const directory = readJson('../data/club-official-sources.json');
const finalEnrichment = readJson('../data/club-official-enrichment-10-kisvarda-final8.json');
const positionCompletion = readJson('../data/club-official-enrichment-11-kisvarda-completion.json');
const finalStats = readJson('../data/club-official-stat-patches-kisvarda-final8.json');
const enrichmentFiles = [
  '../data/club-official-enrichment.json',
  '../data/club-official-enrichment-2.json',
  '../data/club-official-enrichment-3-paks-nyir.json',
  '../data/club-official-enrichment-4-ujpest.json',
  '../data/club-official-enrichment-5-other.json',
  '../data/club-official-enrichment-6-eto-puskas.json',
  '../data/club-official-enrichment-7-kisvarda-selected10.json',
  '../data/club-official-enrichment-8-kisvarda-selected10.json',
  '../data/club-official-enrichment-9-kisvarda-selected10.json',
  '../data/club-official-enrichment-10-kisvarda-final8.json',
  '../data/club-official-enrichment-11-kisvarda-completion.json',
];
const correctionFiles = [
  '../data/club-official-corrections.json',
  '../data/club-official-corrections-2.json',
  '../data/club-official-corrections-3.json',
  '../data/club-official-corrections-4-kisvarda-selected10-2.json',
];
const statPatchFiles = [
  '../data/club-official-stat-patches-kisvarda.json',
  '../data/club-official-stat-patches-kisvarda-selected10.json',
  '../data/club-official-stat-patches-kisvarda-selected10-2.json',
  '../data/club-official-stat-patches-kisvarda-selected10-3.json',
  '../data/club-official-stat-patches-kisvarda-final8.json',
];

const enrichmentParts = enrichmentFiles.map(readJson);
const correctionParts = correctionFiles.map(readJson);
const statPatchParts = statPatchFiles.map(readJson);
const rawEnrichment = {
  ...enrichmentParts[0],
  generatedAt: enrichmentParts.at(-1)?.generatedAt ?? enrichmentParts[0].generatedAt,
  sources: enrichmentParts.flatMap(part => part.sources ?? []),
  records: enrichmentParts.flatMap(part => part.records ?? []),
  clubDirectory: directory.clubs,
};
const corrections = {
  schemaVersion: 1,
  checkedAt: correctionParts.at(-1)?.checkedAt ?? null,
  addSources: correctionParts.flatMap(part => part.addSources ?? []),
  recordPatches: correctionParts.flatMap(part => part.recordPatches ?? []),
  excludeRecords: correctionParts.flatMap(part => part.excludeRecords ?? []),
  additions: correctionParts.flatMap(part => part.additions ?? []),
};
const enriched = applyClubEnrichmentPayload(
  basePayload,
  prepareClubEnrichment(rawEnrichment, corrections),
);
const patched = applyOfficialStatPatches(enriched, statPatchParts);

assert.equal(finalEnrichment.batch.playerCount, 8);
assert.equal(finalEnrichment.batch.playerIds.length, 8);
assert.equal(new Set(finalEnrichment.batch.playerIds).size, 8);
assert.equal(positionCompletion.batch.playerCount, 2);
assert.equal(positionCompletion.records.length, 2);
assert.equal(finalStats.batch.playerCount, 8);
assert.equal(finalStats.rows.length, 8);
assert.equal(patched.players.length, 440);
assert.equal(new Set(patched.players.map(player => player.id)).size, 440);
assert.equal(new Set(patched.players.map(player => player.meta?.personKey)).size, 440);

const kisvarda = patched.players.filter(player => player.meta?.clubIds?.includes(CLUB_ID));
assert.equal(kisvarda.length, 38, 'A Kisvárda adatbázisának 38 játékost kell tartalmaznia');
assert.equal(kisvarda.filter(player => /^\d{4}-\d{2}-\d{2}$/.test(player.birthDate ?? '')).length, 38,
  'Mind a 38 Kisvárda-játékosnak pontos születési dátummal kell rendelkeznie');
assert.equal(kisvarda.filter(player => player.position && player.position !== 'Nincs adat').length, 38,
  'Mind a 38 Kisvárda-játékosnak forrásolt poszttal kell rendelkeznie');

for (const row of finalStats.rows) {
  const [name, appearances, starts, substitutes, squads, goals, yellow, red, secondYellow, dismissals] = row;
  for (const [field, value] of Object.entries({ appearances, starts, substitutes, squads, goals, yellow, red, secondYellow, dismissals })) {
    assert.equal(Number.isFinite(value), true, `${name}: hibás ${field}`);
    assert.ok(value >= 0, `${name}: negatív ${field}`);
  }
  assert.equal(starts + substitutes, appearances, `${name}: hibás kezdés/csere bontás`);
  assert.ok(squads >= appearances, `${name}: hibás kerettagság`);
}

const medgyes = patched.players.find(player => player.id === 'nb1-5617f703b891');
assert.equal(medgyes.position, 'Védő');
assert.equal(medgyes.nation, 'HUN / SVK');
assert.equal(medgyes.meta.clubOfficial.primaryPosition, 'Balhátvéd');
assert.equal(medgyes.meta.clubOfficial.strongFoot, 'bal');

const molnar = patched.players.find(player => player.id === 'nb1-e262cfc330c5');
assert.equal(molnar.position, 'Támadó');
assert.equal(molnar.meta.clubOfficial.primaryPosition, 'Támadó középpályás');

for (const record of [...finalEnrichment.records, ...positionCompletion.records]) {
  const allowedIds = record.sourceId.includes('position-completion')
    ? positionCompletion.batch.playerIds
    : finalEnrichment.batch.playerIds;
  assert.ok(allowedIds.some(id => {
    const player = basePayload.players.find(item => item.id === id);
    return player && enrichmentNamesMatch(player.name, record);
  }), `A lezáró csomagon kívüli rekord került be: ${record.name}`);
  assert.equal(record.checkedAt, '2026-07-20');
  assert.equal(record.season, '2025/26');
  assert.equal(record.confidence, 'high');
  assert.match(record.sourceUrl, /^https:\/\//);
}

const kisvardaDirectory = directory.clubs.find(club => club.clubId === CLUB_ID);
assert.equal(kisvardaDirectory.status, 'complete-38-of-38-player-review');
for (const file of [
  'data/club-official-enrichment-10-kisvarda-final8.json',
  'data/club-official-enrichment-11-kisvarda-completion.json',
  'data/club-official-stat-patches-kisvarda-final8.json',
]) {
  assert.ok(kisvardaDirectory.recordFiles.includes(file), `Hiányzik a klubforrás-jegyzékből: ${file}`);
}

assertRegisteredDataFile('club-official-enrichment-10-kisvarda-final8.json', 'enrichments');
assertRegisteredDataFile('club-official-enrichment-11-kisvarda-completion.json', 'enrichments');
assertRegisteredDataFile('club-official-stat-patches-kisvarda-final8.json', 'statPatches');

console.log('✓ Kisvárda lezárva: 38/38 játékos születési dátuma és posztja, valamint a lezáró statisztikai csomag konzisztens');
