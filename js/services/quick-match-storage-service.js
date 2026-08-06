/** A kétlépcsős Gyors meccs beállításainak és egyszeri indításának tárolása. */

import { APP_STORAGE_KEYS } from '../app/configuration.js';
import {
  normaliseQuickMatchSelection,
  quickMatchKindToCategory,
  quickMatchSelectionEquals,
  quickMatchSelectionsCompatible,
  validateQuickMatchPairing,
} from '../domain/quick-match-domain.js';
import { RANDOM_DECK_SELECTION } from '../domain/deck-selection-domain.js';
import { storageService } from './storage-service.js';

export const QUICK_MATCH_SETUP_VERSION = 2;
export const QUICK_MATCH_SETUP_STORAGE_KEY = APP_STORAGE_KEYS.quickMatchSetup;
export const QUICK_MATCH_LAUNCH_STORAGE_KEY = APP_STORAGE_KEYS.quickMatchLaunch;
export const TOURNAMENT_LAUNCH_TRANSACTION_HOOK = '__FOCISKARTYAK_TOURNAMENT_LAUNCH_TRANSACTION__';

const quickMatchStorageText = value => String(value ?? '').trim();
const quickMatchStorageMode = value => (value === 'penalties' ? 'penalties' : 'classic');
const quickMatchStorageDifficulty = value => quickMatchStorageText(value) || 'medium';
const resolveTournamentHook = action => {
  const handler = globalThis[TOURNAMENT_LAUNCH_TRANSACTION_HOOK]?.[action];
  return typeof handler === 'function' ? handler : () => true;
};

export function normaliseQuickMatchSetup(setup) {
  if (!setup || typeof setup !== 'object') return null;
  const playerSelection = normaliseQuickMatchSelection(setup.playerSelection);
  const opponentSelection = normaliseQuickMatchSelection(setup.opponentSelection);
  if (!playerSelection || !opponentSelection
    || !quickMatchSelectionsCompatible(playerSelection, opponentSelection)
    || quickMatchSelectionEquals(playerSelection, opponentSelection)) return null;
  return Object.freeze({
    version: QUICK_MATCH_SETUP_VERSION,
    category: quickMatchKindToCategory(playerSelection.kind),
    opponentCategory: quickMatchKindToCategory(opponentSelection.kind),
    playerTeamId: quickMatchStorageText(setup.playerTeamId),
    opponentTeamId: quickMatchStorageText(setup.opponentTeamId),
    playerSelection,
    opponentSelection,
    mode: quickMatchStorageMode(setup.mode),
    difficulty: quickMatchStorageDifficulty(setup.difficulty),
    createdAt: quickMatchStorageText(setup.createdAt) || new Date().toISOString(),
  });
}

export function createQuickMatchStorageService({
  storage = storageService,
  commitTournamentLaunch: commitTournamentLaunchOverride = null,
  rollbackTournamentLaunch: rollbackTournamentLaunchOverride = null,
} = {}) {
  const commitTournamentLaunch = () => (
    typeof commitTournamentLaunchOverride === 'function'
      ? commitTournamentLaunchOverride()
      : resolveTournamentHook('commit')()
  );
  const rollbackTournamentLaunch = () => (
    typeof rollbackTournamentLaunchOverride === 'function'
      ? rollbackTournamentLaunchOverride()
      : resolveTournamentHook('rollback')()
  );

  const readSetup = (players = []) => {
    const setup = normaliseQuickMatchSetup(storage.readJson(QUICK_MATCH_SETUP_STORAGE_KEY, null));
    if (!setup) return null;
    return validateQuickMatchPairing(players, setup.playerSelection, setup.opponentSelection).valid
      ? setup
      : null;
  };

  const saveSetup = setup => {
    const normalised = normaliseQuickMatchSetup(setup);
    if (!normalised) return false;
    return storage.writeJson(QUICK_MATCH_SETUP_STORAGE_KEY, normalised);
  };

  const restoreRawValue = (key, value) => {
    if (value == null) return storage.remove(key);
    return storage.writeString(key, value);
  };

  const stage = setup => {
    const normalised = normaliseQuickMatchSetup(setup);
    if (!normalised) {
      rollbackTournamentLaunch();
      return false;
    }

    const stagedValues = [
      [
        APP_STORAGE_KEYS.deckSelection,
        normalised.playerSelection.kind === 'league'
          ? RANDOM_DECK_SELECTION
          : normalised.playerSelection,
      ],
      [QUICK_MATCH_SETUP_STORAGE_KEY, normalised],
      [QUICK_MATCH_LAUNCH_STORAGE_KEY, {
        mode: normalised.mode,
        difficulty: normalised.difficulty,
        createdAt: normalised.createdAt,
      }],
    ];
    const checkpoint = new Map(stagedValues.map(([key]) => [key, storage.readString(key, null)]));
    const rollbackStage = () => {
      for (const [rollbackKey, previous] of checkpoint.entries()) {
        restoreRawValue(rollbackKey, previous);
      }
      rollbackTournamentLaunch();
    };

    for (const [key, value] of stagedValues) {
      if (storage.writeJson(key, value)) continue;
      rollbackStage();
      return false;
    }

    if (!commitTournamentLaunch()) {
      rollbackStage();
      return false;
    }

    // A meglévő mérkőzésmentést a staging soha nem törli. A teljesen
    // inicializált új Session snapshotja csak sikeres indulás után írhatja felül.
    return true;
  };

  const peekLaunch = () => {
    const launch = storage.readJson(QUICK_MATCH_LAUNCH_STORAGE_KEY, null);
    if (!launch || typeof launch !== 'object') return null;
    return Object.freeze({
      mode: quickMatchStorageMode(launch.mode),
      difficulty: quickMatchStorageDifficulty(launch.difficulty),
    });
  };

  const consumeLaunch = () => {
    const launch = peekLaunch();
    storage.remove(QUICK_MATCH_LAUNCH_STORAGE_KEY);
    return launch;
  };

  const clear = () => {
    storage.remove(QUICK_MATCH_SETUP_STORAGE_KEY);
    storage.remove(QUICK_MATCH_LAUNCH_STORAGE_KEY);
    return true;
  };

  return Object.freeze({ readSetup, saveSetup, stage, peekLaunch, consumeLaunch, clear });
}

export const quickMatchStorageService = createQuickMatchStorageService();
export const readQuickMatchSetup = (...args) => quickMatchStorageService.readSetup(...args);
export const stageQuickMatch = (...args) => quickMatchStorageService.stage(...args);
export const consumeQuickMatchLaunch = (...args) => quickMatchStorageService.consumeLaunch(...args);
