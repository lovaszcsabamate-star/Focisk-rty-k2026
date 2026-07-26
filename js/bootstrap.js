import {
  loadDatabase,
} from './database/database-service.js';
import {
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalClubKey,
  describeDeckSelection,
  installDeckSelectionMenu,
  nationPresentation,
  readDeckSelection,
  resolveDeckSelection,
} from './deck-selection.js';
import { installUiEnhancementPipeline } from './ui/ui-enhancement-pipeline.js';

function showFatalError(error) {
  console.error('[bootstrap] Az alkalmazás nem indítható:', error);
  const loading = document.querySelector('#app-loading');
  if (!loading) return;
  loading.hidden = false;
  loading.innerHTML = `
    <div class="app-loading__card app-loading__error" role="alert">
      <span class="app-loading__ball" aria-hidden="true">⚠️</span>
      <h1>A játék nem indult el</h1>
      <p>Az adatbázis vagy a kezelőfelület betöltése megszakadt.</p>
      <button class="btn" id="retry-load-btn" type="button">Újrapróbálás</button>
    </div>
  `;
  loading.querySelector('#retry-load-btn')?.addEventListener('click', () => location.reload(), { once: true });
}

const quickMatchTeam = (selection, count) => {
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

const quickMatchDecorate = (players, side, team) => players.map(player => ({
  ...player,
  meta: {
    ...(player?.meta ?? {}),
    quickMatchSide: side,
    quickMatchTeamKind: team.kind,
    quickMatchTeamKey: team.key,
    quickMatchTeamLabel: team.label,
  },
}));

function buildQuickMatchPayload(playablePayload, selection) {
  if (!selection || selection.kind === 'random') {
    return { payload: applyDeckSelectionToPayload(playablePayload, selection), matchup: null };
  }

  const humanPlayers = resolveDeckSelection(playablePayload.players, selection);
  const minimum = selection.kind === 'nation' ? 7 : 11;
  if (humanPlayers.length < minimum) {
    return { payload: applyDeckSelectionToPayload(playablePayload, { kind: 'random', value: '' }), matchup: null };
  }
  const humanDeckMeta = {
    ...selection,
    label: describeDeckSelection(selection, playablePayload.players),
    availableCards: humanPlayers.length,
    minimumCards: minimum,
  };
  const basePayload = {
    ...(playablePayload ?? {}),
    players: humanPlayers,
    deckSelection: humanDeckMeta,
    selection: {
      ...(playablePayload?.selection ?? {}),
      deckSelection: humanDeckMeta,
    },
  };
  const options = buildDeckSelectionOptions(playablePayload.players, 7);
  const entries = selection.kind === 'club'
    ? options.clubs.filter(entry => entry.count >= 11)
    : options.nations;
  const selectedKey = selection.kind === 'club'
    ? canonicalClubKey(selection.value)
    : nationPresentation(selection.value).key;
  const opponents = entries.filter(entry => entry.key !== selectedKey);
  if (!humanPlayers.length || !opponents.length) {
    return { payload: applyDeckSelectionToPayload(playablePayload, { kind: 'random', value: '' }), matchup: null };
  }

  const opponentEntry = opponents[Math.floor(Math.random() * opponents.length)];
  const opponentSelection = selection.kind === 'club'
    ? { kind: 'club', value: opponentEntry.label }
    : { kind: 'nation', value: opponentEntry.key };
  const aiPlayers = resolveDeckSelection(playablePayload.players, opponentSelection);
  if (!aiPlayers.length) {
    return { payload: applyDeckSelectionToPayload(playablePayload, { kind: 'random', value: '' }), matchup: null };
  }

  const humanTeam = quickMatchTeam(selection, humanPlayers.length);
  const aiTeam = quickMatchTeam(opponentSelection, aiPlayers.length);
  const matchup = Object.freeze({
    enabled: true,
    category: selection.kind,
    human: humanTeam,
    ai: aiTeam,
  });
  const players = [
    ...quickMatchDecorate(humanPlayers, 'human', humanTeam),
    ...quickMatchDecorate(aiPlayers, 'ai', aiTeam),
  ];

  return {
    matchup,
    payload: {
      ...basePayload,
      players,
      quickMatch: matchup,
      selection: {
        ...(basePayload.selection ?? {}),
        quickMatch: matchup,
      },
    },
  };
}

try {
  await installUiEnhancementPipeline();
  const loaded = await loadDatabase();
  const {
    database,
    source,
    payload: fullPayload,
    playablePayload,
    validation,
    statistics,
  } = loaded;
  const deckSelection = readDeckSelection(playablePayload.players);
  const quickMatch = buildQuickMatchPayload(playablePayload, deckSelection);
  const selectedPayload = quickMatch.payload;

  globalThis.__FOCISKARTYAK_DATABASE__ = database;
  globalThis.__FOCISKARTYAK_DATABASE_SOURCE__ = source;
  globalThis.__FOCISKARTYAK_DATABASE_VALIDATION__ = validation;
  globalThis.__FOCISKARTYAK_DATABASE_STATISTICS__ = statistics;
  globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ = playablePayload;
  globalThis.__FOCISKARTYAK_DECK_SELECTION__ = deckSelection;
  globalThis.__FOCISKARTYAK_QUICK_MATCH__ = quickMatch.matchup;
  globalThis.__EMBEDDED_PLAYER_DATA__ = selectedPayload;
  installDeckSelectionMenu(playablePayload, deckSelection);

  console.info(
    `[database] ${database.name} · ${database.season} · ${source} · manifest: ${database.manifestUrl}`,
  );
  console.info(
    `[players] ${statistics.playerCount} rekord · ${statistics.playablePlayerCount} használható · `
    + `${statistics.excludedPlayerCount} hiányos rekord kizárva`,
  );
  console.info(
    `[deck] ${describeDeckSelection(deckSelection, playablePayload.players)} · `
    + `${selectedPayload.players.length} lap aktív mindkét játékmódban`,
  );
  if (quickMatch.matchup) {
    console.info(
      `[quick-match] ${quickMatch.matchup.human.label} (${quickMatch.matchup.human.count}) · `
      + `${quickMatch.matchup.ai.label} (${quickMatch.matchup.ai.count})`,
    );
  }

  if (validation.warnings.length) {
    console.warn(`[database] ${validation.warnings.length} figyelmeztetés:`, validation.warnings);
  }
  if (fullPayload?.enrichment) {
    const summary = fullPayload.enrichment;
    console.info(
      `[enrichment] ${summary.clubSummary?.length ?? 0} klub ellenőrizve · `
      + `${summary.matchedRecords}/${summary.records} hivatalos klubrekord illesztve · `
      + `${summary.updatedExistingPlayers} meglévő MLSZ-rekord kiegészítve · `
      + `${summary.addedPlayers} új, igazolt játékos hozzáadva · `
      + `${summary.unmatchedRecords} kézi ellenőrzésre váró rekord · `
      + `${summary.conflictCount} megőrzött eltérés`,
    );
  }
  if (fullPayload?.officialStatPatches) {
    const summary = fullPayload.officialStatPatches;
    console.info(
      `[official-stats] ${summary.matchedRecords}/${summary.records} hivatalos szezonstatisztika illesztve · `
      + `${summary.unmatchedRecords} kézi ellenőrzés · ${summary.conflictCount} megőrzött eltérés · `
      + `${summary.correctionCount ?? 0} bizonyított korrekció`,
    );
  }

  await import('./main.js');
  const loading = document.querySelector('#app-loading');
  if (loading) loading.hidden = true;
} catch (error) {
  showFatalError(error);
}
