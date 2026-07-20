import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const base = readJson('../data/players.json');
const enrichmentFiles = [
  '../data/club-official-enrichment.json',
  '../data/club-official-enrichment-2.json',
  '../data/club-official-enrichment-3-paks-nyir.json',
  '../data/club-official-enrichment-4-ujpest.json',
  '../data/club-official-enrichment-5-other.json',
  '../data/club-official-enrichment-6-eto-puskas.json',
];
const correctionFiles = [
  '../data/club-official-corrections.json',
  '../data/club-official-corrections-2.json',
];
const parts = enrichmentFiles.map(readJson);
const correctionParts = correctionFiles.map(readJson);
const directory = readJson('../data/club-official-sources.json');
const raw = {
  ...parts[0],
  generatedAt: parts.at(-1)?.generatedAt ?? parts[0].generatedAt,
  sources: parts.flatMap(part => part.sources ?? []),
  records: parts.flatMap(part => part.records ?? []),
  clubDirectory: directory.clubs,
};
const corrections = {
  schemaVersion: 1,
  checkedAt: correctionParts.at(-1)?.checkedAt ?? null,
  addSources: correctionParts.flatMap(part => part.addSources ?? []),
  recordPatches: correctionParts.flatMap(part => part.recordPatches ?? []),
  excludeRecords: correctionParts.flatMap(part => part.excludeRecords ?? []),
  additions: correctionParts.flatMap(part => part.additions ?? []),
};
const prepared = prepareClubEnrichment(raw, corrections);
const result = applyClubEnrichmentPayload(base, prepared);
const conflicts = result.players.flatMap(card =>
  (card?.meta?.enrichmentConflicts ?? []).map(conflict => ({
    playerId: card.id,
    playerName: card.name,
    ...conflict,
  }))
);
console.log('ETO_PUSKAS_AUDIT=' + JSON.stringify({
  rawRecords: raw.records.length,
  preparedRecords: prepared.records.length,
  matchedRecords: result.enrichment.matchedRecords,
  unmatchedRecords: result.enrichment.unmatchedRecords,
  unmatched: result.enrichment.unmatched,
  excludedRecords: result.enrichment.excludedRecords,
  conflictCount: result.enrichment.conflictCount,
  conflicts,
  coverage: result.coverage,
  clubs: result.enrichment.clubSummary.filter(item =>
    ['eto-fc', 'puskas-akademia-fc'].includes(item.clubId)
  ),
}));
