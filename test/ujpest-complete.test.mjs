import assert from 'node:assert/strict';
import fs from 'node:fs';

const CLUB_ID = 'ujpest-fc';
const PATCH_FILE = 'club-official-stat-patches-ujpest.json';
const COMPLETION_FILE = 'club-official-enrichment-17-ujpest-completion.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const patch = readJson(`../data/${PATCH_FILE}`);
const completion = readJson(`../data/${COMPLETION_FILE}`);
const currentRoster = readJson('../data/club-official-enrichment-4-ujpest.json');

assert.equal(patch.schemaVersion, 1);
assert.equal(patch.season, '2025/26');
assert.equal(patch.source.clubId, CLUB_ID);
assert.equal(patch.source.season, '2025/26');
assert.match(patch.source.url, /^https:\/\/adatbank\.mlsz\.hu\//);
assert.equal(patch.batch.playerCount, 41);
assert.equal(patch.rows.length, 41);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 41);
assert.equal(patch.source.additionalUrls.length, 41);
assert.equal(new Set(patch.source.additionalUrls).size, 41);
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
assert.deepEqual(expected.get('Matko Aljosa').slice(1, 6), [33, 33, 0, 33, 17]);
assert.deepEqual(expected.get('HORVÁTH KRISZTOFER GYÖRGY').slice(1, 6), [29, 22, 7, 29, 8]);
assert.deepEqual(expected.get('BANAI DÁVID').slice(1, 6), [21, 21, 0, 32, 0]);
assert.deepEqual(expected.get('MÁNDI NARUKI MILÁN').slice(1, 6), [0, 0, 0, 2, 0]);
assert.equal(expected.get('BESE BARNABÁS')[7], 1);

assert.equal(completion.batch.playerCount, 41);
assert.equal(completion.records.length, 41);
assert.equal(new Set(completion.records.map(record => record.name)).size, 41);
assert.equal(new Set(completion.records.map(record => record.sourceUrl)).size, 41);
const allowedPositions = new Set(['Kapus', 'Védő', 'Középpályás', 'Támadó']);
for (const record of completion.records) {
  assert.equal(record.clubId, CLUB_ID);
  assert.equal(record.confidence, 'high');
  assert.match(record.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(record.sourceUrl, /^https:\/\/adatbank\.mlsz\.hu\/player\/\d+\.html$/);
  assert.ok(record.nation?.trim(), `${record.name}: hiányzó nemzetiség`);
  assert.ok(allowedPositions.has(record.position), `${record.name}: hibás poszt`);
}

const nunes = completion.records.find(record => record.name === 'ANICETO GRANDELA NUNES JOAO');
assert.equal(nunes.birthDate, '1995-11-19');
assert.equal(
  currentRoster.records.find(record => record.name === 'Joao Nunes').birthDate,
  '1995-11-19',
);
assert.equal(completion.records.find(record => record.name === 'MÁNDI NARUKI MILÁN').nation, 'HUN / JPN');
assert.equal(completion.records.find(record => record.name === 'FENYŐ NOAH GABRIEL').nation, 'HUN / GER');

for (const multiClubName of [
  'BODNÁR GERGŐ JÁNOS',
  'DOMBÓ DÁVID',
  'JUHÁSZ ISTVÁN BENCE',
  'KRAJCSOVICS ÁBEL GYÖRGY',
  'MUCSÁNYI MIRON MÁTÉ',
  'STRONATI PATRIZIO',
]) {
  assert.ok(expected.has(multiClubName), `Hiányzó többklubos statisztikai sor: ${multiClubName}`);
}

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  const text = readText(source);
  assert.match(text, new RegExp(PATCH_FILE.replaceAll('.', '\\.')));
  assert.match(text, new RegExp(COMPLETION_FILE.replaceAll('.', '\\.')));
}

assert.match(patch.source.scope, /nem közölnek játékpercet és gólpasszt/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ Újpest lezárva: 41/41 alapadat és 41/41 MLSZ Fizz Liga-rekord konzisztens');
