/** DOM-mentes torna-, liga-, csoportkör- és kieséses logika. */

export const TOURNAMENT_VERSION = 1;

export const TOURNAMENT_FORMAT = Object.freeze({
  GROUP_KNOCKOUT: 'group-knockout',
  KNOCKOUT: 'knockout',
  LEAGUE: 'league',
});

export const TOURNAMENT_CATEGORY = Object.freeze({
  HUNGARIAN: 'hungarian',
  NATIONS: 'nations',
});

export const TOURNAMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETE: 'complete',
});

export const TOURNAMENT_MATCH_STATUS = Object.freeze({
  PENDING: 'pending',
  TIEBREAK: 'tiebreak',
  COMPLETE: 'complete',
});

const tournamentFormats = new Set(Object.values(TOURNAMENT_FORMAT));
const tournamentCategories = new Set(Object.values(TOURNAMENT_CATEGORY));
const tournamentText = value => String(value ?? '').trim();
const tournamentClone = value => JSON.parse(JSON.stringify(value));
const tournamentNow = () => new Date().toISOString();
const tournamentClamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const tournamentHash = value => {
  let hash = 2166136261;
  for (const character of tournamentText(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const tournamentSeededRandom = seed => {
  let state = tournamentHash(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export function tournamentShuffle(items, rng = Math.random) {
  const output = [...(Array.isArray(items) ? items : [])];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const randomValue = tournamentClamp(Number(rng()) || 0, 0, 0.999999999);
    const target = Math.floor(randomValue * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export function normaliseTournamentTeam(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = tournamentText(entry.id);
  const label = tournamentText(entry.label);
  const kind = tournamentText(entry.kind);
  const selection = entry.selection && typeof entry.selection === 'object'
    ? { kind: tournamentText(entry.selection.kind), value: tournamentText(entry.selection.value) }
    : null;
  if (!id || !label || !kind || !selection?.kind || !selection?.value) return null;
  return Object.freeze({
    id,
    label,
    kind,
    selection,
    icon: tournamentText(entry.flag || entry.icon),
    badge: tournamentText(entry.badge),
    subtitle: tournamentText(entry.subtitle),
    count: Number.isFinite(Number(entry.count)) ? Number(entry.count) : 0,
  });
}

const tournamentRoundLabel = (teamCount, roundIndex = 0) => {
  if (teamCount === 2) return 'Döntő';
  if (teamCount === 4) return 'Elődöntő';
  if (teamCount === 8) return 'Negyeddöntő';
  if (teamCount === 16) return 'Nyolcaddöntő';
  if (teamCount === 32) return 'Legjobb 32';
  return `${roundIndex + 1}. kieséses forduló`;
};

const tournamentMatch = ({
  id,
  stage,
  roundIndex,
  homeId,
  awayId,
  groupId = null,
  label = '',
}) => ({
  id,
  stage,
  roundIndex,
  groupId,
  label,
  homeId,
  awayId,
  status: TOURNAMENT_MATCH_STATUS.PENDING,
  homeScore: null,
  awayScore: null,
  winnerId: null,
  decidedBy: null,
  playedAt: null,
});

export function createRoundRobinRounds(teamIds, {
  stage = 'league',
  groupId = null,
  idPrefix = stage,
} = {}) {
  const unique = [...new Set((Array.isArray(teamIds) ? teamIds : []).map(tournamentText).filter(Boolean))];
  if (unique.length < 2) return [];
  const rotating = unique.length % 2 === 0 ? [...unique] : [...unique, null];
  const roundCount = rotating.length - 1;
  const rounds = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const matches = [];
    for (let pairIndex = 0; pairIndex < rotating.length / 2; pairIndex += 1) {
      const left = rotating[pairIndex];
      const right = rotating[rotating.length - 1 - pairIndex];
      if (!left || !right) continue;
      const swap = (roundIndex + pairIndex) % 2 === 1;
      const homeId = swap ? right : left;
      const awayId = swap ? left : right;
      matches.push(tournamentMatch({
        id: `${idPrefix}-r${roundIndex + 1}-m${pairIndex + 1}-${homeId}-${awayId}`,
        stage,
        roundIndex,
        groupId,
        label: `${roundIndex + 1}. forduló`,
        homeId,
        awayId,
      }));
    }
    rounds.push({
      id: `${idPrefix}-round-${roundIndex + 1}`,
      stage,
      groupId,
      index: roundIndex,
      label: `${roundIndex + 1}. forduló`,
      matches,
    });
    rotating.splice(1, 0, rotating.pop());
  }
  return rounds;
}

export function createKnockoutRound(teamIds, roundIndex = 0, idPrefix = 'knockout') {
  const teams = [...new Set((Array.isArray(teamIds) ? teamIds : []).map(tournamentText).filter(Boolean))];
  if (teams.length < 2 || (teams.length & (teams.length - 1)) !== 0) {
    throw new Error('A kieséses szakaszhoz legalább két, kettő hatványának megfelelő számú csapat szükséges.');
  }
  const label = tournamentRoundLabel(teams.length, roundIndex);
  const matches = [];
  for (let index = 0; index < teams.length / 2; index += 1) {
    const homeId = teams[index];
    const awayId = teams[teams.length - 1 - index];
    matches.push(tournamentMatch({
      id: `${idPrefix}-r${roundIndex + 1}-m${index + 1}-${homeId}-${awayId}`,
      stage: 'knockout',
      roundIndex,
      label,
      homeId,
      awayId,
    }));
  }
  return {
    id: `${idPrefix}-round-${roundIndex + 1}`,
    stage: 'knockout',
    groupId: null,
    index: roundIndex,
    label,
    matches,
  };
}

const tournamentGroupCount = participantCount => Math.max(2, Math.floor(participantCount / 4));

const createGroups = participants => {
  const groupCount = tournamentGroupCount(participants.length);
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${String.fromCharCode(65 + index)}`,
    label: `${String.fromCharCode(65 + index)} csoport`,
    teamIds: [],
  }));
  participants.forEach((participant, index) => groups[index % groupCount].teamIds.push(participant.id));
  return groups;
};

const createGroupRounds = groups => {
  const schedules = groups.map(group => createRoundRobinRounds(group.teamIds, {
    stage: 'group',
    groupId: group.id,
    idPrefix: group.id,
  }));
  const roundCount = Math.max(...schedules.map(rounds => rounds.length), 0);
  return Array.from({ length: roundCount }, (_, index) => ({
    id: `group-stage-round-${index + 1}`,
    stage: 'group',
    groupId: null,
    index,
    label: `${index + 1}. csoportforduló`,
    matches: schedules.flatMap(rounds => rounds[index]?.matches ?? []),
  }));
};

export function createTournament({
  name = 'Új torna',
  category = TOURNAMENT_CATEGORY.HUNGARIAN,
  format = TOURNAMENT_FORMAT.LEAGUE,
  participants,
  humanTeamId,
  difficulty = 'medium',
  rng = Math.random,
} = {}) {
  if (!tournamentCategories.has(category)) throw new Error(`Ismeretlen tornakategória: ${category}`);
  if (!tournamentFormats.has(format)) throw new Error(`Ismeretlen tornaforma: ${format}`);
  const teams = (Array.isArray(participants) ? participants : [])
    .map(normaliseTournamentTeam)
    .filter(Boolean);
  const uniqueTeams = [...new Map(teams.map(team => [team.id, team])).values()];
  if (uniqueTeams.length < 4) throw new Error('A torna indításához legalább négy különböző csapat szükséges.');
  if (!uniqueTeams.some(team => team.id === humanTeamId)) throw new Error('A saját csapat nem szerepel a résztvevők között.');
  if (format === TOURNAMENT_FORMAT.KNOCKOUT && (uniqueTeams.length & (uniqueTeams.length - 1)) !== 0) {
    throw new Error('A csak kieséses torna résztvevőinek száma 4, 8, 16 vagy 32 lehet.');
  }
  if (format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT && uniqueTeams.length % 4 !== 0) {
    throw new Error('A csoportkörös torna résztvevőinek száma néggyel osztható kell legyen.');
  }

  const shuffled = tournamentShuffle(uniqueTeams, rng);
  const humanIndex = shuffled.findIndex(team => team.id === humanTeamId);
  if (humanIndex > 0) [shuffled[0], shuffled[humanIndex]] = [shuffled[humanIndex], shuffled[0]];
  const createdAt = tournamentNow();
  const id = `tournament-${Date.now()}-${tournamentHash(`${name}-${humanTeamId}-${createdAt}`).toString(36)}`;
  const groups = format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT ? createGroups(shuffled) : [];
  let rounds = [];
  let phase = 'league';

  if (format === TOURNAMENT_FORMAT.LEAGUE) {
    rounds = createRoundRobinRounds(shuffled.map(team => team.id), { stage: 'league', idPrefix: id });
  } else if (format === TOURNAMENT_FORMAT.KNOCKOUT) {
    phase = 'knockout';
    rounds = [createKnockoutRound(shuffled.map(team => team.id), 0, id)];
  } else {
    phase = 'group';
    rounds = createGroupRounds(groups);
  }

  return {
    version: TOURNAMENT_VERSION,
    id,
    name: tournamentText(name) || 'Új torna',
    category,
    format,
    difficulty: tournamentText(difficulty) || 'medium',
    status: TOURNAMENT_STATUS.ACTIVE,
    phase,
    participants: shuffled,
    humanTeamId,
    groups,
    rounds,
    currentMatchId: null,
    currentMatchMode: null,
    championId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export const tournamentTeamById = (state, teamId) => (
  (state?.participants ?? []).find(team => team.id === teamId) ?? null
);

export const tournamentMatches = state => (
  (state?.rounds ?? []).flatMap(round => round.matches ?? [])
);

export const tournamentMatchById = (state, matchId) => (
  tournamentMatches(state).find(match => match.id === matchId) ?? null
);

export const tournamentRoundForMatch = (state, matchId) => (
  (state?.rounds ?? []).find(round => (round.matches ?? []).some(match => match.id === matchId)) ?? null
);

export function tournamentStandings(state, groupId = null) {
  const scopedTeamIds = groupId
    ? (state?.groups ?? []).find(group => group.id === groupId)?.teamIds ?? []
    : (state?.participants ?? []).map(team => team.id);
  const rows = new Map(scopedTeamIds.map(teamId => [teamId, {
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    scored: 0,
    conceded: 0,
    difference: 0,
    points: 0,
  }]));

  for (const match of tournamentMatches(state)) {
    if (match.status !== TOURNAMENT_MATCH_STATUS.COMPLETE) continue;
    if (groupId && match.groupId !== groupId) continue;
    if (!groupId && !['league', 'group'].includes(match.stage)) continue;
    const home = rows.get(match.homeId);
    const away = rows.get(match.awayId);
    if (!home || !away) continue;
    const homeScore = Number(match.homeScore) || 0;
    const awayScore = Number(match.awayScore) || 0;
    home.played += 1;
    away.played += 1;
    home.scored += homeScore;
    home.conceded += awayScore;
    away.scored += awayScore;
    away.conceded += homeScore;
    if (homeScore === awayScore) {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    } else if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    }
  }

  const output = [...rows.values()].map(row => ({
    ...row,
    difference: row.scored - row.conceded,
  }));
  output.sort((left, right) => (
    right.points - left.points
    || right.difference - left.difference
    || right.scored - left.scored
    || right.wins - left.wins
    || tournamentText(tournamentTeamById(state, left.teamId)?.label)
      .localeCompare(tournamentText(tournamentTeamById(state, right.teamId)?.label), 'hu-HU')
  ));
  return output.map((row, index) => ({ ...row, position: index + 1 }));
}

const tournamentQualifierTarget = participantCount => {
  let value = 1;
  while (value * 2 < participantCount) value *= 2;
  return Math.max(4, value);
};

const groupQualifiers = state => {
  const rankedGroups = (state.groups ?? []).map(group => tournamentStandings(state, group.id));
  const direct = rankedGroups.flatMap(rows => rows.slice(0, 2));
  const target = tournamentQualifierTarget(state.participants.length);
  if (direct.length >= target) return direct.slice(0, target).map(row => row.teamId);
  const additional = rankedGroups
    .flatMap(rows => rows.slice(2, 3))
    .sort((left, right) => (
      right.points - left.points
      || right.difference - left.difference
      || right.scored - left.scored
      || right.wins - left.wins
    ));
  return [...direct, ...additional.slice(0, target - direct.length)].map(row => row.teamId);
};

const allRoundMatchesComplete = round => (
  (round?.matches ?? []).length > 0
  && round.matches.every(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE)
);

export function recordTournamentMatch(state, matchId, {
  homeScore,
  awayScore,
  winnerId = null,
  decidedBy = 'played',
} = {}) {
  const next = tournamentClone(state);
  const match = tournamentMatchById(next, matchId);
  if (!match) throw new Error(`A tornamérkőzés nem található: ${matchId}`);
  if (match.status === TOURNAMENT_MATCH_STATUS.COMPLETE) return next;
  const home = Number(homeScore);
  const away = Number(awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0) {
    throw new Error('A mérkőzés eredménye nem érvényes.');
  }
  match.homeScore = home;
  match.awayScore = away;
  match.playedAt = tournamentNow();

  if (match.stage === 'knockout' && home === away && !winnerId) {
    match.status = TOURNAMENT_MATCH_STATUS.TIEBREAK;
    match.decidedBy = 'pending-penalties';
  } else {
    match.status = TOURNAMENT_MATCH_STATUS.COMPLETE;
    match.winnerId = winnerId || (home > away ? match.homeId : away > home ? match.awayId : null);
    match.decidedBy = decidedBy;
  }
  next.updatedAt = tournamentNow();
  return next;
}

export function recordTournamentTiebreak(state, matchId, {
  homeScore,
  awayScore,
  winnerId,
} = {}) {
  const next = tournamentClone(state);
  const match = tournamentMatchById(next, matchId);
  if (!match || match.status !== TOURNAMENT_MATCH_STATUS.TIEBREAK) {
    throw new Error('Ehhez a mérkőzéshez nincs folyamatban lévő büntetőpárbaj.');
  }
  if (![match.homeId, match.awayId].includes(winnerId)) throw new Error('A büntetőpárbaj győztese érvénytelen.');
  match.status = TOURNAMENT_MATCH_STATUS.COMPLETE;
  match.winnerId = winnerId;
  match.decidedBy = 'penalties';
  match.tiebreakScore = {
    home: Number(homeScore) || 0,
    away: Number(awayScore) || 0,
  };
  match.playedAt = tournamentNow();
  next.updatedAt = tournamentNow();
  return next;
}

export function advanceTournament(state) {
  const next = tournamentClone(state);
  if (next.status === TOURNAMENT_STATUS.COMPLETE) return next;

  if (next.phase === 'league') {
    const leagueRounds = next.rounds.filter(round => round.stage === 'league');
    if (leagueRounds.length && leagueRounds.every(allRoundMatchesComplete)) {
      next.championId = tournamentStandings(next)[0]?.teamId ?? null;
      next.status = TOURNAMENT_STATUS.COMPLETE;
    }
  } else if (next.phase === 'group') {
    const groupRounds = next.rounds.filter(round => round.stage === 'group');
    if (groupRounds.length && groupRounds.every(allRoundMatchesComplete)) {
      const qualifiers = groupQualifiers(next);
      next.phase = 'knockout';
      next.rounds.push(createKnockoutRound(qualifiers, 0, `${next.id}-knockout`));
    }
  } else if (next.phase === 'knockout') {
    const knockoutRounds = next.rounds.filter(round => round.stage === 'knockout');
    const latest = knockoutRounds.at(-1);
    if (latest && allRoundMatchesComplete(latest)) {
      const winners = latest.matches.map(match => match.winnerId).filter(Boolean);
      if (winners.length === 1) {
        next.championId = winners[0];
        next.status = TOURNAMENT_STATUS.COMPLETE;
      } else if (winners.length > 1) {
        next.rounds.push(createKnockoutRound(winners, knockoutRounds.length, `${next.id}-knockout`));
      }
    }
  }

  if (next.status === TOURNAMENT_STATUS.COMPLETE) {
    next.currentMatchId = null;
    next.currentMatchMode = null;
  }
  next.updatedAt = tournamentNow();
  return next;
}

export const tournamentHumanEliminated = state => tournamentMatches(state).some(match => (
  match.stage === 'knockout'
  && match.status === TOURNAMENT_MATCH_STATUS.COMPLETE
  && [match.homeId, match.awayId].includes(state?.humanTeamId)
  && match.winnerId !== state?.humanTeamId
));

export function tournamentNextIncompleteRound(state) {
  return (state?.rounds ?? []).find(round => (
    (round.matches ?? []).some(match => match.status !== TOURNAMENT_MATCH_STATUS.COMPLETE)
  )) ?? null;
}

export function tournamentNextHumanMatch(state) {
  if (!state || state.status === TOURNAMENT_STATUS.COMPLETE || tournamentHumanEliminated(state)) return null;
  const current = tournamentMatchById(state, state.currentMatchId);
  if (current && current.status !== TOURNAMENT_MATCH_STATUS.COMPLETE) return current;
  for (const round of state.rounds ?? []) {
    const match = (round.matches ?? []).find(item => (
      item.status !== TOURNAMENT_MATCH_STATUS.COMPLETE
      && [item.homeId, item.awayId].includes(state.humanTeamId)
    ));
    if (match) return match;
  }
  return null;
}

export function simulateTournamentMatch(state, matchId, strengthResolver = () => 1) {
  const match = tournamentMatchById(state, matchId);
  if (!match || match.status !== TOURNAMENT_MATCH_STATUS.PENDING) return tournamentClone(state);
  const homeStrength = Math.max(0.01, Number(strengthResolver(match.homeId)) || 1);
  const awayStrength = Math.max(0.01, Number(strengthResolver(match.awayId)) || 1);
  const relative = (homeStrength - awayStrength) / Math.max(homeStrength, awayStrength, 1);
  const rng = tournamentSeededRandom(`${state.id}:${match.id}`);
  const drawChance = match.stage === 'knockout' ? 0 : tournamentClamp(0.22 - Math.abs(relative) * 0.14, 0.08, 0.24);
  const first = rng();
  let homeScore;
  let awayScore;
  let winnerId = null;

  if (first < drawChance) {
    homeScore = awayScore = rng() < 0.68 ? 1 : 2;
  } else {
    const homeWinChance = tournamentClamp(0.5 + relative * 0.34, 0.18, 0.82);
    const homeWins = (first - drawChance) / Math.max(0.0001, 1 - drawChance) < homeWinChance;
    const winningScore = 1 + Math.floor(rng() * 3);
    const losingScore = Math.min(winningScore - 1, Math.floor(rng() * Math.max(1, winningScore)));
    homeScore = homeWins ? winningScore : losingScore;
    awayScore = homeWins ? losingScore : winningScore;
    winnerId = homeWins ? match.homeId : match.awayId;
  }

  return recordTournamentMatch(state, matchId, {
    homeScore,
    awayScore,
    winnerId,
    decidedBy: 'simulation',
  });
}

export function simulatePendingAiMatches(state, strengthResolver = () => 1) {
  let next = tournamentClone(state);
  for (let guard = 0; guard < 100; guard += 1) {
    next = advanceTournament(next);
    if (next.status === TOURNAMENT_STATUS.COMPLETE) break;
    const round = tournamentNextIncompleteRound(next);
    if (!round) break;
    let humanPending = false;
    let changed = false;
    for (const match of round.matches ?? []) {
      if (match.status === TOURNAMENT_MATCH_STATUS.COMPLETE) continue;
      if ([match.homeId, match.awayId].includes(next.humanTeamId) && !tournamentHumanEliminated(next)) {
        humanPending = true;
        continue;
      }
      if (match.status === TOURNAMENT_MATCH_STATUS.PENDING) {
        next = simulateTournamentMatch(next, match.id, strengthResolver);
        changed = true;
      }
    }
    next = advanceTournament(next);
    if (humanPending || next.status === TOURNAMENT_STATUS.COMPLETE) break;
    if (!changed && tournamentNextIncompleteRound(next)?.id === round.id) break;
  }
  next.updatedAt = tournamentNow();
  return next;
}

export function tournamentProgress(state) {
  const matches = tournamentMatches(state);
  const completed = matches.filter(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE).length;
  return {
    completed,
    total: matches.length,
    percent: matches.length ? Math.round(completed / matches.length * 100) : 0,
  };
}
