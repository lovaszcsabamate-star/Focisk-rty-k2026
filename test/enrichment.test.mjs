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
];
const rawParts = enrichmentFiles.map(readJson);
const directory = readJson('../data/club-official-sources.json');
const corrections = readJson('../data/club-official-corrections.json');
const rawEnrichment = {
  ...rawParts[0],
  generatedAt: rawParts.at(-1)?.generatedAt ?? rawParts[0].generatedAt,
  sources: rawParts.flatMap(part => part.sources ?? []),
  records: rawParts.flatMap(part => part.records ?? []),
  clubDirectory: directory.clubs,
};
const enrichment = prepareClubEnrichment(rawEnrichment, corrections);
const enriched = applyClubEnrichmentPayload(payload, enrichment);

assert.equal(Object.keys(payload.clubs).length, 12);
assert.equal(directory.clubs.length, 12);
assert.equal(new Set(directory.clubs.map(club => club.clubId)).size, 12);
assert.equal(rawParts.length, 5);
assert.equal(rawEnrichment.records.length, 293);
assert.equal(enrichment.records.length, rawEnrichment.records.length - corrections.excludeRecords.length);
assert.equal(enriched.players.length, 440);
assert.equal(enriched.selection.registrationRecords, 464);
assert.deepEqual(
  enriched.players.map(card => card.id),
  payload.players.map(card => card.id),
  'az eredeti adatbázis sorrendje és azonosítói változatlanok maradnak',
);
assert.equal(new Set(enriched.players.map(card => card.id)).size, 440);
assert.equal(enriched.enrichment.clubSummary.length, 12);
assert.equal(enriched.source.officialClubDirectory.length, 12);
assert.ok(enriched.enrichment.matchedRecords >= 200, 'legalább 200 hivatalos rekordnak automatikusan illeszkednie kell');
assert.ok(enriched.enrichment.unmatchedRecords <= 100, 'a bizonytalan rekordok kézi ellenőrzési listán maradnak');
assert.equal(enriched.enrichment.manualReview.length, enriched.enrichment.unmatchedRecords);
assert.equal(enriched.enrichment.addedPlayers, 0, 'aktuális klubprofil nem hozhat létre új 2025/26-os kártyát');
assert.equal(enriched.enrichment.updatedExistingPlayers, 1);
assert.equal(enriched.enrichment.updatedPlayers[0].name, 'ABU FANI MOHAMMAD');
assert.equal(enriched.selection.playableCards, 440);
assert.equal(enriched.selection.uniquePlayers, 440);
assert.equal(enriched.coverage.goals, 440);
assert.ok(enriched.coverage.position > 149);
assert.ok(enriched.coverage.shirtNumber > 137);
assert.ok(enriched.coverage.heightCm >= 27);
assert.ok(enriched.coverage.officialMetadata > 0);
assert.equal(enriched.selection.exactBirthDates, enriched.coverage.birthDate);
assert.equal(
  enriched.players.filter(card => normaliseEnrichmentText(card.position) === 'NINCS ADAT'
    || normaliseEnrichmentText(card.nation) === 'NINCS ADAT').length,
  0,
);

const find = (clubId, name) => enriched.players.find(card =>
  card?.meta?.clubIds?.includes(clubId) && enrichmentNamesMatch(card.name, { name })
);

const dibusz = find('ferencvarosi-tc', 'Dibusz Dénes');
assert.ok(dibusz);
assert.equal(dibusz.position, 'Kapus');

const bode = find('paksi-fc', 'Böde Dániel');
assert.ok(bode);
assert.equal(bode.position, 'Támadó');
assert.equal(bode.meta.clubOfficial.captain, true);

const banai = find('ujpest-fc', 'Banai Dávid');
assert.ok(banai);
assert.equal(banai.position, 'Kapus');
assert.equal(banai.stats.heightCm, 189);
assert.equal(banai.meta.clubOfficial.strongFoot, 'jobb');

const szendrei = find('zte-fc', 'Szendrei Norbert');
assert.ok(szendrei);
assert.equal(szendrei.position, 'Középpályás');
assert.equal(szendrei.meta.clubOfficial.captain, true);
assert.equal(szendrei.meta.clubOfficial.seasonPlayerOfYear, '2025/26');

const popoola = find('kisvarda-master-good', 'Ridwan Popoola');
assert.ok(popoola);
assert.equal(popoola.meta.clubOfficial.nextClub, 'Al Wasl');
assert.equal(popoola.meta.clubOfficial.officialSeasonAppearances, 28);

const abuFani = find('ferencvarosi-tc', 'ABU FANI MOHAMMAD');
assert.ok(abuFani);
assert.equal(abuFani.id, 'nb1-2856e20f48e9');
assert.equal(abuFani.stats.appearances, 17);
assert.equal(abuFani.stats.yellowCards, 5);

const multiClubWithNumber = enriched.players.find(card =>
  Number(card?.meta?.registrationCount) > 1 && Object.keys(card?.meta?.clubShirtNumbers ?? {}).length > 0
);
if (multiClubWithNumber) {
  assert.equal(multiClubWithNumber.stats.shirtNumber ?? null, null);
}

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

console.log(
  `✓ 12 klubos audit: ${enriched.enrichment.matchedRecords}/${enrichment.records.length} rekord illesztve, `
  + `${enriched.enrichment.unmatchedRecords} kézi ellenőrzés, ${enriched.enrichment.conflictCount} eltérés`,
);
if (enriched.enrichment.unmatchedRecords) console.log(JSON.stringify(enriched.enrichment.manualReview, null, 2));
