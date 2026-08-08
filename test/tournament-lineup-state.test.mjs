import assert from 'node:assert/strict';

import { AI, HUMAN, PHASE } from '../js/engine.js';
import { PenaltyGame } from '../js/penalties.js';
import {
  TOURNAMENT_LINEUP_SIZE,
  automaticTournamentLineup,
  ensureTournamentLineupState,
  moveTournamentPenaltyOrder,
  normaliseTournamentLineupState,
  resetTournamentMatchLineup,
  saveTournamentLineup,
  storedTournamentLineup,
  validateTournamentLineup,
} from '../js/tournament/tournament-lineup-state.js';
import {
  migrateStoredTournament,
  normaliseStoredTournament,
} from '../js/services/tournament-storage-service.js';

const availablePlayers = Array.from({ length: 12 }, (_, index) => ({
  id: `p${index + 1}`,
  name: `Játékos ${index + 1}`,
  club: 'Teszt FC',
  score: index + 1,
}));
const eleven = availablePlayers.slice(0, TOURNAMENT_LINEUP_SIZE).map(player => player.id);
const reversedEleven = [...eleven].reverse();
const baseState = {
  version: 2,
  id: 'tournament-safe-lineup',
  name: 'Teszt torna',
  humanTeamId: 'club:test',
  status: 'active',
  matchMode: 'classic',
  participants: Array.from({ length: 4 }, (_, index) => ({ id: `club:${index}`, label: `Csapat ${index}` })),
  rounds: [{ id: 'round-1', matches: [{ id: 'match-1', homeId: 'club:test', awayId: 'club:1', status: 'pending' }] }],
  tableSnapshot: { untouched: true },
  bracketSnapshot: { untouched: true },
  championId: null,
};

{
  const automatic = automaticTournamentLineup(availablePlayers, player => player.score);
  assert.equal(automatic.length, TOURNAMENT_LINEUP_SIZE);
  assert.deepEqual(automatic, availablePlayers.slice(1).reverse().map(player => player.id));
}

{
  const allTwelve = availablePlayers.map(player => player.id);
  assert.equal(validateTournamentLineup([], availablePlayers).valid, false, '0 játékos nem indíthat mérkőzést');
  assert.equal(validateTournamentLineup([eleven[0]], availablePlayers).valid, false, '1 játékos nem indíthat mérkőzést');
  assert.equal(validateTournamentLineup(eleven.slice(0, 10), availablePlayers).valid, false, '10 játékos nem indíthat mérkőzést');
  assert.equal(validateTournamentLineup(eleven, availablePlayers).valid, true, 'pontosan 11 érvényes játékos indíthat mérkőzést');
  assert.equal(validateTournamentLineup(allTwelve, availablePlayers).valid, false, '12 játékos nem indíthat mérkőzést');

  const duplicate = validateTournamentLineup([...eleven.slice(0, 10), eleven[0]], availablePlayers);
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.duplicateCount, 1);
  const foreign = validateTournamentLineup([...eleven.slice(0, 10), 'other-club-player'], availablePlayers);
  assert.equal(foreign.valid, false);
  assert.equal(foreign.missingOrForeignCount, 1);
}

{
  let state = saveTournamentLineup(baseState, {
    matchId: 'match-1', lineupIds: eleven, availablePlayers, updateLast: false,
  });
  assert.deepEqual(state.lineupState.byMatchId['match-1'], eleven);
  assert.deepEqual(state.lineupState.lastLineupIds, []);
  state = saveTournamentLineup(state, {
    matchId: 'match-1', lineupIds: reversedEleven, availablePlayers,
    updateLast: true, saveFavorite: true, penaltyOrderIds: reversedEleven,
  });
  assert.deepEqual(state.lineupState.lastLineupIds, reversedEleven);
  assert.deepEqual(state.lineupState.favoriteLineupIds, reversedEleven);
  assert.deepEqual(state.lineupState.penaltyOrders['match-1'], reversedEleven);
  state = saveTournamentLineup(state, {
    matchId: 'match-2', lineupIds: eleven, availablePlayers, updateLast: false,
  });
  assert.deepEqual(state.lineupState.byMatchId['match-1'], reversedEleven);
  assert.deepEqual(state.lineupState.byMatchId['match-2'], eleven);
  assert.throws(() => saveTournamentLineup(state, {
    matchId: 'match-3', lineupIds: eleven.slice(0, 10), availablePlayers,
  }), /Pontosan 11/);
  assert.throws(() => saveTournamentLineup(state, {
    matchId: 'match-3', lineupIds: eleven, availablePlayers,
    penaltyOrderIds: [...eleven.slice(0, 10), eleven[0]],
  }), /büntetőrúgó-sorrend/);
  const reset = resetTournamentMatchLineup(state, 'match-1');
  assert.equal(reset.lineupState.byMatchId['match-1'], undefined);
  assert.equal(reset.lineupState.penaltyOrders['match-1'], undefined);
}

{
  const stale = ensureTournamentLineupState({
    ...baseState,
    lineupState: {
      tournamentId: baseState.id,
      teamId: baseState.humanTeamId,
      byMatchId: { 'match-1': [...eleven.slice(0, 10), 'deleted-player'] },
      lastLineupIds: [...eleven.slice(0, 10), 'deleted-player'],
      favoriteLineupIds: [],
      penaltyOrders: {},
    },
  });
  assert.deepEqual(storedTournamentLineup(stale, 'match', availablePlayers, { matchId: 'match-1' }), []);
  assert.deepEqual(storedTournamentLineup(stale, 'favorite', availablePlayers), []);
  const conflicting = normaliseTournamentLineupState(stale.lineupState, {
    tournamentId: 'other-tournament', seasonId: '', teamId: baseState.humanTeamId,
  });
  assert.deepEqual(conflicting.byMatchId, {});
  assert.deepEqual(conflicting.lastLineupIds, []);
}

{
  assert.deepEqual(moveTournamentPenaltyOrder(eleven, eleven[0], 'up'), eleven);
  assert.deepEqual(moveTournamentPenaltyOrder(eleven, eleven.at(-1), 'down'), eleven);
  const movedDown = moveTournamentPenaltyOrder(eleven, eleven[0], 'down');
  assert.deepEqual(movedDown.slice(0, 2), [eleven[1], eleven[0]]);
  const movedUp = moveTournamentPenaltyOrder(eleven, eleven[5], 'up');
  assert.equal(movedUp[4], eleven[5]);
  assert.equal(new Set(movedUp).size, TOURNAMENT_LINEUP_SIZE);
}

{
  const v1 = {
    ...baseState,
    version: 1,
    lastLineupIds: eleven,
    customOptionalField: { keep: true },
  };
  const migratedV1 = normaliseStoredTournament(v1);
  assert.equal(migratedV1.version, 2);
  assert.deepEqual(migratedV1.lineupState.lastLineupIds, eleven);
  assert.deepEqual(migratedV1.rounds, baseState.rounds);
  assert.deepEqual(migratedV1.tableSnapshot, baseState.tableSnapshot);
  assert.deepEqual(migratedV1.bracketSnapshot, baseState.bracketSnapshot);
  assert.deepEqual(migratedV1.customOptionalField, { keep: true });

  const v2 = migrateStoredTournament({
    ...baseState,
    version: 2,
    lineupState: {
      byMatchId: { 'match-1': [...eleven, 'p1', '', null] },
      lastLineupIds: eleven,
      favoriteLineupIds: [],
      penaltyOrders: { 'match-1': reversedEleven },
    },
  });
  assert.deepEqual(v2.lineupState.byMatchId['match-1'], eleven);
  assert.deepEqual(v2.lineupState.penaltyOrders['match-1'], reversedEleven);
  assert.equal(normaliseStoredTournament({ ...baseState, version: 99 }), null);
}

{
  const human = reversedEleven.map((id, index) => ({
    id,
    name: id,
    meta: { quickMatchSide: HUMAN, quickMatchTeamLabel: 'Saját csapat', tournamentLineupOrder: index },
  }));
  const ai = Array.from({ length: 11 }, (_, index) => ({
    id: `ai-${index + 1}`,
    name: `AI ${index + 1}`,
    meta: { quickMatchSide: AI, quickMatchTeamLabel: 'Gép csapata' },
  }));
  const game = new PenaltyGame({ players: [...human, ...ai], rng: () => 0.37 });
  assert.deepEqual(game.hands[HUMAN].map(card => card.id), reversedEleven);
  assert.equal(new Set(game.hands[HUMAN].map(card => card.id)).size, 11);
  game.hands[HUMAN] = [];
  game.hands[AI] = [];
  game.phase = PHASE.REVEAL;
  game.nextDuel();
  assert.deepEqual(game.hands[HUMAN].map(card => card.id), reversedEleven);

  const normalHuman = human.map(({ id, name, meta }) => ({ id, name, meta: { ...meta, tournamentLineupOrder: undefined } }));
  const normalGame = new PenaltyGame({ players: [...normalHuman, ...ai], rng: () => 0.37 });
  assert.equal(normalGame.hands[HUMAN].length, 11);
  assert.equal(new Set(normalGame.hands[HUMAN].map(card => card.id)).size, 11);
}

console.log('✓ Biztonságos torna-keret, 0/1/10/11/12 határesetek, mentésmigráció és determinisztikus büntetőrúgó-sorrend rendben.');
