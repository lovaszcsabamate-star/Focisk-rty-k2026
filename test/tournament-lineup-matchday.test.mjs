import assert from 'node:assert/strict';

import {
  moveTournamentPenaltyOrder,
  saveTournamentLineup,
  storedTournamentLineup,
  validateTournamentLineup,
} from '../js/tournament/tournament-lineup-state.js';

const players = Array.from({ length: 12 }, (_, index) => ({
  id: `p${index + 1}`,
  name: `Játékos ${index + 1}`,
  club: 'Teszt FC',
}));
const eleven = players.slice(0, 11).map(player => player.id);
const twelve = players.map(player => player.id);
const baseState = {
  version: 2,
  id: 'matchday-1-1',
  name: 'Magyar Kupa',
  humanTeamId: 'club:test',
  status: 'active',
  matchMode: 'classic',
  participants: [
    { id: 'club:test', label: 'Teszt FC' },
    { id: 'club:2', label: 'Ellenfél 2' },
    { id: 'club:3', label: 'Ellenfél 3' },
    { id: 'club:4', label: 'Ellenfél 4' },
  ],
  rounds: [{ id: 'quarterfinal', label: 'Negyeddöntő', matches: [{ id: 'match-1', homeId: 'club:test', awayId: 'club:2', status: 'pending' }] }],
};

const tenValidation = validateTournamentLineup(eleven.slice(0, 10), players);
assert.equal(tenValidation.valid, false);
assert.equal(tenValidation.selectedCount, 10);

const elevenValidation = validateTournamentLineup(eleven, players);
assert.equal(elevenValidation.valid, true);
assert.equal(elevenValidation.selectedCount, 11);

const twelveValidation = validateTournamentLineup(twelve, players);
assert.equal(twelveValidation.valid, false);
assert.equal(twelveValidation.selectedCount, 12);

const duplicateValidation = validateTournamentLineup([...eleven.slice(0, 10), eleven[0]], players);
assert.equal(duplicateValidation.valid, false);
assert.equal(duplicateValidation.duplicateCount, 1);

const foreignValidation = validateTournamentLineup([...eleven.slice(0, 10), 'foreign-player'], players);
assert.equal(foreignValidation.valid, false);
assert.equal(foreignValidation.missingOrForeignCount, 1);

const deletedValidation = validateTournamentLineup([...eleven.slice(0, 10), 'deleted-player'], players);
assert.equal(deletedValidation.valid, false);
assert.equal(deletedValidation.missingOrForeignCount, 1);

let saved = saveTournamentLineup(baseState, {
  matchId: 'match-1',
  lineupIds: eleven,
  availablePlayers: players,
  updateLast: true,
  saveFavorite: true,
  penaltyOrderIds: eleven,
});
assert.deepEqual(storedTournamentLineup(saved, 'match', players, { matchId: 'match-1' }), eleven);
assert.deepEqual(storedTournamentLineup(saved, 'last', players), eleven);
assert.deepEqual(storedTournamentLineup(saved, 'favorite', players), eleven);
assert.deepEqual(storedTournamentLineup(saved, 'penalty', players, { matchId: 'match-1' }), eleven);

const movedDown = moveTournamentPenaltyOrder(eleven, eleven[0], 'down');
assert.deepEqual(movedDown.slice(0, 2), [eleven[1], eleven[0]]);
const movedBack = moveTournamentPenaltyOrder(movedDown, eleven[0], 'up');
assert.deepEqual(movedBack, eleven);
assert.equal(new Set(movedDown).size, 11);

assert.throws(() => saveTournamentLineup(saved, {
  matchId: 'match-1',
  lineupIds: eleven,
  availablePlayers: players,
  penaltyOrderIds: [...eleven.slice(0, 10), eleven[0]],
}), /büntetőrúgó-sorrend/);

console.log('✓ Tournament Lineup 1.1 matchday szerződés: 10\/11\/12, mentések és büntetősorrend rendben.');
