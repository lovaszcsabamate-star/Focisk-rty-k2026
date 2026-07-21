import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';

const CLUB_ID = 'zte-fc';
const ENRICHMENT_FILE = 'club-official-enrichment-19-zte-completion.json';
const PATCH_FILE = 'club-official-stat-patches-zte.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);

const base = readJson('../data/players.json');
const enrichment = readJson(`../data/${ENRICHMENT_FILE}`);
const patch = readJson(`../data/${PATCH_FILE}`);

assert.equal(enrichment.schemaVersion, 1);
assert.equal(enrichment.season, '2025/26');
assert.equal(enrichment.batch.playerCount, 43);
assert.equal(enrichment.records.length, 43);
assert.equal(new Set(enrichment.records.map(record => record.name)).size, 43);

const allowedPositions = new Set(['Kapus', 'Védő', 'Középpályás', 'Támadó']);
for (const record of enrichment.records) {
  assert.equal(record.clubId, CLUB_ID);
  assert.equal(record.confidence, 'high');
  assert.match(record.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(record.nation, /^[A-Z]{3}( \/ [A-Z]{3})*$/);
  assert.ok(allowedPositions.has(record.position), `${record.name}: hibás poszt`);
}

const records = new Map(enrichment.records.map(record => [record.name, record]));
assert.deepEqual(
  Object.fromEntries(['birthDate', 'nation', 'position'].map(field => [field, records.get('AKPE VICTORY MADUABUCHUKWU')[field]])),
  { birthDate: '2006-07-19', nation: 'NGA', position: 'Védő' },
);
assert.deepEqual(
  Object.fromEntries(['nation', 'position'].map(field => [field, records.get('DÉNES CSANÁD VILMOS')[field]])),
  { nation: 'HUN', position: 'Támadó' },
);
assert.equal(records.get('HARANGI AIDEN JOSHUA').birthDate, '2006-02-28');
assert.equal(records.get('HARANGI AIDEN JOSHUA').nation, 'HUN / USA');
assert.equal(records.get('RODRIGUES DA SILVA DIOGO').birthDate, '2005-10-06');
assert.equal(records.get('VIEIRA FERREIRA SOUSA JOAO').nation, 'BRA');
assert.equal(records.get('VIEIRA FERREIRA SOUSA JOAO').position, 'Támadó');
assert.equal(records.get('MAURICIO ZAN').nation, 'SLO');

assert.equal(patch.schemaVersion, 1);
assert.equal(patch.season, '2025/26');
assert.equal(patch.source.clubId, CLUB_ID);
assert.match(patch.source.url, /^https:\/\/adatbank\.mlsz\.hu\//);
assert.equal(patch.batch.playerCount, 43);
assert.equal(patch.rows.length, 43);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 43);
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
assert.deepEqual(expected.get('GUNDEL-TAKÁCS BENCE').slice(1, 6), [33, 33, 0, 33, 0]);
assert.deepEqual(expected.get('Skribek Alen Martin').slice(1, 6), [29, 28, 1, 31, 10]);
assert.deepEqual(expected.get('VIEIRA FERREIRA SOUSA JOAO').slice(1, 6), [33, 27, 6, 33, 7]);
assert.equal(expected.get('VÁRKONYI BENCE')[7], 2);
assert.deepEqual(expected.get('BORSOS VILMOS').slice(1, 6), [0, 0, 0, 17, 0]);

const prepared = prepareClubEnrichment(enrichment, {});
const enriched = applyClubEnrichmentPayload(base, prepared);
assert.equal(enriched.enrichment.matchedRecords, 43);
assert.equal(enriched.enrichment.unmatchedRecords, 0);
assert.equal(enriched.enrichment.conflictCount, 0);

const finalPayload = applyOfficialStatPatches(enriched, [patch]);
assert.equal(finalPayload.officialStatPatches.matchedRecords, 43);
assert.equal(finalPayload.officialStatPatches.unmatchedRecords, 0);
assert.equal(finalPayload.officialStatPatches.multiClubMetadataOnly, 6);

const cards = finalPayload.players.filter(card => clubIds(card).includes(CLUB_ID));
assert.equal(cards.length, 43);
for (const card of cards) {
  assert.match(card.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(card.nation, `${card.name}: hiányzó nemzetiség`);
  assert.ok(allowedPositions.has(card.position), `${card.name}: hibás végleges poszt`);
  assert.ok(card.meta.clubOfficialStatsByClub?.[CLUB_ID], `${card.name}: hiányzó klubstatisztikai metaadat`);
}

for (const multiClubName of [
  'BODNÁR GERGŐ JÁNOS',
  'CROIZET YOHAN',
  'KLAUSZ MILÁN GÁBOR',
  'KRAJCSOVICS ÁBEL GYÖRGY',
  'NAGY ZSOMBOR',
  'NYÍRI VINCE TÓBIÁS',
]) {
  assert.ok(expected.has(multiClubName), `Hiányzó többklubos statisztikai sor: ${multiClubName}`);
}

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  const text = readText(source);
  assert.match(text, new RegExp(ENRICHMENT_FILE.replaceAll('.', '\\.')));
  assert.match(text, new RegExp(PATCH_FILE.replaceAll('.', '\\.')));
}
assert.match(patch.source.scope, /nem kerül becslésre/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ ZTE lezárva: 43/43 alapadat és 43/43 MLSZ Fizz Liga-rekord konzisztens');
