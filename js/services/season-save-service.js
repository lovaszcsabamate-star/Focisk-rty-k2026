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
const seasonSaveCardReference = card => card && typeof card === 'object'
  && !Array.isArray(card) && typeof card.id === 'string' && card.id.trim() !== ''
  ? { id: card.id }
  : card;
const seasonSaveCompactClassicPlayers = snapshot => {
  if (snapshot?.mode !== 'classic' || !Array.isArray(snapshot?.game?.players)) return snapshot;
  return {
    ...snapshot,
    game: {
      ...snapshot.game,
      players: snapshot.game.players.map(seasonSaveCardReference),
    },
  };
};

export const SEASON_SAVE_STATUS = Object.freeze({
  OK: 'OK',
  NO_SAVE: 'NO_SAVE',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_SCHEMA: 'INVALID_SCHEMA',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  DATABASE_MISMATCH: 'DATABASE_MISMATCH',
  SEASON_MISMATCH: 'SEASON_MISMATCH',
  MISSING_CARD: 'MISSING_CARD',
  PARTIAL_RESTORE: 'PARTIAL_RESTORE',
});

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

const seasonSaveValidationResult = (
  value,
  errors = [],
  warnings = [],
  {
    code = errors.length
      ? SEASON_SAVE_STATUS.INVALID_SCHEMA
      : warnings.length
        ? SEASON_SAVE_STATUS.PARTIAL_RESTORE
        : SEASON_SAVE_STATUS.OK,
    hasStoredValue = value != null,
  } = {},
) => Object.freeze({
  ok: errors.length === 0,
  value: errors.length === 0 ? value : null,
  errors: Object.freeze(errors.slice()),
  warnings: Object.freeze(warnings.slice()),
  code,
  hasStoredValue: Boolean(hasStoredValue),
});

const seasonSaveValidationCode = errors => {
  if (errors.some(error => String(error).startsWith('version:'))) {
    return SEASON_SAVE_STATUS.UNSUPPORTED_VERSION;
  }
  if (errors.some(error => /ismeretlen kártyaazonosító/i.test(String(error)))) {
    return SEASON_SAVE_STATUS.MISSING_CARD;
  }
  return SEASON_SAVE_STATUS.INVALID_SCHEMA;
};

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
  const inspectParsed = (raw, hasStoredValue = true) => {
    const validation = validateSavedMatch(raw);
    if (!validation.ok) {
      return seasonSaveValidationResult(null, validation.errors, validation.warnings, {
        code: seasonSaveValidationCode(validation.errors),
        hasStoredValue,
      });
    }

    const context = getContext?.() ?? {};
    const expectedDatabaseId = seasonSaveAsText(context.databaseId);
    const expectedSeasonId = seasonSaveDeriveSeasonId(context.seasonId);
    const savedDatabaseId = seasonSaveAsText(raw.databaseId);
    const savedSeasonId = seasonSaveDeriveSeasonId(raw.seasonId);
    const isAllowedLegacySave = !savedDatabaseId && !savedSeasonId
      && expectedDatabaseId === SEASON_SAVE_LEGACY_DATABASE_ID
      && expectedSeasonId === SEASON_SAVE_LEGACY_SEASON_ID;

    if (!isAllowedLegacySave && expectedDatabaseId && savedDatabaseId !== expectedDatabaseId) {
      return seasonSaveValidationResult(null, [
        `database: a mentés ${savedDatabaseId || 'ismeretlen'} adatbázishoz tartozik, az aktív adatbázis ${expectedDatabaseId}`,
      ], validation.warnings, {
        code: SEASON_SAVE_STATUS.DATABASE_MISMATCH,
        hasStoredValue,
      });
    }

    if (!isAllowedLegacySave && expectedSeasonId && savedSeasonId !== expectedSeasonId) {
      return seasonSaveValidationResult(null, [
        `season: a mentés ${savedSeasonId || 'ismeretlen'} szezonhoz tartozik, az aktív szezon ${expectedSeasonId}`,
      ], validation.warnings, {
        code: SEASON_SAVE_STATUS.SEASON_MISMATCH,
        hasStoredValue,
      });
    }

    return seasonSaveValidationResult({
      ...validation.value,
      databaseId: savedDatabaseId || null,
      competitionId: seasonSaveAsText(raw.competitionId) || null,
      seasonId: savedSeasonId || null,
    }, [], validation.warnings, {
      code: validation.warnings.length
        ? SEASON_SAVE_STATUS.PARTIAL_RESTORE
        : SEASON_SAVE_STATUS.OK,
      hasStoredValue,
    });
  };

  const inspect = () => {
    if (typeof storage?.readString === 'function') {
      const rawText = storage.readString(APP_STORAGE_KEYS.savedMatch, null);
      if (rawText == null) {
        return seasonSaveValidationResult(null, [], [], {
          code: SEASON_SAVE_STATUS.NO_SAVE,
          hasStoredValue: false,
        });
      }

      try {
        return inspectParsed(JSON.parse(rawText), true);
      } catch (error) {
        return seasonSaveValidationResult(null, [
          `json: a mentés nem érvényes JSON (${error?.message ?? 'ismeretlen feldolgozási hiba'})`,
        ], [], {
          code: SEASON_SAVE_STATUS.INVALID_JSON,
          hasStoredValue: true,
        });
      }
    }

    const raw = storage?.readJson?.(APP_STORAGE_KEYS.savedMatch, null) ?? null;
    if (raw == null) {
      return seasonSaveValidationResult(null, [], [], {
        code: SEASON_SAVE_STATUS.NO_SAVE,
        hasStoredValue: false,
      });
    }
    return inspectParsed(raw, true);
  };

  const read = () => {
    const validation = inspect();
    return validation.ok && validation.value ? validation.value : null;
  };

  const write = payload => {
    try {
      const snapshot = createSavedMatchSnapshot(payload, now);
      if (!snapshot) return false;
      const compactSnapshot = seasonSaveCompactClassicPlayers(snapshot);
      const context = getContext?.() ?? {};
      const scoped = {
        ...compactSnapshot,
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
