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
  buildQuickMatchPayload as buildQuickMatchPayloadBase,
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

export const TOURNAMENT_LINEUP_STORAGE_KEY = 'fociskartyak.tournament-lineup.v1';

const lineupScore = player => {
  const stats = player?.stats ?? {};
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  return Math.log1p(number(stats.marketValue)) * 1.2
    + Math.log1p(number(stats.minutes))
    + Math.log1p(number(stats.appearances)) * 1.2
    + Math.log1p(number(stats.goals)) * 1.6
    + Math.log1p(number(stats.assists)) * 1.4;
};

const readStagedTournamentLineup = () => {
  try {
    const raw = globalThis.localStorage?.getItem(TOURNAMENT_LINEUP_STORAGE_KEY);
    if (!raw) return null;
    globalThis.localStorage.removeItem(TOURNAMENT_LINEUP_STORAGE_KEY);
    const value = JSON.parse(raw);
    const humanIds = Array.isArray(value?.humanIds)
      ? [...new Set(value.humanIds.map(item => String(item ?? '').trim()).filter(Boolean))]
      : [];
    return humanIds.length ? { ...value, humanIds } : null;
  } catch {
    return null;
  }
};

const applyStagedTournamentLineup = prepared => {
  const lineup = readStagedTournamentLineup();
  if (!lineup) return prepared;
  const payload = Array.isArray(prepared?.payload) ? { players: prepared.payload } : prepared?.payload;
  const players = Array.isArray(payload?.players) ? payload.players : [];
  const humanPool = players.filter(player => player?.meta?.quickMatchSide === 'human');
  const aiPool = players.filter(player => player?.meta?.quickMatchSide === 'ai');
  const byId = new Map(humanPool.map(player => [String(player.id), player]));
  const human = lineup.humanIds.map(id => byId.get(id)).filter(Boolean);
  if (human.length < 4 || aiPool.length < human.length) return prepared;
  const ai = [...aiPool].sort((a, b) => lineupScore(b) - lineupScore(a)).slice(0, human.length);
  const selectedPlayers = [...human, ...ai];
  const lineupMeta = {
    active: true,
    humanIds: human.map(player => player.id),
    aiIds: ai.map(player => player.id),
    tournamentId: String(lineup.tournamentId ?? ''),
    matchId: String(lineup.matchId ?? ''),
  };
  if (Array.isArray(prepared.payload)) return { ...prepared, payload: selectedPlayers, lineup: lineupMeta };
  return {
    ...prepared,
    lineup: lineupMeta,
    payload: {
      ...prepared.payload,
      players: selectedPlayers,
      tournamentLineup: lineupMeta,
      selection: { ...(prepared.payload?.selection ?? {}), tournamentLineup: lineupMeta },
    },
  };
};

export function buildQuickMatchPayload(...args) {
  return applyStagedTournamentLineup(buildQuickMatchPayloadBase(...args));
}

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
const embeddedPayload = globalThis.__EMBEDDED_PLAYER_DATA__;
if (Array.isArray(embeddedPayload?.players) && !globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__) {
  const setup = readQuickMatchSetup(embeddedPayload.players);
  const selection = setup?.playerSelection ?? readDeckSelection(embeddedPayload.players);
  const prepared = buildQuickMatchPayload(embeddedPayload, selection, setup?.opponentSelection ?? null);
  globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ = embeddedPayload;
  globalThis.__FOCISKARTYAK_DECK_SELECTION__ = selection;
  globalThis.__FOCISKARTYAK_QUICK_MATCH_SETUP__ = setup;
  globalThis.__FOCISKARTYAK_QUICK_MATCH__ = prepared.matchup;
  globalThis.__EMBEDDED_PLAYER_DATA__ = prepared.payload;
  installDeckSelectionMenu(embeddedPayload, selection);
}
