import assert from 'node:assert/strict';
import fs from 'node:fs';

const CLUB_ID = 'dvtk';
const PATCH_FILE = 'club-official-stat-patches-dvtk.json';
const COMPLETION_FILE = 'club-official-enrichment-12-dvtk-completion.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const patch = readJson(`../data/${PATCH_FILE}`);
const completion = readJson(`../data/${COMPLETION_FILE}`);

assert.equal(patch.schemaVersion, 1);
assert.equal(patch.season, '2025/26');
assert.equal(patch.source.clubId, CLUB_ID);
assert.equal(patch.source.season, '2025/26');
assert.match(patch.source.url, /^https:\/\/adatbank\.mlsz\.hu\//);
assert.equal(patch.batch.playerCount, 45);
assert.equal(patch.rows.length, 45);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 45);
assert.equal(patch.source.additionalUrls.length, 45);
assert.equal(new Set(patch.source.additionalUrls).size, 45);
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
assert.deepEqual(expected.get('SENTIC KARLO').slice(1, 6), [28, 28, 0, 30, 0]);
assert.deepEqual(expected.get('ACOLATSE ELTON-OFOI').slice(1, 6), [24, 20, 4, 28, 10]);
assert.deepEqual(expected.get('BABOS BENCE').slice(1, 6), [22, 16, 6, 30, 6]);
assert.deepEqual(expected.get('VARGA HUNOR ATTILA').slice(1, 6), [0, 0, 0, 1, 0]);
assert.equal(expected.get('SANICANIN SINISA')[7], 1);
assert.equal(expected.get('COLLEY LAMIN')[7], 1);

assert.equal(completion.batch.playerCount, 1);
assert.deepEqual(completion.batch.playerIds, ['nb1-6a4e42738867']);
assert.equal(completion.records.length, 1);
assert.equal(completion.records[0].name, 'VARGA HUNOR ATTILA');
assert.equal(completion.records[0].birthDate, '2010-03-18');
assert.equal(completion.records[0].nation, 'HUN');
assert.equal(completion.records[0].position, 'Kapus');
assert.equal(completion.records[0].confidence, 'high');

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  const text = readText(source);
  assert.match(text, new RegExp(PATCH_FILE.replaceAll('.', '\\.')));
  assert.match(text, new RegExp(COMPLETION_FILE.replaceAll('.', '\\.')));
}

assert.match(patch.source.scope, /nem közölnek játékpercet és gólpasszt/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ DVTK lezárva: 45/45 MLSZ Fizz Liga-rekord és Varga Hunor teljes alapadat-kiegészítése konzisztens');
