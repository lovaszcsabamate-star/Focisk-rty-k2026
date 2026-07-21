import assert from 'node:assert/strict';

import {
  filterCompleteCardsPayload,
  getIncompleteCardFields,
  isCompleteCard,
} from '../js/data/complete-cards.js';

const makeCard = overrides => ({
  id: 'complete-1',
  name: 'Teljes Játékos',
  club: 'Minta FC',
  nation: 'Magyarország',
  position: 'Középpályás',
  birthDate: '2000-05-10',
  stats: {
    appearances: 20,
    starts: 12,
    goals: 3,
    squads: 24,
    yellowCards: 2,
    redCards: 0,
    totalDismissals: 0,
  },
  ...overrides,
});

const complete = makeCard();
assert.equal(isCompleteCard(complete), true);
assert.deepEqual(getIncompleteCardFields(complete), []);

const noPosition = makeCard({ id: 'incomplete-position', position: '' });
assert.equal(isCompleteCard(noPosition), false);
assert.ok(getIncompleteCardFields(noPosition).includes('position'));

const missingStat = makeCard({
  id: 'incomplete-stat',
  stats: { ...complete.stats, yellowCards: null },
});
assert.equal(isCompleteCard(missingStat), false);
assert.ok(getIncompleteCardFields(missingStat).includes('stats.yellowCards'));

const impossibleStarts = makeCard({
  id: 'incomplete-consistency',
  stats: { ...complete.stats, appearances: 5, starts: 6 },
});
assert.equal(isCompleteCard(impossibleStarts), false);
assert.ok(getIncompleteCardFields(impossibleStarts).includes('stats.starts>appearances'));

const source = {
  season: '2025/26',
  selection: { playableCards: 4 },
  players: [complete, noPosition, missingStat, impossibleStarts],
};
const filtered = filterCompleteCardsPayload(source, { minimumCards: 1 });
assert.equal(source.players.length, 4, 'A forrásadatbázis nem módosulhat');
assert.equal(filtered.players.length, 1);
assert.equal(filtered.players[0].id, complete.id);
assert.equal(filtered.selection.excludedIncompleteCards, 3);
assert.equal(filtered.selection.sourcePlayerRecords, 4);
assert.equal(filtered.completenessFilter.enabled, true);

assert.throws(
  () => filterCompleteCardsPayload(source, { minimumCards: 2 }),
  /Nincs elegendő teljes játékoskártya/,
);

console.log('✓ Csak teljes játékoskártyák kerülnek a játszható pakliba');
