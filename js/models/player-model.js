const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NATIONALITY_CODE = /^[A-Z]{3}( \/ [A-Z]{3})*$/;
const PLACEHOLDER_VALUES = new Set([
  '', '-', '–', '—', 'n/a', 'n.a.', 'na', 'null', 'undefined', 'ismeretlen', 'nincs adat',
]);

export const PLAYER_MODEL_VERSION = 1;
export const DEFAULT_PLAYER_REFERENCE_DATE = new Date('2026-05-16T00:00:00Z');

export const CANONICAL_PLAYER_FIELDS = Object.freeze([
  'id',
  'name',
  'displayName',
  'firstName',
  'lastName',
  'dateOfBirth',
  'age',
  'nationality',
  'nationalityCode',
  'clubId',
  'clubName',
  'position',
  'heightCm',
  'marketValue',
  'appearances',
  'minutesPlayed',
  'goals',
  'assists',
  'yellowCards',
  'redCards',
  'cleanSheets',
  'penaltiesScored',
  'penaltiesMissed',
  'image',
  'season',
  'competition',
  'source',
  'sourceUrl',
  'lastUpdated',
  'dataCompleteness',
]);

export const REQUIRED_PLAYER_FIELDS = Object.freeze(['id', 'name', 'clubName']);

const COMPLETENESS_FIELDS = Object.freeze([
  'id',
  'name',
  'displayName',
  'dateOfBirth',
  'age',
  'nationalityCode',
  'clubId',
  'clubName',
  'position',
  'heightCm',
  'appearances',
  'minutesPlayed',
  'goals',
  'assists',
  'yellowCards',
  'redCards',
]);

const NUMERIC_PLAYER_FIELDS = Object.freeze([
  'age',
  'heightCm',
  'marketValue',
  'appearances',
  'minutesPlayed',
  'goals',
  'assists',
  'yellowCards',
  'redCards',
  'cleanSheets',
  'penaltiesScored',
  'penaltiesMissed',
]);

function meaningfulText(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (PLACEHOLDER_VALUES.has(text.toLocaleLowerCase('hu-HU'))) return null;
  return text;
}

function firstText(...values) {
  for (const value of values) {
    const text = meaningfulText(value);
    if (text != null) return text;
  }
  return null;
}

function finiteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(',', '.');
  if (!text || PLACEHOLDER_VALUES.has(text.toLocaleLowerCase('hu-HU'))) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number != null) return number;
  }
  return null;
}

function validIsoDate(value) {
  const text = meaningfulText(value);
  if (!text || !ISO_DATE.test(text)) return null;
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day) return null;
  return text;
}

export function calculateModelAge(dateOfBirth, reference = DEFAULT_PLAYER_REFERENCE_DATE) {
  const iso = validIsoDate(dateOfBirth);
  const date = reference instanceof Date ? reference : new Date(reference);
  if (!iso || !Number.isFinite(date.getTime())) return null;
  const [year, month, day] = iso.split('-').map(Number);
  let age = date.getUTCFullYear() - year;
  const beforeBirthday = date.getUTCMonth() + 1 < month
    || (date.getUTCMonth() + 1 === month && date.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function canonicalStat(card, ...keys) {
  const stats = card?.stats && typeof card.stats === 'object' ? card.stats : {};
  const values = [];
  for (const key of keys) {
    values.push(stats[key], card?.[key]);
  }
  return firstNumber(...values);
}

function resolveNationalityCode(card) {
  const explicit = firstText(card?.nationalityCode);
  if (explicit) return explicit.toLocaleUpperCase('hu-HU');
  const nation = firstText(card?.nation);
  return nation && NATIONALITY_CODE.test(nation.toLocaleUpperCase('hu-HU'))
    ? nation.toLocaleUpperCase('hu-HU')
    : null;
}

function resolveSource(card, context) {
  return firstText(
    card?.source,
    card?.meta?.sourceDataset,
    context?.source?.datasetId,
    context?.source?.primary,
  );
}

function resolveLastUpdated(card, context) {
  return firstText(
    card?.lastUpdated,
    card?.meta?.checkedAt,
    context?.generatedAt,
    context?.source?.generatedAt,
  );
}

function isKnown(value) {
  if (value == null) return false;
  if (typeof value === 'string') return meaningfulText(value) != null;
  return true;
}

export function calculateDataCompleteness(player) {
  const missingFields = COMPLETENESS_FIELDS.filter(field => !isKnown(player?.[field]));
  const knownFields = COMPLETENESS_FIELDS.length - missingFields.length;
  return {
    knownFields,
    totalFields: COMPLETENESS_FIELDS.length,
    ratio: Number((knownFields / COMPLETENESS_FIELDS.length).toFixed(4)),
    missingFields,
  };
}

export function normalisePlayerRecord(card = {}, context = {}) {
  const stats = card?.stats && typeof card.stats === 'object' ? card.stats : {};
  const dateOfBirth = validIsoDate(card.dateOfBirth ?? card.birthDate);
  const age = calculateModelAge(dateOfBirth, context.referenceDate ?? DEFAULT_PLAYER_REFERENCE_DATE);
  const nationalityCode = resolveNationalityCode(card);
  const nationality = firstText(card.nationality, card.nation, nationalityCode);
  const clubName = firstText(card.clubName, card.club);
  const clubId = firstText(card.clubId, card.meta?.clubId, card.meta?.clubIds?.[0]);
  const displayName = firstText(card.displayName, card.shortName, card.knownAs, card.name);
  const season = firstText(card.season, context.season);
  const competition = firstText(card.competition, context.competition);

  const modelled = {
    ...card,
    playerModelVersion: PLAYER_MODEL_VERSION,
    displayName,
    firstName: firstText(card.firstName),
    lastName: firstText(card.lastName),
    dateOfBirth,
    age,
    nationality,
    nationalityCode,
    clubId,
    clubName,
    position: firstText(card.position),
    heightCm: firstNumber(card.heightCm, stats.heightCm, stats.height),
    marketValue: firstNumber(card.marketValue, stats.marketValue, stats.marketValueEur),
    appearances: canonicalStat(card, 'appearances', 'matches', 'games'),
    minutesPlayed: firstNumber(card.minutesPlayed, card.minutes, stats.minutesPlayed, stats.playingMinutes, stats.minutes),
    goals: canonicalStat(card, 'goals'),
    assists: canonicalStat(card, 'assists', 'goalAssists'),
    yellowCards: canonicalStat(card, 'yellowCards', 'yellows'),
    redCards: canonicalStat(card, 'redCards', 'dismissals'),
    cleanSheets: canonicalStat(card, 'cleanSheets'),
    penaltiesScored: canonicalStat(card, 'penaltiesScored'),
    penaltiesMissed: canonicalStat(card, 'penaltiesMissed'),
    image: firstText(card.image, card.imageUrl, card.meta?.imageUrl),
    season,
    competition,
    source: resolveSource(card, context),
    sourceUrl: firstText(card.sourceUrl, card.meta?.sourceUrl),
    lastUpdated: resolveLastUpdated(card, context),
  };

  modelled.dataCompleteness = calculateDataCompleteness(modelled);
  return modelled;
}

export function validatePlayerRecord(player, { index = null } = {}) {
  const prefix = index == null ? 'player' : `player ${index}`;
  const errors = [];
  const warnings = [];
  const information = [];

  for (const field of REQUIRED_PLAYER_FIELDS) {
    if (!isKnown(player?.[field])) errors.push(`${prefix}: missing ${field}`);
  }

  if (player?.dateOfBirth != null && !validIsoDate(player.dateOfBirth)) {
    errors.push(`${prefix}: invalid dateOfBirth`);
  }

  for (const field of NUMERIC_PLAYER_FIELDS) {
    const value = player?.[field];
    if (value == null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${prefix}: invalid ${field}`);
    } else if (value < 0) {
      errors.push(`${prefix}: negative ${field}`);
    }
  }

  for (const field of ['dateOfBirth', 'nationalityCode', 'clubId', 'position']) {
    if (!isKnown(player?.[field])) warnings.push(`${prefix}: missing ${field}`);
  }

  const completeness = player?.dataCompleteness ?? calculateDataCompleteness(player);
  information.push(`${prefix}: completeness ${Math.round(completeness.ratio * 100)}%`);
  return { errors, warnings, information };
}

export function validatePlayerPayload(players) {
  const list = Array.isArray(players) ? players : [];
  const errors = [];
  const warnings = [];
  const information = [];

  list.forEach((player, index) => {
    const result = validatePlayerRecord(player, { index });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    information.push(...result.information);
  });

  const ids = list.map(player => player?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push('duplicate player ids');

  return {
    errors,
    warnings,
    information,
    summary: {
      playerCount: list.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      informationCount: information.length,
    },
  };
}

export function normalisePlayerPayload(payload, options = {}) {
  const sourcePayload = Array.isArray(payload) ? { players: payload } : (payload ?? {});
  const context = {
    season: sourcePayload.season ?? options.database?.season ?? options.season,
    competition: sourcePayload.competition ?? options.database?.competition ?? options.competition,
    generatedAt: sourcePayload.generatedAt,
    source: sourcePayload.source,
    referenceDate: options.referenceDate ?? DEFAULT_PLAYER_REFERENCE_DATE,
  };
  const players = Array.isArray(sourcePayload.players)
    ? sourcePayload.players.map(card => normalisePlayerRecord(card, context))
    : [];
  const validation = validatePlayerPayload(players);

  return {
    ...sourcePayload,
    players,
    playerModel: {
      version: PLAYER_MODEL_VERSION,
      canonicalFields: CANONICAL_PLAYER_FIELDS,
      requiredFields: REQUIRED_PLAYER_FIELDS,
      validation: validation.summary,
    },
  };
}
