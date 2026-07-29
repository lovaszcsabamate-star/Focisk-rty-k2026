import assert from 'node:assert/strict';

import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  advanceTournament,
  createTournament,
  isHungarianCup12,
  recordTournamentMatch,
  recordTournamentTiebreak,
  simulatePendingAiMatches,
  simulateTournamentMatch,
  tournamentMatchById,
  tournamentMatches,
  tournamentNextHumanMatch,
  tournamentStandings,
} from '../js/tournament/tournament-domain.js';

const teams = Array.from({ length: 12 }, (_, index) => ({
  id: `club:t${index + 1}`,
  kind: 'club',
  label: `Csapat ${index + 1}`,
  count: 11 + index,
  selection: { kind: 'club', value: `Csapat ${index + 1}` },
}));
const fixedRng = () => 0.42;

{
  let tournament = createTournament({
    name: 'Csoportos teszt', category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.GROUP_KNOCKOUT, participants: teams.slice(0, 8),
    humanTeamId: teams[0].id, rng: fixedRng,
  });
  assert.equal(tournament.groups.length, 2);
  for (const match of tournamentMatches(tournament).filter(item => item.stage === 'group')) {
    tournament = recordTournamentMatch(tournament, match.id, {
      homeScore: match.homeId === teams[0].id ? 3 : 2,
      awayScore: match.awayId === teams[0].id ? 3 : 1,
      winnerId: match.homeId === teams[0].id ? match.homeId : match.awayId === teams[0].id ? match.awayId : match.homeId,
    });
  }
  tournament = advanceTournament(tournament);
  assert.equal(tournament.phase, 'knockout');
  assert.equal(tournament.rounds.find(round => round.stage === 'knockout').matches.length, 2);
}

{
  let tournament = createTournament({
    name: 'Kieséses teszt', category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.KNOCKOUT, participants: teams.slice(0, 4),
    humanTeamId: teams[0].id, rng: fixedRng,
  });
  const match = tournamentNextHumanMatch(tournament);
  tournament = recordTournamentMatch(tournament, match.id, { homeScore: 5, awayScore: 5 });
  assert.equal(tournamentMatchById(tournament, match.id).status, TOURNAMENT_MATCH_STATUS.TIEBREAK);
  const winnerId = match.homeId === tournament.humanTeamId ? match.homeId : match.awayId;
  tournament = recordTournamentTiebreak(tournament, match.id, { homeScore: 5, awayScore: 4, winnerId });
  assert.equal(tournamentMatchById(tournament, match.id).decidedBy, 'penalties');
}

{
  let tournament = createTournament({
    name: 'Liga teszt', category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.LEAGUE, participants: teams.slice(0, 4),
    humanTeamId: teams[0].id, rng: fixedRng,
  });
  for (const match of tournamentMatches(tournament)) {
    tournament = recordTournamentMatch(tournament, match.id, {
      homeScore: match.homeId === teams[0].id ? 2 : 1,
      awayScore: match.awayId === teams[0].id ? 2 : 0,
      winnerId: match.homeId === teams[0].id ? match.homeId : match.awayId === teams[0].id ? match.awayId : match.homeId,
    });
  }
  assert.equal(tournamentStandings(tournament)[0].teamId, teams[0].id);
  tournament = advanceTournament(tournament);
  assert.equal(tournament.status, TOURNAMENT_STATUS.COMPLETE);
}

{
  const tournament = createTournament({
    name: 'Büntető szimuláció', category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.LEAGUE, matchMode: TOURNAMENT_MATCH_MODE.PENALTIES,
    participants: teams.slice(0, 4), humanTeamId: teams[0].id, rng: fixedRng,
  });
  const aiMatch = tournamentMatches(tournament).find(match => ![match.homeId, match.awayId].includes(tournament.humanTeamId));
  const simulated = simulateTournamentMatch(tournament, aiMatch.id, () => 1);
  const result = tournamentMatchById(simulated, aiMatch.id);
  assert.notEqual(result.homeScore, result.awayScore);
  assert.equal(result.decidedBy, 'simulation-penalties');
}

{
  let cup = createTournament({
    name: 'Magyar Kupa', category: TOURNAMENT_CATEGORY.HUNGARIAN,
    format: TOURNAMENT_FORMAT.KNOCKOUT, participants: teams,
    humanTeamId: teams[0].id, rng: fixedRng,
  });
  assert.equal(isHungarianCup12(cup), true);
  assert.equal(cup.hungarianCupByeTeamIds.length, 4);
  assert.equal(cup.rounds[0].label, '1. kör');
  assert.equal(cup.rounds[0].matches.length, 4);
  for (const match of cup.rounds[0].matches) {
    cup = recordTournamentMatch(cup, match.id, { homeScore: 2, awayScore: 1, winnerId: match.homeId });
  }
  cup = advanceTournament(cup);
  assert.equal(cup.rounds[1].label, 'Negyeddöntő');
  assert.equal(cup.rounds[1].matches.length, 4);
  for (const match of cup.rounds[1].matches) cup = recordTournamentMatch(cup, match.id, { homeScore: 2, awayScore: 1, winnerId: match.homeId });
  cup = advanceTournament(cup);
  assert.equal(cup.rounds[2].label, 'Elődöntő');
  assert.equal(cup.rounds[2].matches.length, 2);
  for (const match of cup.rounds[2].matches) cup = recordTournamentMatch(cup, match.id, { homeScore: 1, awayScore: 0, winnerId: match.homeId });
  cup = advanceTournament(cup);
  assert.equal(cup.rounds[3].label, 'Döntő');
  assert.equal(cup.rounds[3].matches.length, 1);
}

{
  const tournament = createTournament({
    name: 'Szimulációs teszt', category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.LEAGUE, participants: teams.slice(0, 6),
    humanTeamId: teams[0].id, rng: fixedRng,
  });
  const simulated = simulatePendingAiMatches(tournament, teamId => Number(teamId.match(/\d+/)?.[0] ?? 1));
  const nextHuman = tournamentNextHumanMatch(simulated);
  assert.ok(nextHuman);
  const round = simulated.rounds.find(item => item.matches.some(match => match.id === nextHuman.id));
  assert.ok(round.matches.filter(match => ![match.homeId, match.awayId].includes(simulated.humanTeamId))
    .every(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE));
}

console.log('✓ Torna mód: Magyar Kupa, menthető állapot, klasszikus/büntető formátum és AI-szimuláció rendben.');
