import assert from 'node:assert/strict';
import fs from 'node:fs';

import { normaliseCard, validatePlayers } from '../js/data/players.js';

const payload = JSON.parse(fs.readFileSync(new URL('../data/players.json', import.meta.url), 'utf8'));
const validation = JSON.parse(fs.readFileSync(new URL('../data/validation.json', import.meta.url), 'utf8'));
const cards = payload.players.map(normaliseCard);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const fields = ['appearances', 'starts', 'goals', 'squads', 'yellowCards', 'redCards', 'totalDismissals', 'overallScore'];

assert.equal(payload.schemaVersion, 4);
assert.equal(payload.source.datasetId, 'nb1-2025-26-webadatbazis-v2-enriched');
assert.equal(cards.length, 440);
assert.equal(payload.selection.registrationRecords, 464);
assert.equal(payload.selection.multiClubPlayers, 24);
assert.equal(new Set(cards.map(card => card.id)).size, 440);
assert.equal(new Set(cards.map(card => card.meta.personKey)).size, 440);
assert.equal(cards.filter(card => card.clubs.length > 1).length, 24);
assert.equal(Object.values(payload.clubs).reduce((sum, count) => sum + count, 0), 464);
assert.deepEqual(validatePlayers(cards), []);

for (const card of cards) {
  assert.ok(Array.isArray(card.clubs) && card.clubs.length >= 1, `${card.id}: clubs`);
  assert.equal(card.club, card.clubs.join(' / '), `${card.id}: combined club label`);
  assert.ok(finite(card.stats.goals), `${card.id}: complete goal total`);
  for (const field of fields) {
    assert.ok(card.stats[field] === null || finite(card.stats[field]), `${card.id}: ${field} must be number|null`);
  }
}

const predicates = {
  birthDate: card => typeof card.birthDate === 'string',
  appearances: card => finite(card.stats.appearances),
  starts: card => finite(card.stats.starts),
  goals: card => finite(card.stats.goals),
  squads: card => finite(card.stats.squads),
  yellowCards: card => finite(card.stats.yellowCards),
  redCards: card => finite(card.stats.redCards),
  totalDismissals: card => finite(card.stats.totalDismissals),
  overallScore: card => finite(card.stats.overallScore),
};
for (const [field, predicate] of Object.entries(predicates)) {
  const known = cards.filter(predicate).length;
  assert.equal(payload.coverage[field], known, `${field}: payload coverage`);
  assert.equal(validation.knownValues[field], known, `${field}: validation coverage`);
  assert.equal(validation.missingValueIds[field].length, cards.length - known, `${field}: missing ids`);
}

assert.equal(payload.coverage.goals, 440);
assert.equal(payload.coverage.birthDate, 120);
assert.equal(payload.coverage.appearances, 143);
assert.equal(validation.sourceValidationSummary.valid, true);

console.log('✓ Teljes NB I-adatbázis: 440 személy / 464 klubregisztráció, konzisztens');
