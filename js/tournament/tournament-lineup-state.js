/** DOM-mentes, csapat-, torna- és szezonhatárolt keretállapot-kezelés. */

export const TOURNAMENT_LINEUP_SCHEMA_VERSION = 1;
export const TOURNAMENT_LINEUP_SIZE = 11;

const text = value => String(value ?? '').trim();
const clone = value => JSON.parse(JSON.stringify(value));
const objectValue = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const uniqueIds = value => [...new Set((Array.isArray(value) ? value : []).map(text).filter(Boolean))];

const normaliseIdMap = value => Object.fromEntries(
  Object.entries(objectValue(value))
    .map(([key, ids]) => [text(key), uniqueIds(ids)])
    .filter(([key]) => Boolean(key)),
);

export function tournamentLineupScope(state, { seasonId = '' } = {}) {
  return Object.freeze({
    tournamentId: text(state?.id),
    seasonId: text(seasonId || state?.seasonId || globalThis.__FOCISKARTYAK_SEASON__?.id),
    teamId: text(state?.humanTeamId),
  });
}

const scopeConflicts = (stored, expected) => (
  (text(stored?.tournamentId) && text(expected?.tournamentId) && text(stored.tournamentId) !== text(expected.tournamentId))
  || (text(stored?.seasonId) && text(expected?.seasonId) && text(stored.seasonId) !== text(expected.seasonId))
  || (text(stored?.teamId) && text(expected?.teamId) && text(stored.teamId) !== text(expected.teamId))
);

export function normaliseTournamentLineupState(value, scope = {}) {
  const source = objectValue(value);
  const expected = {
    tournamentId: text(scope.tournamentId),
    seasonId: text(scope.seasonId),
    teamId: text(scope.teamId),
  };
  const reusable = scopeConflicts(source, expected) ? {} : source;
  return {
    schemaVersion: TOURNAMENT_LINEUP_SCHEMA_VERSION,
    tournamentId: expected.tournamentId || text(reusable.tournamentId),
    seasonId: expected.seasonId || text(reusable.seasonId),
    teamId: expected.teamId || text(reusable.teamId),
    byMatchId: normaliseIdMap(reusable.byMatchId),
    lastLineupIds: uniqueIds(reusable.lastLineupIds),
    favoriteLineupIds: uniqueIds(reusable.favoriteLineupIds),
    penaltyOrders: normaliseIdMap(reusable.penaltyOrders),
  };
}

export function ensureTournamentLineupState(state, options = {}) {
  if (!state || typeof state !== 'object') return null;
  const next = clone(state);
  const scope = tournamentLineupScope(next, options);
  next.lineupState = normaliseTournamentLineupState({
    ...next.lineupState,
    lastLineupIds: next.lineupState?.lastLineupIds ?? next.lastLineupIds,
  }, scope);
  next.lastLineupIds = [...next.lineupState.lastLineupIds];
  return next;
}

const playerId = player => text(player?.id);
const availablePlayerMap = players => new Map(
  (Array.isArray(players) ? players : [])
    .map(player => [playerId(player), player])
    .filter(([id]) => Boolean(id)),
);

export function sanitiseTournamentLineupIds(ids, availablePlayers) {
  const available = availablePlayerMap(availablePlayers);
  return uniqueIds(ids).filter(id => available.has(id));
}

export function validateTournamentLineup(ids, availablePlayers, { required = TOURNAMENT_LINEUP_SIZE } = {}) {
  const requested = uniqueIds(ids);
  const sanitised = sanitiseTournamentLineupIds(requested, availablePlayers);
  const duplicateCount = Math.max(0, (Array.isArray(ids) ? ids.length : 0) - requested.length);
  const missingOrForeignCount = Math.max(0, requested.length - sanitised.length);
  const availableCount = availablePlayerMap(availablePlayers).size;
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
  const unique = [...availablePlayerMap(availablePlayers).values()];
  return unique
    .sort((left, right) => Number(score(right) || 0) - Number(score(left) || 0) || playerId(left).localeCompare(playerId(right)))
    .slice(0, required)
    .map(playerId);
}

export function storedTournamentLineup(state, kind, availablePlayers, { matchId = '', required = TOURNAMENT_LINEUP_SIZE } = {}) {
  const scoped = ensureTournamentLineupState(state);
  if (!scoped) return [];
  const source = kind === 'match'
    ? scoped.lineupState.byMatchId[text(matchId)]
    : kind === 'favorite'
      ? scoped.lineupState.favoriteLineupIds
      : kind === 'penalty'
        ? scoped.lineupState.penaltyOrders[text(matchId)]
        : scoped.lineupState.lastLineupIds;
  const ids = sanitiseTournamentLineupIds(source, availablePlayers);
  return ids.length === required ? ids : [];
}

const sameMembers = (left, right) => {
  const a = uniqueIds(left);
  const b = uniqueIds(right);
  return a.length === b.length && a.every(id => b.includes(id));
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
  const key = text(matchId);
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
    if (order.length !== TOURNAMENT_LINEUP_SIZE || !sameMembers(order, validation.ids)) {
      throw new Error('A büntetőrúgó-sorrendnek a kiválasztott 11 különböző játékost kell tartalmaznia.');
    }
    next.lineupState.penaltyOrders[key] = [...order];
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function resetTournamentMatchLineup(state, matchId, options = {}) {
  const next = ensureTournamentLineupState(state, options);
  const key = text(matchId);
  delete next.lineupState.byMatchId[key];
  delete next.lineupState.penaltyOrders[key];
  next.updatedAt = new Date().toISOString();
  return next;
}

export function moveTournamentPenaltyOrder(orderIds, playerIdValue, direction) {
  const ids = uniqueIds(orderIds);
  const id = text(playerIdValue);
  const offset = direction === 'up' || Number(direction) < 0 ? -1 : 1;
  const index = ids.indexOf(id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}
