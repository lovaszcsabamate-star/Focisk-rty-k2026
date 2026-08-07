import assert from 'node:assert/strict';

import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FINALIZATION_STATUS,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  TOURNAMENT_STRUCTURED_RESULT_KEY,
  advanceTournament,
  createTournament,
  finalizeTournamentMatch,
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
import {
  TOURNAMENT_STORAGE_KEY,
  createTournamentStorageService,
} from '../js/services/tournament-storage-service.js';

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
  const regular = finalizeTournamentMatch(tournament, match.id, { homeScore: 5, awayScore: 5 });
  assert.equal(regular.status, TOURNAMENT_FINALIZATION_STATUS.TIEBREAK_REQUIRED);
  tournament = regular.state;
  assert.equal(tournamentMatchById(tournament, match.id).status, TOURNAMENT_MATCH_STATUS.TIEBREAK);
  const winnerId = match.homeId === tournament.humanTeamId ? match.homeId : match.awayId;
  const tiebreak = finalizeTournamentMatch(tournament, match.id, {
    homeScore: winnerId === match.homeId ? 5 : 4,
    awayScore: winnerId === match.awayId ? 5 : 4,
    winnerId,
    tiebreak: true,
    decidedBy: 'penalties',
  });
  assert.equal(tiebreak.status, TOURNAMENT_FINALIZATION_STATUS.FINALIZED);
  tournament = tiebreak.state;
  assert.equal(tournamentMatchById(tournament, match.id).decidedBy, 'penalties');
  assert.equal(tournamentMatchById(tournament, match.id).finalizationVersion, 1);
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
  let tournament = createTournament({
    name: 'Idempotencia teszt', category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.LEAGUE, participants: teams.slice(0, 4),
    humanTeamId: teams[0].id, rng: fixedRng,
  });
  const match = tournamentNextHumanMatch(tournament);
  tournament.currentMatchId = match.id;
  tournament.currentMatchMode = TOURNAMENT_MATCH_MODE.CLASSIC;
  tournament.currentLineupIds = ['p1'];
  const input = {
    homeScore: 3,
    awayScore: 1,
    winnerId: match.homeId,
    humanOutcome: match.homeId === tournament.humanTeamId ? 'win' : 'loss',
    penaltyMatch: false,
    lineup: [{ playerId: 'p1', name: 'Teszt Játékos' }],
  };
  const first = finalizeTournamentMatch(tournament, match.id, input);
  assert.equal(first.status, TOURNAMENT_FINALIZATION_STATUS.FINALIZED);
  assert.equal(first.state.currentMatchId, null);
  assert.equal(first.state.playerStats.p1.appearances, 1);
  const standings = tournamentStandings(first.state);

  const duplicate = finalizeTournamentMatch(first.state, match.id, input);
  assert.equal(duplicate.status, TOURNAMENT_FINALIZATION_STATUS.ALREADY_FINALIZED);
  assert.equal(duplicate.conflict, false);
  assert.equal(duplicate.state.playerStats.p1.appearances, 1);
  assert.deepEqual(tournamentStandings(duplicate.state), standings);

  const conflictingDuplicate = finalizeTournamentMatch(first.state, match.id, {
    ...input,
    homeScore: 0,
    awayScore: 4,
    winnerId: match.awayId,
  });
  assert.equal(conflictingDuplicate.status, TOURNAMENT_FINALIZATION_STATUS.ALREADY_FINALIZED);
  assert.equal(conflictingDuplicate.conflict, true);
  assert.deepEqual(tournamentStandings(conflictingDuplicate.state), standings);

  assert.equal(
    finalizeTournamentMatch(first.state, 'missing-match', input).status,
    TOURNAMENT_FINALIZATION_STATUS.MATCH_NOT_FOUND,
  );
  assert.equal(
    finalizeTournamentMatch(tournament, match.id, { homeScore: -1, awayScore: 2 }).status,
    TOURNAMENT_FINALIZATION_STATUS.INVALID_RESULT,
  );
}

{
  let tournament = createTournament({
    name: 'Strukturált eredmény teszt', category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.LEAGUE, participants: teams.slice(0, 4),
    humanTeamId: teams[0].id, rng: fixedRng,
  });
  const match = tournamentNextHumanMatch(tournament);
  tournament.currentMatchId = match.id;
  tournament.currentLineupIds = ['p2'];
  globalThis[TOURNAMENT_STRUCTURED_RESULT_KEY] = Object.freeze({
    schemaVersion: 1,
    tournamentId: tournament.id,
    matchId: match.id,
    homeScore: 4,
    awayScore: 0,
    winnerId: match.homeId,
    decidedBy: 'played',
    humanOutcome: match.homeId === tournament.humanTeamId ? 'win' : 'loss',
    penaltyMatch: false,
    tiebreak: false,
    lineup: [{ playerId: 'p2', name: 'Strukturált Játékos' }],
  });
  const finalized = recordTournamentMatch(tournament, match.id, {
    homeScore: 0,
    awayScore: 9,
    winnerId: match.awayId,
  });
  delete globalThis[TOURNAMENT_STRUCTURED_RESULT_KEY];
  assert.equal(tournamentMatchById(finalized, match.id).homeScore, 4);
  assert.equal(tournamentMatchById(finalized, match.id).awayScore, 0);
  assert.equal(finalized.playerStats.p2.appearances, 1);
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
  assert.equal(result.finalizationVersion, 1);
  assert.ok(result.finalizedAt);
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
  const roundsBeforeDuplicate = cup.rounds.length;
  const semifinal = cup.rounds[2].matches[0];
  const duplicate = finalizeTournamentMatch(cup, semifinal.id, {
    homeScore: semifinal.homeScore,
    awayScore: semifinal.awayScore,
    winnerId: semifinal.winnerId,
  });
  assert.equal(duplicate.status, TOURNAMENT_FINALIZATION_STATUS.ALREADY_FINALIZED);
  assert.equal(duplicate.state.rounds.length, roundsBeforeDuplicate);
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
    .every(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE && match.finalizationVersion === 1));
}

{
  const memory = new Map();
  let failTournamentWrites = false;
  const storage = {
    readJson(key, fallback) { return memory.has(key) ? structuredClone(memory.get(key)) : fallback; },
    writeJson(key, value) {
      if (failTournamentWrites && key === TOURNAMENT_STORAGE_KEY) return false;
      memory.set(key, structuredClone(value));
      return true;
    },
    remove(key) { memory.delete(key); return true; },
  };
  const service = createTournamentStorageService({ storage });
  const initial = createTournament({
    name: 'Rollback teszt', category: TOURNAMENT_CATEGORY.NATIONS,
    format: TOURNAMENT_FORMAT.LEAGUE, participants: teams.slice(0, 4),
    humanTeamId: teams[0].id, rng: fixedRng,
  });
  assert.equal(service.save(initial), true);
  const match = tournamentNextHumanMatch(initial);
  const staged = { ...initial, currentMatchId: match.id, currentMatchMode: TOURNAMENT_MATCH_MODE.CLASSIC };
  assert.equal(service.save(staged), true);
  assert.equal(service.commitPendingLaunch(), true);
  const active = service.read();
  const finalized = finalizeTournamentMatch(active, match.id, {
    homeScore: 2,
    awayScore: 1,
    winnerId: match.homeId,
  });
  failTournamentWrites = true;
  assert.equal(service.save(finalized.state), false);
  const afterFailure = service.read();
  assert.equal(afterFailure.currentMatchId, match.id);
  assert.equal(tournamentMatchById(afterFailure, match.id).status, TOURNAMENT_MATCH_STATUS.PENDING);
}

console.log('✓ Torna mód: idempotens finalizáció, Magyar Kupa, mentési rollback, klasszikus/büntető és AI-szimuláció rendben.');
