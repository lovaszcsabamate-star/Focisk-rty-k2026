import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';
import { assertRegisteredDataFile } from './database-manifest-assertions.mjs';

const CLUB_ID = 'kolorcity-kazincbarcika-sc';
const ENRICHMENT_FILE = 'club-official-enrichment-16-kazincbarcika-completion.json';
const PATCH_FILE = 'club-official-stat-patches-kazincbarcika.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);

const base = readJson('../data/players.json');
const enrichment = readJson(`../data/${ENRICHMENT_FILE}`);
const patch = readJson(`../data/${PATCH_FILE}`);

assert.equal(enrichment.schemaVersion, 1);
assert.equal(enrichment.season, '2025/26');
assert.equal(enrichment.batch.playerCount, 40);
assert.equal(enrichment.records.length, 40);
assert.equal(new Set(enrichment.records.map(record => record.name)).size, 40);
assert.equal(new Set(enrichment.records.map(record => record.sourceUrl)).size, 40);

const allowedPositions = new Set(['Kapus', 'Védő', 'Középpályás', 'Támadó']);
for (const record of enrichment.records) {
  assert.equal(record.clubId, CLUB_ID);
  assert.equal(record.confidence, 'high');
  assert.match(record.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(record.nation, /^[A-Z]{3}( \/ [A-Z]{3})*$/);
  assert.ok(allowedPositions.has(record.position), `${record.name}: hibás poszt`);
  assert.match(record.sourceUrl, /^https:\/\/adatbank\.mlsz\.hu\/player\/\d+\.html$/);
}

assert.equal(patch.schemaVersion, 1);
assert.equal(patch.season, '2025/26');
assert.equal(patch.source.clubId, CLUB_ID);
assert.match(patch.source.url, /^https:\/\/adatbank\.mlsz\.hu\//);
assert.equal(patch.batch.playerCount, 40);
assert.equal(patch.rows.length, 40);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 40);
assert.equal(patch.source.additionalUrls.length, 40);
assert.equal(new Set(patch.source.additionalUrls).size, 40);
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
assert.deepEqual(expected.get('Kártik Bálint József').slice(1, 6), [32, 31, 1, 32, 4]);
assert.deepEqual(expected.get('MYHAILO MESKHI').slice(1, 6), [30, 29, 1, 30, 2]);
assert.equal(expected.get('MYHAILO MESKHI')[7], 1);
assert.deepEqual(expected.get('UBOCHIOMA MESHACK IZUCHUKWU').slice(1, 6), [28, 21, 7, 28, 4]);
assert.deepEqual(expected.get('BÁNFALVI GERGŐ').slice(1, 6), [0, 0, 0, 17, 0]);
assert.deepEqual(expected.get('Slogar Martin').slice(1, 6), [20, 15, 5, 23, 2]);

const prepared = prepareClubEnrichment(enrichment, {});
const enriched = applyClubEnrichmentPayload(base, prepared);
assert.equal(enriched.enrichment.matchedRecords, 40);
assert.equal(enriched.enrichment.unmatchedRecords, 0);
assert.equal(enriched.enrichment.conflictCount, 0);

const finalPayload = applyOfficialStatPatches(enriched, [patch]);
assert.equal(finalPayload.officialStatPatches.matchedRecords, 40);
assert.equal(finalPayload.officialStatPatches.unmatchedRecords, 0);
assert.equal(finalPayload.officialStatPatches.multiClubMetadataOnly, 6);

const cards = finalPayload.players.filter(card => clubIds(card).includes(CLUB_ID));
assert.equal(cards.length, 40);
for (const card of cards) {
  assert.match(card.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(card.nation);
  assert.ok(allowedPositions.has(card.position));
  assert.ok(card.meta.clubOfficialStatsByClub?.[CLUB_ID], `${card.name}: hiányzó klubstatisztikai metaadat`);
}

assertRegisteredDataFile(ENRICHMENT_FILE, 'enrichments');
assertRegisteredDataFile(PATCH_FILE, 'statPatches');
assert.match(patch.source.scope, /nem közölnek játékpercet és gólpasszt/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ Kazincbarcika lezárva: 40/40 alapadat és 40/40 MLSZ Fizz Liga-rekord konzisztens');
