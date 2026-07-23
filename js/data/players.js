/**
 * NB I card data contract, normalisation and centrally configured comparison categories.
 *
 * Real card fields are never guessed. Unknown values stay `null`; categories are enabled
 * only when the loaded database contains enough valid values, and cards without a valid
 * value cannot be used in that comparison.
 */

import { CATEGORY_MINIMUM_COVERAGE, CATEGORY_RATE_MINUTES, createCategoryRegistry } from './categories.js';

const PLACEHOLDER_VALUES = new Set([
  '', '-', '–', '—', 'n/a', 'n.a.', 'na', 'null', 'undefined', 'ismeretlen', 'nincs adat',
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const firstValid = values => values.find(value => value != null) ?? null;

export const SEASON_REFERENCE_DATE = new Date('2026-05-16T00:00:00Z');
export const MIN_MINUTES_FOR_RATE_STATS = CATEGORY_RATE_MINUTES;
export const MIN_CATEGORY_COVERAGE = CATEGORY_MINIMUM_COVERAGE;

export function normaliseNumber(value) {
  if (isFiniteNumber(value)) return value;
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (PLACEHOLDER_VALUES.has(raw.toLocaleLowerCase('hu-HU'))) return null;

  let cleaned = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[€$£¥₽₿]/g, '')
    .replace(/(?:eur|huf|ft)$/i, '');

  let multiplier = 1;
  const suffix = cleaned.match(/(k|ezer|m|millió|million)$/i)?.[1]?.toLocaleLowerCase('hu-HU');
  if (suffix) {
    cleaned = cleaned.slice(0, -suffix.length);
    multiplier = suffix === 'k' || suffix === 'ezer' ? 1_000 : 1_000_000;
  }

  const comma = cleaned.lastIndexOf(',');
  const dot = cleaned.lastIndexOf('.');
  if (comma !== -1 && dot !== -1) {
    const decimalSeparator = comma > dot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    cleaned = cleaned.replace(thousandsSeparator, '').replace(decimalSeparator, '.');
  } else if (comma !== -1) {
    cleaned = cleaned.replace(',', '.');
  } else if ((cleaned.match(/\./g) ?? []).length > 1) {
    cleaned = cleaned.replace(/\./g, '');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function validatedIsoDate(year, month, day) {
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  if (parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normaliseDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return validatedIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (PLACEHOLDER_VALUES.has(raw.toLocaleLowerCase('hu-HU'))) return null;

  let match = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?$/);
  if (match) return validatedIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})\.?$/);
  if (match) return validatedIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));

  return null;
}

export function parseBirthDate(value) {
  const iso = normaliseDate(value);
  if (!iso || !ISO_DATE.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function calculateAge(birthDate, reference = SEASON_REFERENCE_DATE) {
  const timestamp = parseBirthDate(birthDate);
  if (timestamp == null) return null;
  const born = new Date(timestamp);
  let age = reference.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday = reference.getUTCMonth() < born.getUTCMonth()
    || (reference.getUTCMonth() === born.getUTCMonth() && reference.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

const categoryRegistry = createCategoryRegistry({
  normaliseNumber,
  parseBirthDate,
  calculateAge,
});

/** Kanonikus kategóriaexportok. */
export const CATEGORY_DEFINITIONS = categoryRegistry.definitions;
export const CATEGORY_BY_ID = categoryRegistry.byId;
export const ENABLED_CATEGORIES = categoryRegistry.enabledCategories;
export const CARD_CATEGORY_IDS = categoryRegistry.cardCategoryIds;
export const CATEGORY_AVAILABILITY = categoryRegistry.availability;
export const categoryValue = categoryRegistry.value;
export const hasCategoryData = categoryRegistry.hasValue;
export const formatCategoryValue = categoryRegistry.formatValue;
export const configureCategories = categoryRegistry.configure;

/** Visszafelé kompatibilis attribútumexportok a meglévő motorhoz és UI-hoz. */
export const ATTRIBUTE_DEFINITIONS = CATEGORY_DEFINITIONS;
export const ATTRIBUTE_BY_KEY = CATEGORY_BY_ID;
export const ATTRIBUTES = ENABLED_CATEGORIES;
export const CARD_ATTRIBUTE_KEYS = CARD_CATEGORY_IDS;
export const attributeValue = categoryValue;
export const hasAttributeData = hasCategoryData;
export const formatAttribute = formatCategoryValue;
export const configureAttributes = configureCategories;

const pickNumber = (...values) => firstValid(values.map(normaliseNumber));

/** Backward-compatible normalisation for older and future enriched JSON payloads. */
export function normaliseCard(card = {}) {
  const rawStats = card.stats && typeof card.stats === 'object' ? card.stats : {};
  const stats = {
    ...rawStats,
    age: pickNumber(rawStats.age, card.age),
    appearances: pickNumber(rawStats.appearances, rawStats.matches, rawStats.games, card.appearances),
    starts: pickNumber(rawStats.starts, rawStats.startingAppearances, card.starts),
    goals: pickNumber(rawStats.goals, card.goals),
    squads: pickNumber(rawStats.squads, rawStats.matchdaySquads, card.squads),
    minutes: pickNumber(rawStats.minutes, rawStats.playingMinutes, rawStats.minutesPlayed, card.minutes),
    assists: pickNumber(rawStats.assists, rawStats.goalAssists, card.assists),
    yellowCards: pickNumber(rawStats.yellowCards, rawStats.yellows, card.yellowCards),
    redCards: pickNumber(rawStats.redCards, rawStats.dismissals, card.redCards),
    secondYellowRedCards: pickNumber(rawStats.secondYellowRedCards, rawStats.secondYellowReds),
    totalDismissals: pickNumber(rawStats.totalDismissals),
    overallScore: pickNumber(rawStats.overallScore),
    heightCm: pickNumber(rawStats.heightCm, rawStats.height, card.heightCm, card.height),
    marketValue: pickNumber(rawStats.marketValue, rawStats.marketValueEur, card.marketValue, card.marketValueEur),
    shirtNumber: pickNumber(rawStats.shirtNumber, rawStats.jerseyNumber, card.shirtNumber, card.jerseyNumber),
  };

  if (stats.totalDismissals == null && stats.redCards != null) {
    // MLSZ redCards already represents the complete dismissal total; do not add breakdowns twice.
    stats.totalDismissals = stats.redCards;
  }

  const birthDate = normaliseDate(card.birthDate ?? card.dateOfBirth);
  const calculatedAge = calculateAge(birthDate);
  if (calculatedAge != null) stats.age = calculatedAge;

  return {
    ...card,
    birthDate,
    nation: typeof card.nation === 'string' ? card.nation : '',
    position: typeof card.position === 'string' ? card.position : '',
    stats,
  };
}

const MOCK_CLUBS = [
  'Duna-part FC', 'Vasgyári SC', 'Kertvárosi TC', 'Hegyalja SE',
  'Belvárosi AFC', 'Rába-parti FC', 'Tiszamenti VSC', 'Bakony United',
];

const makeMockPlayer = index => {
  const appearances = 8 + (index * 7) % 26;
  const starts = Math.min(appearances, (index * 5) % 31);
  const goals = (index * 3) % 15;
  const yellowCards = (index * 2) % 9;
  const redCards = index % 17 === 0 ? 1 : 0;
  const birthYear = 1987 + (index * 5) % 20;
  const birthMonth = String(1 + (index * 7) % 12).padStart(2, '0');
  const birthDay = String(1 + (index * 11) % 28).padStart(2, '0');
  const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

  return normaliseCard({
    id: `mock-${String(index + 1).padStart(2, '0')}`,
    name: `Próbajátékos ${String(index + 1).padStart(2, '0')}`,
    club: MOCK_CLUBS[index % MOCK_CLUBS.length],
    nation: 'Fiktív',
    position: '',
    birthDate,
    stats: {
      appearances, starts, goals, squads: appearances,
      yellowCards, redCards, secondYellowRedCards: null,
      totalDismissals: redCards, overallScore: null,
    },
    meta: { fictional: true, imageUrl: null },
  });
};

export const MOCK_PLAYERS = Array.from({ length: 52 }, (_, index) => makeMockPlayer(index));

/** Validate the complete pool while allowing source-declared optional nulls. */
export function validatePlayers(cards) {
  const problems = [];

  cards.forEach((card, index) => {
    if (!card?.id || !card?.name || !card?.club) problems.push(`card ${index}: missing id, name or club`);
    if (attributeValue(card, 'goals') == null) {
      problems.push(`${card?.name ?? `card ${index}`}: goals is missing or invalid`);
    }
  });

  if (new Set(cards.map(card => card?.id)).size !== cards.length) problems.push('duplicate card ids');
  return problems;
}

/** Load verified data, falling back only when the whole payload is unusable. */
export async function loadPlayers(url = 'data/players.json') {
  try {
    const embedded = globalThis.__EMBEDDED_PLAYER_DATA__;
    let payload;
    if (embedded) {
      payload = embedded;
    } else {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      payload = await response.json();
    }

    const rawCards = Array.isArray(payload) ? payload : payload.players;
    if (!Array.isArray(rawCards) || rawCards.length === 0) throw new Error('no players array');
    const cards = rawCards.map(normaliseCard);
    const problems = validatePlayers(cards);
    if (problems.length) throw new Error(`${problems.length} invalid card(s): ${problems.slice(0, 5).join('; ')}`);
    configureAttributes(cards);

    console.info(`[players] ${cards.length} valós NB I-játékos betöltve · ${ATTRIBUTES.length} használható kategória${payload.season ? ` · ${payload.season}` : ''}`);
    return { players: cards, source: 'real', meta: Array.isArray(payload) ? null : payload };
  } catch (error) {
    configureAttributes(MOCK_PLAYERS);
    console.info(`[players] Fiktív tartalékpakli használata: ${error.message}`);
    return { players: MOCK_PLAYERS, source: 'mock', meta: null };
  }
}
