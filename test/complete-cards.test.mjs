import assert from 'node:assert/strict';

import {
  filterCompleteCardsPayload,
  getIncompleteCardFields,
  getUnplayableCardFields,
  isCompleteCard,
  isPlayableCard,
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
assert.equal(isPlayableCard(complete), true);
assert.deepEqual(getIncompleteCardFields(complete), []);
assert.deepEqual(getUnplayableCardFields(complete), []);

const noPosition = makeCard({ id: 'incomplete-position', position: '' });
assert.equal(isCompleteCard(noPosition), false);
assert.equal(isPlayableCard(noPosition), true, 'a pozíció opcionális futásidejű adat');
assert.ok(getIncompleteCardFields(noPosition).includes('position'));
assert.deepEqual(getUnplayableCardFields(noPosition), []);

const missingStat = makeCard({
  id: 'incomplete-stat',
  stats: { ...complete.stats, yellowCards: null },
});
assert.equal(isCompleteCard(missingStat), false);
assert.equal(isPlayableCard(missingStat), true, 'a hiányzó opcionális statisztika nem zárhatja ki a játékost');
assert.ok(getIncompleteCardFields(missingStat).includes('stats.yellowCards'));
assert.deepEqual(getUnplayableCardFields(missingStat), []);

const impossibleStarts = makeCard({
  id: 'incomplete-consistency',
  stats: { ...complete.stats, appearances: 5, starts: 6 },
});
assert.equal(isCompleteCard(impossibleStarts), false);
assert.equal(isPlayableCard(impossibleStarts), true, 'az auditelt statisztikai ellentmondás nem írhatja felül az azonosítóalapú runtime-szabályt');
assert.ok(getIncompleteCardFields(impossibleStarts).includes('stats.starts>appearances'));

const missingClub = makeCard({ id: 'unplayable-club', club: '' });
assert.equal(isPlayableCard(missingClub), false);
assert.ok(getUnplayableCardFields(missingClub).includes('club'));

const source = {
  season: '2025/26',
  selection: { playableCards: 5 },
  players: [complete, noPosition, missingStat, impossibleStarts, missingClub],
};
const filtered = filterCompleteCardsPayload(source, { minimumCards: 1 });
assert.equal(source.players.length, 5, 'A forrásadatbázis nem módosulhat');
assert.equal(filtered.players.length, 4);
assert.deepEqual(
  filtered.players.map(player => player.id),
  ['complete-1', 'incomplete-position', 'incomplete-stat', 'incomplete-consistency'],
  'minden kötelező azonosítóval rendelkező valós kártya játszható marad',
);
assert.equal(filtered.selection.playableCards, 4);
assert.equal(filtered.selection.completePlayableCards, 1);
assert.equal(filtered.selection.incompleteButPlayableCards, 3);
assert.equal(filtered.selection.excludedUnplayableCards, 1);
assert.equal(filtered.selection.excludedIncompleteCards, 4, 'a szigorú audit hiánylistája megmarad');
assert.equal(filtered.selection.sourcePlayerRecords, 5);
assert.equal(filtered.completenessFilter.enabled, true);
assert.equal(filtered.completenessFilter.mode, 'runtime-identity');
assert.deepEqual(filtered.completenessFilter.requiredStatFields, []);

assert.throws(
  () => filterCompleteCardsPayload(source, { minimumCards: 5 }),
  /Nincs elegendő kötelező azonosítóval rendelkező játékoskártya/,
);

console.log('✓ A szigorú teljességi audit megmarad, a runtime pedig csak a kötelező kártyaazonosítókat követeli meg');
