import assert from 'node:assert/strict';

import {
  SEASON_STATUS,
  createSeasonCardId,
  deriveSeasonId,
  normaliseSeasonDefinition,
  seasonIdFromYears,
  seasonStorageScope,
  validateSeasonDefinition,
} from '../js/database/season-model.js';

assert.equal(deriveSeasonId('2025/26'), '2025-26');
assert.equal(deriveSeasonId('2025-2026'), '2025-26');
assert.equal(deriveSeasonId('2025-26'), '2025-26');
assert.equal(seasonIdFromYears(2025, 2026), '2025-26');
assert.equal(seasonIdFromYears(2025, 2027), '');

const current = validateSeasonDefinition({
  id: '2025-26',
  label: '2025/26',
  startYear: 2025,
  endYear: 2026,
  status: SEASON_STATUS.CURRENT,
});
assert.deepEqual(current, {
  id: '2025-26',
  label: '2025/26',
  startYear: 2025,
  endYear: 2026,
  status: 'current',
  sortOrder: 20252026,
});

const legacy = normaliseSeasonDefinition('2024/25');
assert.equal(legacy.id, '2024-25');
assert.equal(legacy.startYear, 2024);
assert.equal(legacy.endYear, 2025);
assert.equal(legacy.status, 'archived');

assert.equal(createSeasonCardId('2025/26', 'player-42'), '2025-26:player-42');
assert.equal(
  seasonStorageScope({ databaseId: 'hungary-nb1-2025-26', competitionId: 'hungary-nb1', seasonId: '2025/26' }),
  'hungary-nb1-2025-26:hungary-nb1:2025-26',
);

assert.throws(
  () => validateSeasonDefinition({ id: '2025-27', label: '2025/27', startYear: 2025, endYear: 2027 }),
  /kezdőévet követő évnek/,
);
assert.throws(
  () => validateSeasonDefinition({ id: 'hibás', label: 'hibás', status: 'current' }),
  /érvénytelen szezonazonosító|hiányzó szezonév-határok/,
);

console.log('✓ Strukturált szezonmodell: kanonikus azonosító, évhatárok, állapot és szezonos kártyaazonosító rendben');
