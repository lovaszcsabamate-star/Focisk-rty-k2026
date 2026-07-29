import {
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  tournamentMatches,
  tournamentTeamById,
} from './tournament-domain.js';

/** Torna v3 állapot-, statisztika-, díj- és visszafelé kompatibilitási modell. */

const TOURNAMENT_ENHANCED_VERSION = 3;

const clone = value => JSON.parse(JSON.stringify(value));
const text = value => String(value ?? '').trim();
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const now = () => new Date().toISOString();

const emptyPlayerStat = ({ playerId = '', name = '', teamId = '', teamLabel = '', cardImage = '' } = {}) => ({
  playerId: text(playerId),
  name: text(name) || text(playerId),
  teamId: text(teamId),
  teamLabel: text(teamLabel),
  cardImage: text(cardImage),
  matchIds: [],
  appearances: 0,
  selections: 0,
  duelWins: 0,
  duelLosses: 0,
  duelDraws: 0,
  categoryWins: {},
  bestCategory: '',
  manOfMatchCount: 0,
  keyMoments: 0,
  penaltyAttempts: 0,
  penaltyGoals: 0,
  penaltyMisses: 0,
  suddenDeathGoals: 0,
  decisivePenalties: 0,
  captainAppearances: 0,
  totalPerformance: 0,
  efficiency: 0,
});

const normalisePlayerStat = (value, playerId = '') => {
  const base = emptyPlayerStat({ playerId, ...value });
  const categoryWins = value?.categoryWins && typeof value.categoryWins === 'object' ? value.categoryWins : {};
  return {
    ...base,
    ...value,
    playerId: text(value?.playerId || playerId),
    name: text(value?.name || playerId),
    teamId: text(value?.teamId),
    teamLabel: text(value?.teamLabel),
    cardImage: text(value?.cardImage),
    matchIds: Array.isArray(value?.matchIds) ? [...new Set(value.matchIds.map(text).filter(Boolean))] : [],
    appearances: number(value?.appearances),
    selections: number(value?.selections ?? value?.appearances),
    duelWins: number(value?.duelWins ?? value?.wins),
    duelLosses: number(value?.duelLosses ?? value?.losses),
    duelDraws: number(value?.duelDraws ?? value?.draws),
    categoryWins,
    manOfMatchCount: number(value?.manOfMatchCount),
    keyMoments: number(value?.keyMoments),
    penaltyAttempts: number(value?.penaltyAttempts ?? value?.penaltyMatches),
    penaltyGoals: number(value?.penaltyGoals),
    penaltyMisses: number(value?.penaltyMisses),
    suddenDeathGoals: number(value?.suddenDeathGoals),
    decisivePenalties: number(value?.decisivePenalties),
    captainAppearances: number(value?.captainAppearances),
    totalPerformance: number(value?.totalPerformance),
    efficiency: number(value?.efficiency),
  };
};

const emptyTeamStat = team => ({
  teamId: text(team?.id),
  label: text(team?.label),
  badge: text(team?.badge),
  icon: text(team?.icon),
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  scored: 0,
  conceded: 0,
  difference: 0,
  longestWinStreak: 0,
  currentWinStreak: 0,
  averagePerformance: 0,
  simulatedMatches: 0,
  humanMatches: 0,
});

const normaliseLineupState = value => ({
  byMatchId: value?.byMatchId && typeof value.byMatchId === 'object' ? value.byMatchId : {},
  lastLineupIds: Array.isArray(value?.lastLineupIds) ? value.lastLineupIds.map(text).filter(Boolean) : [],
  favoriteLineupIds: Array.isArray(value?.favoriteLineupIds) ? value.favoriteLineupIds.map(text).filter(Boolean) : [],
  penaltyOrders: value?.penaltyOrders && typeof value.penaltyOrders === 'object' ? value.penaltyOrders : {},
});

function migrateEnhancedTournament(value) {
  if (!value || typeof value !== 'object') return null;
  const state = clone(value);
  const playerStats = {};
  for (const [playerId, item] of Object.entries(state.playerStats ?? {})) {
    playerStats[playerId] = normalisePlayerStat(item, playerId);
  }
  state.version = Math.max(number(state.version), TOURNAMENT_ENHANCED_VERSION);
  state.playerStats = playerStats;
  state.teamStats = state.teamStats && typeof state.teamStats === 'object' ? state.teamStats : {};
  state.lineupState = normaliseLineupState({
    ...state.lineupState,
    lastLineupIds: state.lineupState?.lastLineupIds ?? state.lastLineupIds,
  });
  state.currentLineupIds = Array.isArray(state.currentLineupIds) ? state.currentLineupIds.map(text).filter(Boolean) : [];
  state.lastLineupIds = Array.isArray(state.lastLineupIds) ? state.lastLineupIds.map(text).filter(Boolean) : state.lineupState.lastLineupIds;
  state.simulatedResults = Array.isArray(state.simulatedResults) ? state.simulatedResults : [];
  state.matchHistory = Array.isArray(state.matchHistory) ? state.matchHistory : [];
  state.awards = state.awards && typeof state.awards === 'object' ? state.awards : null;
  state.statsUpdatedAt = text(state.statsUpdatedAt);
  return rebuildTeamStats(state);
}

function saveLineupForMatch(state, matchId, lineupIds, { favorite = false, mode = null } = {}) {
  const next = migrateEnhancedTournament(state);
  const ids = [...new Set((Array.isArray(lineupIds) ? lineupIds : []).map(text).filter(Boolean))];
  const key = text(matchId);
  next.lineupState.byMatchId[key] = ids;
  next.lineupState.lastLineupIds = ids;
  next.lastLineupIds = ids;
  if (favorite) next.lineupState.favoriteLineupIds = ids;
  if (mode === TOURNAMENT_MATCH_MODE.PENALTIES) next.lineupState.penaltyOrders[key] = ids;
  next.updatedAt = now();
  return next;
}

const lineupForMatch = (state, matchId) => {
  const migrated = migrateEnhancedTournament(state);
  return migrated.lineupState.byMatchId[text(matchId)] ?? [];
};

const playerImage = player => text(
  player?.portrait
  || player?.image
  || player?.photo
  || player?.meta?.portrait
  || player?.meta?.image,
);

const ensureStat = (state, player, team) => {
  const playerId = text(player?.id);
  if (!playerId) return null;
  const previous = normalisePlayerStat(state.playerStats[playerId], playerId);
  state.playerStats[playerId] = {
    ...previous,
    name: text(player?.name || previous.name || playerId),
    teamId: text(team?.id || previous.teamId),
    teamLabel: text(team?.label || previous.teamLabel),
    cardImage: playerImage(player) || previous.cardImage,
  };
  return state.playerStats[playerId];
};

const addMatchAppearance = (stat, matchId) => {
  if (!stat.matchIds.includes(matchId)) {
    stat.matchIds.push(matchId);
    stat.appearances += 1;
  }
  stat.selections += 1;
};

const updateBestCategory = stat => {
  const entries = Object.entries(stat.categoryWins ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  stat.bestCategory = entries[0]?.[0] ?? '';
  const decisions = stat.duelWins + stat.duelLosses + stat.duelDraws;
  stat.efficiency = decisions ? Math.round(stat.duelWins / decisions * 1000) / 10 : 0;
};

const performanceForLog = item => {
  const winner = text(item?.winner);
  if (winner === 'human') return { human: 3, ai: -1 };
  if (winner === 'ai') return { human: -1, ai: 3 };
  return { human: 1, ai: 1 };
};

function applyMatchTelemetry(state, match, telemetry, playerLookup = new Map()) {
  const next = migrateEnhancedTournament(state);
  if (!match || !telemetry || !Array.isArray(telemetry.log)) return next;
  const homeTeam = tournamentTeamById(next, match.homeId);
  const awayTeam = tournamentTeamById(next, match.awayId);
  const humanIsHome = match.homeId === next.humanTeamId;
  const humanRepresentsHome = telemetry.homeSide
    ? telemetry.homeSide === 'human'
    : humanIsHome;
  const sideTeam = side => side === 'human'
    ? (humanRepresentsHome ? homeTeam : awayTeam)
    : (humanRepresentsHome ? awayTeam : homeTeam);
  const matchScores = new Map();
  const touched = new Set();

  for (const item of telemetry.log) {
    const sideCards = [
      ['human', item?.humanCard],
      ['ai', item?.aiCard],
    ];
    const perf = performanceForLog(item);
    for (const [side, card] of sideCards) {
      const originalId = text(card?.meta?.mirrorOf || card?.id).replace(/--mirror-[^-]+-\d+$/, '');
      const player = playerLookup.get(originalId) ?? card;
      const team = sideTeam(side);
      const stat = ensureStat(next, player, team);
      if (!stat) continue;
      addMatchAppearance(stat, match.id);
      touched.add(stat.playerId);
      const winner = text(item?.winner);
      if (winner === 'tie') stat.duelDraws += 1;
      else if (winner === side) stat.duelWins += 1;
      else stat.duelLosses += 1;
      if (winner === side && item?.attribute) {
        stat.categoryWins[item.attribute] = number(stat.categoryWins[item.attribute]) + 1;
      }
      if ((item?.suddenDeath || number(item?.potScooped) > 0) && winner === side) stat.keyMoments += 1;
      if (telemetry.mode === TOURNAMENT_MATCH_MODE.PENALTIES) {
        stat.penaltyAttempts += 1;
        const scored = winner === side || winner === 'tie';
        if (scored) {
          stat.penaltyGoals += 1;
          if (item?.suddenDeath) stat.suddenDeathGoals += 1;
        } else stat.penaltyMisses += 1;
      }
      const points = side === 'human' ? perf.human : perf.ai;
      stat.totalPerformance += points + (item?.suddenDeath && winner === side ? 2 : 0);
      matchScores.set(stat.playerId, number(matchScores.get(stat.playerId)) + points);
    }
  }

  for (const captainId of Array.isArray(telemetry.captainIds) ? telemetry.captainIds : []) {
    const resolvedId = text(captainId);
    if (next.playerStats[resolvedId]) next.playerStats[resolvedId].captainAppearances += 1;
  }

  const ranked = [...matchScores.entries()].sort((a, b) => b[1] - a[1]);
  const manOfMatchId = ranked[0]?.[0] ?? '';
  if (manOfMatchId && next.playerStats[manOfMatchId]) next.playerStats[manOfMatchId].manOfMatchCount += 1;
  const lastDecisive = [...telemetry.log].reverse().find(item => item?.winner && item.winner !== 'tie');
  if (telemetry.mode === TOURNAMENT_MATCH_MODE.PENALTIES && lastDecisive) {
    const decisiveCard = lastDecisive.winner === 'human' ? lastDecisive.humanCard : lastDecisive.aiCard;
    const decisiveId = text(decisiveCard?.meta?.mirrorOf || decisiveCard?.id).replace(/--mirror-[^-]+-\d+$/, '');
    if (next.playerStats[decisiveId]) {
      next.playerStats[decisiveId].decisivePenalties += 1;
      next.playerStats[decisiveId].keyMoments += 1;
    }
  }
  for (const playerId of touched) updateBestCategory(next.playerStats[playerId]);
  next.statsUpdatedAt = now();
  return rebuildTeamStats(next);
}

function appendSimulatedResult(state, match, simulation) {
  const next = migrateEnhancedTournament(state);
  const record = {
    matchId: text(match?.id),
    homeId: text(match?.homeId),
    awayId: text(match?.awayId),
    homeScore: number(match?.homeScore),
    awayScore: number(match?.awayScore),
    mode: text(simulation?.mode || next.matchMode),
    summary: text(simulation?.summary),
    suddenDeath: Boolean(simulation?.suddenDeath),
    playedAt: text(match?.playedAt || now()),
  };
  next.simulatedResults = [
    ...next.simulatedResults.filter(item => item.matchId !== record.matchId),
    record,
  ];
  next.matchHistory = [
    ...next.matchHistory.filter(item => item.matchId !== record.matchId),
    { ...record, simulated: true },
  ];
  return rebuildTeamStats(next);
}

function appendPlayedResult(state, match) {
  const next = migrateEnhancedTournament(state);
  const record = {
    matchId: text(match?.id),
    homeId: text(match?.homeId),
    awayId: text(match?.awayId),
    homeScore: number(match?.homeScore),
    awayScore: number(match?.awayScore),
    mode: text(next.currentMatchMode || next.matchMode),
    summary: '',
    suddenDeath: String(match?.decidedBy).includes('penalties'),
    playedAt: text(match?.playedAt || now()),
    simulated: false,
  };
  next.matchHistory = [...next.matchHistory.filter(item => item.matchId !== record.matchId), record];
  return rebuildTeamStats(next);
}

function rebuildTeamStats(state) {
  const next = clone(state);
  const teams = new Map((next.participants ?? []).map(team => [team.id, emptyTeamStat(team)]));
  const ordered = [...tournamentMatches(next)]
    .filter(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE)
    .sort((a, b) => text(a.playedAt).localeCompare(text(b.playedAt)));
  for (const match of ordered) {
    const home = teams.get(match.homeId);
    const away = teams.get(match.awayId);
    if (!home || !away) continue;
    const hs = number(match.homeScore);
    const as = number(match.awayScore);
    home.played += 1; away.played += 1;
    home.scored += hs; home.conceded += as;
    away.scored += as; away.conceded += hs;
    const simulated = String(match.decidedBy).startsWith('simulation');
    if (simulated) { home.simulatedMatches += 1; away.simulatedMatches += 1; }
    else { home.humanMatches += 1; away.humanMatches += 1; }
    if (hs === as) {
      home.draws += 1; away.draws += 1;
      home.currentWinStreak = 0; away.currentWinStreak = 0;
    } else {
      const winner = hs > as ? home : away;
      const loser = hs > as ? away : home;
      winner.wins += 1; loser.losses += 1;
      winner.currentWinStreak += 1;
      winner.longestWinStreak = Math.max(winner.longestWinStreak, winner.currentWinStreak);
      loser.currentWinStreak = 0;
    }
  }
  for (const stat of teams.values()) {
    stat.difference = stat.scored - stat.conceded;
    stat.averagePerformance = stat.played ? Math.round(stat.scored / stat.played * 100) / 100 : 0;
  }
  next.teamStats = Object.fromEntries(teams);
  next.statsUpdatedAt = now();
  return next;
}

const teamStatistics = state => Object.values(migrateEnhancedTournament(state).teamStats)
  .sort((a, b) => b.wins - a.wins || b.difference - a.difference || b.scored - a.scored || a.label.localeCompare(b.label, 'hu-HU'));

const playerStatistics = state => Object.values(migrateEnhancedTournament(state).playerStats)
  .map(item => ({ ...item, efficiency: number(item.efficiency) }))
  .sort((a, b) => b.totalPerformance - a.totalPerformance || b.duelWins - a.duelWins || b.penaltyGoals - a.penaltyGoals || a.name.localeCompare(b.name, 'hu-HU'));

function calculateTournamentAwards(state) {
  const next = migrateEnhancedTournament(state);
  const players = playerStatistics(next);
  const teams = teamStatistics(next);
  const topBy = selector => [...players].sort((a, b) => selector(b) - selector(a) || b.totalPerformance - a.totalPerformance)[0] ?? null;
  const champion = tournamentTeamById(next, next.championId);
  const surprise = [...teams]
    .filter(team => team.teamId !== next.championId)
    .sort((a, b) => (b.wins * 3 + b.difference) - (a.wins * 3 + a.difference))[0] ?? teams[0] ?? null;
  next.awards = {
    bestPlayer: players[0] ?? null,
    scoringKing: next.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES
      ? topBy(item => item.penaltyGoals)
      : topBy(item => item.categoryWins ? Object.values(item.categoryWins).reduce((sum, value) => sum + number(value), 0) : 0),
    duelKing: topBy(item => item.duelWins),
    bestCaptain: topBy(item => item.captainAppearances + item.manOfMatchCount),
    surprisePlayer: [...players].sort((a, b) => b.efficiency - a.efficiency || a.appearances - b.appearances)[0] ?? null,
    bestTeam: champion ? teams.find(team => team.teamId === champion.id) ?? emptyTeamStat(champion) : teams[0] ?? null,
    surpriseTeam: surprise,
    createdAt: now(),
  };
  return next;
}

export { TOURNAMENT_ENHANCED_VERSION, migrateEnhancedTournament, saveLineupForMatch, lineupForMatch, applyMatchTelemetry, appendSimulatedResult, appendPlayedResult, rebuildTeamStats, teamStatistics, playerStatistics, calculateTournamentAwards };
