import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  normaliseEnrichmentText,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const payload = readJson('../data/players.json');
const enrichmentFiles = [
  '../data/club-official-enrichment.json',
  '../data/club-official-enrichment-2.json',
  '../data/club-official-enrichment-3-paks-nyir.json',
  '../data/club-official-enrichment-4-ujpest.json',
  '../data/club-official-enrichment-5-other.json',
  '../data/club-official-enrichment-6-eto-puskas.json',
];
const correctionFiles = [
  '../data/club-official-corrections.json',
  '../data/club-official-corrections-2.json',
  '../data/club-official-corrections-3.json',
];
const rawParts = enrichmentFiles.map(readJson);
const correctionParts = correctionFiles.map(readJson);
const directory = readJson('../data/club-official-sources.json');
const rawEnrichment = {
  ...rawParts[0],
  generatedAt: rawParts.at(-1)?.generatedAt ?? rawParts[0].generatedAt,
  sources: rawParts.flatMap(part => part.sources ?? []),
  records: rawParts.flatMap(part => part.records ?? []),
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
const enrichment = prepareClubEnrichment(rawEnrichment, corrections);
const enriched = applyClubEnrichmentPayload(payload, enrichment);

assert.equal(Object.keys(payload.clubs).length, 12);
assert.equal(directory.clubs.length, 12);
assert.equal(new Set(directory.clubs.map(club => club.clubId)).size, 12);
assert.equal(rawParts.at(-1).records.length, 58);
assert.equal(rawEnrichment.records.length, 351);
assert.equal(corrections.recordPatches.length, 11);
assert.equal(corrections.excludeRecords.length, 24);
assert.equal(enrichment.records.length, 327);
assert.equal(enriched.players.length, 440);
assert.equal(enriched.selection.registrationRecords, 464);
assert.deepEqual(enriched.players.map(card => card.id), payload.players.map(card => card.id));
assert.equal(new Set(enriched.players.map(card => card.id)).size, 440);
assert.equal(enriched.enrichment.clubSummary.length, 12);
assert.equal(enriched.source.officialClubDirectory.length, 12);
assert.equal(enriched.enrichment.matchedRecords, 327);
assert.equal(enriched.enrichment.unmatchedRecords, 0);
assert.equal(enriched.enrichment.manualReview.length, 0);
assert.equal(enriched.enrichment.conflictCount, 0);
assert.equal(enriched.enrichment.excludedRecords, 24);
assert.equal(enriched.enrichment.addedPlayers, 0);
assert.equal(enriched.enrichment.updatedExistingPlayers, 1);
assert.equal(enriched.enrichment.updatedPlayers[0].name, 'ABU FANI MOHAMMAD');
assert.equal(enriched.selection.playableCards, 440);
assert.equal(enriched.selection.uniquePlayers, 440);
assert.equal(enriched.coverage.birthDate, 265);
assert.equal(enriched.coverage.position, 307);
assert.equal(enriched.coverage.nation, 170);
assert.equal(enriched.coverage.heightCm, 46);
assert.equal(enriched.coverage.shirtNumber, 261);
assert.equal(enriched.coverage.officialMetadata, 41);
assert.equal(enriched.coverage.goals, 440);
assert.equal(enriched.selection.exactBirthDates, enriched.coverage.birthDate);
assert.equal(
  enriched.players.filter(card => normaliseEnrichmentText(card.position) === 'NINCS ADAT'
    || normaliseEnrichmentText(card.nation) === 'NINCS ADAT').length,
  0,
);

const find = (clubId, name) => enriched.players.find(card =>
  card?.meta?.clubIds?.includes(clubId) && enrichmentNamesMatch(card.name, { name })
);

const bode = find('paksi-fc', 'Böde Dániel');
assert.ok(bode);
assert.equal(bode.position, 'Támadó');
assert.equal(bode.meta.clubOfficial.captain, true);

const banai = find('ujpest-fc', 'Banai Dávid');
assert.ok(banai);
assert.equal(banai.stats.heightCm, 189);
assert.equal(banai.meta.clubOfficial.strongFoot, 'jobb');

const szendrei = find('zte-fc', 'Szendrei Norbert');
assert.ok(szendrei);
assert.equal(szendrei.meta.clubOfficial.captain, true);
assert.equal(szendrei.meta.clubOfficial.seasonPlayerOfYear, '2025/26');

const popoola = find('kisvarda-master-good', 'Ridwan Popoola');
assert.ok(popoola);
assert.equal(popoola.meta.clubOfficial.nextClub, 'Al Wasl');
assert.equal(popoola.meta.clubOfficial.officialSeasonAppearances, 28);

const haroyan = find('kolorcity-kazincbarcika-sc', 'HAROYAN VARAZDAT');
assert.ok(haroyan);
assert.equal(haroyan.position, 'Védő');

const meskhi = find('kolorcity-kazincbarcika-sc', 'MYHAILO MESKHI');
assert.ok(meskhi);
assert.equal(meskhi.position, 'Középpályás');

const megyeri = find('eto-fc', 'Balázs Megyeri');
assert.ok(megyeri);
assert.equal(megyeri.position, 'Kapus');
assert.equal(megyeri.stats.shirtNumber, 16);

const krpic = find('eto-fc', 'Miljan Krpic');
assert.ok(krpic);
assert.equal(krpic.position, 'Védő');
assert.equal(krpic.stats.shirtNumber, 24);

const arutiunian = find('puskas-akademia-fc', 'ARUTIUNIAN GEORGII');
assert.ok(arutiunian);
assert.equal(arutiunian.position, 'Védő');
assert.equal(arutiunian.birthDate, '2004-08-09');
assert.equal(arutiunian.stats.shirtNumber, 21);

const dardai = find('puskas-akademia-fc', 'DÁRDAI PÁL');
assert.ok(dardai);
assert.equal(dardai.position, 'Támadó');
assert.equal(dardai.birthDate, '1999-04-24');
assert.equal(dardai.stats.shirtNumber, 10);

const puskasSummary = enriched.enrichment.clubSummary.find(item => item.clubId === 'puskas-akademia-fc');
assert.deepEqual(
  {
    officialRecords: puskasSummary.officialRecords,
    eligibleRecords: puskasSummary.eligibleRecords,
    matched: puskasSummary.matched,
    excluded: puskasSummary.excluded,
    review: puskasSummary.review,
  },
  { officialRecords: 32, eligibleRecords: 27, matched: 27, excluded: 5, review: 0 },
);
const etoSummary = enriched.enrichment.clubSummary.find(item => item.clubId === 'eto-fc');
assert.deepEqual(
  {
    officialRecords: etoSummary.officialRecords,
    eligibleRecords: etoSummary.eligibleRecords,
    matched: etoSummary.matched,
    excluded: etoSummary.excluded,
    review: etoSummary.review,
  },
  { officialRecords: 28, eligibleRecords: 28, matched: 28, excluded: 0, review: 0 },
);

for (const name of ['Bozó Mirkó', 'Farkas Bendegúz', 'Pál Barna', 'Brugger Dániel', 'Somfalvi Bence']) {
  assert.ok(enrichment.excludedRecords.some(record => record.name === name && record.clubId === 'puskas-akademia-fc'));
  assert.equal(enriched.enrichment.manualReview.some(record => record.name === name), false);
}

const abuFani = find('ferencvarosi-tc', 'ABU FANI MOHAMMAD');
assert.ok(abuFani);
assert.equal(abuFani.id, 'nb1-2856e20f48e9');
assert.equal(abuFani.stats.appearances, 17);
assert.equal(abuFani.stats.yellowCards, 5);

for (const name of ['Szappanos Péter', 'Markgráf Ákos', 'Heitor', 'Etienne Amenyido', 'Muhamed Tijani']) {
  assert.equal(enriched.enrichment.manualReview.some(record => record.name === name), false);
}

const multiClubWithNumber = enriched.players.find(card =>
  Number(card?.meta?.registrationCount) > 1 && Object.keys(card?.meta?.clubShirtNumbers ?? {}).length > 0
);
if (multiClubWithNumber) assert.equal(multiClubWithNumber.stats.shirtNumber ?? null, null);

const conflictPayload = {
  players: [{
    id: 'conflict', name: 'TESZT ELEK', club: 'DVTK', position: 'Nincs adat', nation: 'Nincs adat', birthDate: '2000-01-01',
    stats: { heightCm: null, shirtNumber: null, goals: 0 },
    meta: { clubId: 'dvtk', clubIds: ['dvtk'], registrationCount: 1 },
  }],
};
const conflictEnrichment = {
  schemaVersion: 1,
  sources: [{ id: 'test', clubId: 'dvtk', name: 'Tesztforrás', url: 'https://example.com', checkedAt: '2026-07-20' }],
  records: [{
    sourceId: 'test', clubId: 'dvtk', name: 'Teszt Elek', birthDate: '1999-01-01',
    position: 'Védő', nation: 'HUN', shirtNumber: 4, meta: { captain: true },
  }],
  clubDirectory: [{ clubId: 'dvtk', clubName: 'DVTK' }],
};
const conflictResult = applyClubEnrichmentPayload(conflictPayload, prepareClubEnrichment(conflictEnrichment, {}));
assert.equal(conflictResult.players[0].birthDate, '2000-01-01');
assert.equal(conflictResult.players[0].position, 'Védő');
assert.equal(conflictResult.players[0].meta.clubOfficial.captain, true);
assert.equal(conflictResult.enrichment.conflictCount, 1);
assert.equal(normaliseEnrichmentText("O'Dowda, Callum"), 'O DOWDA CALLUM');

console.log('✓ 12 klubos audit: 327/327 rekord illesztve, 0 kézi ellenőrzés, 0 forrásütközés');
