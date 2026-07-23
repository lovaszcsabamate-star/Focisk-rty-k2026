import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from './data/club-enrichment.js';
import { applyOfficialStatPatches } from './data/club-stat-patches.js';
import { filterCompleteCardsPayload } from './data/complete-cards.js';
import { applyVerifiedPlayerCorrections } from './data/verified-player-corrections.js';
import {
  applyDeckSelectionToPayload,
  describeDeckSelection,
  installDeckSelectionMenu,
  readDeckSelection,
} from './deck-selection.js';
import { getDefaultDatabase } from './database/database-registry.js';

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

function combineEnrichments(parts, directory) {
  const valid = parts.filter(part => part && Array.isArray(part.records));
  if (!valid.length) return null;
  return {
    ...valid[0],
    generatedAt: valid.at(-1)?.generatedAt ?? valid[0].generatedAt,
    sources: valid.flatMap(part => part.sources ?? []),
    records: valid.flatMap(part => part.records ?? []),
    clubDirectory: Array.isArray(directory?.clubs) ? directory.clubs : [],
  };
}

function combineCorrections(parts) {
  const valid = parts.filter(Boolean);
  return {
    schemaVersion: 1,
    checkedAt: valid.at(-1)?.checkedAt ?? null,
    addSources: valid.flatMap(part => part.addSources ?? []),
    recordPatches: valid.flatMap(part => part.recordPatches ?? []),
    verifiedCorrections: valid.flatMap(part => part.verifiedCorrections ?? []),
    excludeRecords: valid.flatMap(part => part.excludeRecords ?? []),
    additions: valid.flatMap(part => part.additions ?? []),
  };
}

function validateNormalizedPayload(payload, database) {
  if (!payload || !Array.isArray(payload.players) || payload.players.length < database.minimumPlayers) {
    throw new Error('A normalizált adatfájl nem tartalmaz elegendő játékosrekordot.');
  }
  if (payload.databaseId && payload.databaseId !== database.id) {
    throw new Error(`A normalizált adatfájl másik adatbázishoz tartozik: ${payload.databaseId}`);
  }
  const requiredModelVersion = database.normalization?.playerModelVersion;
  if (requiredModelVersion != null && payload.playerModel?.version !== requiredModelVersion) {
    throw new Error(
      `Nem támogatott játékosmodell: ${payload.playerModel?.version ?? 'ismeretlen'}; elvárt: ${requiredModelVersion}`,
    );
  }
  if ((payload.playerModel?.validation?.errorCount ?? 0) > 0) {
    throw new Error('A normalizált adatfájl kritikus validációs hibát jelez.');
  }
  return payload;
}

async function loadLegacyLayeredPayload(files) {
  const enrichmentFiles = Array.isArray(files.enrichments) ? files.enrichments : [];
  const correctionFiles = Array.isArray(files.corrections) ? files.corrections : [];
  const statPatchFiles = Array.isArray(files.statPatches) ? files.statPatches : [];

  const [payload, rawParts, correctionParts, statPatchParts, directory] = await Promise.all([
    fetchJson(files.players),
    Promise.all(enrichmentFiles.map(url => fetchJson(url).catch(error => {
      console.warn(`[enrichment] A kluboldali kiegészítés nem tölthető be (${url}): ${error.message}`);
      return null;
    }))),
    Promise.all(correctionFiles.map(url => fetchJson(url).catch(error => {
      console.warn(`[enrichment] A korrekciós réteg nem tölthető be (${url}): ${error.message}`);
      return null;
    }))),
    Promise.all(statPatchFiles.map(url => fetchJson(url).catch(error => {
      console.warn(`[enrichment] A hivatalos klubstatisztika nem tölthető be (${url}): ${error.message}`);
      return null;
    }))),
    fetchJson(files.clubDirectory).catch(error => {
      console.warn(`[enrichment] A klubforrás-jegyzék nem tölthető be: ${error.message}`);
      return null;
    }),
  ]);

  const combined = combineEnrichments(rawParts, directory);
  const corrections = combineCorrections(correctionParts);
  const correctedPayload = applyVerifiedPlayerCorrections(payload, corrections.verifiedCorrections);
  const enrichment = combined ? prepareClubEnrichment(combined, corrections) : null;
  const enrichedPayload = enrichment
    ? applyClubEnrichmentPayload(correctedPayload, enrichment)
    : correctedPayload;
  return applyOfficialStatPatches(enrichedPayload, statPatchParts);
}

async function loadDatabasePayload(database) {
  const files = database.files ?? {};
  if (files.normalizedPlayers) {
    try {
      const payload = validateNormalizedPayload(await fetchJson(files.normalizedPlayers), database);
      return { payload, source: 'normalized' };
    } catch (error) {
      console.warn(
        `[database] A normalizált adatbázis nem használható (${files.normalizedPlayers}): ${error.message}. `
        + 'Visszaállás a régi forrásrétegekre.',
      );
    }
  }

  return {
    payload: await loadLegacyLayeredPayload(files),
    source: 'legacy-fallback',
  };
}

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
  const database = await getDefaultDatabase();
  const loaded = await loadDatabasePayload(database);
  const finalPayload = loaded.payload;
  const playablePayload = filterCompleteCardsPayload(finalPayload, { playerModel: { database } });
  const deckSelection = readDeckSelection(playablePayload.players);
  const selectedPayload = applyDeckSelectionToPayload(playablePayload, deckSelection);

  globalThis.__FOCISKARTYAK_DATABASE__ = database;
  globalThis.__FOCISKARTYAK_DATABASE_SOURCE__ = loaded.source;
  globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ = playablePayload;
  globalThis.__FOCISKARTYAK_DECK_SELECTION__ = deckSelection;
  globalThis.__EMBEDDED_PLAYER_DATA__ = selectedPayload;
  installDeckSelectionMenu(playablePayload, deckSelection);

  console.info(
    `[database] ${database.name} · ${database.season} · ${loaded.source} · manifest: ${database.manifestUrl}`,
  );
  console.info(
    `[players] Teljes kártyák szűrése: ${playablePayload.players.length} használható · `
    + `${playablePayload.completenessFilter.excludedIncompleteCards} hiányos rekord kizárva`,
  );
  console.info(
    `[deck] ${describeDeckSelection(deckSelection, playablePayload.players)} · `
    + `${selectedPayload.players.length} lap aktív mindkét játékmódban`,
  );

  if (finalPayload?.enrichment) {
    const summary = finalPayload.enrichment;
    console.info(
      `[enrichment] ${summary.clubSummary?.length ?? 0} klub ellenőrizve · `
      + `${summary.matchedRecords}/${summary.records} hivatalos klubrekord illesztve · `
      + `${summary.updatedExistingPlayers} meglévő MLSZ-rekord kiegészítve · `
      + `${summary.addedPlayers} új, igazolt játékos hozzáadva · `
      + `${summary.unmatchedRecords} kézi ellenőrzésre váró rekord · `
      + `${summary.conflictCount} megőrzött eltérés`,
    );
  }
  if (finalPayload?.officialStatPatches) {
    const summary = finalPayload.officialStatPatches;
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
