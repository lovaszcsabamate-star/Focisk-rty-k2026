/** Szezonhoz kötött mentési homlokzat a v2 játékmenet-séma megtartásával. */

import { APP_STORAGE_KEYS } from '../app/configuration.js';
import {
  createSavedMatchSnapshot,
  hydrateGame,
  validateSavedMatch,
} from './save-service.js';
import { storageService } from './storage-service.js';

const SEASON_SAVE_LEGACY_DATABASE_ID = 'hungary-nb1-2025-26';
const SEASON_SAVE_LEGACY_SEASON_ID = '2025-26';
const seasonSaveAsText = value => typeof value === 'string' ? value.trim() : '';
const seasonSaveClone = value => JSON.parse(JSON.stringify(value));
const seasonSaveIdPattern = /^(\d{4})-(\d{2})$/;
const seasonSaveLabelPattern = /^(\d{4})\s*[\/-]\s*(\d{2}|\d{4})$/;

const seasonSaveDeriveSeasonId = value => {
  const text = seasonSaveAsText(value);
  if (seasonSaveIdPattern.test(text)) return text;
  const match = text.match(seasonSaveLabelPattern);
  if (!match) return '';
  const startYear = Number(match[1]);
  const rawEnd = Number(match[2]);
  let endYear = match[2].length === 4 ? rawEnd : Math.floor(startYear / 100) * 100 + rawEnd;
  if (endYear < startYear) endYear += 100;
  return endYear === startYear + 1 ? `${startYear}-${String(endYear).slice(-2)}` : '';
};

const seasonSaveValidationResult = (value, errors = [], warnings = []) => Object.freeze({
  ok: errors.length === 0,
  value: errors.length === 0 ? value : null,
  errors: Object.freeze(errors.slice()),
  warnings: Object.freeze(warnings.slice()),
});

export function currentSeasonSaveContext() {
  const database = globalThis.__FOCISKARTYAK_DATABASE__ ?? {};
  const embedded = globalThis.__EMBEDDED_PLAYER_DATA__ ?? {};
  return Object.freeze({
    databaseId: seasonSaveAsText(database.id || embedded.databaseId),
    competitionId: seasonSaveAsText(database.competitionId || embedded.competitionId),
    seasonId: seasonSaveDeriveSeasonId(
      database.seasonId || embedded.seasonId || database.season || embedded.season,
    ),
  });
}

export function savedMatchMatchesSeason(snapshot, context = {}) {
  const expectedDatabaseId = seasonSaveAsText(context.databaseId);
  const expectedSeasonId = seasonSaveDeriveSeasonId(context.seasonId);
  if (!expectedDatabaseId && !expectedSeasonId) return true;

  const savedDatabaseId = seasonSaveAsText(snapshot?.databaseId);
  const savedSeasonId = seasonSaveDeriveSeasonId(snapshot?.seasonId);
  if (!savedDatabaseId && !savedSeasonId) {
    return expectedDatabaseId === SEASON_SAVE_LEGACY_DATABASE_ID
      && expectedSeasonId === SEASON_SAVE_LEGACY_SEASON_ID;
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
    if (raw == null) return seasonSaveValidationResult(null);
    const validation = validateSavedMatch(raw);
    if (!validation.ok) return validation;

    const context = getContext?.() ?? {};
    if (!savedMatchMatchesSeason(raw, context)) {
      return seasonSaveValidationResult(null, [
        `season: a mentés ${raw.seasonId ?? 'ismeretlen'} szezonhoz tartozik, az aktív szezon ${context.seasonId ?? 'ismeretlen'}`,
      ], validation.warnings);
    }

    return seasonSaveValidationResult({
      ...validation.value,
      databaseId: seasonSaveAsText(raw.databaseId) || null,
      competitionId: seasonSaveAsText(raw.competitionId) || null,
      seasonId: seasonSaveDeriveSeasonId(raw.seasonId) || null,
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
        databaseId: seasonSaveAsText(payload?.databaseId || context.databaseId) || null,
        competitionId: seasonSaveAsText(payload?.competitionId || context.competitionId) || null,
        seasonId: seasonSaveDeriveSeasonId(payload?.seasonId || context.seasonId) || null,
      };
      return Boolean(storage?.writeJson?.(APP_STORAGE_KEYS.savedMatch, seasonSaveClone(scoped)));
    } catch (error) {
      console.warn('[save] A szezonhoz kötött játékállás nem menthető:', error);
      return false;
    }
  };

  const clear = () => Boolean(storage?.remove?.(APP_STORAGE_KEYS.savedMatch));
  return Object.freeze({ inspect, read, write, clear });
}

export const hydrateSeasonGame = (...args) => hydrateGame(...args);
export const seasonSaveService = createSeasonSaveService();
export const inspectSeasonSavedMatch = () => seasonSaveService.inspect();
export const readSeasonSavedMatch = () => seasonSaveService.read();
export const writeSeasonSavedMatch = payload => seasonSaveService.write(payload);
export const clearSeasonSavedMatch = () => seasonSaveService.clear();
