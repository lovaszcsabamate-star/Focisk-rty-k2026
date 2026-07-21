import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';
import { applyVerifiedPlayerCorrections } from '../js/data/verified-player-corrections.js';

const CLUB_ID = 'puskas-akademia-fc';
const ENRICHMENT_FILE = 'club-official-enrichment-20-puskas-completion.json';
const CORRECTION_FILE = 'club-official-corrections-5-puskas.json';
const PATCH_FILE = 'club-official-stat-patches-puskas.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);

const base = readJson('../data/players.json');
const enrichment = readJson(`../data/${ENRICHMENT_FILE}`);
const correction = readJson(`../data/${CORRECTION_FILE}`);
const patch = readJson(`../data/${PATCH_FILE}`);
const currentRoster = readJson('../data/club-official-enrichment-6-eto-puskas.json');

assert.equal(enrichment.schemaVersion, 1);
assert.equal(enrichment.season, '2025/26');
assert.equal(enrichment.batch.playerCount, 34);
assert.equal(enrichment.records.length, 34);
assert.equal(new Set(enrichment.records.map(record => record.name)).size, 34);
assert.equal(new Set(enrichment.records.map(record => record.sourceUrl)).size, 34);

const allowedPositions = new Set(['Kapus', 'Védő', 'Középpályás', 'Támadó']);
for (const record of enrichment.records) {
  assert.equal(record.clubId, CLUB_ID);
  assert.equal(record.confidence, 'high');
  assert.match(record.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(record.nation, /^[A-Z]{3}( \/ [A-Z]{3})*$/);
  assert.ok(allowedPositions.has(record.position), `${record.name}: hibás poszt`);
  assert.match(record.sourceUrl, /^https:\/\/adatbank\.mlsz\.hu\/player\/\d+\.html$/);
}

const records = new Map(enrichment.records.map(record => [record.name, record]));
assert.deepEqual(
  Object.fromEntries(['birthDate', 'nation', 'position'].map(field => [field, records.get('Ásványi Domonkos')[field]])),
  { birthDate: '2006-06-02', nation: 'HUN', position: 'Védő' },
);
assert.equal(records.get('DALA MARTIN').position, 'Kapus');
assert.equal(records.get('DÁRDAI PÁL').nation, 'HUN / GER');
assert.equal(records.get("D'Encarnacao Duarte Laros Michael").nation, 'CPV / NED');
assert.equal(records.get('NÉMETH ANDRÁS').nation, 'HUN / RSA');
assert.equal(records.get('SOISALO MIKAEL ANTERO').birthDate, '1998-04-24');

assert.equal(correction.recordPatches.length, 1);
assert.equal(correction.recordPatches[0].name, 'Mikael Soisalo');
assert.equal(correction.recordPatches[0].birthDate, '1998-04-24');
assert.equal(correction.verifiedCorrections.length, 1);
assert.deepEqual(correction.verifiedCorrections[0].overrideFields, ['birthDate']);
const preparedCurrent = prepareClubEnrichment(currentRoster, correction);
assert.equal(
  preparedCurrent.records.find(record => record.name === 'Mikael Soisalo').birthDate,
  '1998-04-24',
);

assert.equal(patch.schemaVersion, 1);
assert.equal(patch.season, '2025/26');
assert.equal(patch.source.clubId, CLUB_ID);
assert.match(patch.source.url, /^https:\/\/adatbank\.mlsz\.hu\//);
assert.equal(patch.batch.playerCount, 34);
assert.equal(patch.rows.length, 34);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 34);
assert.equal(patch.source.additionalUrls.length, 34);
assert.equal(new Set(patch.source.additionalUrls).size, 34);
assert.deepEqual(patch.fields, [
  'name',
  'appearances',
  'starts',
  'substituteAppearances',
  'squads',
  'goals',
  'yellowCards',
  'redCards',
  'totalDismissals',
]);

for (const row of patch.rows) {
  assert.equal(row.length, patch.fields.length, `${row[0]}: hibás oszlopszám`);
  const [name, appearances, starts, substitutes, squads, goals, yellow, red, dismissals] = row;
  assert.equal(typeof name, 'string');
  for (const [field, value] of Object.entries({ appearances, starts, substitutes, squads, goals, yellow, red, dismissals })) {
    assert.equal(Number.isInteger(value), true, `${name}: hibás ${field}`);
    assert.ok(value >= 0, `${name}: negatív ${field}`);
  }
  assert.equal(starts + substitutes, appearances, `${name}: hibás kezdés/csere bontás`);
  assert.ok(squads >= appearances, `${name}: a kerettagság kisebb a pályára lépésnél`);
  assert.equal(dismissals, red, `${name}: hibás teljes kiállításszám`);
}

const expected = new Map(patch.rows.map(row => [row[0], row]));
assert.deepEqual(expected.get('Lukács Dániel').slice(1, 6), [33, 33, 0, 33, 17]);
assert.deepEqual(expected.get('NAGY ZSOLT').slice(1, 6), [28, 28, 0, 28, 7]);
assert.deepEqual(expected.get('SZAPPANOS PÉTER').slice(1, 6), [31, 31, 0, 31, 0]);
assert.equal(expected.get('MARKGRÁF ÁKOS')[7], 1);
assert.deepEqual(expected.get('KRUPA ZSOLT').slice(1, 6), [0, 0, 0, 3, 0]);

const corrected = applyVerifiedPlayerCorrections(base, correction.verifiedCorrections);
assert.equal(corrected.verifiedPlayerCorrections.requested, 1);
assert.equal(corrected.verifiedPlayerCorrections.appliedPlayers, 1);
assert.equal(corrected.verifiedPlayerCorrections.appliedFields, 1);
assert.equal(
  corrected.players.find(card => card.id === 'nb1-0313d575ded4').birthDate,
  '1998-04-24',
);
const prepared = prepareClubEnrichment(enrichment, correction);
const enriched = applyClubEnrichmentPayload(corrected, prepared);
assert.equal(enriched.enrichment.matchedRecords, 34);
assert.equal(enriched.enrichment.unmatchedRecords, 0);
assert.equal(enriched.enrichment.conflictCount, 0);

const finalPayload = applyOfficialStatPatches(enriched, [patch]);
assert.equal(finalPayload.officialStatPatches.matchedRecords, 34);
assert.equal(finalPayload.officialStatPatches.unmatchedRecords, 0);
assert.equal(finalPayload.officialStatPatches.multiClubMetadataOnly, 4);

const cards = finalPayload.players.filter(card => clubIds(card).includes(CLUB_ID));
assert.equal(cards.length, 34);
for (const card of cards) {
  assert.match(card.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(card.nation, `${card.name}: hiányzó nemzetiség`);
  assert.ok(allowedPositions.has(card.position), `${card.name}: hibás végleges poszt`);
  assert.ok(card.meta.clubOfficialStatsByClub?.[CLUB_ID], `${card.name}: hiányzó klubstatisztikai metaadat`);
}
assert.equal(cards.find(card => card.name === 'SOISALO MIKAEL ANTERO').birthDate, '1998-04-24');

for (const multiClubName of [
  'COLLEY LAMIN',
  'DALA MARTIN',
  'KEREZSI ZALÁN MÁRK',
  'STRONATI PATRIZIO',
]) {
  assert.ok(expected.has(multiClubName), `Hiányzó többklubos statisztikai sor: ${multiClubName}`);
}

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  const text = readText(source);
  assert.match(text, new RegExp(ENRICHMENT_FILE.replaceAll('.', '\\.')));
  assert.match(text, new RegExp(CORRECTION_FILE.replaceAll('.', '\\.')));
  assert.match(text, new RegExp(PATCH_FILE.replaceAll('.', '\\.')));
  assert.match(text, /verified-player-corrections/);
}
assert.match(patch.source.scope, /nem kerül becslésre/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ Puskás Akadémia lezárva: 34/34 alapadat és 34/34 MLSZ Fizz Liga-rekord konzisztens');
