import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';

const CLUB_ID = 'kisvarda-master-good';
const FILE = 'club-official-enrichment-22-kisvarda-nationalities.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);

const base = readJson('../data/players.json');
const oldParts = [
  readJson('../data/club-official-enrichment-5-other.json'),
  readJson('../data/club-official-enrichment-7-kisvarda-selected10.json'),
  readJson('../data/club-official-enrichment-8-kisvarda-selected10.json'),
  readJson('../data/club-official-enrichment-9-kisvarda-selected10.json'),
  readJson('../data/club-official-enrichment-10-kisvarda-final8.json'),
  readJson('../data/club-official-enrichment-11-kisvarda-completion.json'),
];
const correction = readJson('../data/club-official-corrections-4-kisvarda-selected10-2.json');
const completion = readJson(`../data/${FILE}`);

assert.equal(completion.schemaVersion, 1);
assert.equal(completion.season, '2025/26');
assert.equal(completion.batch.playerCount, 21);
assert.equal(completion.records.length, 21);
assert.equal(new Set(completion.records.map(record => record.name)).size, 21);
for (const record of completion.records) {
  assert.equal(record.clubId, CLUB_ID);
  assert.equal(record.confidence, 'high');
  assert.match(record.nation, /^[A-Z]{3}( \/ [A-Z]{3})*$/);
  assert.equal('birthDate' in record, false, `${record.name}: a nemzetiségi réteg születési dátumot is tartalmaz`);
  assert.equal('position' in record, false, `${record.name}: a nemzetiségi réteg posztot is tartalmaz`);
  assert.equal('stats' in record, false, `${record.name}: a nemzetiségi réteg statisztikát is tartalmaz`);
}

const oldCombined = {
  ...oldParts[0],
  sources: oldParts.flatMap(part => part.sources ?? []),
  records: oldParts.flatMap(part => part.records ?? []),
};
const oldPrepared = prepareClubEnrichment(oldCombined, correction);
const oldPayload = applyClubEnrichmentPayload(base, oldPrepared);
const beforeCards = oldPayload.players.filter(card => clubIds(card).includes(CLUB_ID));
assert.equal(beforeCards.length, 38);
assert.equal(beforeCards.filter(card => card.nation).length, 17);

const preparedCompletion = prepareClubEnrichment(completion, {});
const finalPayload = applyClubEnrichmentPayload(oldPayload, preparedCompletion);
assert.equal(finalPayload.enrichment.matchedRecords, 21);
assert.equal(finalPayload.enrichment.unmatchedRecords, 0);
assert.equal(finalPayload.enrichment.conflictCount, 0);

const cards = finalPayload.players.filter(card => clubIds(card).includes(CLUB_ID));
assert.equal(cards.length, 38);
assert.equal(cards.filter(card => card.nation).length, 38);

const beforeById = new Map(beforeCards.map(card => [card.id, card]));
for (const card of cards) {
  const before = beforeById.get(card.id);
  assert.ok(before, `${card.name}: hiányzó korábbi rekord`);
  assert.equal(card.birthDate, before.birthDate, `${card.name}: megváltozott a születési dátum`);
  assert.equal(card.position, before.position, `${card.name}: megváltozott a poszt`);
  assert.deepEqual(card.stats, before.stats, `${card.name}: megváltozott a statisztika`);
  if (before.nation) assert.equal(card.nation, before.nation, `${card.name}: meglévő nemzetiség felülíródott`);
}

const byName = new Map(cards.map(card => [card.name, card]));
assert.equal(byName.get('ABDULLAHI KAMAL').nation, 'NGR');
assert.equal(byName.get('JAZSIK ROMÁN').nation, 'UKR');
assert.equal(byName.get('Osztrovka Maxim').nation, 'UKR / HUN');
assert.equal(byName.get('POPOVICS ILLYA').nation, 'UKR');
assert.equal(byName.get('VEPRIK TARASZ').nation, 'UKR');

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  assert.match(readText(source), new RegExp(FILE.replaceAll('.', '\\.')));
}
assert.match(readText('../sw.js'), /fociskartyak-2026-v29/);

console.log('✓ Kisvárda nemzetiségek lezárva: 38/38 forrásolt országadat, alap- és statisztikai értékek változatlanok');
