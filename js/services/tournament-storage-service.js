/** Az aktív torna, a kibővített állapot és a korábbi tornaeredmények helyi mentése. */

import { storageService } from './storage-service.js';
import {
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_STATUS,
} from '../tournament/tournament-domain.js';
import {
  TOURNAMENT_ENHANCED_VERSION,
  migrateEnhancedTournament,
} from '../tournament/tournament-state.js';

export const TOURNAMENT_STORAGE_KEY = 'fociskartyak.tournament.v1';
export const TOURNAMENT_HISTORY_STORAGE_KEY = 'fociskartyak.tournament-history.v1';

const text = value => String(value ?? '').trim();
const clone = value => JSON.parse(JSON.stringify(value));

const migrateTournament = value => {
  if (!value || typeof value !== 'object') return null;
  const version = Number(value.version) || 1;
  if (version > TOURNAMENT_ENHANCED_VERSION) return null;
  const migrated = migrateEnhancedTournament({
    ...clone(value),
    version: TOURNAMENT_ENHANCED_VERSION,
    matchMode: value.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES
      ? TOURNAMENT_MATCH_MODE.PENALTIES
      : TOURNAMENT_MATCH_MODE.CLASSIC,
    hungarianCupByeTeamIds: Array.isArray(value.hungarianCupByeTeamIds)
      ? value.hungarianCupByeTeamIds
      : [],
    currentLineupIds: Array.isArray(value.currentLineupIds) ? value.currentLineupIds : [],
    lastLineupIds: Array.isArray(value.lastLineupIds) ? value.lastLineupIds : [],
    playerStats: value.playerStats && typeof value.playerStats === 'object' ? value.playerStats : {},
    teamStats: value.teamStats && typeof value.teamStats === 'object' ? value.teamStats : {},
    lineupState: value.lineupState && typeof value.lineupState === 'object' ? value.lineupState : {},
    simulatedResults: Array.isArray(value.simulatedResults) ? value.simulatedResults : [],
    matchHistory: Array.isArray(value.matchHistory) ? value.matchHistory : [],
    awards: value.awards && typeof value.awards === 'object' ? value.awards : null,
  });
  return migrated;
};

export function normaliseStoredTournament(value) {
  const migrated = migrateTournament(value);
  if (!migrated) return null;
  if (!text(migrated.id) || !text(migrated.humanTeamId)) return null;
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
  const clear = () => {
    storage.remove(TOURNAMENT_STORAGE_KEY);
    return true;
  };
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
      awards: normalised.awards ? clone(normalised.awards) : null,
      matchCount: Array.isArray(normalised.matchHistory) ? normalised.matchHistory.length : 0,
    };
    return storage.writeJson(
      TOURNAMENT_HISTORY_STORAGE_KEY,
      [record, ...history.filter(item => item.id !== record.id)].slice(0, 30),
    );
  };
  return Object.freeze({ read, save, clear, readHistory, archive });
}

export const tournamentStorageService = createTournamentStorageService();
export const readTournament = (...args) => tournamentStorageService.read(...args);
export const saveTournament = (...args) => tournamentStorageService.save(...args);
export const clearTournament = (...args) => tournamentStorageService.clear(...args);
