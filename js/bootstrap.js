import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from './data/club-enrichment.js';

const PLAYER_DATA_URL = 'data/players.json';
const CLUB_ENRICHMENT_URL = 'data/club-official-enrichment.json';
const CLUB_CORRECTIONS_URL = 'data/club-official-corrections.json';

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

try {
  const [payload, rawEnrichment, corrections] = await Promise.all([
    fetchJson(PLAYER_DATA_URL),
    fetchJson(CLUB_ENRICHMENT_URL).catch(error => {
      console.warn(`[enrichment] A kluboldali kiegészítés nem tölthető be: ${error.message}`);
      return null;
    }),
    fetchJson(CLUB_CORRECTIONS_URL).catch(error => {
      console.warn(`[enrichment] A korrekciós réteg nem tölthető be: ${error.message}`);
      return null;
    }),
  ]);

  const enrichment = rawEnrichment ? prepareClubEnrichment(rawEnrichment, corrections) : null;
  const enrichedPayload = enrichment ? applyClubEnrichmentPayload(payload, enrichment) : payload;
  globalThis.__EMBEDDED_PLAYER_DATA__ = enrichedPayload;

  if (enrichedPayload?.enrichment) {
    const summary = enrichedPayload.enrichment;
    console.info(
      `[enrichment] ${summary.matchedRecords}/${summary.records} hivatalos klubrekord illesztve · `
      + `${summary.updatedExistingPlayers} meglévő MLSZ-rekord kiegészítve · `
      + `${summary.addedPlayers} új, igazolt játékos hozzáadva · `
      + `${summary.unmatchedRecords} illesztetlen rekord · ${summary.conflictCount} megőrzött eltérés`
    );
  }
} catch (error) {
  console.warn(`[bootstrap] Előzetes adatbetöltés sikertelen, a normál betöltő próbálkozik: ${error.message}`);
}

await import('./main.js');
