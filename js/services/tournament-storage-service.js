/** Az aktív torna, a keretállapot és a korábbi tornagyőzelmek helyi mentése. */

import { storageService } from './storage-service.js';
import {
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_STATUS,
  TOURNAMENT_VERSION,
} from '../tournament/tournament-domain.js';
import {
  ensureTournamentLineupState,
  normaliseTournamentLineupState,
  tournamentLineupScope,
} from '../tournament/tournament-lineup-state.js';

export const TOURNAMENT_STORAGE_KEY = 'fociskartyak.tournament.v1';
export const TOURNAMENT_HISTORY_STORAGE_KEY = 'fociskartyak.tournament-history.v1';

const tournamentStorageText = value => String(value ?? '').trim();
const tournamentStorageClone = value => JSON.parse(JSON.stringify(value));

export const migrateStoredTournament = value => {
  if (!value || typeof value !== 'object') return null;
  const version = Number(value.version) || 1;
  if (version > TOURNAMENT_VERSION) return null;
  const migrated = {
    ...tournamentStorageClone(value),
    version: TOURNAMENT_VERSION,
    matchMode: value.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES
      ? TOURNAMENT_MATCH_MODE.PENALTIES
      : TOURNAMENT_MATCH_MODE.CLASSIC,
    hungarianCupByeTeamIds: Array.isArray(value.hungarianCupByeTeamIds) ? value.hungarianCupByeTeamIds : [],
    currentLineupIds: Array.isArray(value.currentLineupIds) ? value.currentLineupIds : [],
    lastLineupIds: Array.isArray(value.lastLineupIds) ? value.lastLineupIds : [],
    playerStats: value.playerStats && typeof value.playerStats === 'object' ? value.playerStats : {},
  };
  const scope = tournamentLineupScope(migrated);
  migrated.lineupState = normaliseTournamentLineupState({
    ...(value.lineupState && typeof value.lineupState === 'object' ? value.lineupState : {}),
    byMatchId: value.lineupState?.byMatchId ?? {},
    lastLineupIds: value.lineupState?.lastLineupIds ?? migrated.lastLineupIds,
    favoriteLineupIds: value.lineupState?.favoriteLineupIds ?? [],
    penaltyOrders: value.lineupState?.penaltyOrders ?? {},
  }, scope);
  migrated.lastLineupIds = [...migrated.lineupState.lastLineupIds];
  return ensureTournamentLineupState(migrated);
};

export function normaliseStoredTournament(value) {
  const migrated = migrateStoredTournament(value);
  if (!migrated) return null;
  if (!tournamentStorageText(migrated.id) || !tournamentStorageText(migrated.humanTeamId)) return null;
  if (!Array.isArray(migrated.participants) || migrated.participants.length < 4) return null;
  if (!Array.isArray(migrated.rounds)) return null;
  if (![TOURNAMENT_STATUS.ACTIVE, TOURNAMENT_STATUS.COMPLETE].includes(migrated.status)) return null;
  return migrated;
}

export function createTournamentStorageService({ storage = storageService } = {}) {
  const read = () => normaliseStoredTournament(storage.readJson(TOURNAMENT_STORAGE_KEY, null));
  const save = state => {
    const normalised = normaliseStoredTournament(state);
    return normalised ? storage.writeJson(TOURNAMENT_STORAGE_KEY, normalised) : false;
  };
  const clear = () => { storage.remove(TOURNAMENT_STORAGE_KEY); return true; };
  const readHistory = () => {
    const value = storage.readJson(TOURNAMENT_HISTORY_STORAGE_KEY, []);
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object').slice(0, 30) : [];
  };
  const archive = state => {
    const normalised = normaliseStoredTournament(state);
    if (!normalised || normalised.status !== TOURNAMENT_STATUS.COMPLETE || !normalised.championId) return false;
    const history = readHistory();
    const record = {
      id: normalised.id,
      name: normalised.name,
      category: normalised.category,
      format: normalised.format,
      matchMode: normalised.matchMode,
      humanTeamId: normalised.humanTeamId,
      championId: normalised.championId,
      won: normalised.championId === normalised.humanTeamId,
      completedAt: normalised.updatedAt || new Date().toISOString(),
    };
    return storage.writeJson(TOURNAMENT_HISTORY_STORAGE_KEY, [record, ...history.filter(item => item.id !== record.id)].slice(0, 30));
  };
  return Object.freeze({ read, save, clear, readHistory, archive });
}

export const tournamentStorageService = createTournamentStorageService();
export const readTournament = (...args) => tournamentStorageService.read(...args);
export const saveTournament = (...args) => tournamentStorageService.save(...args);
export const clearTournament = (...args) => tournamentStorageService.clear(...args);
