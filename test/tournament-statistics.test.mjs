import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  TOURNAMENT_STATISTICS_MIN_DUELS,
  mergeTournamentResultAnalytics,
  tournamentCategoryStatistics,
  tournamentPlayerStatistics,
  tournamentStatisticsSnapshot,
  tournamentTeamStatistics,
} from '../js/tournament/tournament-experience-v2-runtime.js';

const complete = 'complete';
const team = (id, label) => ({ id, label, kind: 'club', selection: { kind: 'club', value: label } });
const teams = [team('human', 'Saját Csapat'), team('a', 'Csapat A'), team('b', 'Csapat B'), team('c', 'Csapat C')];

const analyticsState = {
  version: 2,
  id: 'stats-tournament',
  humanTeamId: 'human',
  participants: teams,
  rounds: [{
    id: 'round-1',
    stage: 'league',
    matches: [{
      id: 'match-1',
      stage: 'league',
      homeId: 'human',
      awayId: 'a',
      status: complete,
      homeScore: 3,
      awayScore: 1,
      winnerId: 'human',
    }],
  }],
};

const payload = {
  schemaVersion: 1,
  tournamentId: analyticsState.id,
  matchId: 'match-1',
  mode: 'classic',
  humanOutcome: 'win',
  penaltyMatch: false,
  tiebreak: false,
  lineup: [
    { playerId: 'p1', name: 'Első Játékos' },
    { playerId: 'p2', name: 'Második Játékos' },
  ],
  duels: [
    {
      id: 'match-1:classic:1:p1:goals', round: 1, attribute: 'goals', outcome: 'win',
      humanPlayerId: 'p1', humanPlayerName: 'Első Játékos', aiPlayerId: 'a1', aiPlayerName: 'Ellenfél 1',
    },
    {
      id: 'match-1:classic:2:p1:yellowCards', round: 2, attribute: 'yellowCards', outcome: 'draw',
      humanPlayerId: 'p1', humanPlayerName: 'Első Játékos', aiPlayerId: 'a2', aiPlayerName: 'Ellenfél 2',
    },
    {
      id: 'match-1:classic:3:p2:goals', round: 3, attribute: 'goals', outcome: 'loss',
      humanPlayerId: 'p2', humanPlayerName: 'Második Játékos', aiPlayerId: 'a3', aiPlayerName: 'Ellenfél 3',
    },
  ],
};

const merged = mergeTournamentResultAnalytics(analyticsState, payload);
assert.equal(merged.tournamentAnalytics.version, 1);
assert.equal(Object.keys(merged.tournamentAnalytics.segments).length, 1);

const playerStats = tournamentPlayerStatistics(merged);
const first = playerStats.find(row => row.playerId === 'p1');
const second = playerStats.find(row => row.playerId === 'p2');
assert.deepEqual(
  { played: first.played, wins: first.wins, draws: first.draws, losses: first.losses, appearances: first.appearances },
  { played: 2, wins: 1, draws: 1, losses: 0, appearances: 1 },
);
assert.deepEqual(
  { played: second.played, wins: second.wins, draws: second.draws, losses: second.losses, appearances: second.appearances },
  { played: 1, wins: 0, draws: 0, losses: 1, appearances: 1 },
);
assert.equal(merged.playerStats.p1.appearances, 1, 'A kompatibilitási játékosstatisztika is csak egyszer számolhatja a meccset.');
assert.equal(merged.playerStats.p1.duels, 2);
assert.equal(merged.playerStats.p1.duelWins, 1);

const categoryStats = tournamentCategoryStatistics(merged);
const goals = categoryStats.find(row => row.attribute === 'goals');
const yellowCards = categoryStats.find(row => row.attribute === 'yellowCards');
assert.deepEqual(
  { played: goals.played, wins: goals.wins, draws: goals.draws, losses: goals.losses },
  { played: 2, wins: 1, draws: 0, losses: 1 },
);
assert.deepEqual(
  { played: yellowCards.played, wins: yellowCards.wins, draws: yellowCards.draws, losses: yellowCards.losses },
  { played: 1, wins: 0, draws: 1, losses: 0 },
);

const duplicate = mergeTournamentResultAnalytics(merged, payload);
assert.equal(Object.keys(duplicate.tournamentAnalytics.segments).length, 1, 'Ugyanaz a result segment nem duplikálódhat.');
assert.deepEqual(tournamentStatisticsSnapshot(duplicate), tournamentStatisticsSnapshot(merged));
assert.equal(tournamentPlayerStatistics(duplicate).find(row => row.playerId === 'p1').played, 2);

const reloaded = JSON.parse(JSON.stringify(duplicate));
assert.deepEqual(
  tournamentStatisticsSnapshot(reloaded),
  tournamentStatisticsSnapshot(duplicate),
  'Reload után ugyanabból a tornaállapotból ugyanazt a statisztikát kell kapni.',
);

const tiebreakPayload = {
  ...payload,
  mode: 'penalties',
  penaltyMatch: true,
  tiebreak: true,
  humanOutcome: 'win',
  duels: [{
    id: 'match-1:penalties:1:p1:goals', round: 1, attribute: 'goals', outcome: 'win',
    humanPlayerId: 'p1', humanPlayerName: 'Első Játékos', aiPlayerId: 'a4', aiPlayerName: 'Ellenfél 4',
  }],
};
const withTiebreak = mergeTournamentResultAnalytics(duplicate, tiebreakPayload);
assert.equal(Object.keys(withTiebreak.tournamentAnalytics.segments).length, 2);
assert.equal(tournamentPlayerStatistics(withTiebreak).find(row => row.playerId === 'p1').played, 3);
assert.equal(tournamentPlayerStatistics(withTiebreak).find(row => row.playerId === 'p1').penaltyMatches, 1);
const duplicateTiebreak = mergeTournamentResultAnalytics(withTiebreak, tiebreakPayload);
assert.equal(Object.keys(duplicateTiebreak.tournamentAnalytics.segments).length, 2);
assert.equal(tournamentPlayerStatistics(duplicateTiebreak).find(row => row.playerId === 'p1').played, 3);
assert.equal(TOURNAMENT_STATISTICS_MIN_DUELS, 3);
assert.equal(tournamentStatisticsSnapshot(withTiebreak).bestWinRate?.playerId, 'p1');

const teamState = {
  id: 'team-stats',
  humanTeamId: 'human',
  participants: teams,
  rounds: [{
    id: 'league-rounds',
    stage: 'league',
    matches: [
      { id: 'm1', stage: 'league', homeId: 'human', awayId: 'a', status: complete, homeScore: 3, awayScore: 1, winnerId: 'human' },
      { id: 'm2', stage: 'league', homeId: 'b', awayId: 'human', status: complete, homeScore: 2, awayScore: 2, winnerId: null },
      { id: 'm3', stage: 'league', homeId: 'human', awayId: 'c', status: complete, homeScore: 0, awayScore: 1, winnerId: 'c' },
    ],
  }],
};
const humanTeamStats = tournamentTeamStatistics(teamState).find(row => row.teamId === 'human');
assert.deepEqual(
  {
    played: humanTeamStats.played,
    wins: humanTeamStats.wins,
    draws: humanTeamStats.draws,
    losses: humanTeamStats.losses,
    scored: humanTeamStats.scored,
    conceded: humanTeamStats.conceded,
    difference: humanTeamStats.difference,
    points: humanTeamStats.points,
    winRate: humanTeamStats.winRate,
  },
  { played: 3, wins: 1, draws: 1, losses: 1, scored: 5, conceded: 4, difference: 1, points: 4, winRate: 33 },
);

const knockoutState = {
  id: 'knockout-stats', humanTeamId: 'human', participants: teams.slice(0, 2),
  rounds: [{
    stage: 'knockout', matches: [{
      id: 'ko1', stage: 'knockout', homeId: 'human', awayId: 'a', status: complete,
      homeScore: 2, awayScore: 2, winnerId: 'human', tiebreakScore: { home: 5, away: 4 }, decidedBy: 'penalties',
    }],
  }],
};
const knockoutHuman = tournamentTeamStatistics(knockoutState).find(row => row.teamId === 'human');
assert.equal(knockoutHuman.played, 1);
assert.equal(knockoutHuman.wins, 1);
assert.equal(knockoutHuman.pointsRelevant, false);
assert.equal(knockoutHuman.points, 0);
assert.deepEqual([knockoutHuman.scored, knockoutHuman.conceded], [7, 6]);

const runtimeSource = fs.readFileSync(new URL('../js/tournament/tournament-experience-v2-runtime.js', import.meta.url), 'utf8');
assert.match(runtimeSource, /playersButton\.textContent = 'Statisztikák'/);
assert.match(runtimeSource, /renderTournamentStatistics\(state\)/);
assert.match(runtimeSource, /TOURNAMENT_STATISTICS_MIN_DUELS = 3/);
assert.doesNotMatch(runtimeSource, /playersButton\?\.remove\(\)/, 'A régi játékos tabot újra kell hasznosítani, nem eltávolítani.');

console.log('✓ Tournament Statistics 1.0: derived csapat-, játékos- és kategóriastatisztikák, reload és idempotencia rendben.');
