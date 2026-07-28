/** Pakli- és Gyors meccs választási kompatibilitási homlokzat. */

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
  canonicalFederationKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
} from './domain/deck-selection-domain.js';
import {
  MINIMUM_TEAM_SIZE,
  getCountryData,
  getPlayableFederationTeams,
  getPlayableNationalTeams,
  getPlayerFederation,
  groupPlayersByCountry,
  groupPlayersByFederation,
  isPlayablePlayer,
  validatePlayerFederationData,
} from './domain/federation-domain.js';
import {
  QUICK_MATCH_CATEGORY,
  QUICK_MATCH_FEDERATION_MINIMUM,
  QUICK_MATCH_LEAGUE_MINIMUM,
  QUICK_MATCH_NATION_MINIMUM,
  QUICK_MATCH_SELECTION_STEP,
  buildQuickMatchCatalog,
  buildQuickMatchPayload,
  canonicalLeagueKey,
  chooseQuickMatchOpponent,
  describeQuickMatchSelection,
  normaliseQuickMatchSelection,
  quickMatchCategoryToKind,
  quickMatchEntriesForCategory,
  quickMatchEntryFromId,
  quickMatchEntryFromSelection,
  quickMatchKindToCategory,
  quickMatchMinimumForKind,
  quickMatchOpponentEntries,
  quickMatchSelectionEquals,
  quickMatchSelectionKey,
  quickMatchSelectionsCompatible,
  resolveQuickMatchSelection,
  validateQuickMatchPairing,
} from './domain/quick-match-domain.js';
import {
  QUICK_MATCH_LAUNCH_STORAGE_KEY,
  QUICK_MATCH_SETUP_STORAGE_KEY,
  QUICK_MATCH_SETUP_VERSION,
  consumeQuickMatchLaunch,
  createQuickMatchStorageService,
  normaliseQuickMatchSetup,
  quickMatchStorageService,
  readQuickMatchSetup,
  stageQuickMatch,
} from './services/quick-match-storage-service.js';
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
  canonicalFederationKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
};

export {
  MINIMUM_TEAM_SIZE,
  getCountryData,
  getPlayableFederationTeams,
  getPlayableNationalTeams,
  getPlayerFederation,
  groupPlayersByCountry,
  groupPlayersByFederation,
  isPlayablePlayer,
  validatePlayerFederationData,
};

export {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  readDeckSelection,
  saveDeckSelection,
};

export {
  QUICK_MATCH_CATEGORY,
  QUICK_MATCH_FEDERATION_MINIMUM,
  QUICK_MATCH_LEAGUE_MINIMUM,
  QUICK_MATCH_NATION_MINIMUM,
  QUICK_MATCH_SELECTION_STEP,
  buildQuickMatchCatalog,
  buildQuickMatchPayload,
  canonicalLeagueKey,
  chooseQuickMatchOpponent,
  describeQuickMatchSelection,
  normaliseQuickMatchSelection,
  quickMatchCategoryToKind,
  quickMatchEntriesForCategory,
  quickMatchEntryFromId,
  quickMatchEntryFromSelection,
  quickMatchKindToCategory,
  quickMatchMinimumForKind,
  quickMatchOpponentEntries,
  quickMatchSelectionEquals,
  quickMatchSelectionKey,
  quickMatchSelectionsCompatible,
  resolveQuickMatchSelection,
  validateQuickMatchPairing,
};

export {
  QUICK_MATCH_LAUNCH_STORAGE_KEY,
  QUICK_MATCH_SETUP_STORAGE_KEY,
  QUICK_MATCH_SETUP_VERSION,
  consumeQuickMatchLaunch,
  createQuickMatchStorageService,
  normaliseQuickMatchSetup,
  quickMatchStorageService,
  readQuickMatchSetup,
  stageQuickMatch,
};

export {
  DECK_SELECTION_MENU_STYLE_ID,
  createDeckSelectionMenuController,
  installDeckSelectionMenu,
};

/* A moduláris alkalmazásban a bootstrap végzi az előkészítést. Az önálló buildben
   a teljes adatbázis már a modulok előtt be van ágyazva, ezért itt készül el a pontos párosítás. */
const deckSelectionFacadeEmbeddedPayload = globalThis.__EMBEDDED_PLAYER_DATA__;
if (Array.isArray(deckSelectionFacadeEmbeddedPayload?.players)
  && !globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__) {
  const deckSelectionFacadeSetup = readQuickMatchSetup(deckSelectionFacadeEmbeddedPayload.players);
  const deckSelectionFacadeSelection = deckSelectionFacadeSetup?.playerSelection
    ?? readDeckSelection(deckSelectionFacadeEmbeddedPayload.players);
  const deckSelectionFacadePrepared = buildQuickMatchPayload(
    deckSelectionFacadeEmbeddedPayload,
    deckSelectionFacadeSelection,
    deckSelectionFacadeSetup?.opponentSelection ?? null,
  );
  globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ = deckSelectionFacadeEmbeddedPayload;
  globalThis.__FOCISKARTYAK_DECK_SELECTION__ = deckSelectionFacadeSelection;
  globalThis.__FOCISKARTYAK_QUICK_MATCH_SETUP__ = deckSelectionFacadeSetup;
  globalThis.__FOCISKARTYAK_QUICK_MATCH__ = deckSelectionFacadePrepared.matchup;
  globalThis.__EMBEDDED_PLAYER_DATA__ = deckSelectionFacadePrepared.payload;
  installDeckSelectionMenu(deckSelectionFacadeEmbeddedPayload, deckSelectionFacadeSelection);
}
