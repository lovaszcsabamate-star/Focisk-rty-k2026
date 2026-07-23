import assert from 'node:assert/strict';

import {
  ATTRIBUTE_BY_KEY,
  ATTRIBUTE_DEFINITIONS,
  ATTRIBUTES,
  CARD_ATTRIBUTE_KEYS,
  CATEGORY_AVAILABILITY,
  CATEGORY_BY_ID,
  CATEGORY_DEFINITIONS,
  CARD_CATEGORY_IDS,
  ENABLED_CATEGORIES,
  categoryValue,
  configureCategories,
  formatCategoryValue,
  hasCategoryData,
  normaliseCard,
} from '../js/data/players.js';
import {
  CATEGORY_DIRECTIONS,
  CATEGORY_GROUPS,
  CATEGORY_RATE_MINUTES,
  CATEGORY_SCHEMA_VERSION,
  validateCategoryDefinitions,
} from '../js/data/categories.js';

assert.equal(CATEGORY_SCHEMA_VERSION, 1);
assert.equal(CATEGORY_RATE_MINUTES, 90);
assert.equal(CATEGORY_DEFINITIONS.length, 26);
assert.deepEqual(validateCategoryDefinitions(CATEGORY_DEFINITIONS), []);
assert.equal(new Set(CATEGORY_DEFINITIONS.map(category => category.id)).size, CATEGORY_DEFINITIONS.length);

for (const category of CATEGORY_DEFINITIONS) {
  assert.equal(category.schemaVersion, CATEGORY_SCHEMA_VERSION, `${category.id}: schemaVersion`);
  assert.equal(typeof category.id, 'string', `${category.id}: id`);
  assert.equal(typeof category.nameHu, 'string', `${category.id}: nameHu`);
  assert.equal(typeof category.shortNameHu, 'string', `${category.id}: shortNameHu`);
  assert.equal(typeof category.value, 'function', `${category.id}: value`);
  assert.ok(Object.values(CATEGORY_DIRECTIONS).includes(category.direction), `${category.id}: direction`);
  assert.equal(typeof category.formatValue, 'function', `${category.id}: formatValue`);
  assert.ok(Array.isArray(category.requiredFields), `${category.id}: requiredFields`);
  assert.ok(category.requiredFields.length > 0, `${category.id}: empty requiredFields`);
  assert.ok(category.minimumMinutes == null || category.minimumMinutes >= 0, `${category.id}: minimumMinutes`);
  assert.ok(Object.values(CATEGORY_GROUPS).includes(category.group), `${category.id}: group`);
  assert.equal(typeof category.enabled, 'boolean', `${category.id}: enabled`);

  // A régi API mezői ugyanazt a szerződést tükrözik.
  assert.equal(category.key, category.id);
  assert.equal(category.label, category.nameHu);
  assert.equal(category.shortLabel, category.shortNameHu);
  assert.equal(category.getValue, category.value);
  assert.equal(category.format, category.formatValue);
}

assert.equal(ATTRIBUTE_DEFINITIONS, CATEGORY_DEFINITIONS);
assert.equal(ATTRIBUTE_BY_KEY, CATEGORY_BY_ID);
assert.equal(ATTRIBUTES, ENABLED_CATEGORIES);
assert.equal(CARD_ATTRIBUTE_KEYS, CARD_CATEGORY_IDS);
assert.equal(ATTRIBUTE_BY_KEY.birthDate.id, 'birthDate');
assert.deepEqual(ATTRIBUTE_BY_KEY.birthDate.requiredFields, ['birthDate']);
assert.deepEqual(ATTRIBUTE_BY_KEY.startRate.requiredFields, ['stats.starts', 'stats.appearances']);
assert.deepEqual(ATTRIBUTE_BY_KEY.goalsPer90.requiredFields, ['stats.goals', 'stats.minutes']);
assert.equal(ATTRIBUTE_BY_KEY.goalsPer90.minimumMinutes, CATEGORY_RATE_MINUTES);
assert.equal(ATTRIBUTE_BY_KEY.minutesPerGoal.direction, CATEGORY_DIRECTIONS.LOWER);
assert.equal(ATTRIBUTE_BY_KEY.discipline.group, CATEGORY_GROUPS.DISCIPLINE);

const card = normaliseCard({
  id: 'registry-test',
  name: 'Regiszter Teszt',
  club: 'Teszt FC',
  birthDate: '2002-06-10',
  stats: {
    appearances: 20,
    starts: 15,
    goals: 10,
    assists: 5,
    minutes: 900,
    squads: 22,
    yellowCards: 2,
    redCards: 0,
    totalDismissals: 0,
  },
});

assert.equal(categoryValue(card, 'goalsPer90'), 1);
assert.equal(formatCategoryValue(card, 'goalsPer90'), '1');
assert.equal(hasCategoryData(card, 'assistsPer90'), true);
assert.equal(categoryValue(card, 'startRate'), 75);

const coverageCards = Array.from({ length: 20 }, (_, index) => normaliseCard({
  id: `coverage-${index}`,
  name: `Lefedettség ${index}`,
  club: 'Teszt FC',
  birthDate: '2000-01-01',
  stats: {
    appearances: 10,
    starts: 5,
    goals: 1,
    squads: 10,
    yellowCards: 0,
    redCards: 0,
    totalDismissals: 0,
    heightCm: index < 2 ? 180 + index : null,
  },
}));

configureCategories(coverageCards);
assert.equal(CATEGORY_BY_ID.heightCm.enabled, true);
assert.equal(CATEGORY_BY_ID.marketValue.enabled, false);
assert.equal(CATEGORY_AVAILABILITY.heightCm.status, 'experimental');
assert.equal(CATEGORY_AVAILABILITY.marketValue.status, 'disabled');
assert.ok(ENABLED_CATEGORIES.includes(CATEGORY_BY_ID.goals));

console.log('✓ Központi, verziózott és visszafelé kompatibilis kategóriaregiszter: rendben');
