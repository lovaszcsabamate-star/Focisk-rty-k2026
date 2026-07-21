import assert from 'node:assert/strict';
import fs from 'node:fs';

const CLUB_ID = 'mtk-budapest';
const PATCH_FILE = 'club-official-stat-patches-mtk.json';
const COMPLETION_FILE = 'club-official-enrichment-13-mtk-completion.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const patch = readJson(`../data/${PATCH_FILE}`);
const completion = readJson(`../data/${COMPLETION_FILE}`);

assert.equal(patch.schemaVersion, 1);
assert.equal(patch.season, '2025/26');
assert.equal(patch.source.clubId, CLUB_ID);
assert.equal(patch.source.season, '2025/26');
assert.match(patch.source.url, /^https:\/\/adatbank\.mlsz\.hu\//);
assert.equal(patch.batch.playerCount, 36);
assert.equal(patch.rows.length, 36);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 36);
assert.equal(patch.source.additionalUrls.length, 36);
assert.equal(new Set(patch.source.additionalUrls).size, 36);
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
assert.deepEqual(expected.get('MOLNÁR ÁDIN').slice(1, 6), [32, 29, 3, 33, 10]);
assert.deepEqual(expected.get('ÁTROK ISTVÁN ZALÁN').slice(1, 6), [30, 18, 12, 33, 6]);
assert.deepEqual(expected.get('KATA MIHÁLY').slice(1, 6), [27, 25, 2, 27, 1]);
assert.deepEqual(expected.get('VASILJEVIC ANDREJ').slice(1, 6), [1, 0, 1, 1, 0]);
assert.deepEqual(expected.get('GÖRÖG VINCENT').slice(1, 6), [1, 0, 1, 1, 0]);
assert.equal(expected.get('BERIASHVILI ILIA')[7], 1);
assert.equal(expected.get('NÉMETH HUNOR VAJK')[7], 1);
assert.equal(expected.get('VITÁLYOS VIKTOR TAMÁS')[7], 1);

assert.equal(completion.batch.playerCount, 4);
assert.equal(completion.records.length, 4);
const completed = new Map(completion.records.map(record => [record.name, record]));
assert.deepEqual(
  [...completed.keys()].sort(),
  ['GÖRÖG VINCENT', 'KOVÁCS MÁTYÁS', 'MOLNÁR PÉTER', 'VASILJEVIC ANDREJ'].sort(),
);
assert.equal(completed.get('KOVÁCS MÁTYÁS').position, 'Középpályás');
assert.equal(completed.get('MOLNÁR PÉTER').position, 'Támadó');
assert.equal(completed.get('VASILJEVIC ANDREJ').nation, 'SRB / HUN');
assert.equal(completed.get('GÖRÖG VINCENT').birthDate, '2009-01-28');
assert.ok(completion.records.every(record => record.confidence === 'high'));

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  const text = readText(source);
  assert.match(text, new RegExp(PATCH_FILE.replaceAll('.', '\\.')));
  assert.match(text, new RegExp(COMPLETION_FILE.replaceAll('.', '\\.')));
}

assert.match(patch.source.scope, /nem közölnek játékpercet és gólpasszt/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ MTK lezárva: 36/36 MLSZ Fizz Liga-rekord és négy hiányzó alapadat-profil konzisztens');
