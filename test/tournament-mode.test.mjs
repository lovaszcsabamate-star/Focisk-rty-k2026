import assert from 'node:assert/strict';

import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  advanceTournament,
  createTournament,
  recordTournamentMatch,
  recordTournamentTiebreak,
  simulatePendingAiMatches,
  tournamentMatchById,
  tournamentMatches,
  tournamentNextHumanMatch,
  tournamentStandings,
} from '../js/tournament/tournament-domain.js';

const teams = Array.from({ length: 12 }, (_, index) => ({
  id: `nation:t${index + 1}`,
  kind: 'nation',
  label: `Csapat ${index + 1}`,
  count: 11 + index,
  selection: { kind: 'nation', value: `T${index + 1}` },
}));

const fixedRng = () => 0.42;

{
  let tournament = createTournament({
    name: 'Csoportos teszt',
    category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.GROUP_KNOCKOUT,
    participants: teams.slice(0, 8),
    humanTeamId: teams[0].id,
    rng: fixedRng,
  });
  assert.equal(tournament.groups.length, 2);
  assert.equal(tournament.phase, 'group');
  for (const match of tournamentMatches(tournament).filter(item => item.stage === 'group')) {
    tournament = recordTournamentMatch(tournament, match.id, {
      homeScore: match.homeId === teams[0].id ? 3 : 2,
      awayScore: match.awayId === teams[0].id ? 3 : 1,
      winnerId: match.homeId === teams[0].id ? match.homeId : match.awayId === teams[0].id ? match.awayId : match.homeId,
    });
  }
  tournament = advanceTournament(tournament);
  assert.equal(tournament.phase, 'knockout');
  const knockout = tournament.rounds.find(round => round.stage === 'knockout');
  assert.ok(knockout);
  assert.equal(knockout.matches.length, 2);
}

{
  let tournament = createTournament({
    name: 'Kieséses teszt',
    category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.KNOCKOUT,
    participants: teams.slice(0, 4),
    humanTeamId: teams[0].id,
    rng: fixedRng,
  });
  const match = tournamentNextHumanMatch(tournament);
  tournament = recordTournamentMatch(tournament, match.id, { homeScore: 5, awayScore: 5 });
  assert.equal(tournamentMatchById(tournament, match.id).status, TOURNAMENT_MATCH_STATUS.TIEBREAK);
  const winnerId = match.homeId === tournament.humanTeamId ? match.homeId : match.awayId;
  tournament = recordTournamentTiebreak(tournament, match.id, { homeScore: 5, awayScore: 4, winnerId });
  assert.equal(tournamentMatchById(tournament, match.id).status, TOURNAMENT_MATCH_STATUS.COMPLETE);
  assert.equal(tournamentMatchById(tournament, match.id).decidedBy, 'penalties');
}

{
  let tournament = createTournament({
    name: 'Liga teszt',
    category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.LEAGUE,
    participants: teams.slice(0, 4),
    humanTeamId: teams[0].id,
    rng: fixedRng,
  });
  for (const match of tournamentMatches(tournament)) {
    tournament = recordTournamentMatch(tournament, match.id, {
      homeScore: match.homeId === teams[0].id ? 2 : 1,
      awayScore: match.awayId === teams[0].id ? 2 : 0,
      winnerId: match.homeId === teams[0].id ? match.homeId : match.awayId === teams[0].id ? match.awayId : match.homeId,
    });
  }
  const standings = tournamentStandings(tournament);
  assert.equal(standings[0].teamId, teams[0].id);
  tournament = advanceTournament(tournament);
  assert.equal(tournament.status, TOURNAMENT_STATUS.COMPLETE);
  assert.equal(tournament.championId, teams[0].id);
}

{
  const tournament = createTournament({
    name: 'Szimulációs teszt',
    category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.LEAGUE,
    participants: teams.slice(0, 6),
    humanTeamId: teams[0].id,
    rng: fixedRng,
  });
  const simulated = simulatePendingAiMatches(tournament, teamId => Number(teamId.match(/\d+/)?.[0] ?? 1));
  const nextHuman = tournamentNextHumanMatch(simulated);
  assert.ok(nextHuman);
  const currentRound = simulated.rounds.find(round => round.matches.some(match => match.id === nextHuman.id));
  assert.ok(currentRound.matches.filter(match => ![match.homeId, match.awayId].includes(simulated.humanTeamId))
    .every(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE));
}

console.log('✓ Torna mód: csoportkör, liga, kieséses ág, büntetők és AI-szimuláció rendben.');
