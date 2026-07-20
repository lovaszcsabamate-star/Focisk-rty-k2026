import {
  enrichmentNamesMatch,
  normaliseEnrichmentText,
} from './club-enrichment.js';

const isObject = value => value != null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const STAT_FIELDS = [
  'appearances',
  'starts',
  'squads',
  'minutes',
  'substituteAppearances',
  'goals',
  'assists',
  'yellowCards',
  'redCards',
  'secondYellowRedCards',
  'totalDismissals',
];

const cardClubIds = card => {
  if (Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length) return card.meta.clubIds;
  return [card?.meta?.clubId].filter(Boolean);
};

const sortedNameKey = value => [...new Set(
  normaliseEnrichmentText(value).split(' ').filter(Boolean)
)].sort().join('|');

const expandRows = payload => {
  if (!isObject(payload) || !Array.isArray(payload.fields) || !Array.isArray(payload.rows)) return [];
  return payload.rows.map(row => {
    const record = Object.fromEntries(payload.fields.map((field, index) => [field, row[index]]));
    const { name, ...stats } = record;
    return {
      sourceId: payload.source?.id ?? null,
      clubId: payload.source?.clubId ?? null,
      name,
      aliases: payload.aliases?.[name] ?? [],
      stats,
    };
  });
};

const patchCoverage = cards => Object.fromEntries(
  STAT_FIELDS.map(field => [field, cards.filter(card => finite(card?.stats?.[field])).length])
);

const matchRecord = (cards, record) => {
  const candidates = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => cardClubIds(card).includes(record.clubId));
  const offeredNames = [record.name, ...(Array.isArray(record.aliases) ? record.aliases : [])]
    .filter(name => typeof name === 'string' && name.trim());
  const exact = candidates.filter(({ card }) =>
    offeredNames.some(name => sortedNameKey(card.name) === sortedNameKey(name))
  );
  if (exact.length === 1) return { match: exact[0], reason: null };
  if (exact.length > 1) return { match: null, reason: 'ambiguous-exact-player-match' };
  const fuzzy = candidates.filter(({ card }) => enrichmentNamesMatch(card.name, record));
  if (fuzzy.length === 1) return { match: fuzzy[0], reason: null };
  return {
    match: null,
    reason: fuzzy.length > 1 ? 'ambiguous-player-match' : 'no-unique-player-match',
  };
};

export function applyOfficialStatPatches(payload, patchPayloads) {
  const rawCards = Array.isArray(payload) ? payload : payload?.players;
  if (!Array.isArray(rawCards)) return payload;

  const parts = (Array.isArray(patchPayloads) ? patchPayloads : [patchPayloads]).filter(isObject);
  const sources = parts.map(part => part.source).filter(source => source?.id);
  const records = parts.flatMap(expandRows);
  if (!records.length) return payload;

  const cards = rawCards.map(card => ({
    ...card,
    stats: { ...(card?.stats ?? {}) },
    meta: {
      ...(card?.meta ?? {}),
      clubOfficialStatsByClub: { ...(card?.meta?.clubOfficialStatsByClub ?? {}) },
      officialStatSources: Array.isArray(card?.meta?.officialStatSources)
        ? [...card.meta.officialStatSources]
        : [],
    },
  }));

  const sourceById = new Map(sources.map(source => [source.id, source]));
  const before = patchCoverage(cards);
  const unmatched = [];
  const conflicts = [];
  const appliedFieldCounts = {};
  let matchedRecords = 0;
  let multiClubMetadataOnly = 0;

  for (const record of records) {
    if (!record?.name || !record?.clubId || !record?.sourceId) {
      unmatched.push({ name: record?.name ?? null, clubId: record?.clubId ?? null, reason: 'invalid-record' });
      continue;
    }

    const matchResult = matchRecord(cards, record);
    if (!matchResult.match) {
      unmatched.push({
        name: record.name,
        clubId: record.clubId,
        sourceId: record.sourceId,
        reason: matchResult.reason,
      });
      continue;
    }

    const { card, index } = matchResult.match;
    const stats = { ...card.stats };
    const meta = { ...card.meta };
    const offeredStats = Object.fromEntries(
      STAT_FIELDS.filter(field => finite(record.stats?.[field])).map(field => [field, record.stats[field]])
    );
    const registrationCount = Number(meta.registrationCount ?? cardClubIds(card).length ?? 1);
    const appliedFields = [];

    meta.clubOfficialStatsByClub = {
      ...(meta.clubOfficialStatsByClub ?? {}),
      [record.clubId]: {
        ...(meta.clubOfficialStatsByClub?.[record.clubId] ?? {}),
        ...offeredStats,
        sourceId: record.sourceId,
      },
    };

    if (registrationCount <= 1) {
      for (const [field, offered] of Object.entries(offeredStats)) {
        const current = stats[field];
        if (!finite(current)) {
          stats[field] = offered;
          appliedFields.push(field);
          appliedFieldCounts[field] = (appliedFieldCounts[field] ?? 0) + 1;
        } else if (current !== offered) {
          conflicts.push({
            playerId: card.id,
            playerName: card.name,
            clubId: record.clubId,
            sourceId: record.sourceId,
            field,
            kept: current,
            offered,
          });
        }
      }
    } else {
      multiClubMetadataOnly += 1;
    }

    const source = sourceById.get(record.sourceId);
    const sourceEntry = {
      sourceId: record.sourceId,
      sourceName: source?.name ?? null,
      sourceUrl: source?.url ?? null,
      additionalUrls: source?.additionalUrls ?? [],
      checkedAt: source?.checkedAt ?? null,
      season: source?.season ?? null,
      clubId: record.clubId,
      matchedName: record.name,
      fieldsApplied: appliedFields,
    };
    const sourceKey = `${record.sourceId}|${record.clubId}|${record.name}`;
    const existingIndex = meta.officialStatSources.findIndex(item =>
      `${item?.sourceId}|${item?.clubId}|${item?.matchedName}` === sourceKey
    );
    if (existingIndex >= 0) meta.officialStatSources[existingIndex] = sourceEntry;
    else meta.officialStatSources.push(sourceEntry);

    if (appliedFields.length) meta.dataStatus = meta.dataStatus === 'verified' ? 'verified' : 'partially_verified';
    cards[index] = { ...card, stats, meta };
    matchedRecords += 1;
  }

  const after = patchCoverage(cards);
  const fieldCoverage = STAT_FIELDS.map(field => ({
    field,
    before: before[field],
    after: after[field],
    added: after[field] - before[field],
  }));
  const summary = {
    schemaVersion: 1,
    season: parts.at(-1)?.season ?? null,
    generatedAt: parts.at(-1)?.generatedAt ?? null,
    records: records.length,
    matchedRecords,
    unmatchedRecords: unmatched.length,
    conflictCount: conflicts.length,
    multiClubMetadataOnly,
    appliedFieldCounts,
    fieldCoverage,
    manualReview: unmatched,
    conflicts,
    sources,
  };

  if (Array.isArray(payload)) return cards;
  return {
    ...payload,
    coverage: { ...(payload.coverage ?? {}), ...after },
    source: {
      ...(payload.source ?? {}),
      officialClubStatPatches: sources,
    },
    officialStatPatches: summary,
    players: cards,
  };
}
