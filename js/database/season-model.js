/** Strukturált, több szezonra bővíthető szezonazonosítás és validáció. */

export const SEASON_STATUS = Object.freeze({
  ARCHIVED: 'archived',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
});

const SEASON_STATUSES = new Set(Object.values(SEASON_STATUS));
const SEASON_ID_PATTERN = /^(\d{4})-(\d{2})$/;
const SEASON_LABEL_PATTERN = /^(\d{4})\s*[\/-]\s*(\d{2}|\d{4})$/;

const asText = value => typeof value === 'string' ? value.trim() : '';
const asInteger = value => Number.isInteger(Number(value)) ? Number(value) : null;
const asObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  ? value
  : {};

const resolveYearsFromId = seasonId => {
  const match = asText(seasonId).match(SEASON_ID_PATTERN);
  if (!match) return { startYear: null, endYear: null };
  const startYear = Number(match[1]);
  const endCentury = Math.floor(startYear / 100) * 100;
  let endYear = endCentury + Number(match[2]);
  if (endYear < startYear) endYear += 100;
  return { startYear, endYear };
};

const resolveYearsFromLabel = label => {
  const match = asText(label).match(SEASON_LABEL_PATTERN);
  if (!match) return { startYear: null, endYear: null };
  const startYear = Number(match[1]);
  const rawEnd = Number(match[2]);
  let endYear = match[2].length === 4 ? rawEnd : Math.floor(startYear / 100) * 100 + rawEnd;
  if (endYear < startYear) endYear += 100;
  return { startYear, endYear };
};

export function seasonIdFromYears(startYear, endYear) {
  const start = asInteger(startYear);
  const end = asInteger(endYear);
  if (start == null || end == null || end !== start + 1) return '';
  return `${start}-${String(end).slice(-2)}`;
}

export function deriveSeasonId(value) {
  const text = asText(value);
  if (SEASON_ID_PATTERN.test(text)) return text;
  const { startYear, endYear } = resolveYearsFromLabel(text);
  return seasonIdFromYears(startYear, endYear);
}

export function normaliseSeasonDefinition(value = {}, fallback = {}) {
  const input = typeof value === 'string' ? { label: value } : asObject(value);
  const defaults = asObject(fallback);
  const label = asText(input.label || input.name || defaults.label || defaults.name)
    || asText(typeof value === 'string' ? value : '');
  const explicitId = asText(input.id || input.seasonId || defaults.id || defaults.seasonId);
  const id = explicitId || deriveSeasonId(label);
  const idYears = resolveYearsFromId(id);
  const labelYears = resolveYearsFromLabel(label);
  const startYear = asInteger(input.startYear ?? defaults.startYear)
    ?? idYears.startYear
    ?? labelYears.startYear;
  const endYear = asInteger(input.endYear ?? defaults.endYear)
    ?? idYears.endYear
    ?? labelYears.endYear;
  const resolvedLabel = label || (startYear != null && endYear != null
    ? `${startYear}/${String(endYear).slice(-2)}`
    : id);
  const requestedStatus = asText(input.status || defaults.status);
  const status = SEASON_STATUSES.has(requestedStatus) ? requestedStatus : SEASON_STATUS.ARCHIVED;

  return Object.freeze({
    id: id || seasonIdFromYears(startYear, endYear),
    label: resolvedLabel,
    startYear,
    endYear,
    status,
    sortOrder: startYear != null && endYear != null ? startYear * 10000 + endYear : 0,
  });
}

export function validateSeasonDefinition(value = {}, fallback = {}) {
  const season = normaliseSeasonDefinition(value, fallback);
  const errors = [];
  if (!season.id || !SEASON_ID_PATTERN.test(season.id)) errors.push('érvénytelen szezonazonosító');
  if (!season.label) errors.push('hiányzó szezonfelirat');
  if (!Number.isInteger(season.startYear) || !Number.isInteger(season.endYear)) {
    errors.push('hiányzó szezonév-határok');
  } else if (season.endYear !== season.startYear + 1) {
    errors.push('a szezon végévének a kezdőévet követő évnek kell lennie');
  }
  if (!SEASON_STATUSES.has(season.status)) errors.push('érvénytelen szezonállapot');
  if (errors.length) throw new Error(`Hibás szezondefiníció: ${errors.join('; ')}`);
  return season;
}

export function createSeasonCardId(seasonId, playerId) {
  const season = deriveSeasonId(seasonId);
  const player = asText(playerId);
  return season && player ? `${season}:${player}` : player;
}

export function seasonStorageScope({ databaseId, competitionId, seasonId } = {}) {
  return [asText(databaseId), asText(competitionId), deriveSeasonId(seasonId)]
    .filter(Boolean)
    .join(':');
}
