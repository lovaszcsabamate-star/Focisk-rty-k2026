import fs from 'node:fs';
import path from 'node:path';

import { isValidHeightCm } from '../js/data/height.js';
import { normaliseEnrichmentText } from '../js/data/club-enrichment.js';
import { buildNormalizedDatabase, PROJECT_ROOT } from './migrate-normalized-database.mjs';

const ENRICHMENT_PATH = path.join(PROJECT_ROOT, 'data/club-official-enrichment-26-height-1-reviewed.json');
const enrichment = JSON.parse(fs.readFileSync(ENRICHMENT_PATH, 'utf8'));
const { output } = buildNormalizedDatabase();
const players = output.players ?? [];
const sources = new Map((enrichment.sources ?? []).map(source => [source.id, source]));

const cardClubIds = player => Array.isArray(player?.meta?.clubIds)
  ? player.meta.clubIds
  : [player?.meta?.clubId].filter(Boolean);
const candidateNames = record => [record.name, ...(record.aliases ?? [])]
  .map(normaliseEnrichmentText)
  .filter(Boolean);
const strictNameMatch = (player, record) => candidateNames(record).includes(normaliseEnrichmentText(player?.name));

const errors = [];
const matched = [];

for (const record of enrichment.records ?? []) {
  if (!record.clubId || !record.birthDate || !record.name || !record.sourceId) {
    errors.push(`${record.name ?? '<névtelen>'}: hiányos identity/source rekord`);
    continue;
  }
  if (!isValidHeightCm(record.heightCm)) {
    errors.push(`${record.name}: érvénytelen heightCm=${JSON.stringify(record.heightCm)}`);
    continue;
  }
  const source = sources.get(record.sourceId);
  if (!source?.url || !source?.name || source?.checkedAt !== '2026-08-08') {
    errors.push(`${record.name}: hiányos vagy nem 2026-08-08-i forrásmetaadat`);
  }

  const identityMatches = players.filter(player =>
    cardClubIds(player).includes(record.clubId)
    && (player.birthDate ?? player.dateOfBirth) === record.birthDate
    && strictNameMatch(player, record)
  );

  if (identityMatches.length !== 1) {
    errors.push(`${record.name}: strict club+birthDate+normalizedName match=${identityMatches.length}`);
    continue;
  }

  const player = identityMatches[0];
  const finalHeight = player.heightCm ?? player.stats?.heightCm ?? null;
  if (finalHeight !== record.heightCm) {
    errors.push(`${record.name}: a végső heightCm ${finalHeight}, a forrásrekord ${record.heightCm}`);
    continue;
  }

  const sourceTrace = (player.meta?.clubOfficialSources ?? []).find(item =>
    item?.sourceId === record.sourceId && item?.fieldsApplied?.includes('heightCm')
  );
  if (!sourceTrace) errors.push(`${record.name}: hiányzik a heightCm source trace`);

  matched.push({
    playerId: player.id,
    name: player.name,
    clubId: record.clubId,
    birthDate: record.birthDate,
    heightCm: record.heightCm,
    sourceId: record.sourceId,
  });
}

if (new Set(matched.map(item => item.playerId)).size !== matched.length) {
  errors.push('ugyanahhoz a személyhez több Height 1.0 rekord kapcsolódik');
}

for (const conflict of enrichment.conflicts ?? []) {
  if (conflict.status !== 'unresolved-no-height-applied') continue;
  const conflictCandidates = players.filter(player =>
    cardClubIds(player).includes(conflict.clubId)
    && normaliseEnrichmentText(player.name) === normaliseEnrichmentText(conflict.player)
  );
  if (conflictCandidates.length === 1 && conflictCandidates[0].birthDate === conflict.sourceBirthDate) {
    errors.push(`${conflict.player}: az unresolved konfliktus mégis sourceBirthDate-re illeszkedik`);
  }
}

console.log(JSON.stringify({
  records: enrichment.records?.length ?? 0,
  strictMatches: matched.length,
  conflicts: enrichment.conflicts?.length ?? 0,
  errors,
}, null, 2));

if (errors.length) throw new Error(`Height 1.0 strict identity validation failed: ${errors.join('; ')}`);
