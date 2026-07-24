/** DOM-mentes, injektálható pakliválasztási tárolási szolgáltatás. */

import { APP_STORAGE_KEYS } from '../app/configuration.js';
import {
  RANDOM_DECK_SELECTION,
  normaliseDeckSelection,
  validateDeckSelection,
} from '../domain/deck-selection-domain.js';
import { storageService } from './storage-service.js';

export const DECK_SELECTION_STORAGE_KEY = APP_STORAGE_KEYS.deckSelection;
export const SAVED_MATCH_STORAGE_KEY = APP_STORAGE_KEYS.savedMatch;

export const DECK_SELECTION_STORAGE_KEYS = Object.freeze({
  selection: DECK_SELECTION_STORAGE_KEY,
  savedMatch: SAVED_MATCH_STORAGE_KEY,
});

export class DeckSelectionStorageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeckSelectionStorageError';
    this.code = code;
  }
}

const deckStorageAssertMethod = (target, method) => {
  if (typeof target?.[method] !== 'function') {
    throw new DeckSelectionStorageError(
      'INVALID_STORAGE_ADAPTER',
      `A pakliválasztási tároló adapterből hiányzik a(z) ${method} metódus.`,
    );
  }
};

const deckStorageValidateKeys = keys => {
  const selection = String(keys?.selection ?? '').trim();
  const savedMatch = String(keys?.savedMatch ?? '').trim();
  if (!selection || !savedMatch) {
    throw new DeckSelectionStorageError(
      'INVALID_STORAGE_KEYS',
      'A pakliválasztás és a mentett mérkőzés tárolási kulcsa kötelező.',
    );
  }
  return Object.freeze({ selection, savedMatch });
};

export function createDeckSelectionStorageService({
  storage = storageService,
  keys = DECK_SELECTION_STORAGE_KEYS,
} = {}) {
  ['readJson', 'readString', 'writeJson', 'remove'].forEach(method => deckStorageAssertMethod(storage, method));
  const configuredKeys = deckStorageValidateKeys(keys);

  const read = (players = []) => {
    const stored = storage.readJson(configuredKeys.selection, RANDOM_DECK_SELECTION);
    return validateDeckSelection(players, stored).selection;
  };

  const save = selection => storage.writeJson(
    configuredKeys.selection,
    normaliseDeckSelection(selection),
  );

  const hasSavedMatch = () => Boolean(storage.readString(configuredKeys.savedMatch, null));
  const clearSavedMatch = () => storage.remove(configuredKeys.savedMatch);

  const replace = (selection, { clearSavedMatch: shouldClearSavedMatch = true } = {}) => {
    const normalized = normaliseDeckSelection(selection);
    if (shouldClearSavedMatch) clearSavedMatch();
    const saved = storage.writeJson(configuredKeys.selection, normalized);
    return Object.freeze({ selection: normalized, saved });
  };

  return Object.freeze({
    keys: configuredKeys,
    read,
    save,
    hasSavedMatch,
    clearSavedMatch,
    replace,
  });
}

export const deckSelectionStorageService = createDeckSelectionStorageService();

export const readDeckSelection = (...args) => deckSelectionStorageService.read(...args);
export const saveDeckSelection = (...args) => deckSelectionStorageService.save(...args);
