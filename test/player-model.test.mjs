import assert from 'node:assert/strict';
import fs from 'node:fs';

import { filterCompleteCardsPayload } from '../js/data/complete-cards.js';
import {
  CANONICAL_PLAYER_FIELDS,
  PLAYER_MODEL_VERSION,
  calculateModelAge,
  normalisePlayerPayload,
  normalisePlayerRecord,
  validatePlayerPayload,
} from '../js/models/player-model.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));

const sample = {
  id: 'sample-1',
  name: 'MINTA JÁTÉKOS',
  club: 'Minta FC',
  nation: 'HUN / SRB',
  position: 'Középpályás',
  birthDate: '2008-08-08',
  stats: {
    appearances: 0,
    starts: 0,
    goals: 0,
    assists: null,
    minutes: 0,
    yellowCards: 0,
    redCards: 0,
    totalDismissals: 0,
    heightCm: 181,
    marketValue: null,
  },
  meta: {
    clubId: 'minta-fc',
    imageUrl: null,
    sourceUrl: 'https://example.com/player/1',
    checkedAt: '2026-07-23',
    sourceDataset: 'sample-dataset',
  },
};

const player = normalisePlayerRecord(sample, {
  season: '2025/26',
  competition: 'NB I',
});

assert.equal(player.playerModelVersion, PLAYER_MODEL_VERSION);
assert.equal(player.displayName, 'MINTA JÁTÉKOS');
assert.equal(player.firstName, null, 'A modell nem találhat ki keresztnevet a teljes névből.');
assert.equal(player.lastName, null, 'A modell nem találhat ki vezetéknevet a teljes névből.');
assert.equal(player.dateOfBirth, '2008-08-08');
assert.equal(player.age, 17);
assert.equal(calculateModelAge('2008-08-08'), 17);
assert.equal(player.nationality, 'HUN / SRB');
assert.equal(player.nationalityCode, 'HUN / SRB');
assert.equal(player.clubId, 'minta-fc');
assert.equal(player.clubName, 'Minta FC');
assert.equal(player.heightCm, 181);
assert.equal(player.appearances, 0, 'A valódi nulla nem válhat hiányzó adattá.');
assert.equal(player.minutesPlayed, 0);
assert.equal(player.goals, 0);
assert.equal(player.assists, null);
assert.equal(player.image, null);
assert.equal(player.source, 'sample-dataset');
assert.equal(player.sourceUrl, 'https://example.com/player/1');
assert.equal(player.lastUpdated, '2026-07-23');
assert.equal(player.season, '2025/26');
assert.equal(player.competition, 'NB I');
assert.deepEqual(player.stats, sample.stats, 'A meglévő statisztikai objektum nem módosulhat.');
assert.ok(player.dataCompleteness.ratio > 0 && player.dataCompleteness.ratio <= 1);
assert.ok(player.dataCompleteness.missingFields.includes('assists'));

for (const field of CANONICAL_PLAYER_FIELDS) {
  assert.ok(Object.hasOwn(player, field), `Hiányzó kanonikus mező: ${field}`);
}

const invalidPayload = normalisePlayerPayload({
  players: [sample, { ...sample, name: 'Másik név' }],
});
const invalidValidation = validatePlayerPayload(invalidPayload.players);
assert.ok(invalidValidation.errors.includes('duplicate player ids'));

const reviewed = readJson('../data/players-reviewed.json');
const modelled = normalisePlayerPayload(reviewed);
assert.equal(modelled.players.length, 440);
assert.equal(modelled.playerModel.version, PLAYER_MODEL_VERSION);
assert.equal(modelled.playerModel.validation.playerCount, 440);
assert.equal(modelled.playerModel.validation.errorCount, 0);
assert.equal(new Set(modelled.players.map(card => card.id)).size, 440);

for (let index = 0; index < reviewed.players.length; index += 1) {
  const before = reviewed.players[index];
  const after = modelled.players[index];
  assert.equal(after.id, before.id);
  assert.equal(after.name, before.name);
  assert.equal(after.club, before.club);
  assert.equal(after.birthDate, before.birthDate);
  assert.deepEqual(after.stats, before.stats, `${before.name}: a statisztika megváltozott`);
  for (const field of CANONICAL_PLAYER_FIELDS) {
    assert.ok(Object.hasOwn(after, field), `${before.name}: hiányzó ${field}`);
  }
}

const playable = filterCompleteCardsPayload(reviewed);
assert.equal(playable.players.length, 440);
assert.equal(playable.playerModel.version, PLAYER_MODEL_VERSION);
assert.equal(playable.completenessFilter.excludedIncompleteCards, 0);

console.log('✓ Egységes játékos-adatmodell: 440 rekord, stabil azonosítók és változatlan statisztikák');
