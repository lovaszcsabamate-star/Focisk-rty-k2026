import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  normaliseEnrichmentText,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';

const payload = JSON.parse(fs.readFileSync(new URL('../data/players.json', import.meta.url), 'utf8'));
const rawParts = [
  JSON.parse(fs.readFileSync(new URL('../data/club-official-enrichment.json', import.meta.url), 'utf8')),
  JSON.parse(fs.readFileSync(new URL('../data/club-official-enrichment-2.json', import.meta.url), 'utf8')),
];
const rawEnrichment = {
  ...rawParts[0],
  generatedAt: rawParts.at(-1)?.generatedAt ?? rawParts[0].generatedAt,
  sources: rawParts.flatMap(part => part.sources ?? []),
  records: rawParts.flatMap(part => part.records ?? []),
};
const corrections = JSON.parse(fs.readFileSync(new URL('../data/club-official-corrections.json', import.meta.url), 'utf8'));
const enrichment = prepareClubEnrichment(rawEnrichment, corrections);
const enriched = applyClubEnrichmentPayload(payload, enrichment);

assert.equal(rawParts[0].records.length, 86);
assert.equal(rawParts[1].records.length, 75);
assert.equal(rawEnrichment.records.length, 161);
assert.equal(corrections.recordPatches.length, 7);
assert.equal(corrections.excludeRecords.length, 8);
assert.equal(enrichment.records.length, 153);
assert.equal(enrichment.excludedRecords.length, 8);
assert.equal(enrichment.additions.length, 1);
assert.equal(enriched.players.length, payload.players.length);
assert.deepEqual(
  enriched.players.map(card => card.id),
  payload.players.map(card => card.id),
  'az eredeti adatbázis sorrendje és azonosítói változatlanok maradnak',
);
assert.equal(new Set(enriched.players.map(card => card.id)).size, enriched.players.length);
assert.equal(enriched.enrichment.matchedRecords, 153);
assert.equal(enriched.enrichment.unmatchedRecords, 0);
assert.equal(enriched.enrichment.excludedRecords, 8);
assert.equal(enriched.enrichment.addedPlayers, 0);
assert.equal(enriched.enrichment.updatedExistingPlayers, 1);
assert.equal(enriched.enrichment.updatedPlayers[0].name, 'ABU FANI MOHAMMAD');
assert.equal(enriched.enrichment.skippedCorrections.length, 0);
assert.equal(enriched.enrichment.conflictCount, 0);
assert.equal(enriched.selection.playableCards, payload.selection.playableCards);
assert.equal(enriched.selection.uniquePlayers, payload.selection.uniquePlayers);
assert.equal(enriched.selection.registrationRecords, payload.selection.registrationRecords);
assert.equal(enriched.clubs['Ferencvárosi TC'], payload.clubs['Ferencvárosi TC']);
assert.equal(enriched.coverage.birthDate, 222);
assert.equal(enriched.coverage.appearances, (payload.coverage.appearances ?? 0) + 1);
assert.equal(enriched.coverage.starts, (payload.coverage.starts ?? 0) + 1);
assert.equal(enriched.coverage.squads, (payload.coverage.squads ?? 0) + 1);
assert.equal(enriched.coverage.yellowCards, (payload.coverage.yellowCards ?? 0) + 1);
assert.equal(enriched.coverage.redCards, (payload.coverage.redCards ?? 0) + 1);
assert.equal(enriched.coverage.totalDismissals, (payload.coverage.totalDismissals ?? 0) + 1);
assert.equal(enriched.coverage.position, 149);
assert.equal(enriched.coverage.nation, 149);
assert.equal(enriched.coverage.heightCm, 27);
assert.equal(enriched.coverage.shirtNumber, 137);
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
assert.ok(szatmari);
assert.equal(szatmari.position, 'Védő');
assert.equal(szatmari.stats.heightCm, 198);

const dibusz = find('ferencvarosi-tc', 'Dibusz Dénes');
assert.ok(dibusz);
assert.equal(dibusz.position, 'Kapus');
assert.equal(dibusz.stats.shirtNumber, 90);

const gordic = find('dvsc', 'GORDIC DORDE');
assert.ok(gordic, 'Gordić Đorđe klubnév az MLSZ GORDIC DORDE rekordjához illeszkedik');
assert.equal(gordic.position, 'Középpályás');
assert.equal(gordic.nation, 'SRB');
assert.equal(gordic.stats.shirtNumber, 14);

const manzanara = find('dvsc', 'LOPEZ DE LA MANZANARA DELGADO FRANCISCO JESUS');
assert.ok(manzanara, 'Manzanara rövid név az MLSZ teljes névformájához illeszkedik');
assert.equal(manzanara.position, 'Középpályás');
assert.equal(manzanara.nation, 'ESP');
assert.equal(manzanara.stats.shirtNumber, 16);

const kulbachuk = find('dvsc', 'KULBACHUK VIACHESLAV');
assert.ok(kulbachuk);
assert.equal(kulbachuk.birthDate, '2004-08-25', 'az MLSZ születési dátuma marad');
assert.equal(kulbachuk.stats.shirtNumber, 49);

const mejias = find('dvsc', 'MEJIAS GARCIA JOSUA ANTONIO');
assert.ok(mejias);
assert.equal(mejias.birthDate, '1997-06-09', 'az MLSZ születési dátuma marad');
assert.equal(mejias.stats.shirtNumber, 4);

const barany = find('dvsc', 'Bárány Donát');
assert.ok(barany);
assert.equal(barany.position, 'Támadó');
assert.equal(barany.birthDate, '2000-09-04', 'az MLSZ-ben ellenőrzött születési dátum marad');
assert.equal(barany.stats.shirtNumber, 17);

const bermejo = find('dvsc', 'Bermejo Escribano Alex');
assert.ok(bermejo);
assert.equal(bermejo.position, 'Támadó');
assert.equal(bermejo.birthDate, '1998-12-11', 'a nyilvánvaló kluboldali dátumhiba nem kerül át');

const bognar = find('mtk-budapest', 'Bognár István');
assert.ok(bognar);
assert.equal(bognar.position, 'Középpályás');
assert.equal(bognar.stats.heightCm, 175);
assert.equal(bognar.stats.shirtNumber, 10);

const jurina = find('mtk-budapest', 'Jurina Marin');
assert.ok(jurina);
assert.equal(jurina.position, 'Támadó');
assert.equal(jurina.stats.heightCm, 188);

const abuFani = find('ferencvarosi-tc', 'ABU FANI MOHAMMAD');
assert.ok(abuFani);
assert.equal(abuFani.id, 'nb1-2856e20f48e9');
assert.equal(abuFani.stats.appearances, 17);
assert.equal(abuFani.stats.starts, 9);
assert.equal(abuFani.stats.squads, 23);
assert.equal(abuFani.stats.yellowCards, 5);
assert.equal(abuFani.stats.redCards, 0);

for (const [clubId, name] of [
  ['ferencvarosi-tc', 'Tóth Zalán'],
  ['dvsc', 'Engedi Márk'],
  ['dvsc', 'Gyenti Kristóf'],
  ['dvsc', 'Hornyák Csaba'],
  ['dvsc', 'Nwachukwu David'],
  ['dvsc', 'Polozhyi Ivan'],
  ['dvsc', 'Batai Tamás'],
  ['dvsc', 'Vázquez Erik'],
]) {
  assert.equal(
    enriched.players.some(card => card?.meta?.clubIds?.includes(clubId)
      && enrichmentNamesMatch(card.name, { name })),
    false,
    `${name} nem kerülhet igazolatlan Fizz Liga-kártyaként az adatbázisba`,
  );
}

const acolatse = find('dvtk', 'Acolatse Elton');
if (acolatse?.meta?.registrationCount > 1) {
  assert.equal(acolatse.stats.shirtNumber ?? null, null);
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
assert.equal(conflictResult.players[0].birthDate, '2000-01-01');
assert.equal(conflictResult.players[0].position, 'Védő');
assert.equal(conflictResult.enrichment.conflictCount, 1);
assert.equal(normaliseEnrichmentText("O'Dowda, Callum"), 'O DOWDA CALLUM');

console.log(
  `✓ Kluboldali audit: ${enriched.enrichment.matchedRecords}/${enrichment.records.length} rekord illesztve, `
  + `${enriched.enrichment.unmatchedRecords} illesztetlen rekord, `
  + `${enriched.enrichment.conflictCount} forrásütközés`,
);
