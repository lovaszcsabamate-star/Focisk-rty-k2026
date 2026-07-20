/**
 * NB I card data contract, normalisation and centrally configured comparison categories.
 *
 * Real card fields are never guessed. Unknown values stay `null`; categories are enabled
 * only when the loaded database contains enough valid values, and cards without a valid
 * value cannot be used in that comparison.
 */

const PLACEHOLDER_VALUES = new Set([
  '', '-', '–', '—', 'n/a', 'n.a.', 'na', 'null', 'undefined', 'ismeretlen', 'nincs adat',
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const firstValid = values => values.find(value => value != null) ?? null;

export const SEASON_REFERENCE_DATE = new Date('2026-05-16T00:00:00Z');
export const MIN_MINUTES_FOR_RATE_STATS = 90;
export const MIN_CATEGORY_COVERAGE = 0.10;
export const CATEGORY_AVAILABILITY = {};

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

const integer = value => `${Math.round(value)}`;
const decimal = value => value.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
const percent = value => `${decimal(value)}%`;
const minutes = value => `${Math.round(value)} perc`;
const centimetres = value => `${decimal(value)} cm`;
const money = value => new Intl.NumberFormat('hu-HU', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
}).format(value);

const statValue = key => card => normaliseNumber(card?.stats?.[key]);
const exactBirthDate = card => parseBirthDate(card?.birthDate);
const safeRatio = (numerator, denominator, multiplier = 1) => {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator <= 0) return null;
  const value = numerator / denominator * multiplier;
  return Number.isFinite(value) ? value : null;
};
const ratePer90 = (card, numeratorKey) => {
  const numerator = normaliseNumber(card?.stats?.[numeratorKey]);
  const playedMinutes = normaliseNumber(card?.stats?.minutes);
  if (playedMinutes == null || playedMinutes < MIN_MINUTES_FOR_RATE_STATS) return null;
  return safeRatio(numerator, playedMinutes, 90);
};
const goalContributions = card => {
  const goals = normaliseNumber(card?.stats?.goals);
  const assists = normaliseNumber(card?.stats?.assists);
  return goals == null || assists == null ? null : goals + assists;
};
const disciplinaryEvents = card => {
  const yellows = normaliseNumber(card?.stats?.yellowCards);
  const dismissals = normaliseNumber(card?.stats?.totalDismissals);
  return yellows == null || dismissals == null ? null : yellows + dismissals;
};

const category = config => ({
  optional: true,
  precision: null,
  enabledByDefault: false,
  cardStatKey: config.key,
  ...config,
  higherWins: ['higher', 'later'].includes(config.direction),
});

/** Complete requested category catalogue. Unsupported categories stay disabled until data appears. */
export const ATTRIBUTE_DEFINITIONS = [
  category({
    key: 'birthDate', label: 'Fiatalabb játékos', shortLabel: 'Fiatalabb', cardLabel: 'Életkor',
    icon: '🎂', group: 'Alapadatok', direction: 'later', hint: 'A fiatalabb nyer',
    getValue: exactBirthDate, format: (value, card) => `${calculateAge(card.birthDate)} év`, enabledByDefault: true,
  }),
  category({
    key: 'birthDateOlder', label: 'Idősebb játékos', shortLabel: 'Idősebb', cardLabel: 'Életkor',
    icon: '🕰️', group: 'Alapadatok', direction: 'earlier', hint: 'Az idősebb nyer',
    getValue: exactBirthDate, format: (value, card) => `${calculateAge(card.birthDate)} év`,
    cardStatKey: 'birthDate', enabledByDefault: true,
  }),
  category({
    key: 'heightCm', label: 'Magasabb játékos', shortLabel: 'Magasabb', cardLabel: 'Magasság',
    icon: '📏', group: 'Alapadatok', direction: 'higher', hint: 'A magasabb nyer',
    getValue: statValue('heightCm'), format: centimetres,
  }),
  category({
    key: 'heightCmLower', label: 'Alacsonyabb játékos', shortLabel: 'Alacsonyabb', cardLabel: 'Magasság',
    icon: '📐', group: 'Alapadatok', direction: 'lower', hint: 'Az alacsonyabb nyer',
    getValue: statValue('heightCm'), format: centimetres, cardStatKey: 'heightCm',
  }),
  category({
    key: 'marketValue', label: 'Magasabb piaci érték', shortLabel: 'Nagyobb érték', cardLabel: 'Piaci érték',
    icon: '💶', group: 'Alapadatok', direction: 'higher', hint: 'A nagyobb érték nyer',
    getValue: statValue('marketValue'), format: money,
  }),
  category({
    key: 'marketValueLower', label: 'Alacsonyabb piaci érték', shortLabel: 'Kisebb érték', cardLabel: 'Piaci érték',
    icon: '🪙', group: 'Alapadatok', direction: 'lower', hint: 'A kisebb érték nyer',
    getValue: statValue('marketValue'), format: money, cardStatKey: 'marketValue',
  }),
  category({
    key: 'appearances', label: 'Több mérkőzés', shortLabel: 'Mérkőzések', cardLabel: 'Mérkőzések',
    icon: '👕', group: 'Pályára lépés', direction: 'higher', hint: 'A több nyer',
    getValue: statValue('appearances'), format: integer, enabledByDefault: true,
  }),
  category({
    key: 'starts', label: 'Több kezdés', shortLabel: 'Kezdések', cardLabel: 'Kezdőként',
    icon: '▶', group: 'Pályára lépés', direction: 'higher', hint: 'A több nyer',
    getValue: statValue('starts'), format: integer, enabledByDefault: true,
  }),
  category({
    key: 'minutes', label: 'Több játékperc', shortLabel: 'Játékpercek', cardLabel: 'Játékperc',
    icon: '⏱️', group: 'Pályára lépés', direction: 'higher', hint: 'A több nyer',
    getValue: statValue('minutes'), format: minutes,
  }),
  category({
    key: 'minutesPerAppearance', label: 'Több játékperc mérkőzésenként', shortLabel: 'Perc/meccs', cardLabel: 'Perc/meccs',
    icon: '⌛', group: 'Pályára lépés', direction: 'higher', hint: 'A több nyer', precision: 2,
    getValue: card => safeRatio(normaliseNumber(card?.stats?.minutes), normaliseNumber(card?.stats?.appearances)),
    format: value => `${decimal(value)} perc`,
  }),
  category({
    key: 'startRate', label: 'Magasabb kezdési arány', shortLabel: 'Kezdési arány', cardLabel: 'Kezdési arány',
    icon: '📊', group: 'Pályára lépés', direction: 'higher', hint: 'A magasabb arány nyer', precision: 2,
    getValue: card => {
      const starts = normaliseNumber(card?.stats?.starts);
      const appearances = normaliseNumber(card?.stats?.appearances);
      if (starts == null || appearances == null || starts < 0 || appearances <= 0 || starts > appearances) return null;
      return safeRatio(starts, appearances, 100);
    },
    format: percent, enabledByDefault: true,
  }),
  category({
    key: 'goals', label: 'Több gól', shortLabel: 'Gólok', cardLabel: 'Gólok',
    icon: '⚽', group: 'Támadás', direction: 'higher', hint: 'A több nyer',
    getValue: statValue('goals'), format: integer, enabledByDefault: true, optional: false,
  }),
  category({
    key: 'assists', label: 'Több gólpassz', shortLabel: 'Gólpasszok', cardLabel: 'Gólpasszok',
    icon: '🅰️', group: 'Támadás', direction: 'higher', hint: 'A több nyer',
    getValue: statValue('assists'), format: integer,
  }),
  category({
    key: 'goalContributions', label: 'Több kanadai pont', shortLabel: 'Kanadai pont', cardLabel: 'Kanadai pont',
    icon: '➕', group: 'Támadás', direction: 'higher', hint: 'A több nyer',
    getValue: goalContributions, format: integer,
  }),
  category({
    key: 'goalsPer90', label: 'Több gól 90 percenként', shortLabel: 'Gól/90', cardLabel: 'Gól/90',
    icon: '🎯', group: 'Támadás', direction: 'higher', hint: 'A több nyer', precision: 2,
    minimumMinutes: MIN_MINUTES_FOR_RATE_STATS, getValue: card => ratePer90(card, 'goals'), format: decimal,
  }),
  category({
    key: 'assistsPer90', label: 'Több gólpassz 90 percenként', shortLabel: 'Gólpassz/90', cardLabel: 'Gólpassz/90',
    icon: '🧠', group: 'Támadás', direction: 'higher', hint: 'A több nyer', precision: 2,
    minimumMinutes: MIN_MINUTES_FOR_RATE_STATS, getValue: card => ratePer90(card, 'assists'), format: decimal,
  }),
  category({
    key: 'goalContributionsPer90', label: 'Több kanadai pont 90 percenként', shortLabel: 'Pont/90', cardLabel: 'Pont/90',
    icon: '🚀', group: 'Támadás', direction: 'higher', hint: 'A több nyer', precision: 2,
    minimumMinutes: MIN_MINUTES_FOR_RATE_STATS,
    getValue: card => {
      const contributions = goalContributions(card);
      const playedMinutes = normaliseNumber(card?.stats?.minutes);
      if (playedMinutes == null || playedMinutes < MIN_MINUTES_FOR_RATE_STATS) return null;
      return safeRatio(contributions, playedMinutes, 90);
    },
    format: decimal,
  }),
  category({
    key: 'minutesPerGoal', label: 'Kevesebb játékperc egy gólhoz', shortLabel: 'Perc/gól', cardLabel: 'Perc/gól',
    icon: '🥅', group: 'Támadás', direction: 'lower', hint: 'A kevesebb nyer', precision: 2,
    minimumMinutes: MIN_MINUTES_FOR_RATE_STATS,
    getValue: card => {
      const goals = normaliseNumber(card?.stats?.goals);
      const playedMinutes = normaliseNumber(card?.stats?.minutes);
      if (playedMinutes == null || playedMinutes < MIN_MINUTES_FOR_RATE_STATS || goals == null || goals <= 0) return null;
      return safeRatio(playedMinutes, goals);
    },
    format: minutes,
  }),
  category({
    key: 'minutesPerGoalContribution', label: 'Kevesebb játékperc egy kanadai ponthoz', shortLabel: 'Perc/pont', cardLabel: 'Perc/pont',
    icon: '⚡', group: 'Támadás', direction: 'lower', hint: 'A kevesebb nyer', precision: 2,
    minimumMinutes: MIN_MINUTES_FOR_RATE_STATS,
    getValue: card => {
      const contributions = goalContributions(card);
      const playedMinutes = normaliseNumber(card?.stats?.minutes);
      if (playedMinutes == null || playedMinutes < MIN_MINUTES_FOR_RATE_STATS || contributions == null || contributions <= 0) return null;
      return safeRatio(playedMinutes, contributions);
    },
    format: minutes,
  }),
  category({
    key: 'squads', label: 'Több kerettagság', shortLabel: 'Kerettagság', cardLabel: 'Meccskeretben',
    icon: '📋', group: 'Pályára lépés', direction: 'higher', hint: 'A több nyer',
    getValue: statValue('squads'), format: integer, enabledByDefault: true,
  }),
  category({
    key: 'yellowCards', label: 'Több sárga lap', shortLabel: 'Több sárga', cardLabel: 'Sárga lap',
    icon: '🟨', group: 'Fegyelem', direction: 'higher', hint: 'A több nyer',
    getValue: statValue('yellowCards'), format: integer, enabledByDefault: true,
  }),
  category({
    key: 'yellowCardsFewest', label: 'Kevesebb sárga lap', shortLabel: 'Kevesebb sárga', cardLabel: 'Sárga lap',
    icon: '🟨', group: 'Fegyelem', direction: 'lower', hint: 'A kevesebb nyer',
    getValue: statValue('yellowCards'), format: integer, cardStatKey: 'yellowCards', enabledByDefault: true,
  }),
  category({
    key: 'totalDismissals', label: 'Több kiállítás', shortLabel: 'Több kiállítás', cardLabel: 'Kiállítás',
    icon: '🟥', group: 'Fegyelem', direction: 'higher', hint: 'A több nyer',
    getValue: statValue('totalDismissals'), format: integer, enabledByDefault: true,
  }),
  category({
    key: 'totalDismissalsFewest', label: 'Kevesebb kiállítás', shortLabel: 'Kevesebb kiállítás', cardLabel: 'Kiállítás',
    icon: '🟥', group: 'Fegyelem', direction: 'lower', hint: 'A kevesebb nyer',
    getValue: statValue('totalDismissals'), format: integer, cardStatKey: 'totalDismissals', enabledByDefault: true,
  }),
  category({
    key: 'cardsPer90', label: 'Több lap 90 percenként', shortLabel: 'Lap/90', cardLabel: 'Lap/90',
    icon: '🟨', group: 'Fegyelem', direction: 'higher', hint: 'A több nyer', precision: 2,
    minimumMinutes: MIN_MINUTES_FOR_RATE_STATS,
    getValue: card => {
      const cards = disciplinaryEvents(card);
      const playedMinutes = normaliseNumber(card?.stats?.minutes);
      if (playedMinutes == null || playedMinutes < MIN_MINUTES_FOR_RATE_STATS) return null;
      return safeRatio(cards, playedMinutes, 90);
    },
    format: decimal,
  }),
  category({
    key: 'discipline', label: 'Fegyelmezettebb játékos', shortLabel: 'Fegyelmezettebb', cardLabel: 'Összes lap',
    icon: '🕊️', group: 'Fegyelem', direction: 'lower', hint: 'A kevesebb lap nyer',
    getValue: disciplinaryEvents, format: value => `${integer(value)} lap`, enabledByDefault: true,
  }),
];

export const ATTRIBUTE_BY_KEY = Object.fromEntries(ATTRIBUTE_DEFINITIONS.map(attribute => [attribute.key, attribute]));
export const ATTRIBUTES = ATTRIBUTE_DEFINITIONS.filter(attribute => attribute.enabledByDefault);
export const CARD_ATTRIBUTE_KEYS = ['birthDate', 'appearances', 'starts', 'goals', 'squads', 'yellowCards', 'totalDismissals'];

/** Return a comparable primitive, or null for unknown/malformed data. */
export function attributeValue(card, attributeKey) {
  const attribute = ATTRIBUTE_BY_KEY[attributeKey];
  if (!card || !attribute) return null;
  const value = attribute.getValue(card);
  return isFiniteNumber(value) ? value : null;
}

export const hasAttributeData = (card, attributeKey) => attributeValue(card, attributeKey) != null;

export function formatAttribute(card, attributeKey) {
  const attribute = ATTRIBUTE_BY_KEY[attributeKey];
  if (!attribute) return '';
  const value = attributeValue(card, attributeKey);
  return value == null ? '' : attribute.format(value, card);
}

export function configureAttributes(cards, { minimumCoverage = MIN_CATEGORY_COVERAGE } = {}) {
  const pool = Array.isArray(cards) ? cards : [];
  const minimumKnown = Math.max(2, Math.ceil(pool.length * minimumCoverage));
  const enabled = [];

  for (const attribute of ATTRIBUTE_DEFINITIONS) {
    const known = pool.filter(card => hasAttributeData(card, attribute.key)).length;
    const coverage = pool.length ? known / pool.length : 0;
    const active = known >= minimumKnown || (!attribute.optional && known === pool.length && known > 0);
    const status = active ? (coverage < 0.5 ? 'experimental' : 'enabled') : 'disabled';
    Object.assign(attribute, { enabled: active, knownValues: known, coverage, status });
    CATEGORY_AVAILABILITY[attribute.key] = { enabled: active, knownValues: known, coverage, status };
    if (active) enabled.push(attribute);
  }

  ATTRIBUTES.splice(0, ATTRIBUTES.length, ...enabled);
  return CATEGORY_AVAILABILITY;
}

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
