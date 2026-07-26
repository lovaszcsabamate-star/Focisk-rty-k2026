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

const DECK_SELECTION_FACADE_NATION_MINIMUM = 7;

const deckSelectionFacadeQuickMatchTeam = (selection, count) => {
  if (selection.kind === 'nation') {
    const nation = nationPresentation(selection.value);
    return Object.freeze({
      kind: 'nation',
      key: nation.key,
      value: nation.key,
      label: `${nation.label} ligaválogatott`,
      icon: nation.flag,
      count,
    });
  }
  return Object.freeze({
    kind: 'club',
    key: canonicalClubKey(selection.value),
    value: String(selection.value ?? '').trim(),
    label: String(selection.value ?? '').trim(),
    icon: '🛡️',
    count,
  });
};

const deckSelectionFacadeDecoratePlayers = (players, side, team) => players.map(player => ({
  ...player,
  meta: {
    ...(player?.meta ?? {}),
    quickMatchSide: side,
    quickMatchTeamKind: team.kind,
    quickMatchTeamKey: team.key,
    quickMatchTeamLabel: team.label,
  },
}));

const deckSelectionFacadeBuildQuickMatchPayload = (payload, selection, rng = Math.random) => {
  if (!selection || selection.kind === 'random') {
    return { payload: applyDeckSelectionToPayload(payload, selection), matchup: null };
  }

  const humanPlayers = resolveDeckSelection(payload.players, selection);
  const minimum = selection.kind === 'nation'
    ? DECK_SELECTION_FACADE_NATION_MINIMUM
    : MIN_FILTERED_DECK_SIZE;
  const randomFallback = () => ({
    payload: applyDeckSelectionToPayload(payload, RANDOM_DECK_SELECTION),
    matchup: null,
  });
  if (humanPlayers.length < minimum) return randomFallback();

  const options = buildDeckSelectionOptions(payload.players, DECK_SELECTION_FACADE_NATION_MINIMUM);
  const entries = selection.kind === 'club'
    ? options.clubs.filter(entry => entry.count >= MIN_FILTERED_DECK_SIZE)
    : options.nations;
  const selectedKey = selection.kind === 'club'
    ? canonicalClubKey(selection.value)
    : nationPresentation(selection.value).key;
  const opponents = entries.filter(entry => entry.key !== selectedKey);
  if (!opponents.length) return randomFallback();

  const opponentEntry = opponents[Math.floor(rng() * opponents.length)];
  const opponentSelection = selection.kind === 'club'
    ? { kind: 'club', value: opponentEntry.label }
    : { kind: 'nation', value: opponentEntry.key };
  const aiPlayers = resolveDeckSelection(payload.players, opponentSelection);
  if (!aiPlayers.length) return randomFallback();

  const humanTeam = deckSelectionFacadeQuickMatchTeam(selection, humanPlayers.length);
  const aiTeam = deckSelectionFacadeQuickMatchTeam(opponentSelection, aiPlayers.length);
  const matchup = Object.freeze({
    enabled: true,
    category: selection.kind,
    human: humanTeam,
    ai: aiTeam,
  });
  const deckMeta = {
    ...selection,
    label: describeDeckSelection(selection, payload.players),
    availableCards: humanPlayers.length,
    minimumCards: minimum,
  };

  return {
    matchup,
    payload: {
      ...payload,
      players: [
        ...deckSelectionFacadeDecoratePlayers(humanPlayers, 'human', humanTeam),
        ...deckSelectionFacadeDecoratePlayers(aiPlayers, 'ai', aiTeam),
      ],
      deckSelection: deckMeta,
      quickMatch: matchup,
      selection: {
        ...(payload?.selection ?? {}),
        deckSelection: deckMeta,
        quickMatch: matchup,
      },
    },
  };
};

/* A moduláris alkalmazásban a bootstrap végzi az előkészítést. Az önálló buildben
   a teljes adatbázis már a modulok előtt be van ágyazva, ezért itt készül el a párosítás. */
const deckSelectionFacadeEmbeddedPayload = globalThis.__EMBEDDED_PLAYER_DATA__;
if (Array.isArray(deckSelectionFacadeEmbeddedPayload?.players)
  && !globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__) {
  const deckSelectionFacadeSelection = readDeckSelection(deckSelectionFacadeEmbeddedPayload.players);
  const deckSelectionFacadePrepared = deckSelectionFacadeBuildQuickMatchPayload(
    deckSelectionFacadeEmbeddedPayload,
    deckSelectionFacadeSelection,
  );
  globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ = deckSelectionFacadeEmbeddedPayload;
  globalThis.__FOCISKARTYAK_DECK_SELECTION__ = deckSelectionFacadeSelection;
  globalThis.__FOCISKARTYAK_QUICK_MATCH__ = deckSelectionFacadePrepared.matchup;
  globalThis.__EMBEDDED_PLAYER_DATA__ = deckSelectionFacadePrepared.payload;
  installDeckSelectionMenu(deckSelectionFacadeEmbeddedPayload, deckSelectionFacadeSelection);
}
