import assert from 'node:assert/strict';
import fs from 'node:fs';

import { assertRegisteredDataFile } from './database-manifest-assertions.mjs';

const CLUB_ID = 'nyiregyhaza-spartacus-fc';
const FILE = 'club-official-enrichment-15-nyiregyhaza-nationalities.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));

const payload = readJson(`../data/${FILE}`);

assert.equal(payload.schemaVersion, 1);
assert.equal(payload.season, '2025/26');
assert.equal(payload.batch.playerCount, 39);
assert.equal(payload.records.length, 39);
assert.equal(new Set(payload.records.map(record => record.name)).size, 39);
assert.ok(payload.sources.length >= 10);

const byName = new Map(payload.records.map(record => [record.name, record]));
for (const record of payload.records) {
  assert.equal(record.clubId, CLUB_ID);
  assert.match(record.nation, /^[A-Z]{3}( \/ [A-Z]{3})?$/, `${record.name}: hibás nemzetiségkód`);
  assert.match(record.sourceUrl, /^https:\/\//);
  assert.ok(['high', 'medium'].includes(record.confidence));
}

assert.equal(payload.records.filter(record => record.confidence === 'medium').length, 1);
assert.equal(byName.get('MOLNÁR MÁTYÁS').confidence, 'medium');
assert.equal(byName.get('KERSÁK ROLAND ATTILA').nation, 'HUN');
assert.equal(byName.get('TOMA GYÖRGY').nation, 'UKR / HUN');
assert.equal(byName.get('BABUNSKI HRISTOVSKI DORIAN').nation, 'MKD / ESP');
assert.equal(byName.get('GILBERT DANTAYE MICHAEL LEE').nation, 'TRI');
assert.equal(byName.get('ABOUBAKAR KEITA').nation, 'CIV');
assert.equal(byName.get('EVANGELOU STEFANOS').nation, 'GRC');
assert.equal(byName.get('BITRI ENEO').nation, 'ALB');
assert.equal(byName.get('DRESKOVIC MELDIN').nation, 'MNE');
assert.equal(byName.get('TIJANI MUHAMED').nation, 'NGA');

assertRegisteredDataFile(FILE, 'enrichments');

console.log('✓ Nyíregyháza nemzetiségek: 39/39 forrásolt rekord és kód konzisztens');
