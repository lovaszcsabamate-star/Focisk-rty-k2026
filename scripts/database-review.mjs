import fs from 'node:fs';
import path from 'node:path';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const blank = value => value == null || (typeof value === 'string' && value.trim() === '');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REVIEW_FIELDS = [
  ['birthDate', card => card?.birthDate],
  ['nation', card => card?.nation],
  ['position', card => card?.position],
  ['appearances', card => card?.stats?.appearances],
  ['starts', card => card?.stats?.starts],
  ['minutes', card => card?.stats?.minutes],
  ['goals', card => card?.stats?.goals],
  ['assists', card => card?.stats?.assists],
  ['squads', card => card?.stats?.squads],
  ['yellowCards', card => card?.stats?.yellowCards],
  ['redCards', card => card?.stats?.redCards],
  ['secondYellowRedCards', card => card?.stats?.secondYellowRedCards],
  ['totalDismissals', card => card?.stats?.totalDismissals],
  ['heightCm', card => card?.stats?.heightCm],
  ['shirtNumber', card => card?.stats?.shirtNumber],
];
const NUMERIC_FIELDS = REVIEW_FIELDS
  .filter(([field]) => !['birthDate', 'nation', 'position'].includes(field))
  .map(([field]) => field);

function normaliseName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleUpperCase('hu-HU')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function domainOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLocaleLowerCase('hu-HU');
  } catch {
    return null;
  }
}

function cardClubIds(card) {
  if (Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length) return card.meta.clubIds;
  return [card?.meta?.clubId].filter(Boolean);
}

function isKnown(field, value) {
  if (['birthDate', 'nation', 'position'].includes(field)) return !blank(value);
  return finite(value);
}

function issue(type, card, details = {}) {
  return {
    type,
    playerId: card?.id ?? null,
    playerName: card?.name ?? null,
    club: card?.club ?? null,
    ...details,
  };
}

function collectChanges(card) {
  const changes = [];
  for (const source of Array.isArray(card?.meta?.clubOfficialSources) ? card.meta.clubOfficialSources : []) {
    for (const field of Array.isArray(source?.fieldsApplied) ? source.fieldsApplied : []) {
      changes.push({
        playerId: card.id,
        playerName: card.name,
        clubId: source.clubId ?? null,
        field,
        sourceId: source.sourceId ?? null,
        sourceName: source.sourceName ?? null,
        sourceUrl: source.sourceUrl ?? null,
        checkedAt: source.checkedAt ?? null,
        changeType: 'missing-field-enrichment',
        confidence: 'high',
      });
    }
  }
  for (const field of Array.isArray(card?.meta?.officialCorrection?.fieldsApplied)
    ? card.meta.officialCorrection.fieldsApplied : []) {
    changes.push({
      playerId: card.id,
      playerName: card.name,
      clubId: card?.meta?.clubId ?? null,
      field,
      sourceId: null,
      sourceName: 'igazolt korrekció',
      sourceUrl: card?.meta?.sourceUrl ?? null,
      checkedAt: card?.meta?.officialCorrection?.checkedAt ?? card?.meta?.checkedAt ?? null,
      changeType: 'verified-correction',
      confidence: 'high',
    });
  }
  for (const source of Array.isArray(card?.meta?.officialStatSources) ? card.meta.officialStatSources : []) {
    for (const field of Array.isArray(source?.fieldsApplied) ? source.fieldsApplied : []) {
      changes.push({
        playerId: card.id,
        playerName: card.name,
        clubId: source.clubId ?? null,
        field: `stats.${field}`,
        sourceId: source.sourceId ?? null,
        sourceName: source.sourceName ?? 'hivatalos szezonstatisztika',
        sourceUrl: source.sourceUrl ?? null,
        checkedAt: source.checkedAt ?? null,
        changeType: 'official-stat-enrichment',
        confidence: 'high',
      });
    }
  }
  return changes;
}

export function auditReviewedDatabase(payload, options = {}) {
  const players = Array.isArray(payload) ? payload : payload?.players;
  if (!Array.isArray(players)) throw new Error('A felülvizsgálandó adatbázis játékoslistája hibás.');

  const errors = [];
  const warnings = [];
  const conflicts = [];
  const changes = [];
  const duplicateCandidates = [];
  const ids = new Map();
  const personKeys = new Map();
  const namesByClub = new Map();
  const missingByField = Object.fromEntries(REVIEW_FIELDS.map(([field]) => [field, []]));
  const seasonEnd = Date.UTC(2026, 4, 16);

  for (const card of players) {
    if (blank(card?.id)) errors.push(issue('missing-id', card));
    if (blank(card?.name)) errors.push(issue('missing-name', card));
    if (blank(card?.club)) errors.push(issue('missing-club', card));

    if (!blank(card?.id)) {
      if (ids.has(card.id)) errors.push(issue('duplicate-id', card, { duplicateOf: ids.get(card.id) }));
      else ids.set(card.id, card.name);
    }
    const personKey = card?.meta?.personKey;
    if (!blank(personKey)) {
      if (personKeys.has(personKey)) errors.push(issue('duplicate-person-key', card, { duplicateOf: personKeys.get(personKey) }));
      else personKeys.set(personKey, card.id);
    } else {
      warnings.push(issue('missing-person-key', card));
    }

    const clubIds = cardClubIds(card);
    if (!clubIds.length) errors.push(issue('missing-club-id', card));
    for (const clubId of clubIds) {
      const key = `${clubId}|${normaliseName(card?.name)}`;
      if (namesByClub.has(key)) {
        duplicateCandidates.push({
          clubId,
          normalizedName: normaliseName(card.name),
          playerIds: [namesByClub.get(key), card.id],
        });
      } else namesByClub.set(key, card.id);
    }

    if (!blank(card?.birthDate)) {
      if (!validIsoDate(card.birthDate)) errors.push(issue('invalid-birth-date', card, { value: card.birthDate }));
      else if (Date.parse(`${card.birthDate}T00:00:00Z`) > seasonEnd) {
        errors.push(issue('birth-date-after-season', card, { value: card.birthDate }));
      }
    }

    for (const field of NUMERIC_FIELDS) {
      const value = card?.stats?.[field];
      if (value != null && !finite(value)) errors.push(issue('non-numeric-stat', card, { field, value }));
      if (finite(value) && value < 0) errors.push(issue('negative-stat', card, { field, value }));
    }
    if (!finite(card?.stats?.goals)) errors.push(issue('missing-required-goals', card));
    if (finite(card?.stats?.starts) && finite(card?.stats?.appearances)
      && card.stats.starts > card.stats.appearances) {
      errors.push(issue('starts-exceed-appearances', card, {
        starts: card.stats.starts,
        appearances: card.stats.appearances,
      }));
    }
    if (finite(card?.stats?.redCards) && finite(card?.stats?.totalDismissals)
      && card.stats.totalDismissals < card.stats.redCards) {
      errors.push(issue('dismissals-below-red-cards', card, {
        redCards: card.stats.redCards,
        totalDismissals: card.stats.totalDismissals,
      }));
    }
    if (finite(card?.stats?.heightCm) && (card.stats.heightCm < 140 || card.stats.heightCm > 220)) {
      warnings.push(issue('unusual-height', card, { value: card.stats.heightCm }));
    }
    if (finite(card?.stats?.shirtNumber)
      && (!Number.isInteger(card.stats.shirtNumber) || card.stats.shirtNumber < 1 || card.stats.shirtNumber > 99)) {
      warnings.push(issue('unusual-shirt-number', card, { value: card.stats.shirtNumber }));
    }

    for (const [field, getter] of REVIEW_FIELDS) {
      if (!isKnown(field, getter(card))) missingByField[field].push(card.id);
    }
    if (blank(card?.meta?.sourceUrl)
      && !(Array.isArray(card?.meta?.clubOfficialSources) && card.meta.clubOfficialSources.length)) {
      warnings.push(issue('missing-source-reference', card));
    }

    for (const conflict of Array.isArray(card?.meta?.enrichmentConflicts) ? card.meta.enrichmentConflicts : []) {
      conflicts.push({ playerId: card.id, playerName: card.name, ...conflict });
    }
    changes.push(...collectChanges(card));
  }

  const directoryClubs = Array.isArray(options?.directory?.clubs) ? options.directory.clubs : [];
  const directoryById = new Map(directoryClubs.map(club => [club.clubId, club]));
  const allClubIds = [...new Set(players.flatMap(cardClubIds))].sort();
  for (const clubId of allClubIds) {
    if (!directoryById.has(clubId)) errors.push({ type: 'missing-club-directory-entry', clubId });
  }

  const sourceReview = directoryClubs.map(club => {
    const officialDomain = domainOf(club.officialUrl);
    const rosterDomain = domainOf(club.officialRosterUrl);
    const crossDomain = Boolean(officialDomain && rosterDomain && officialDomain !== rosterDomain);
    if (!officialDomain) errors.push({ type: 'invalid-official-club-url', clubId: club.clubId, value: club.officialUrl ?? null });
    if (!rosterDomain) warnings.push({ type: 'invalid-roster-source-url', clubId: club.clubId, value: club.officialRosterUrl ?? null });
    if (crossDomain) warnings.push({
      type: 'cross-domain-roster-source',
      clubId: club.clubId,
      officialDomain,
      rosterDomain,
      note: 'A szezonforrás nem a klub elsődleges domainjén található; a forrás jellegét külön dokumentálni kell.',
    });
    return {
      clubId: club.clubId,
      clubName: club.clubName,
      status: club.status ?? null,
      officialUrl: club.officialUrl ?? null,
      officialRosterUrl: club.officialRosterUrl ?? null,
      officialCurrentRosterUrl: club.officialCurrentRosterUrl ?? null,
      historicalRosterSourceUrl: club.historicalRosterSourceUrl ?? null,
      officialDomain,
      rosterDomain,
      crossDomain,
      recordFiles: club.recordFiles ?? [],
      note: club.note ?? null,
    };
  });

  const clubCoverage = directoryClubs.map(club => {
    const cards = players.filter(card => cardClubIds(card).includes(club.clubId));
    const coverage = Object.fromEntries(REVIEW_FIELDS.map(([field, getter]) => [
      field,
      cards.filter(card => isKnown(field, getter(card))).length,
    ]));
    return {
      clubId: club.clubId,
      clubName: club.clubName,
      players: cards.length,
      coverage,
      missing: Object.fromEntries(Object.entries(coverage).map(([field, count]) => [field, cards.length - count])),
    };
  });

  const coverage = Object.fromEntries(REVIEW_FIELDS.map(([field]) => [
    field,
    players.length - missingByField[field].length,
  ]));

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    season: payload?.season ?? null,
    competition: payload?.competition ?? null,
    sourceDataset: payload?.source?.datasetId ?? null,
    sourceDatasetVersion: payload?.source?.version ?? null,
    sourceFiles: options.sourceFiles ?? [],
    summary: {
      players: players.length,
      uniqueIds: ids.size,
      uniquePersonKeys: personKeys.size,
      registrationRecords: payload?.selection?.registrationRecords ?? null,
      clubs: allClubIds.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      duplicateCandidateCount: duplicateCandidates.length,
      conflictCount: conflicts.length,
      changeCount: changes.length,
      exactBirthDates: coverage.birthDate,
      completeGoals: coverage.goals,
    },
    coverage,
    missingCounts: Object.fromEntries(Object.entries(missingByField).map(([field, idsForField]) => [field, idsForField.length])),
    missingByField,
    clubCoverage,
    sourceReview,
    errors,
    warnings,
    duplicateCandidates,
    conflicts,
    changes,
  };
}

export function buildDatabaseReviewMarkdown(audit) {
  const coverageRows = Object.entries(audit.coverage)
    .map(([field, count]) => `| ${field} | ${count} | ${audit.summary.players - count} |`);
  const clubRows = audit.clubCoverage.map(club => [
    club.clubName,
    club.players,
    club.coverage.birthDate,
    club.coverage.position,
    club.coverage.nation,
    club.coverage.appearances,
    club.coverage.minutes,
    club.coverage.assists,
  ].map(value => ` ${value} `).join('|'));
  const sourceWarnings = audit.sourceReview
    .filter(source => source.crossDomain)
    .map(source => `- **${source.clubName}:** a szezonforrás domainje (${source.rosterDomain}) eltér a klub hivatalos domainjétől (${source.officialDomain}).`);

  return [
    '# Fociskártyák 2026 – adatbázis-felülvizsgálat',
    '',
    `Generálva: ${audit.generatedAt}`,
    '',
    '## Összefoglaló',
    '',
    `- Játékoskártyák: **${audit.summary.players}**`,
    `- Klubregisztrációk: **${audit.summary.registrationRecords ?? 'nincs adat'}**`,
    `- Pontos születési dátum: **${audit.summary.exactBirthDates}/${audit.summary.players}**`,
    `- Változásnapló-bejegyzések: **${audit.summary.changeCount}**`,
    `- Megőrzött forrásütközések: **${audit.summary.conflictCount}**`,
    `- Kritikus hibák: **${audit.summary.errorCount}**`,
    `- Figyelmeztetések: **${audit.summary.warningCount}**`,
    '',
    '## Mezőlefedettség',
    '',
    '| Mező | Ismert | Hiányzó |',
    '|---|---:|---:|',
    ...coverageRows,
    '',
    '## Klubonkénti lefedettség',
    '',
    '| Klub | Játékos | Születési dátum | Poszt | Nemzetiség | Mérkőzés | Perc | Gólpassz |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...clubRows.map(row => `|${row}|`),
    '',
    '## Forráskezelési megjegyzések',
    '',
    ...(sourceWarnings.length ? sourceWarnings : ['- Nem található eltérő domainen tárolt szezonforrás.']),
    '',
    'Az eltérő domainű történeti szezonforrások adatai nem kerülnek automatikusan felülírva aktuális keretoldalakkal. Az aktuális és a 2025/26-os történeti forrást külön kell nyilvántartani.',
    '',
    '## Kritikus hibák',
    '',
    ...(audit.errors.length ? audit.errors.map(item => `- ${item.type}: ${item.playerName ?? item.clubId ?? item.playerId ?? 'ismeretlen rekord'}`) : ['- Nem található kritikus szerkezeti hiba.']),
    '',
    '## További kézi ellenőrzés',
    '',
    '- A hiányzó mezők játékosazonosítói a `data/missing-player-data-reviewed.json` fájlban találhatók.',
    '- A forrásból megőrzött eltérések és a hozzáadott mezők a `data/database-changelog.json` fájlban követhetők.',
    '- Hiányzó adat nem tekinthető nullának vagy nulla statisztikának; a játék ezeket a kategóriából kizárja.',
    '',
  ].join('\n');
}

export function writeDatabaseReviewFiles(root, payload, audit) {
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'players-reviewed.json'), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.join(dataDir, 'database-review.json'), `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(path.join(dataDir, 'database-review.md'), buildDatabaseReviewMarkdown(audit));
  fs.writeFileSync(path.join(dataDir, 'database-changelog.json'), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: audit.generatedAt,
    sourceDataset: audit.sourceDataset,
    sourceDatasetVersion: audit.sourceDatasetVersion,
    changes: audit.changes,
    conflicts: audit.conflicts,
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(dataDir, 'missing-player-data-reviewed.json'), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: audit.generatedAt,
    playerCount: audit.summary.players,
    missingCounts: audit.missingCounts,
    missingByField: audit.missingByField,
    clubCoverage: audit.clubCoverage,
  }, null, 2)}\n`);
}
