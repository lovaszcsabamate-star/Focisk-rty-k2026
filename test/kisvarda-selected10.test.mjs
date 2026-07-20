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
const selectedEnrichment = readJson('../data/club-official-enrichment-7-kisvarda-selected10.json');
const selectedStats = readJson('../data/club-official-stat-patches-kisvarda-selected10.json');
const enrichmentFiles = [
  '../data/club-official-enrichment.json',
  '../data/club-official-enrichment-2.json',
  '../data/club-official-enrichment-3-paks-nyir.json',
  '../data/club-official-enrichment-4-ujpest.json',
  '../data/club-official-enrichment-5-other.json',
  '../data/club-official-enrichment-6-eto-puskas.json',
  '../data/club-official-enrichment-7-kisvarda-selected10.json',
];
const correctionFiles = [
  '../data/club-official-corrections.json',
  '../data/club-official-corrections-2.json',
  '../data/club-official-corrections-3.json',
];
const statPatchFiles = [
  '../data/club-official-stat-patches-kisvarda.json',
  '../data/club-official-stat-patches-kisvarda-selected10.json',
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
assert.equal(patched.officialStatPatches.records, 40);
assert.equal(patched.officialStatPatches.matchedRecords, 40);
assert.equal(patched.officialStatPatches.unmatchedRecords, 0);
assert.equal(patched.officialStatPatches.conflictCount, 0);
assert.equal(patched.officialStatPatches.sources.length, 2);
assert.equal(patched.coverage.birthDate, 275);
assert.equal(patched.coverage.squads, 117);

const expected = {
  'nb1-8061aa670d1b': { birthDate: '2007-01-16', position: 'Középpályás', shirtNumber: null, appearances: 0, starts: 0, substitutes: 0, squads: 1 },
  'nb1-482c77bd9d65': { birthDate: '2006-11-14', position: 'Középpályás', nation: 'NGR', shirtNumber: 6, appearances: 28, starts: 26, substitutes: 2, squads: 29 },
  'nb1-3ec979342281': { birthDate: '1995-07-18', position: 'Védő', nation: 'BIH', heightCm: 189, shirtNumber: 3, appearances: 20, starts: 17, substitutes: 3, squads: 29 },
  'nb1-634e0e27432f': { birthDate: '1998-07-14', position: 'Támadó', shirtNumber: 29, appearances: 31, starts: 28, substitutes: 3, squads: 32 },
  'nb1-fa00a4ac868d': { birthDate: '1997-01-11', position: 'Védő', nation: 'CZE', shirtNumber: 5, appearances: 29, starts: 28, substitutes: 1, squads: 32 },
  'nb1-fe0b630e6a22': { birthDate: '1995-05-24', position: 'Védő', nation: 'BIH / CRO', shirtNumber: 24, appearances: 29, starts: 25, substitutes: 4, squads: 30 },
  'nb1-c41102009eb6': { birthDate: '2000-05-25', position: 'Védő', shirtNumber: null, appearances: 1, starts: 0, substitutes: 1, squads: 2 },
  'nb1-3f02cae67457': { birthDate: '2007-11-17', position: 'Középpályás', shirtNumber: null, appearances: 0, starts: 0, substitutes: 0, squads: 1 },
  'nb1-1f4f96815ad4': { birthDate: '2003-02-09', position: 'Kapus', heightCm: 185, shirtNumber: 1, appearances: 0, starts: 0, substitutes: 0, squads: 32 },
  'nb1-d41a8ab9b25c': { birthDate: '2001-06-30', position: 'Védő', shirtNumber: 18, appearances: 9, starts: 0, substitutes: 9, squads: 18 },
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
  for (const field of ['appearances', 'starts', 'substituteAppearances', 'squads', 'goals', 'yellowCards', 'redCards', 'totalDismissals']) {
    assert.ok(player.stats[field] == null || player.stats[field] >= 0, `${player.name}: negatív ${field}`);
  }
  const sources = player.meta?.clubOfficialSources ?? [];
  assert.ok(sources.some(source => source.checkedAt === '2026-07-20'), `${player.name}: hiányzó forrásmetaadat`);
}

const popoola = patched.players.find(player => player.id === 'nb1-482c77bd9d65');
assert.equal(popoola.meta.clubOfficial.seasonClub, 'Kisvárda Master Good');
assert.equal(popoola.meta.clubOfficial.currentClub, 'Al Wasl');
assert.equal(popoola.meta.clubOfficial.currentStatus, 'transferred');
assert.equal(popoola.meta.clubOfficial.seasonShirtNumber, 6);

const adayilo = patched.players.find(player => player.id === 'nb1-c41102009eb6');
assert.equal(adayilo.meta.clubOfficial.seasonClub, 'Kisvárda Master Good');
assert.equal(adayilo.meta.clubOfficial.currentClub, 'MFK Zvolen');
assert.equal(adayilo.meta.clubOfficial.currentStatus, 'transferred');

const kormendi = patched.players.find(player => player.id === 'nb1-d41a8ab9b25c');
assert.equal(kormendi.meta.clubOfficial.loanTo, 'Tiszakécskei LC');
assert.equal(kormendi.meta.clubOfficial.loanStatus, true);
assert.equal(kormendi.meta.clubOfficial.seasonStatus, 'loaned-second-half');

const jovicic = patched.players.find(player => player.id === 'nb1-3ec979342281');
assert.equal(jovicic.meta.clubOfficial.seasonClub, 'Kisvárda Master Good');
assert.equal(jovicic.meta.clubOfficial.currentStatus, 'departed');
assert.equal(jovicic.meta.clubOfficial.seasonStatus, 'released-before-final-two-rounds');

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
  'club-official-enrichment-7-kisvarda-selected10.json',
  'club-official-stat-patches-kisvarda-selected10.json',
]) {
  for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
    assert.match(readText(source), new RegExp(file.replaceAll('.', '\\.')));
  }
}

console.log('✓ Első Kisvárda-tízes: 10/10 játékos forrásolt alapadatai, Fizz Liga sorai és kerettagsága rendben');
