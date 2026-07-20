import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from './data/club-enrichment.js';

const PLAYER_DATA_URL = 'data/players.json';
const CLUB_ENRICHMENT_URLS = [
  'data/club-official-enrichment.json',
  'data/club-official-enrichment-2.json',
  'data/club-official-enrichment-3-paks-nyir.json',
  'data/club-official-enrichment-4-ujpest.json',
  'data/club-official-enrichment-5-other.json',
];
const CLUB_CORRECTIONS_URL = 'data/club-official-corrections.json';
const CLUB_DIRECTORY_URL = 'data/club-official-sources.json';

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

try {
  const [payload, rawParts, corrections, directory] = await Promise.all([
    fetchJson(PLAYER_DATA_URL),
    Promise.all(CLUB_ENRICHMENT_URLS.map(url => fetchJson(url).catch(error => {
      console.warn(`[enrichment] A kluboldali kiegészítés nem tölthető be (${url}): ${error.message}`);
      return null;
    }))),
    fetchJson(CLUB_CORRECTIONS_URL).catch(error => {
      console.warn(`[enrichment] A korrekciós réteg nem tölthető be: ${error.message}`);
      return null;
    }),
    fetchJson(CLUB_DIRECTORY_URL).catch(error => {
      console.warn(`[enrichment] A klubforrás-jegyzék nem tölthető be: ${error.message}`);
      return null;
    }),
  ]);

  const combined = combineEnrichments(rawParts, directory);
  const enrichment = combined ? prepareClubEnrichment(combined, corrections) : null;
  const enrichedPayload = enrichment ? applyClubEnrichmentPayload(payload, enrichment) : payload;
  globalThis.__EMBEDDED_PLAYER_DATA__ = enrichedPayload;

  if (enrichedPayload?.enrichment) {
    const summary = enrichedPayload.enrichment;
    console.info(
      `[enrichment] ${summary.clubSummary?.length ?? 0} klub ellenőrizve · `
      + `${summary.matchedRecords}/${summary.records} hivatalos klubrekord illesztve · `
      + `${summary.updatedExistingPlayers} meglévő MLSZ-rekord kiegészítve · `
      + `${summary.addedPlayers} új, igazolt játékos hozzáadva · `
      + `${summary.unmatchedRecords} kézi ellenőrzésre váró rekord · `
      + `${summary.conflictCount} megőrzött eltérés`
    );
  }
} catch (error) {
  console.warn(`[bootstrap] Előzetes adatbetöltés sikertelen, a normál betöltő próbálkozik: ${error.message}`);
}

await import('./main.js');
