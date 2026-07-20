import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from './data/club-enrichment.js';
import { applyOfficialStatPatches } from './data/club-stat-patches.js';

const PLAYER_DATA_URL = 'data/players.json';
const CLUB_ENRICHMENT_URLS = [
  'data/club-official-enrichment.json',
  'data/club-official-enrichment-2.json',
  'data/club-official-enrichment-3-paks-nyir.json',
  'data/club-official-enrichment-4-ujpest.json',
  'data/club-official-enrichment-5-other.json',
  'data/club-official-enrichment-6-eto-puskas.json',
];
const CLUB_CORRECTION_URLS = [
  'data/club-official-corrections.json',
  'data/club-official-corrections-2.json',
  'data/club-official-corrections-3.json',
];
const CLUB_STAT_PATCH_URLS = [
  'data/club-official-stat-patches-kisvarda.json',
];
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

function combineCorrections(parts) {
  const valid = parts.filter(Boolean);
  return {
    schemaVersion: 1,
    checkedAt: valid.at(-1)?.checkedAt ?? null,
    addSources: valid.flatMap(part => part.addSources ?? []),
    recordPatches: valid.flatMap(part => part.recordPatches ?? []),
    excludeRecords: valid.flatMap(part => part.excludeRecords ?? []),
    additions: valid.flatMap(part => part.additions ?? []),
  };
}

try {
  const [payload, rawParts, correctionParts, statPatchParts, directory] = await Promise.all([
    fetchJson(PLAYER_DATA_URL),
    Promise.all(CLUB_ENRICHMENT_URLS.map(url => fetchJson(url).catch(error => {
      console.warn(`[enrichment] A kluboldali kiegészítés nem tölthető be (${url}): ${error.message}`);
      return null;
    }))),
    Promise.all(CLUB_CORRECTION_URLS.map(url => fetchJson(url).catch(error => {
      console.warn(`[enrichment] A korrekciós réteg nem tölthető be (${url}): ${error.message}`);
      return null;
    }))),
    Promise.all(CLUB_STAT_PATCH_URLS.map(url => fetchJson(url).catch(error => {
      console.warn(`[enrichment] A hivatalos klubstatisztika nem tölthető be (${url}): ${error.message}`);
      return null;
    }))),
    fetchJson(CLUB_DIRECTORY_URL).catch(error => {
      console.warn(`[enrichment] A klubforrás-jegyzék nem tölthető be: ${error.message}`);
      return null;
    }),
  ]);

  const combined = combineEnrichments(rawParts, directory);
  const corrections = combineCorrections(correctionParts);
  const enrichment = combined ? prepareClubEnrichment(combined, corrections) : null;
  const enrichedPayload = enrichment ? applyClubEnrichmentPayload(payload, enrichment) : payload;
  const finalPayload = applyOfficialStatPatches(enrichedPayload, statPatchParts);
  globalThis.__EMBEDDED_PLAYER_DATA__ = finalPayload;

  if (finalPayload?.enrichment) {
    const summary = finalPayload.enrichment;
    console.info(
      `[enrichment] ${summary.clubSummary?.length ?? 0} klub ellenőrizve · `
      + `${summary.matchedRecords}/${summary.records} hivatalos klubrekord illesztve · `
      + `${summary.updatedExistingPlayers} meglévő MLSZ-rekord kiegészítve · `
      + `${summary.addedPlayers} új, igazolt játékos hozzáadva · `
      + `${summary.unmatchedRecords} kézi ellenőrzésre váró rekord · `
      + `${summary.conflictCount} megőrzött eltérés`
    );
  }
  if (finalPayload?.officialStatPatches) {
    const summary = finalPayload.officialStatPatches;
    console.info(
      `[official-stats] ${summary.matchedRecords}/${summary.records} hivatalos szezonstatisztika illesztve · `
      + `${summary.unmatchedRecords} kézi ellenőrzés · ${summary.conflictCount} megőrzött eltérés`
    );
  }
} catch (error) {
  console.warn(`[bootstrap] Előzetes adatbetöltés sikertelen, a normál betöltő próbálkozik: ${error.message}`);
}

await import('./main.js');
