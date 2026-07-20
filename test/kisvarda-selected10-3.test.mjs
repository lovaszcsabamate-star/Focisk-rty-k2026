import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const basePayload = readJson('../data/players.json');
const directory = readJson('../data/club-official-sources.json');
const selectedEnrichment = readJson('../data/club-official-enrichment-9-kisvarda-selected10.json');
const selectedStats = readJson('../data/club-official-stat-patches-kisvarda-selected10-3.json');
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
assert.equal(patched.officialStatPatches.records, 60);
assert.equal(patched.officialStatPatches.matchedRecords, 60);
assert.equal(patched.officialStatPatches.unmatchedRecords, 0);
assert.equal(patched.officialStatPatches.conflictCount, 0);
assert.equal(patched.officialStatPatches.correctionCount, 2);
assert.deepEqual(patched.officialStatPatches.correctedFieldCounts, { starts: 1, substituteAppearances: 1 });
assert.equal(patched.officialStatPatches.sources.length, 4);
assert.equal(patched.coverage.birthDate, 295);
assert.equal(patched.coverage.nation, 184);
assert.equal(patched.coverage.position, 334);
assert.equal(patched.coverage.squads, 137);
assert.equal(patched.coverage.heightCm, 57);
assert.equal(patched.coverage.shirtNumber, 288);

const expected = {
  'nb1-3ba077e8f4ad': { birthDate: '2005-11-30', position: 'Kapus', shirtNumber: 30, appearances: 33, starts: 33, substitutes: 0, squads: 33 },
  'nb1-6cbcce5a2082': { birthDate: '2007-03-17', position: 'Kapus', heightCm: 192, shirtNumber: 32, appearances: 0, starts: 0, substitutes: 0, squads: 1 },
  'nb1-1508247df0ae': { birthDate: '1994-12-02', position: 'Védő', nation: 'HUN', heightCm: 188, shirtNumber: 50, appearances: 17, starts: 17, substitutes: 0, squads: 27 },
  'nb1-4b5aebe756a9': { birthDate: '1997-01-30', position: 'Védő', nation: 'SRB', heightCm: 189, shirtNumber: 26, appearances: 14, starts: 14, substitutes: 0, squads: 15 },
  'nb1-c58be98f1211': { birthDate: '2001-01-14', position: 'Középpályás', shirtNumber: 70, appearances: 19, starts: 5, substitutes: 14, squads: 28 },
  'nb1-1fad065b3f0e': { birthDate: '2007-04-07', position: 'Középpályás', shirtNumber: 66, appearances: 1, starts: 0, substitutes: 1, squads: 12 },
  'nb1-65d519bbe651': { birthDate: '2007-09-18', position: 'Középpályás', shirtNumber: 96, appearances: 5, starts: 3, substitutes: 2, squads: 18 },
  'nb1-b7749b584ff6': { birthDate: '2000-11-29', position: 'Középpályás', shirtNumber: 8, appearances: 5, starts: 2, substitutes: 3, squads: 20 },
  'nb1-6540a986095c': { birthDate: '2000-11-29', position: 'Támadó', heightCm: 179, shirtNumber: 10, appearances: 19, starts: 14, substitutes: 5, squads: 23 },
  'nb1-651be5400806': { birthDate: '1998-11-27', position: 'Támadó', nation: 'BUL', heightCm: 180, shirtNumber: 99, appearances: 21, starts: 11, substitutes: 10, squads: 31 },
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

const papp = patched.players.find(player => player.id === 'nb1-6cbcce5a2082');
assert.equal(papp.meta.clubOfficial.currentClub, 'Kisvárda Master Good II.');
assert.equal(papp.meta.clubOfficial.currentStatus, 'reserve-team');
assert.equal(papp.meta.clubOfficial.seasonStatus, 'winter-arrival-first-team-bench-only');

const olah = patched.players.find(player => player.id === 'nb1-1508247df0ae');
assert.equal(olah.meta.clubOfficial.primaryPosition, 'Belső védő');
assert.equal(olah.meta.clubOfficial.secondaryPosition, 'Középpályás');
assert.equal(olah.meta.clubOfficial.strongFoot, 'bal');

const radmanovac = patched.players.find(player => player.id === 'nb1-4b5aebe756a9');
assert.equal(radmanovac.meta.clubOfficial.birthPlace, 'Krusevac, Szerbia');
assert.equal(radmanovac.meta.clubOfficial.strongFoot, 'jobb');
assert.equal(radmanovac.meta.clubOfficial.seasonStatus, 'winter-arrival');

const szor = patched.players.find(player => player.id === 'nb1-c58be98f1211');
assert.equal(szor.meta.clubOfficial.homegrown, true);
assert.equal(szor.meta.clubOfficial.contractExtensionAgreedAt, '2025-12-24');

const osztrovka = patched.players.find(player => player.id === 'nb1-1fad065b3f0e');
assert.equal(osztrovka.meta.clubOfficial.homegrown, true);
assert.equal(osztrovka.meta.clubOfficial.seasonStatus, 'loaned-second-half');
assert.equal(osztrovka.meta.clubOfficial.currentStatus, 'returned-from-loan');

const solteszIstvan = patched.players.find(player => player.id === 'nb1-b7749b584ff6');
const solteszDominik = patched.players.find(player => player.id === 'nb1-6540a986095c');
assert.equal(solteszIstvan.meta.clubOfficial.strongFoot, 'jobb');
assert.equal(solteszDominik.meta.clubOfficial.strongFoot, 'bal');
assert.equal(solteszDominik.meta.clubOfficial.primaryPosition, 'Szélső támadó');

const yordanov = patched.players.find(player => player.id === 'nb1-651be5400806');
assert.equal(yordanov.meta.clubOfficial.birthPlace, 'Szevlievo, Bulgária');
assert.equal(yordanov.meta.clubOfficial.strongFoot, 'jobb');
assert.equal(yordanov.meta.clubOfficial.previousClub, 'Arda Kardzsali');

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

for (const file of [
  'club-official-enrichment-9-kisvarda-selected10.json',
  'club-official-stat-patches-kisvarda-selected10-3.json',
]) {
  for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
    assert.match(readText(source), new RegExp(file.replaceAll('.', '\\.')));
  }
}

console.log('✓ Harmadik Kisvárda-tízes: 10/10 játékos forrásolt alapadatai, mezszámai és végleges Fizz Liga-kerettagsága rendben');
