import assert from 'node:assert/strict';
import fs from 'node:fs';

import { assertRegisteredDataFile } from './database-manifest-assertions.mjs';

const CLUB_ID = 'nyiregyhaza-spartacus-fc';
const PATCH_FILE = 'club-official-stat-patches-nyiregyhaza.json';
const COMPLETION_FILE = 'club-official-enrichment-14-nyiregyhaza-completion.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));

const patch = readJson(`../data/${PATCH_FILE}`);
const completion = readJson(`../data/${COMPLETION_FILE}`);

assert.equal(patch.schemaVersion, 1);
assert.equal(patch.season, '2025/26');
assert.equal(patch.source.clubId, CLUB_ID);
assert.equal(patch.source.season, '2025/26');
assert.match(patch.source.url, /^https:\/\/adatbank\.mlsz\.hu\//);
assert.equal(patch.batch.playerCount, 39);
assert.equal(patch.rows.length, 39);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 39);
assert.equal(patch.source.additionalUrls.length, 39);
assert.equal(new Set(patch.source.additionalUrls).size, 39);
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
  assert.ok(name.trim().length > 0, 'Üres játékosnév');
  for (const [field, value] of Object.entries({ appearances, starts, substitutes, squads, goals, yellow, red, dismissals })) {
    assert.equal(Number.isInteger(value), true, `${name}: hibás ${field}`);
    assert.ok(value >= 0, `${name}: negatív ${field}`);
  }
  assert.equal(starts + substitutes, appearances, `${name}: hibás kezdés/csere bontás`);
  assert.ok(squads >= appearances, `${name}: a kerettagság kisebb a pályára lépésnél`);
  assert.equal(dismissals, red, `${name}: a teljes kiállításszám nem egyezik az MLSZ Piros oszlopával`);
}

const expected = new Map(patch.rows.map(row => [row[0], row]));
assert.deepEqual(expected.get('TOMA GYÖRGY').slice(1, 6), [27, 13, 14, 31, 1]);
assert.deepEqual(expected.get('TEMESVÁRI ATTILA').slice(1, 6), [26, 23, 3, 28, 4]);
assert.equal(expected.get('TEMESVÁRI ATTILA')[7], 1);
assert.deepEqual(expected.get('KVASINA MARKO').slice(1, 6), [15, 15, 0, 15, 7]);
assert.deepEqual(expected.get('DALA MARTIN').slice(1, 6), [4, 4, 0, 31, 0]);
assert.deepEqual(expected.get('TÓTH BALÁZS').slice(1, 6), [0, 0, 0, 3, 0]);
assert.deepEqual(expected.get('BABIC SLOBODAN').slice(1, 6), [1, 0, 1, 3, 0]);

assert.equal(completion.batch.playerCount, 39);
assert.equal(completion.records.length, 39);
assert.equal(new Set(completion.records.map(record => record.name)).size, 39);
assert.equal(new Set(completion.records.map(record => record.sourceUrl)).size, 39);
for (const record of completion.records) {
  assert.equal(record.clubId, CLUB_ID);
  assert.equal(record.confidence, 'high');
  assert.match(record.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(record.sourceUrl, /^https:\/\/adatbank\.mlsz\.hu\/player\/\d+\.html$/);
}

assertRegisteredDataFile(PATCH_FILE, 'statPatches');
assertRegisteredDataFile(COMPLETION_FILE, 'enrichments');

assert.match(patch.source.scope, /nem közölnek játékpercet és gólpasszt/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ Nyíregyháza lezárva: 39/39 MLSZ Fizz Liga-rekord és 39/39 pontos születési dátum konzisztens');
