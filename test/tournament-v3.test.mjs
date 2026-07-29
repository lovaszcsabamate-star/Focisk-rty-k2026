import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  createTournament,
  tournamentMatches,
} from '../js/tournament/tournament-domain.js';
import {
  applyMatchTelemetry,
  migrateEnhancedTournament,
  playerStatistics,
  teamStatistics,
} from '../js/tournament/tournament-state.js';
import {
  simulatePendingAiMatchesEnhanced,
} from '../js/tournament/tournament-simulation.js';
import { clubBrandForLabel } from '../js/tournament/tournament-presentation-upgrade.js';
import { HUMAN } from '../js/engine.js';
import { PenaltyGame, applyPenaltyRoundScore } from '../js/penalties.js';

const teams = ['alpha', 'bravo', 'charlie', 'delta'].map((id, index) => ({
  id,
  label: `Csapat ${index + 1}`,
  kind: 'club',
  selection: { kind: 'club', value: id },
  count: 11,
}));

const cardsByTeam = new Map(teams.map((team, teamIndex) => [
  team.id,
  Array.from({ length: 11 }, (_, cardIndex) => ({
    id: `${team.id}-${cardIndex + 1}`,
    name: `${team.label} játékos ${cardIndex + 1}`,
    birthDate: `200${cardIndex % 8}-0${cardIndex % 9 + 1}-15`,
    stats: {
      marketValue: (teamIndex + 1) * 1_000_000 + cardIndex * 25_000,
      appearances: 10 + teamIndex + cardIndex,
      starts: 5 + teamIndex + cardIndex,
      minutes: 600 + teamIndex * 90 + cardIndex * 35,
      goals: teamIndex + cardIndex % 5,
      assists: cardIndex % 4,
      yellowCards: cardIndex % 3,
      redCards: cardIndex % 2,
      heightCm: 174 + cardIndex,
    },
  })),
]));

const resolveCards = teamId => cardsByTeam.get(teamId) ?? [];

const classic = migrateEnhancedTournament(createTournament({
  name: 'V3 klasszikus teszt',
  category: TOURNAMENT_CATEGORY.HUNGARIAN,
  format: TOURNAMENT_FORMAT.KNOCKOUT,
  matchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
  participants: teams,
  humanTeamId: teams[0].id,
  rng: () => 0.1,
}));
const classicAfterSimulation = simulatePendingAiMatchesEnhanced(classic, resolveCards);
const classicAiMatch = tournamentMatches(classicAfterSimulation).find(match => ![match.homeId, match.awayId].includes(classicAfterSimulation.humanTeamId));
assert.equal(classicAfterSimulation.version, 3);
assert.equal(classicAiMatch.status, TOURNAMENT_MATCH_STATUS.COMPLETE);
assert.equal(classicAiMatch.decidedBy, 'simulation-classic');
assert.ok(classicAiMatch.simulation.rounds >= 8);
assert.ok(classicAiMatch.homeScore >= 0 && classicAiMatch.awayScore >= 0);
assert.equal(classicAfterSimulation.simulatedResults.length, 1);
assert.ok(playerStatistics(classicAfterSimulation).length > 0);
assert.equal(teamStatistics(classicAfterSimulation).length, 4);

const penalties = migrateEnhancedTournament(createTournament({
  name: 'V3 büntető teszt',
  category: TOURNAMENT_CATEGORY.HUNGARIAN,
  format: TOURNAMENT_FORMAT.KNOCKOUT,
  matchMode: TOURNAMENT_MATCH_MODE.PENALTIES,
  participants: teams,
  humanTeamId: teams[0].id,
  rng: () => 0.1,
}));
const penaltiesAfterSimulation = simulatePendingAiMatchesEnhanced(penalties, resolveCards);
const penaltyAiMatch = tournamentMatches(penaltiesAfterSimulation).find(match => ![match.homeId, match.awayId].includes(penaltiesAfterSimulation.humanTeamId));
assert.equal(penaltyAiMatch.status, TOURNAMENT_MATCH_STATUS.COMPLETE);
assert.equal(penaltyAiMatch.decidedBy, 'simulation-penalties');
assert.notEqual(penaltyAiMatch.homeScore, penaltyAiMatch.awayScore);
assert.ok(penaltiesAfterSimulation.simulatedResults[0].mode === TOURNAMENT_MATCH_MODE.PENALTIES);

const tiedScore = { human: 2, ai: 1 };
const tieResolution = applyPenaltyRoundScore(tiedScore, 'tie', ['human', 'ai']);
assert.deepEqual(tiedScore, { human: 3, ai: 2 }, 'Döntetlennél mindkét csapat gólt és pontot kap.');
assert.equal(tieResolution.tie, true);
assert.deepEqual(tieResolution.goals, { human: 1, ai: 1 });

const telemetryMatch = tournamentMatches(penalties)[0];
const homeCard = cardsByTeam.get(telemetryMatch.homeId)[0];
const awayCard = cardsByTeam.get(telemetryMatch.awayId)[0];
const telemetryLookup = new Map([homeCard, awayCard].map(card => [card.id, card]));
const tieTelemetryState = applyMatchTelemetry(penalties, telemetryMatch, {
  mode: TOURNAMENT_MATCH_MODE.PENALTIES,
  homeSide: 'human',
  log: [{
    round: 1,
    attribute: 'goals',
    humanCard: homeCard,
    aiCard: awayCard,
    winner: 'tie',
    suddenDeath: false,
  }],
}, telemetryLookup);
for (const card of [homeCard, awayCard]) {
  const stat = tieTelemetryState.playerStats[card.id];
  assert.equal(stat.duelDraws, 1);
  assert.equal(stat.penaltyGoals, 1);
  assert.equal(stat.penaltyMisses, 0);
}

assert.equal(clubBrandForLabel('Paksi FC')?.short, 'PAKS');
const presentationSource = readFileSync(new URL('../js/tournament/tournament-lineup-ui.js', import.meta.url), 'utf8');
assert.match(presentationSource, /tournament-bracket--tree/);
assert.match(presentationSource, /tournament-bracket__match--connected/);

const oldSave = migrateEnhancedTournament({
  ...classic,
  version: 1,
  playerStats: { legacy: { playerId: 'legacy', name: 'Régi játékos', wins: 2, losses: 1, draws: 1 } },
  teamStats: undefined,
  lineupState: undefined,
  simulatedResults: undefined,
  matchHistory: undefined,
});
assert.equal(oldSave.version, 3);
assert.equal(oldSave.playerStats.legacy.duelWins, 2);
assert.deepEqual(oldSave.lineupState.favoriteLineupIds, []);
assert.deepEqual(oldSave.simulatedResults, []);

const orderedHuman = Array.from({ length: 11 }, (_, index) => ({
  ...cardsByTeam.get('alpha')[index],
  meta: { quickMatchSide: HUMAN, tournamentLineupOrder: index },
}));
const orderedAi = Array.from({ length: 11 }, (_, index) => ({
  ...cardsByTeam.get('bravo')[index],
  meta: { quickMatchSide: 'ai', tournamentLineupOrder: index },
}));
const penaltyGame = new PenaltyGame({ players: [...orderedHuman, ...orderedAi], rng: () => 0.75 });
assert.deepEqual(
  penaltyGame.hands[HUMAN].map(card => card.id),
  orderedHuman.map(card => card.id),
  'A torna büntetőrúgó-sorrendjének meg kell maradnia a meccs indításakor.',
);

console.log('Torna v3: klublogók, kupaág, döntetlen büntetők, szimuláció és statisztikák rendben.');
