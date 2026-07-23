import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';
import { assertRegisteredDataFile } from './database-manifest-assertions.mjs';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));

const basePayload = readJson('../data/players.json');
const directory = readJson('../data/club-official-sources.json');
const selectedEnrichment = readJson('../data/club-official-enrichment-8-kisvarda-selected10.json');
const selectedStats = readJson('../data/club-official-stat-patches-kisvarda-selected10-2.json');
const enrichmentFiles = [
  '../data/club-official-enrichment.json',
  '../data/club-official-enrichment-2.json',
  '../data/club-official-enrichment-3-paks-nyir.json',
  '../data/club-official-enrichment-4-ujpest.json',
  '../data/club-official-enrichment-5-other.json',
  '../data/club-official-enrichment-6-eto-puskas.json',
  '../data/club-official-enrichment-7-kisvarda-selected10.json',
  '../data/club-official-enrichment-8-kisvarda-selected10.json',
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

const selectedIds = selectedEnrichment.batch.playerIds;
assert.equal(selectedEnrichment.batch.playerCount, 10);
assert.equal(selectedIds.length, 10);
assert.equal(new Set(selectedIds).size, 10);
assert.equal(selectedStats.batch.playerCount, 10);
assert.equal(selectedStats.rows.length, 10);
assert.equal(patched.players.length, 440);
assert.equal(new Set(patched.players.map(player => player.id)).size, 440);
assert.equal(new Set(patched.players.map(player => player.meta?.personKey)).size, 440);
assert.equal(patched.enrichment.unmatchedRecords, 0);
assert.equal(patched.enrichment.conflictCount, 0);
assert.equal(patched.officialStatPatches.records, 50);
assert.equal(patched.officialStatPatches.matchedRecords, 50);
assert.equal(patched.officialStatPatches.unmatchedRecords, 0);
assert.equal(patched.officialStatPatches.conflictCount, 0);
assert.equal(patched.officialStatPatches.correctionCount, 2);
assert.deepEqual(patched.officialStatPatches.correctedFieldCounts, { starts: 1, substituteAppearances: 1 });
assert.equal(patched.officialStatPatches.sources.length, 3);
assert.equal(patched.coverage.birthDate, 285);
assert.equal(patched.coverage.squads, 127);

const expected = {
  'nb1-046e04c4b9c4': { birthDate: '1997-12-24', position: 'Védő', shirtNumber: 42, appearances: 9, starts: 0, substitutes: 9, squads: 32 },
  'nb1-2e28ae6a6417': { birthDate: '1999-12-28', position: 'Középpályás', nation: 'FRA / CMR', heightCm: 186, shirtNumber: 80, appearances: 13, starts: 12, substitutes: 1, squads: 14 },
  'nb1-cce1ff8d0032': { birthDate: '2000-07-17', position: 'Középpályás', nation: 'MNE', heightCm: 189, shirtNumber: 11, appearances: 28, starts: 15, substitutes: 13, squads: 33 },
  'nb1-194f70766db2': { birthDate: '1994-07-27', position: 'Védő', nation: 'CRO', shirtNumber: 4, appearances: 9, starts: 9, substitutes: 0, squads: 9 },
  'nb1-5617f703b891': { birthDate: '1993-06-30', position: '', shirtNumber: 23, appearances: 15, starts: 7, substitutes: 8, squads: 28 },
  'nb1-b491c6bd8e82': { birthDate: '1997-01-04', position: 'Középpályás', nation: 'HUN', heightCm: 176, shirtNumber: 14, appearances: 30, starts: 30, substitutes: 0, squads: 30 },
  'nb1-7bc81b0db266': { birthDate: '1992-01-06', position: 'Támadó', nation: 'BIH', shirtNumber: 27, appearances: 22, starts: 20, substitutes: 2, squads: 27 },
  'nb1-e262cfc330c5': { birthDate: '1994-05-16', position: '', shirtNumber: 16, appearances: 27, starts: 5, substitutes: 22, squads: 31 },
  'nb1-34295f65a151': { birthDate: '1995-07-18', position: 'Középpályás', nation: 'HUN', heightCm: 180, shirtNumber: 55, appearances: 23, starts: 19, substitutes: 4, squads: 32 },
  'nb1-07dfcc9bf7b9': { birthDate: '1994-06-16', position: 'Támadó', nation: 'HUN', shirtNumber: 86, appearances: 32, starts: 15, substitutes: 17, squads: 33 },
};

for (const [id, values] of Object.entries(expected)) {
  const player = patched.players.find(item => item.id === id);
  assert.ok(player, `Hiányzik a kiválasztott játékos: ${id}`);
  assert.equal(player.meta?.clubIds?.includes('kisvarda-master-good'), true);
  assert.equal(player.birthDate, values.birthDate, `${player.name}: hibás születési dátum`);
  assert.equal(player.position, values.position, `${player.name}: hibás poszt`);
  if ('nation' in values) assert.equal(player.nation, values.nation, `${player.name}: hibás nemzetiség`);
  if ('heightCm' in values) assert.equal(player.stats.heightCm, values.heightCm, `${player.name}: hibás magasság`);
  assert.equal(player.stats.shirtNumber ?? null, values.shirtNumber, `${player.name}: hibás mezszám`);
  assert.equal(player.stats.appearances, values.appearances, `${player.name}: hibás mérkőzésszám`);
  assert.equal(player.stats.starts, values.starts, `${player.name}: hibás kezdésszám`);
  assert.equal(player.stats.substituteAppearances, values.substitutes, `${player.name}: hibás cserepályára lépés`);
  assert.equal(player.stats.squads, values.squads, `${player.name}: hibás kerettagság`);
  assert.equal(player.stats.starts + player.stats.substituteAppearances, player.stats.appearances);
  assert.ok(player.stats.squads >= player.stats.appearances);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(player.birthDate));
  assert.ok(new Date(`${player.birthDate}T00:00:00Z`) <= new Date('2026-07-20T23:59:59Z'));
  for (const field of ['appearances', 'starts', 'substituteAppearances', 'squads', 'goals', 'yellowCards', 'redCards', 'secondYellowRedCards', 'totalDismissals']) {
    assert.ok(player.stats[field] == null || player.stats[field] >= 0, `${player.name}: negatív ${field}`);
  }
  const sources = player.meta?.clubOfficialSources ?? [];
  assert.ok(sources.some(source => source.checkedAt === '2026-07-20'), `${player.name}: hiányzó forrásmetaadat`);
}

const mesanovic = patched.players.find(player => player.id === 'nb1-7bc81b0db266');
assert.equal(mesanovic.stats.starts, 20);
assert.equal(mesanovic.stats.substituteAppearances, 2);
assert.ok(mesanovic.meta.officialStatSources.some(source =>
  source.sourceId === 'mlsz-fizz-liga-kisvarda-selected10-2-2025-26'
  && source.correctedFields.includes('starts')
  && source.correctedFields.includes('substituteAppearances')
));

const mbock = patched.players.find(player => player.id === 'nb1-2e28ae6a6417');
assert.equal(mbock.meta.clubOfficial.secondNationality, 'CMR');
assert.equal(mbock.meta.clubOfficial.strongFoot, 'jobb');
assert.equal(mbock.meta.clubOfficial.currentStatus, 'active');

const matanovic = patched.players.find(player => player.id === 'nb1-cce1ff8d0032');
assert.equal(matanovic.meta.clubOfficial.loanStatus, false);
assert.equal(matanovic.meta.clubOfficial.permanentFrom, '2025-06-11');
assert.equal(matanovic.meta.clubOfficial.strongFoot, 'bal');

const matic = patched.players.find(player => player.id === 'nb1-194f70766db2');
assert.equal(matic.meta.clubOfficial.departedAt, '2026-01-22');
assert.equal(matic.meta.clubOfficial.currentStatus, 'departed');
assert.equal(matic.meta.clubOfficial.seasonStatus, 'departed-midseason-injured');

const melnik = patched.players.find(player => player.id === 'nb1-b491c6bd8e82');
assert.equal(melnik.meta.clubOfficial.birthPlace, 'Volodimir-Volinszkij, Ukrajna');
assert.equal(melnik.meta.clubOfficial.strongFoot, 'jobb');
assert.equal(melnik.meta.clubOfficial.secondaryPosition, 'Szélső védő');

for (const record of selectedEnrichment.records) {
  assert.ok(selectedIds.some(id => {
    const player = basePayload.players.find(item => item.id === id);
    return player && enrichmentNamesMatch(player.name, record);
  }), `A tízes körön kívüli rekord került a csomagba: ${record.name}`);
  assert.equal(record.checkedAt, '2026-07-20');
  assert.equal(record.season, '2025/26');
  assert.equal(record.confidence, 'high');
  assert.match(record.sourceUrl, /^https:\/\//);
}

assertRegisteredDataFile('club-official-enrichment-8-kisvarda-selected10.json', 'enrichments');
assertRegisteredDataFile('club-official-corrections-4-kisvarda-selected10-2.json', 'corrections');
assertRegisteredDataFile('club-official-stat-patches-kisvarda-selected10-2.json', 'statPatches');

console.log('✓ Második Kisvárda-tízes: 10/10 játékos forrásolt alapadatai, kerettagsága és két bizonyított MLSZ-korrekciója rendben');
