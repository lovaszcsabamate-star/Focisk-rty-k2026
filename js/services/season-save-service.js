/** Szezonhoz kötött mentési homlokzat a v2 játékmenet-séma megtartásával. */

import { APP_STORAGE_KEYS } from '../app/configuration.js';
import { deriveSeasonId } from '../database/season-model.js';
import {
  createSavedMatchSnapshot,
  hydrateGame,
  validateSavedMatch,
} from './save-service.js';
import { storageService } from './storage-service.js';

const LEGACY_UNSCOPED_DATABASE_ID = 'hungary-nb1-2025-26';
const LEGACY_UNSCOPED_SEASON_ID = '2025-26';
const asText = value => typeof value === 'string' ? value.trim() : '';
const clone = value => JSON.parse(JSON.stringify(value));

const validationResult = (value, errors = [], warnings = []) => Object.freeze({
  ok: errors.length === 0,
  value: errors.length === 0 ? value : null,
  errors: Object.freeze(errors.slice()),
  warnings: Object.freeze(warnings.slice()),
});

export function currentSeasonSaveContext() {
  const database = globalThis.__FOCISKARTYAK_DATABASE__ ?? {};
  const embedded = globalThis.__EMBEDDED_PLAYER_DATA__ ?? {};
  return Object.freeze({
    databaseId: asText(database.id || embedded.databaseId),
    competitionId: asText(database.competitionId || embedded.competitionId),
    seasonId: deriveSeasonId(database.seasonId || embedded.seasonId || database.season || embedded.season),
  });
}

export function savedMatchMatchesSeason(snapshot, context = {}) {
  const expectedDatabaseId = asText(context.databaseId);
  const expectedSeasonId = deriveSeasonId(context.seasonId);
  if (!expectedDatabaseId && !expectedSeasonId) return true;

  const savedDatabaseId = asText(snapshot?.databaseId);
  const savedSeasonId = deriveSeasonId(snapshot?.seasonId);
  if (!savedDatabaseId && !savedSeasonId) {
    return expectedDatabaseId === LEGACY_UNSCOPED_DATABASE_ID
      && expectedSeasonId === LEGACY_UNSCOPED_SEASON_ID;
  }
  if (expectedDatabaseId && savedDatabaseId !== expectedDatabaseId) return false;
  if (expectedSeasonId && savedSeasonId !== expectedSeasonId) return false;
  return true;
}

export function createSeasonSaveService({
  storage = storageService,
  now = () => new Date(),
  getContext = currentSeasonSaveContext,
} = {}) {
  const inspect = () => {
    const raw = storage?.readJson?.(APP_STORAGE_KEYS.savedMatch, null) ?? null;
    if (raw == null) return validationResult(null);
    const validation = validateSavedMatch(raw);
    if (!validation.ok) return validation;

    const context = getContext?.() ?? {};
    if (!savedMatchMatchesSeason(raw, context)) {
      return validationResult(null, [
        `season: a mentés ${raw.seasonId ?? 'ismeretlen'} szezonhoz tartozik, az aktív szezon ${context.seasonId ?? 'ismeretlen'}`,
      ], validation.warnings);
    }

    return validationResult({
      ...validation.value,
      databaseId: asText(raw.databaseId) || null,
      competitionId: asText(raw.competitionId) || null,
      seasonId: deriveSeasonId(raw.seasonId) || null,
    }, [], validation.warnings);
  };

  const read = () => {
    const validation = inspect();
    return validation.ok ? validation.value : null;
  };

  const write = payload => {
    try {
      const snapshot = createSavedMatchSnapshot(payload, now);
      if (!snapshot) return false;
      const context = getContext?.() ?? {};
      const scoped = {
        ...snapshot,
        databaseId: asText(payload?.databaseId || context.databaseId) || null,
        competitionId: asText(payload?.competitionId || context.competitionId) || null,
        seasonId: deriveSeasonId(payload?.seasonId || context.seasonId) || null,
      };
      return Boolean(storage?.writeJson?.(APP_STORAGE_KEYS.savedMatch, clone(scoped)));
    } catch (error) {
      console.warn('[save] A szezonhoz kötött játékállás nem menthető:', error);
      return false;
    }
  };

  const clear = () => Boolean(storage?.remove?.(APP_STORAGE_KEYS.savedMatch));
  return Object.freeze({ inspect, read, write, clear });
}

export { hydrateGame };

export const seasonSaveService = createSeasonSaveService();
export const inspectSavedMatch = () => seasonSaveService.inspect();
export const readSavedMatch = () => seasonSaveService.read();
export const writeSavedMatch = payload => seasonSaveService.write(payload);
export const clearSavedMatch = () => seasonSaveService.clear();
