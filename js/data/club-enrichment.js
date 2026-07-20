/**
 * Non-destructive enrichment of the original MLSZ-based player database.
 * Official club pages may only fill missing fields; existing MLSZ values always win.
 */

const isObject = value => value != null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const MISSING_TEXT_VALUES = new Set([
  '', '-', '–', '—', 'n/a', 'n.a.', 'na', 'null', 'undefined', 'ismeretlen', 'nincs adat',
]);
const blank = value => value == null
  || (typeof value === 'string' && MISSING_TEXT_VALUES.has(value.trim().toLocaleLowerCase('hu-HU')));
const usable = value => isFiniteNumber(value)
  || (typeof value === 'string' && !blank(value))
  || typeof value === 'boolean';
const comparable = value => {
  if (Array.isArray(value) || isObject(value)) return JSON.stringify(value);
  return value == null ? null : String(value).trim();
};

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

const recordKey = record => [record?.sourceId, record?.clubId, normaliseEnrichmentText(record?.name)].join('|');
const uniqueStrings = values => [...new Set(values.filter(value => typeof value === 'string' && value.trim()))];
const countBy = (values, keyFn) => values.reduce((acc, value) => {
  const key = keyFn(value);
  if (key) acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

/** Apply auditable corrections without altering any source snapshot. */
export function prepareClubEnrichment(enrichment, corrections) {
  if (!isObject(enrichment)) return enrichment;
  const safeCorrections = isObject(corrections) ? corrections : {};
  const rawRecords = Array.isArray(enrichment.records) ? enrichment.records : [];
  const excluded = new Map(
    (Array.isArray(safeCorrections.excludeRecords) ? safeCorrections.excludeRecords : [])
      .map(record => [recordKey(record), record])
  );
  const patches = new Map(
    (Array.isArray(safeCorrections.recordPatches) ? safeCorrections.recordPatches : [])
      .map(record => [recordKey(record), record])
  );

  const records = rawRecords
    .filter(record => !excluded.has(recordKey(record)))
    .map(record => {
      const patch = patches.get(recordKey(record));
      if (!patch) return record;
      return {
        ...record,
        ...patch,
        aliases: uniqueStrings([...(record.aliases ?? []), ...(patch.aliases ?? [])]),
        meta: { ...(record.meta ?? {}), ...(patch.meta ?? {}) },
      };
    });

  const sourceMap = new Map();
  for (const source of [...(enrichment.sources ?? []), ...(safeCorrections.addSources ?? [])]) {
    if (source?.id) sourceMap.set(source.id, source);
  }

  return {
    ...enrichment,
    sources: [...sourceMap.values()],
    records,
    additions: Array.isArray(safeCorrections.additions) ? safeCorrections.additions : [],
    excludedRecords: [...excluded.values()],
    rawRecordCountsByClub: countBy(rawRecords, record => record?.clubId),
    eligibleRecordCountsByClub: countBy(records, record => record?.clubId),
    corrections: {
      checkedAt: safeCorrections.checkedAt ?? null,
      recordPatches: patches.size,
      excludedRecords: excluded.size,
      additions: Array.isArray(safeCorrections.additions) ? safeCorrections.additions.length : 0,
    },
  };
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

const cloneCard = card => ({
  ...card,
  nation: blank(card?.nation) ? '' : card.nation.trim(),
  position: blank(card?.position) ? '' : card.position.trim(),
  birthDate: blank(card?.birthDate) ? null : card.birthDate,
  clubs: Array.isArray(card?.clubs) ? [...card.clubs] : card?.clubs,
  stats: { ...(card?.stats ?? {}) },
  meta: {
    ...(card?.meta ?? {}),
    clubIds: Array.isArray(card?.meta?.clubIds) ? [...card.meta.clubIds] : card?.meta?.clubIds,
    clubOfficial: { ...(card?.meta?.clubOfficial ?? {}) },
    clubShirtNumbers: { ...(card?.meta?.clubShirtNumbers ?? {}) },
  },
});

function addConflict(conflicts, field, kept, offered) {
  if (comparable(kept) !== comparable(offered)) conflicts.push({ field, kept, offered });
}

function mergeOfficialMeta(meta, recordMeta, record, conflicts, appliedFields) {
  if (!isObject(recordMeta)) return;
  const official = { ...(meta.clubOfficial ?? {}) };
  for (const [field, offered] of Object.entries(recordMeta)) {
    if (!usable(offered)) continue;
    const current = official[field];
    if (!usable(current)) {
      official[field] = offered;
      appliedFields.push(`meta.${field}`);
    } else {
      addConflict(conflicts, `meta.${field}`, current, offered);
    }
  }
  meta.clubOfficial = official;

  const byClub = { ...(meta.clubOfficialByClub ?? {}) };
  byClub[record.clubId] = { ...(byClub[record.clubId] ?? {}), ...recordMeta };
  meta.clubOfficialByClub = byClub;
}

function mergeRecord(card, record, source) {
  const stats = { ...(card.stats ?? {}) };
  const meta = { ...(card.meta ?? {}) };
  const appliedFields = [];
  const conflicts = [];
  let position = blank(card.position) ? '' : card.position;
  let nation = blank(card.nation) ? '' : card.nation;
  let birthDate = blank(card.birthDate) ? null : card.birthDate;

  if (blank(position) && !blank(record.position)) {
    position = record.position;
    appliedFields.push('position');
  } else if (!blank(record.position)) addConflict(conflicts, 'position', position, record.position);

  if (blank(nation) && !blank(record.nation)) {
    nation = record.nation;
    appliedFields.push('nation');
  } else if (!blank(record.nation)) addConflict(conflicts, 'nation', nation, record.nation);

  if (blank(birthDate) && !blank(record.birthDate)) {
    birthDate = record.birthDate;
    appliedFields.push('birthDate');
  } else if (!blank(record.birthDate)) addConflict(conflicts, 'birthDate', birthDate, record.birthDate);

  if (!isFiniteNumber(stats.heightCm) && isFiniteNumber(record.heightCm)) {
    stats.heightCm = record.heightCm;
    appliedFields.push('heightCm');
  } else if (isFiniteNumber(record.heightCm)) addConflict(conflicts, 'heightCm', stats.heightCm, record.heightCm);

  const registrationCount = Number(meta.registrationCount ?? cardClubIds(card).length ?? 1);
  if (isFiniteNumber(record.shirtNumber)) {
    const shirtNumbers = { ...(meta.clubShirtNumbers ?? {}) };
    if (!isFiniteNumber(shirtNumbers[record.clubId])) shirtNumbers[record.clubId] = record.shirtNumber;
    else addConflict(conflicts, `clubShirtNumbers.${record.clubId}`, shirtNumbers[record.clubId], record.shirtNumber);
    meta.clubShirtNumbers = shirtNumbers;

    if (registrationCount <= 1 && !isFiniteNumber(stats.shirtNumber)) {
      stats.shirtNumber = record.shirtNumber;
      appliedFields.push('shirtNumber');
    } else if (registrationCount <= 1) addConflict(conflicts, 'shirtNumber', stats.shirtNumber, record.shirtNumber);
  }

  mergeOfficialMeta(meta, record.meta, record, conflicts, appliedFields);

  const sourceEntry = {
    sourceId: record.sourceId,
    sourceName: source?.name ?? null,
    sourceUrl: source?.url ?? null,
    checkedAt: source?.checkedAt ?? null,
    season: source?.season ?? null,
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

  return { card: { ...card, position, nation, birthDate, stats, meta }, appliedFields, conflicts };
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

function mergeVerifiedCorrection(card, correction) {
  const next = cloneCard(card);
  const appliedFields = [];
  for (const field of ['nation', 'position', 'birthDate']) {
    if (blank(next[field]) && usable(correction[field])) {
      next[field] = correction[field];
      appliedFields.push(field);
    }
  }
  for (const [field, offered] of Object.entries(correction.stats ?? {})) {
    if (!usable(next.stats[field]) && usable(offered)) {
      next.stats[field] = offered;
      appliedFields.push(field);
    }
  }
  for (const field of [
    'sourceUrl', 'rosterSourceUrl', 'checkedAt', 'dataStatus', 'imageUrl',
    'birthDateSource', 'birthDateSourceName', 'dismissalBreakdown',
  ]) {
    if (!usable(next.meta[field]) && usable(correction.meta?.[field])) next.meta[field] = correction.meta[field];
  }
  next.meta.officialCorrection = {
    checkedAt: correction.meta?.checkedAt ?? null,
    sourceIds: uniqueStrings(correction.meta?.additionSourceIds ?? []),
    fieldsApplied: appliedFields,
    note: correction.meta?.sourceNotes ?? null,
  };
  if (appliedFields.length) next.meta.dataStatus = correction.meta?.dataStatus ?? 'verified';
  return { card: next, appliedFields };
}

function appendAdditions(cards, additions) {
  const added = [];
  const updated = [];
  const skipped = [];
  for (const addition of Array.isArray(additions) ? additions : []) {
    if (!addition?.id || !addition?.name || !addition?.club || !addition?.meta?.clubId) {
      skipped.push({ id: addition?.id ?? null, name: addition?.name ?? null, reason: 'invalid-addition' });
      continue;
    }
    const duplicateIndex = cards.findIndex(card => card.id === addition.id
      || (cardClubIds(card).includes(addition.meta.clubId) && enrichmentNamesMatch(card.name, addition)));
    if (duplicateIndex >= 0) {
      const merged = mergeVerifiedCorrection(cards[duplicateIndex], addition);
      cards[duplicateIndex] = merged.card;
      updated.push({
        id: cards[duplicateIndex].id,
        name: cards[duplicateIndex].name,
        correctionId: addition.id,
        fieldsApplied: merged.appliedFields,
      });
      continue;
    }
    const card = cloneCard(addition);
    cards.push(card);
    added.push(card);
  }
  return { added, updated, skipped };
}

const coverage = cards => ({
  birthDate: cards.filter(card => !blank(card?.birthDate)).length,
  appearances: cards.filter(card => isFiniteNumber(card?.stats?.appearances)).length,
  starts: cards.filter(card => isFiniteNumber(card?.stats?.starts)).length,
  goals: cards.filter(card => isFiniteNumber(card?.stats?.goals)).length,
  squads: cards.filter(card => isFiniteNumber(card?.stats?.squads)).length,
  yellowCards: cards.filter(card => isFiniteNumber(card?.stats?.yellowCards)).length,
  redCards: cards.filter(card => isFiniteNumber(card?.stats?.redCards)).length,
  totalDismissals: cards.filter(card => isFiniteNumber(card?.stats?.totalDismissals)).length,
  overallScore: cards.filter(card => isFiniteNumber(card?.stats?.overallScore)).length,
  position: cards.filter(card => !blank(card?.position)).length,
  nation: cards.filter(card => !blank(card?.nation)).length,
  heightCm: cards.filter(card => isFiniteNumber(card?.stats?.heightCm)).length,
  shirtNumber: cards.filter(card => isFiniteNumber(card?.stats?.shirtNumber)).length,
  officialMetadata: cards.filter(card => Object.keys(card?.meta?.clubOfficial ?? {}).length > 0).length,
});

const selectionSummary = (cards, previous = {}) => ({
  ...previous,
  playableCards: cards.length,
  uniquePlayers: new Set(cards.map(card => card?.meta?.personKey ?? card?.id)).size,
  registrationRecords: cards.reduce((sum, card) => sum
    + Math.max(1, Number(card?.meta?.registrationCount ?? cardClubIds(card).length ?? 1)), 0),
  multiClubPlayers: cards.filter(card => Number(card?.meta?.registrationCount ?? cardClubIds(card).length) > 1).length,
  completeGoalTotals: cards.filter(card => isFiniteNumber(card?.stats?.goals)).length,
});

function buildClubSummary(cards, enrichment, matchedByClub, unmatchedByClub) {
  const directory = Array.isArray(enrichment.clubDirectory) ? enrichment.clubDirectory : [];
  const directoryById = new Map(directory.map(club => [club.clubId, club]));
  const sourceByClub = new Map((enrichment.sources ?? []).map(source => [source.clubId, source]));
  const clubIds = new Set([
    ...cards.flatMap(cardClubIds),
    ...Object.keys(enrichment.rawRecordCountsByClub ?? {}),
    ...directory.map(club => club.clubId),
  ]);
  const excludedByClub = countBy(enrichment.excludedRecords ?? [], record => record?.clubId);

  return [...clubIds].sort().map(clubId => {
    const directoryEntry = directoryById.get(clubId);
    const source = sourceByClub.get(clubId);
    const mlszCards = cards.filter(card => cardClubIds(card).includes(clubId)).length;
    return {
      clubId,
      clubName: directoryEntry?.clubName ?? source?.clubName
        ?? cards.find(card => cardClubIds(card).includes(clubId))?.club ?? clubId,
      mlszCards,
      officialRecords: enrichment.rawRecordCountsByClub?.[clubId] ?? 0,
      eligibleRecords: enrichment.eligibleRecordCountsByClub?.[clubId] ?? 0,
      matched: matchedByClub[clubId] ?? 0,
      excluded: excludedByClub[clubId] ?? 0,
      review: unmatchedByClub[clubId] ?? 0,
      sourceStatus: directoryEntry?.status ?? null,
      officialRosterUrl: directoryEntry?.officialRosterUrl ?? source?.url ?? null,
    };
  });
}

export function applyClubEnrichmentPayload(payload, enrichment) {
  const rawCards = Array.isArray(payload) ? payload : payload?.players;
  if (!Array.isArray(rawCards) || !isObject(enrichment) || !Array.isArray(enrichment.records)) return payload;

  const cards = rawCards.map(cloneCard);
  const before = coverage(cards);
  const additionResult = appendAdditions(cards, enrichment.additions);
  const sources = sourceById(enrichment);
  const unmatchedRecords = [];
  const appliedFieldCounts = {};
  const matchedByClub = {};
  const unmatchedByClub = {};
  let matchedRecords = 0;
  let conflictCount = 0;

  for (const record of enrichment.records) {
    if (!record?.clubId || !record?.name || !record?.sourceId) {
      unmatchedRecords.push({ name: record?.name ?? null, clubId: record?.clubId ?? null, reason: 'invalid-record' });
      if (record?.clubId) unmatchedByClub[record.clubId] = (unmatchedByClub[record.clubId] ?? 0) + 1;
      continue;
    }
    const index = matchRecord(cards, record);
    if (index == null) {
      unmatchedRecords.push({
        name: record.name,
        clubId: record.clubId,
        sourceId: record.sourceId,
        reason: 'no-unique-player-match',
      });
      unmatchedByClub[record.clubId] = (unmatchedByClub[record.clubId] ?? 0) + 1;
      continue;
    }
    const merged = mergeRecord(cards[index], record, sources.get(record.sourceId));
    cards[index] = merged.card;
    matchedRecords += 1;
    matchedByClub[record.clubId] = (matchedByClub[record.clubId] ?? 0) + 1;
    conflictCount += merged.conflicts.length;
    for (const field of merged.appliedFields) appliedFieldCounts[field] = (appliedFieldCounts[field] ?? 0) + 1;
  }

  const after = coverage(cards);
  const fieldCoverage = Object.keys(after).map(field => ({
    field,
    before: before[field] ?? 0,
    after: after[field] ?? 0,
    added: (after[field] ?? 0) - (before[field] ?? 0),
  }));
  const summary = {
    schemaVersion: enrichment.schemaVersion ?? null,
    season: enrichment.season ?? null,
    generatedAt: enrichment.generatedAt ?? null,
    records: enrichment.records.length,
    matchedRecords,
    unmatchedRecords: unmatchedRecords.length,
    excludedRecords: Array.isArray(enrichment.excludedRecords) ? enrichment.excludedRecords.length : 0,
    correctionsRequested: Array.isArray(enrichment.additions) ? enrichment.additions.length : 0,
    addedPlayers: additionResult.added.length,
    updatedExistingPlayers: additionResult.updated.length,
    updatedPlayers: additionResult.updated,
    skippedCorrections: additionResult.skipped,
    conflictCount,
    appliedFieldCounts,
    coverageBefore: before,
    coverageAfter: after,
    fieldCoverage,
    clubSummary: buildClubSummary(cards, enrichment, matchedByClub, unmatchedByClub),
    manualReview: unmatchedRecords,
    unmatched: unmatchedRecords,
  };

  if (Array.isArray(payload)) return cards;
  const { players: ignoredPlayers, ...basePayload } = payload;
  void ignoredPlayers;
  const clubCounts = { ...(isObject(payload.clubs) ? payload.clubs : {}) };
  for (const card of additionResult.added) {
    for (const clubName of Array.isArray(card.clubs) && card.clubs.length ? card.clubs : [card.club]) {
      clubCounts[clubName] = (clubCounts[clubName] ?? 0) + 1;
    }
  }

  return {
    ...basePayload,
    clubs: clubCounts,
    selection: {
      ...selectionSummary(cards, isObject(payload.selection) ? payload.selection : {}),
      exactBirthDates: after.birthDate,
    },
    coverage: { ...(isObject(payload.coverage) ? payload.coverage : {}), ...after },
    source: {
      ...(isObject(payload.source) ? payload.source : {}),
      officialClubDirectory: enrichment.clubDirectory ?? [],
      clubOfficialEnrichment: (enrichment.sources ?? []).map(source => ({
        id: source.id,
        clubId: source.clubId,
        clubName: source.clubName,
        name: source.name,
        url: source.url,
        checkedAt: source.checkedAt,
        season: source.season ?? enrichment.season ?? null,
      })),
    },
    enrichment: summary,
    players: cards,
  };
}
