import assert from 'node:assert/strict';

import {
  ATTRIBUTES, ATTRIBUTE_BY_KEY, attributeValue, calculateAge, configureAttributes, formatAttribute,
  hasAttributeData, MIN_MINUTES_FOR_RATE_STATS, normaliseCard, normaliseDate, normaliseNumber,
  parseBirthDate, validatePlayers,
} from '../js/data/players.js';
import { AI, HUMAN, compare, Game } from '../js/engine.js';
import { PenaltyGame } from '../js/penalties.js';

const card = (index, overrides = {}) => {
  const baseStats = {
    age: 26, appearances: 10, starts: 5, goals: 2, squads: 12,
    minutes: null, assists: null, yellowCards: 1, redCards: 0,
    secondYellowRedCards: null, totalDismissals: 0, overallScore: 50,
    heightCm: null, marketValue: null,
  };
  return normaliseCard({
    id: `test-${index}`,
    name: `Tesztjátékos ${index}`,
    club: index % 2 ? 'A FC' : 'B FC',
    birthDate: `2000-01-${String(1 + (index % 27)).padStart(2, '0')}`,
    ...overrides,
    stats: { ...baseStats, ...(overrides.stats ?? {}) },
  });
};

assert.equal(normaliseNumber('1 234'), 1234);
assert.equal(normaliseNumber('1,5m EUR'), 1_500_000);
assert.equal(normaliseNumber('N/A'), null);
assert.equal(normaliseDate('31.12.2000'), '2000-12-31');
assert.equal(normaliseDate('2026-02-29'), null);
assert.equal(parseBirthDate('2024/02/29'), Date.UTC(2024, 1, 29));
assert.equal(calculateAge('2000-12-31'), 25);

const older = card(101, { birthDate: '2000-01-01' });
const younger = card(102, { birthDate: '2000-12-31' });
assert.equal(compare('birthDate', younger, older), HUMAN);
assert.equal(compare('birthDateOlder', older, younger), HUMAN);
assert.equal(formatAttribute(younger, 'birthDate'), '25 év');
assert.doesNotMatch(formatAttribute(younger, 'birthDate'), /2000/);

const cardHeavy = card(103, { stats: { yellowCards: 5, totalDismissals: 1, redCards: 1 } });
const cardClean = card(104, { stats: { yellowCards: 1, totalDismissals: 0, redCards: 0 } });
assert.equal(compare('yellowCards', cardHeavy, cardClean), HUMAN);
assert.equal(compare('yellowCardsFewest', cardHeavy, cardClean), AI);
assert.equal(compare('totalDismissalsFewest', cardHeavy, cardClean), AI);
assert.equal(compare('discipline', cardHeavy, cardClean), AI);

const starter = card(105, { stats: { appearances: 20, starts: 15 } });
const bench = card(106, { stats: { appearances: 20, starts: 5 } });
assert.equal(attributeValue(starter, 'startRate'), 75);
assert.equal(compare('startRate', starter, bench), HUMAN);
assert.equal(attributeValue(card(107, { stats: { appearances: 0, starts: 0 } }), 'startRate'), null);

const efficient = card(108, { stats: { minutes: 900, goals: 10, assists: 5 } });
const lessEfficient = card(109, { stats: { minutes: 900, goals: 5, assists: 2 } });
assert.equal(attributeValue(efficient, 'goalsPer90'), 1);
assert.equal(compare('goalsPer90', efficient, lessEfficient), HUMAN);
assert.equal(compare('minutesPerGoal', efficient, lessEfficient), HUMAN);
assert.equal(attributeValue(card(110, { stats: { minutes: MIN_MINUTES_FOR_RATE_STATS - 1, goals: 5 } }), 'goalsPer90'), null);
assert.equal(attributeValue(card(111, { stats: { minutes: 900, goals: 0 } }), 'minutesPerGoal'), null);
assert.equal(hasAttributeData(card(112, { stats: { minutes: 0, goals: 0 } }), 'goalsPer90'), false);

const tieA = card(113, { stats: { appearances: 3, starts: 1 } });
const tieB = card(114, { stats: { appearances: 6, starts: 2 } });
assert.equal(compare('startRate', tieA, tieB), 'tie');

const partial = normaliseCard({
  id: 'partial', name: 'Részleges Játékos', club: 'Teszt FC', birthDate: null,
  stats: { goals: 0, appearances: null, starts: null, yellowCards: null, redCards: null },
});
assert.deepEqual(validatePlayers([partial]), []);
assert.equal(hasAttributeData(partial, 'goals'), true);
assert.equal(hasAttributeData(partial, 'appearances'), false);
assert.equal(formatAttribute(partial, 'appearances'), '');

const coverageCards = Array.from({ length: 20 }, (_, index) => card(index, {
  stats: index < 4 ? { heightCm: 180 + index } : {},
}));
configureAttributes(coverageCards);
assert.equal(ATTRIBUTE_BY_KEY.heightCm.enabled, true);
assert.equal(ATTRIBUTE_BY_KEY.marketValue.enabled, false);
assert.ok(ATTRIBUTES.some(attribute => attribute.key === 'heightCm'));
assert.ok(!ATTRIBUTES.some(attribute => attribute.key === 'marketValue'));
assert.ok(!ATTRIBUTES.some(attribute => attribute.key === 'overallScore'));

const gameCards = Array.from({ length: 30 }, (_, index) => card(index));
configureAttributes(gameCards);
const classic = new Game({ players: gameCards, rng: () => 0.999999 });
assert.ok(classic.availableAttributeKeys().includes('goals'));
const penalties = new PenaltyGame({ players: gameCards, rng: () => 0.999999 });
assert.ok(penalties.availableAttributeKeys().includes('goals'));

console.log('✓ Új kategóriák, normalizálás és hiányzóadat-kezelés: sikeres');
