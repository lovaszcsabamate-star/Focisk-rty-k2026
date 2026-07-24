/** Pakliválasztási kompatibilitási homlokzat. */

import {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  readDeckSelection,
  saveDeckSelection,
} from './services/deck-selection-storage-service.js';
import {
  MIN_FILTERED_DECK_SIZE,
  RANDOM_DECK_SELECTION,
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalClubKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
} from './domain/deck-selection-domain.js';
import {
  DECK_SELECTION_MENU_STYLE_ID,
  createDeckSelectionMenuController,
  installDeckSelectionMenu,
} from './ui/deck-selection-menu-component.js';

export {
  MIN_FILTERED_DECK_SIZE,
  RANDOM_DECK_SELECTION,
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalClubKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
};

export {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  readDeckSelection,
  saveDeckSelection,
};

export {
  DECK_SELECTION_MENU_STYLE_ID,
  createDeckSelectionMenuController,
  installDeckSelectionMenu,
};
