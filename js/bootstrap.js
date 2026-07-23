import {
  loadDatabase,
} from './database/database-service.js';
import {
  applyDeckSelectionToPayload,
  describeDeckSelection,
  installDeckSelectionMenu,
  readDeckSelection,
} from './deck-selection.js';

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

try {
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
  const selectedPayload = applyDeckSelectionToPayload(playablePayload, deckSelection);

  globalThis.__FOCISKARTYAK_DATABASE__ = database;
  globalThis.__FOCISKARTYAK_DATABASE_SOURCE__ = source;
  globalThis.__FOCISKARTYAK_DATABASE_VALIDATION__ = validation;
  globalThis.__FOCISKARTYAK_DATABASE_STATISTICS__ = statistics;
  globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ = playablePayload;
  globalThis.__FOCISKARTYAK_DECK_SELECTION__ = deckSelection;
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
