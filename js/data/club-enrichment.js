/**
 * Non-destructive enrichment of the original MLSZ-based player database.
 * Official club pages may only fill missing fields; existing values always win.
 */

const isObject = value => value != null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const blank = value => value == null || (typeof value === 'string' && value.trim() === '');

export function normaliseEnrichmentText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleUpperCase('hu-HU')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const nameTokens = value => normaliseEnrichmentText(value).split(' ').filter(Boolean);
const sortedNameKey = value => [...new Set(nameTokens(value))].sort().join('|');
const isSubset = (smaller, larger) => smaller.every(token => larger.includes(token));

export function enrichmentNamesMatch(cardName, record = {}) {
  const cardTokens = [...new Set(nameTokens(cardName))];
  if (!cardTokens.length) return false;

  const candidates = [record.name, ...(Array.isArray(record.aliases) ? record.aliases : [])]
    .filter(value => typeof value === 'string' && value.trim());

  return candidates.some(candidate => {
    const candidateTokens = [...new Set(nameTokens(candidate))];
    if (!candidateTokens.length) return false;
    if (sortedNameKey(cardName) === sortedNameKey(candidate)) return true;
    if (Math.min(cardTokens.length, candidateTokens.length) < 2) return false;
    return isSubset(cardTokens, candidateTokens) || isSubset(candidateTokens, cardTokens);
  });
}

const cardClubIds = card => {
  const ids = card?.meta?.clubIds;
  if (Array.isArray(ids) && ids.length) return ids;
  return [card?.meta?.clubId].filter(Boolean);
};

const sourceById = enrichment => new Map(
  (Array.isArray(enrichment?.sources) ? enrichment.sources : [])
    .filter(source => source?.id)
    .map(source => [source.id, source])
);

const comparable = value => value == null ? null : String(value).trim();

function mergeRecord(card, record, source) {
  const stats = isObject(card.stats) ? { ...card.stats } : {};
  const meta = isObject(card.meta) ? { ...card.meta } : {};
  const appliedFields = [];
  const conflicts = [];

  let position = typeof card.position === 'string' ? card.position : '';
  let nation = typeof card.nation === 'string' ? card.nation : '';
  let birthDate = card.birthDate ?? null;

  if (blank(position) && !blank(record.position)) {
    position = record.position;
    appliedFields.push('position');
  } else if (!blank(record.position) && comparable(position) !== comparable(record.position)) {
    conflicts.push({ field: 'position', kept: position, offered: record.position });
  }

  if (blank(nation) && !blank(record.nation)) {
    nation = record.nation;
    appliedFields.push('nation');
  } else if (!blank(record.nation) && comparable(nation) !== comparable(record.nation)) {
    conflicts.push({ field: 'nation', kept: nation, offered: record.nation });
  }

  if (blank(birthDate) && !blank(record.birthDate)) {
    birthDate = record.birthDate;
    appliedFields.push('birthDate');
  } else if (!blank(record.birthDate) && comparable(birthDate) !== comparable(record.birthDate)) {
    conflicts.push({ field: 'birthDate', kept: birthDate, offered: record.birthDate });
  }

  if (!isFiniteNumber(stats.heightCm) && isFiniteNumber(record.heightCm)) {
    stats.heightCm = record.heightCm;
    appliedFields.push('heightCm');
  } else if (isFiniteNumber(stats.heightCm) && isFiniteNumber(record.heightCm) && stats.heightCm !== record.heightCm) {
    conflicts.push({ field: 'heightCm', kept: stats.heightCm, offered: record.heightCm });
  }

  const registrationCount = Number(meta.registrationCount ?? cardClubIds(card).length ?? 1);
  if (registrationCount <= 1 && !isFiniteNumber(stats.shirtNumber) && isFiniteNumber(record.shirtNumber)) {
    stats.shirtNumber = record.shirtNumber;
    appliedFields.push('shirtNumber');
  } else if (registrationCount <= 1 && isFiniteNumber(stats.shirtNumber)
    && isFiniteNumber(record.shirtNumber) && stats.shirtNumber !== record.shirtNumber) {
    conflicts.push({ field: 'shirtNumber', kept: stats.shirtNumber, offered: record.shirtNumber });
  }

  const sourceEntry = {
    sourceId: record.sourceId,
    sourceName: source?.name ?? null,
    sourceUrl: source?.url ?? null,
    checkedAt: source?.checkedAt ?? null,
    clubId: record.clubId,
    matchedName: record.name,
    fieldsApplied: appliedFields,
    inactiveSince: record.inactiveSince ?? null,
  };

  const officialSources = Array.isArray(meta.clubOfficialSources) ? [...meta.clubOfficialSources] : [];
  const sourceKey = `${sourceEntry.sourceId}|${sourceEntry.clubId}|${normaliseEnrichmentText(sourceEntry.matchedName)}`;
  const duplicateIndex = officialSources.findIndex(item =>
    `${item?.sourceId}|${item?.clubId}|${normaliseEnrichmentText(item?.matchedName)}` === sourceKey
  );
  if (duplicateIndex >= 0) officialSources[duplicateIndex] = sourceEntry;
  else officialSources.push(sourceEntry);
  meta.clubOfficialSources = officialSources;

  if (conflicts.length) {
    meta.enrichmentConflicts = [
      ...(Array.isArray(meta.enrichmentConflicts) ? meta.enrichmentConflicts : []),
      ...conflicts.map(conflict => ({ ...conflict, sourceId: record.sourceId, clubId: record.clubId })),
    ];
  }
  if (appliedFields.length) meta.dataStatus = meta.dataStatus === 'verified' ? 'verified' : 'partially_verified';

  return {
    card: { ...card, position, nation, birthDate, stats, meta },
    appliedFields,
    conflicts,
  };
}

function matchRecord(cards, record) {
  const clubCandidates = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => cardClubIds(card).includes(record.clubId));

  const exact = clubCandidates.filter(({ card }) =>
    [record.name, ...(Array.isArray(record.aliases) ? record.aliases : [])]
      .some(name => sortedNameKey(card?.name) === sortedNameKey(name))
  );
  if (exact.length === 1) return exact[0].index;
  if (exact.length > 1) return null;

  const fuzzy = clubCandidates.filter(({ card }) => enrichmentNamesMatch(card?.name, record));
  return fuzzy.length === 1 ? fuzzy[0].index : null;
}

const coverage = cards => ({
  birthDate: cards.filter(card => !blank(card?.birthDate)).length,
  position: cards.filter(card => !blank(card?.position)).length,
  nation: cards.filter(card => !blank(card?.nation)).length,
  heightCm: cards.filter(card => isFiniteNumber(card?.stats?.heightCm)).length,
  shirtNumber: cards.filter(card => isFiniteNumber(card?.stats?.shirtNumber)).length,
});

export function applyClubEnrichmentPayload(payload, enrichment) {
  const rawCards = Array.isArray(payload) ? payload : payload?.players;
  if (!Array.isArray(rawCards) || !isObject(enrichment) || !Array.isArray(enrichment.records)) return payload;

  const cards = rawCards.map(card => ({ ...card, stats: { ...(card?.stats ?? {}) }, meta: { ...(card?.meta ?? {}) } }));
  const sources = sourceById(enrichment);
  const before = coverage(cards);
  const unmatchedRecords = [];
  const appliedFieldCounts = {};
  let matchedRecords = 0;
  let conflictCount = 0;

  for (const record of enrichment.records) {
    if (!record?.clubId || !record?.name || !record?.sourceId) {
      unmatchedRecords.push({ name: record?.name ?? null, clubId: record?.clubId ?? null, reason: 'invalid-record' });
      continue;
    }
    const index = matchRecord(cards, record);
    if (index == null) {
      unmatchedRecords.push({ name: record.name, clubId: record.clubId, reason: 'no-unique-player-match' });
      continue;
    }
    const merged = mergeRecord(cards[index], record, sources.get(record.sourceId));
    cards[index] = merged.card;
    matchedRecords += 1;
    conflictCount += merged.conflicts.length;
    for (const field of merged.appliedFields) appliedFieldCounts[field] = (appliedFieldCounts[field] ?? 0) + 1;
  }

  const after = coverage(cards);
  const summary = {
    schemaVersion: enrichment.schemaVersion ?? null,
    season: enrichment.season ?? null,
    generatedAt: enrichment.generatedAt ?? null,
    records: enrichment.records.length,
    matchedRecords,
    unmatchedRecords: unmatchedRecords.length,
    conflictCount,
    appliedFieldCounts,
    coverageBefore: before,
    coverageAfter: after,
    unmatched: unmatchedRecords,
  };

  if (Array.isArray(payload)) return cards;

  const { players: ignoredPlayers, ...basePayload } = payload;
  void ignoredPlayers;
  return {
    ...basePayload,
    selection: {
      ...(isObject(payload.selection) ? payload.selection : {}),
      exactBirthDates: after.birthDate,
    },
    coverage: { ...(isObject(payload.coverage) ? payload.coverage : {}), ...after },
    source: {
      ...(isObject(payload.source) ? payload.source : {}),
      clubOfficialEnrichment: (enrichment.sources ?? []).map(source => ({
        id: source.id,
        name: source.name,
        url: source.url,
        checkedAt: source.checkedAt,
      })),
    },
    enrichment: summary,
    players: cards,
  };
}
