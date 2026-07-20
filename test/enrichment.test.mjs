import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  normaliseEnrichmentText,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';

const payload = JSON.parse(fs.readFileSync(new URL('../data/players.json', import.meta.url), 'utf8'));
const rawEnrichment = JSON.parse(fs.readFileSync(new URL('../data/club-official-enrichment.json', import.meta.url), 'utf8'));
const corrections = JSON.parse(fs.readFileSync(new URL('../data/club-official-corrections.json', import.meta.url), 'utf8'));
const enrichment = prepareClubEnrichment(rawEnrichment, corrections);
const enriched = applyClubEnrichmentPayload(payload, enrichment);

assert.equal(rawEnrichment.schemaVersion, 1);
assert.equal(rawEnrichment.season, '2025/26');
assert.equal(rawEnrichment.records.length, 86);
assert.equal(enrichment.records.length, 85);
assert.equal(enrichment.excludedRecords.length, 1);
assert.equal(enrichment.additions.length, 1);
assert.equal(enriched.players.length, payload.players.length);
assert.deepEqual(
  enriched.players.map(card => card.id),
  payload.players.map(card => card.id),
  'az eredeti adatbázis sorrendje és azonosítói változatlanok maradnak',
);
assert.equal(new Set(enriched.players.map(card => card.id)).size, enriched.players.length);
assert.equal(enriched.enrichment.matchedRecords, enrichment.records.length);
assert.equal(enriched.enrichment.unmatchedRecords, 0);
assert.equal(enriched.enrichment.excludedRecords, 1);
assert.equal(enriched.enrichment.addedPlayers, 0);
assert.equal(enriched.enrichment.updatedExistingPlayers, 1);
assert.equal(enriched.enrichment.updatedPlayers[0].name, 'ABU FANI MOHAMMAD');
assert.equal(enriched.enrichment.skippedCorrections.length, 0);
assert.equal(enriched.selection.playableCards, payload.selection.playableCards);
assert.equal(enriched.selection.uniquePlayers, payload.selection.uniquePlayers);
assert.equal(enriched.selection.registrationRecords, payload.selection.registrationRecords);
assert.equal(enriched.clubs['Ferencvárosi TC'], payload.clubs['Ferencvárosi TC']);
assert.ok(enriched.coverage.birthDate > (payload.coverage.birthDate ?? 0));
assert.equal(enriched.coverage.appearances, (payload.coverage.appearances ?? 0) + 1);
assert.equal(enriched.coverage.starts, (payload.coverage.starts ?? 0) + 1);
assert.equal(enriched.coverage.squads, (payload.coverage.squads ?? 0) + 1);
assert.equal(enriched.coverage.yellowCards, (payload.coverage.yellowCards ?? 0) + 1);
assert.equal(enriched.coverage.redCards, (payload.coverage.redCards ?? 0) + 1);
assert.equal(enriched.coverage.totalDismissals, (payload.coverage.totalDismissals ?? 0) + 1);
assert.ok(enriched.coverage.position > 0);
assert.ok(enriched.coverage.nation > 0);
assert.ok(enriched.coverage.heightCm > 0);
assert.ok(enriched.coverage.shirtNumber > 0);
assert.equal(enriched.selection.exactBirthDates, enriched.coverage.birthDate);
assert.equal(enriched.enrichment.coverageAfter.birthDate, enriched.coverage.birthDate);
assert.equal(
  enriched.players.filter(card => normaliseEnrichmentText(card.position) === 'NINCS ADAT'
    || normaliseEnrichmentText(card.nation) === 'NINCS ADAT').length,
  0,
  'a szöveges hiányértékek nem maradhatnak meg valódi adatként',
);

const find = (clubId, name) => enriched.players.find(card =>
  card?.meta?.clubIds?.includes(clubId) && enrichmentNamesMatch(card.name, { name })
);

const szatmari = find('dvtk', 'Szatmári Csaba');
assert.ok(szatmari, 'Szatmári Csaba rekord');
assert.equal(szatmari.position, 'Védő');
assert.equal(szatmari.nation, 'HUN');
assert.equal(szatmari.stats.heightCm, 198);
assert.equal(szatmari.stats.shirtNumber, 3);

const dibusz = find('ferencvarosi-tc', 'Dibusz Dénes');
assert.ok(dibusz, 'Dibusz Dénes rekord');
assert.equal(dibusz.position, 'Kapus');
assert.equal(dibusz.nation, 'HUN');
assert.equal(dibusz.stats.shirtNumber, 90);

const makreckis = find('ferencvarosi-tc', 'MAKRECKIS CEBRAILS');
assert.ok(makreckis, 'Makreckis Cebrails MLSZ-névforma');
assert.equal(makreckis.position, 'Védő');
assert.equal(makreckis.nation, 'LAT / GER');
assert.equal(makreckis.stats.shirtNumber, 25);

const cadu = find('ferencvarosi-tc', 'LOPES CRUZ CARLOS EDUARDO');
assert.ok(cadu, 'Cadu MLSZ teljes névformája');
assert.equal(cadu.position, 'Középpályás');
assert.equal(cadu.nation, 'BRA');
assert.equal(cadu.stats.shirtNumber, 20);

const abuFani = find('ferencvarosi-tc', 'ABU FANI MOHAMMAD');
assert.ok(abuFani, 'Abu Fani igazolt MLSZ-rekord');
assert.equal(abuFani.id, 'nb1-2856e20f48e9', 'az eredeti játékosazonosító megmarad');
assert.equal(abuFani.position, 'Középpályás');
assert.equal(abuFani.nation, 'ISR');
assert.equal(abuFani.birthDate, '1998-04-27');
assert.equal(abuFani.stats.appearances, 17);
assert.equal(abuFani.stats.starts, 9);
assert.equal(abuFani.stats.squads, 23);
assert.equal(abuFani.stats.goals, 2);
assert.equal(abuFani.stats.yellowCards, 5);
assert.equal(abuFani.stats.redCards, 0);
assert.equal(abuFani.stats.totalDismissals, 0);
assert.equal(abuFani.stats.shirtNumber, 15);
assert.equal(abuFani.meta.dataStatus, 'verified');
assert.ok(abuFani.meta.officialCorrection.fieldsApplied.includes('appearances'));

assert.equal(
  enriched.players.some(card => card?.meta?.clubIds?.includes('ferencvarosi-tc')
    && enrichmentNamesMatch(card.name, { name: 'Tóth Zalán' })),
  false,
  'FTC II.-es játékos nem kerülhet Fizz Liga-kártyaként az adatbázisba',
);

const acolatse = find('dvtk', 'Acolatse Elton');
if (acolatse?.meta?.registrationCount > 1) {
  assert.equal(acolatse.stats.shirtNumber ?? null, null, 'többklubos kártyán nincs klubspecifikus mezszám');
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
  sources: [{ id: 'test', name: 'Tesztforrás', url: 'https://example.com', checkedAt: '2026-07-20' }],
  records: [{
    sourceId: 'test', clubId: 'dvtk', name: 'Teszt Elek', birthDate: '1999-01-01',
    position: 'Védő', nation: 'HUN', shirtNumber: 4,
  }],
};
const conflictResult = applyClubEnrichmentPayload(conflictPayload, conflictEnrichment);
assert.equal(conflictResult.players[0].birthDate, '2000-01-01', 'meglévő MLSZ-adat nem írható felül');
assert.equal(conflictResult.players[0].position, 'Védő');
assert.equal(conflictResult.players[0].nation, 'HUN');
assert.equal(conflictResult.enrichment.conflictCount, 1);
assert.equal(normaliseEnrichmentText("O'Dowda, Callum"), 'O DOWDA CALLUM');

console.log(
  `✓ Kluboldali bővítés: ${enriched.enrichment.matchedRecords}/${enrichment.records.length} rekord illesztve, `
  + `${enriched.enrichment.updatedExistingPlayers} meglévő MLSZ-rekord kiegészítve`,
);
