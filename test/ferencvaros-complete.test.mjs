import assert from 'node:assert/strict';
import fs from 'node:fs';

const CLUB_ID = 'ferencvarosi-tc';
const PATCH_FILE = 'club-official-stat-patches-ferencvaros.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const patch = readJson(`../data/${PATCH_FILE}`);

assert.equal(patch.schemaVersion, 1);
assert.equal(patch.season, '2025/26');
assert.equal(patch.source.clubId, CLUB_ID);
assert.equal(patch.source.season, '2025/26');
assert.match(patch.source.url, /^https:\/\/adatbank\.mlsz\.hu\//);
assert.equal(patch.batch.playerCount, 42);
assert.equal(patch.rows.length, 42);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 42);
assert.equal(patch.fields.length, 9);
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
assert.deepEqual(expected.get('Varga Barnabás').slice(1, 6), [17, 14, 3, 17, 10]);
assert.deepEqual(expected.get('Gruber Zsombor').slice(1, 6), [29, 17, 12, 33, 9]);
assert.deepEqual(expected.get('Dibusz Dénes').slice(1, 6), [20, 20, 0, 22, 0]);
assert.deepEqual(expected.get('Szécsi Gergő').slice(1, 6), [0, 0, 0, 3, 0]);
assert.equal(expected.get('Gróf Dávid Attila')[7], 1);
assert.equal(expected.get('Corbu Marius Dumitru')[7], 1);

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  assert.match(readText(source), new RegExp(PATCH_FILE.replaceAll('.', '\\.')));
}

assert.match(patch.source.scope, /nem közölnek játékpercet és gólpasszt/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ Ferencváros: 42 MLSZ Fizz Liga-rekord, konzisztens pályára lépés és kerettagság, teljes buildintegráció');
