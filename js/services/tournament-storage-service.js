/** Az aktív torna és a korábbi tornagyőzelmek helyi mentése. */

import { storageService } from './storage-service.js';
import { TOURNAMENT_STATUS, TOURNAMENT_VERSION } from '../tournament/tournament-domain.js';

export const TOURNAMENT_STORAGE_KEY = 'fociskartyak.tournament.v1';
export const TOURNAMENT_HISTORY_STORAGE_KEY = 'fociskartyak.tournament-history.v1';

const tournamentStorageText = value => String(value ?? '').trim();

export function normaliseStoredTournament(value) {
  if (!value || typeof value !== 'object') return null;
  if (Number(value.version) !== TOURNAMENT_VERSION) return null;
  if (!tournamentStorageText(value.id) || !tournamentStorageText(value.humanTeamId)) return null;
  if (!Array.isArray(value.participants) || value.participants.length < 4) return null;
  if (!Array.isArray(value.rounds)) return null;
  if (![TOURNAMENT_STATUS.ACTIVE, TOURNAMENT_STATUS.COMPLETE].includes(value.status)) return null;
  return value;
}

export function createTournamentStorageService({ storage = storageService } = {}) {
  const read = () => normaliseStoredTournament(storage.readJson(TOURNAMENT_STORAGE_KEY, null));

  const save = state => {
    const normalised = normaliseStoredTournament(state);
    if (!normalised) return false;
    return storage.writeJson(TOURNAMENT_STORAGE_KEY, normalised);
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
      humanTeamId: normalised.humanTeamId,
      championId: normalised.championId,
      won: normalised.championId === normalised.humanTeamId,
      completedAt: normalised.updatedAt || new Date().toISOString(),
    };
    const next = [record, ...history.filter(item => item.id !== record.id)].slice(0, 30);
    return storage.writeJson(TOURNAMENT_HISTORY_STORAGE_KEY, next);
  };

  return Object.freeze({ read, save, clear, readHistory, archive });
}

export const tournamentStorageService = createTournamentStorageService();
export const readTournament = (...args) => tournamentStorageService.read(...args);
export const saveTournament = (...args) => tournamentStorageService.save(...args);
export const clearTournament = (...args) => tournamentStorageService.clear(...args);
