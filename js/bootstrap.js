import { applyClubEnrichmentPayload } from './data/club-enrichment.js';

const PLAYER_DATA_URL = 'data/players.json';
const CLUB_ENRICHMENT_URL = 'data/club-official-enrichment.json';

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

try {
  const [payload, enrichment] = await Promise.all([
    fetchJson(PLAYER_DATA_URL),
    fetchJson(CLUB_ENRICHMENT_URL).catch(error => {
      console.warn(`[enrichment] A kluboldali kiegészítés nem tölthető be: ${error.message}`);
      return null;
    }),
  ]);

  const enrichedPayload = enrichment ? applyClubEnrichmentPayload(payload, enrichment) : payload;
  globalThis.__EMBEDDED_PLAYER_DATA__ = enrichedPayload;

  if (enrichedPayload?.enrichment) {
    const summary = enrichedPayload.enrichment;
    console.info(
      `[enrichment] ${summary.matchedRecords}/${summary.records} hivatalos klubrekord illesztve · `
      + `${summary.conflictCount} eltérés megőrizve felülírás nélkül`
    );
  }
} catch (error) {
  console.warn(`[bootstrap] Előzetes adatbetöltés sikertelen, a normál betöltő próbálkozik: ${error.message}`);
}

await import('./main.js');
