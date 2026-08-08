/** DOM-mentes, csapat-, torna- és szezonhatárolt keretállapot-kezelés. */

export const TOURNAMENT_LINEUP_SCHEMA_VERSION = 1;
export const TOURNAMENT_LINEUP_SIZE = 11;

const lineupStateText = value => String(value ?? '').trim();
const lineupStateClone = value => JSON.parse(JSON.stringify(value));
const lineupStateObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const lineupStateUniqueIds = value => [...new Set(
  (Array.isArray(value) ? value : []).map(lineupStateText).filter(Boolean),
)];

const normaliseLineupIdMap = value => Object.fromEntries(
  Object.entries(lineupStateObject(value))
    .map(([key, ids]) => [lineupStateText(key), lineupStateUniqueIds(ids)])
    .filter(([key]) => Boolean(key)),
);

export function tournamentLineupScope(state, { seasonId = '' } = {}) {
  const activeSeason = globalThis.__FOCISKARTYAK_SEASON__;
  return Object.freeze({
    tournamentId: lineupStateText(state?.id),
    seasonId: lineupStateText(seasonId || state?.seasonId || activeSeason?.seasonId || activeSeason?.id),
    teamId: lineupStateText(state?.humanTeamId),
  });
}

const lineupScopeConflicts = (stored, expected) => (
  (lineupStateText(stored?.tournamentId) && lineupStateText(expected?.tournamentId)
    && lineupStateText(stored.tournamentId) !== lineupStateText(expected.tournamentId))
  || (lineupStateText(stored?.seasonId) && lineupStateText(expected?.seasonId)
    && lineupStateText(stored.seasonId) !== lineupStateText(expected.seasonId))
  || (lineupStateText(stored?.teamId) && lineupStateText(expected?.teamId)
    && lineupStateText(stored.teamId) !== lineupStateText(expected.teamId))
);

export function normaliseTournamentLineupState(value, scope = {}) {
  const source = lineupStateObject(value);
  const expected = {
    tournamentId: lineupStateText(scope.tournamentId),
    seasonId: lineupStateText(scope.seasonId),
    teamId: lineupStateText(scope.teamId),
  };
  const reusable = lineupScopeConflicts(source, expected) ? {} : source;
  return {
    schemaVersion: TOURNAMENT_LINEUP_SCHEMA_VERSION,
    tournamentId: expected.tournamentId || lineupStateText(reusable.tournamentId),
    seasonId: expected.seasonId || lineupStateText(reusable.seasonId),
    teamId: expected.teamId || lineupStateText(reusable.teamId),
    byMatchId: normaliseLineupIdMap(reusable.byMatchId),
    lastLineupIds: lineupStateUniqueIds(reusable.lastLineupIds),
    favoriteLineupIds: lineupStateUniqueIds(reusable.favoriteLineupIds),
    penaltyOrders: normaliseLineupIdMap(reusable.penaltyOrders),
  };
}

export function ensureTournamentLineupState(state, options = {}) {
  if (!state || typeof state !== 'object') return null;
  const next = lineupStateClone(state);
  const scope = tournamentLineupScope(next, options);
  next.lineupState = normaliseTournamentLineupState({
    ...next.lineupState,
    lastLineupIds: next.lineupState?.lastLineupIds ?? next.lastLineupIds,
  }, scope);
  next.lastLineupIds = [...next.lineupState.lastLineupIds];
  return next;
}

const lineupPlayerId = player => lineupStateText(player?.id);
const availableLineupPlayerMap = players => new Map(
  (Array.isArray(players) ? players : [])
    .map(player => [lineupPlayerId(player), player])
    .filter(([id]) => Boolean(id)),
);

export function sanitiseTournamentLineupIds(ids, availablePlayers) {
  const available = availableLineupPlayerMap(availablePlayers);
  return lineupStateUniqueIds(ids).filter(id => available.has(id));
}

export function validateTournamentLineup(ids, availablePlayers, { required = TOURNAMENT_LINEUP_SIZE } = {}) {
  const requested = lineupStateUniqueIds(ids);
  const sanitised = sanitiseTournamentLineupIds(requested, availablePlayers);
  const duplicateCount = Math.max(0, (Array.isArray(ids) ? ids.length : 0) - requested.length);
  const missingOrForeignCount = Math.max(0, requested.length - sanitised.length);
  const availableCount = availableLineupPlayerMap(availablePlayers).size;
  const errors = [];
  if (availableCount < required) errors.push(`A csapatban csak ${availableCount} használható játékoskártya van; ${required} szükséges.`);
  if (duplicateCount) errors.push('Ugyanaz a játékoskártya csak egyszer szerepelhet a keretben.');
  if (missingOrForeignCount) errors.push('A keret hiányzó vagy másik csapathoz tartozó játékoskártyát tartalmazott.');
  if (sanitised.length !== required) errors.push(`Pontosan ${required} különböző játékoskártyát kell kiválasztani.`);
  return Object.freeze({
    valid: errors.length === 0,
    ids: Object.freeze(sanitised),
    required,
    selectedCount: sanitised.length,
    availableCount,
    duplicateCount,
    missingOrForeignCount,
    errors: Object.freeze(errors),
  });
}

export function automaticTournamentLineup(availablePlayers, score = () => 0, required = TOURNAMENT_LINEUP_SIZE) {
  const unique = [...availableLineupPlayerMap(availablePlayers).values()];
  return unique
    .sort((left, right) => Number(score(right) || 0) - Number(score(left) || 0)
      || lineupPlayerId(left).localeCompare(lineupPlayerId(right)))
    .slice(0, required)
    .map(lineupPlayerId);
}

export function storedTournamentLineup(
  state,
  kind,
  availablePlayers,
  { matchId = '', required = TOURNAMENT_LINEUP_SIZE } = {},
) {
  const scoped = ensureTournamentLineupState(state);
  if (!scoped) return [];
  const source = kind === 'match'
    ? scoped.lineupState.byMatchId[lineupStateText(matchId)]
    : kind === 'favorite'
      ? scoped.lineupState.favoriteLineupIds
      : kind === 'penalty'
        ? scoped.lineupState.penaltyOrders[lineupStateText(matchId)]
        : scoped.lineupState.lastLineupIds;
  const ids = sanitiseTournamentLineupIds(source, availablePlayers);
  return ids.length === required ? ids : [];
}

const sameLineupMembers = (left, right) => {
  const first = lineupStateUniqueIds(left);
  const second = lineupStateUniqueIds(right);
  return first.length === second.length && first.every(id => second.includes(id));
};

export function saveTournamentLineup(state, {
  matchId,
  lineupIds,
  availablePlayers,
  seasonId = '',
  updateLast = true,
  saveFavorite = false,
  penaltyOrderIds = null,
} = {}) {
  const key = lineupStateText(matchId);
  if (!key) throw new Error('A keret mentéséhez mérkőzésazonosító szükséges.');
  const validation = validateTournamentLineup(lineupIds, availablePlayers);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const next = ensureTournamentLineupState(state, { seasonId });
  next.lineupState.byMatchId[key] = [...validation.ids];
  if (updateLast) {
    next.lineupState.lastLineupIds = [...validation.ids];
    next.lastLineupIds = [...validation.ids];
  }
  if (saveFavorite) next.lineupState.favoriteLineupIds = [...validation.ids];
  if (penaltyOrderIds !== null) {
    const order = sanitiseTournamentLineupIds(penaltyOrderIds, availablePlayers);
    if (order.length !== TOURNAMENT_LINEUP_SIZE || !sameLineupMembers(order, validation.ids)) {
      throw new Error('A büntetőrúgó-sorrendnek a kiválasztott 11 különböző játékost kell tartalmaznia.');
    }
    next.lineupState.penaltyOrders[key] = [...order];
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function resetTournamentMatchLineup(state, matchId, options = {}) {
  const next = ensureTournamentLineupState(state, options);
  const key = lineupStateText(matchId);
  delete next.lineupState.byMatchId[key];
  delete next.lineupState.penaltyOrders[key];
  next.updatedAt = new Date().toISOString();
  return next;
}

export function moveTournamentPenaltyOrder(orderIds, playerIdValue, direction) {
  const ids = lineupStateUniqueIds(orderIds);
  const id = lineupStateText(playerIdValue);
  const offset = direction === 'up' || Number(direction) < 0 ? -1 : 1;
  const index = ids.indexOf(id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}
