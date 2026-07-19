/**
 * NB I card data contract and safe loader.
 *
 * Real card fields are never guessed. Optional values use `null`, which the
 * UI renders as „Nincs adat”, and cards missing a chosen statistic cannot be
 * played in that comparison.
 *
 * @typedef {object} PlayerCard
 * @property {string} id
 * @property {string} name
 * @property {string} club
 * @property {string} [nation]
 * @property {string} [position]
 * @property {string|null} birthDate Exact ISO date (YYYY-MM-DD), if verified.
 * @property {object} stats
 * @property {number} stats.age Preserved source age; display uses birthDate when known.
 * @property {number} stats.appearances
 * @property {number} stats.starts
 * @property {number} stats.goals
 * @property {number|null} [stats.squads]
 * @property {number|null} [stats.overallScore]
 * @property {number} stats.yellowCards
 * @property {number} stats.redCards MLSZ red-card/kiállítás total.
 * @property {number|null} stats.secondYellowRedCards Separate detail, if a source provides it.
 * @property {number|null} stats.totalDismissals Game total.
 */

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBirthDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
}

export function calculateAge(birthDate, reference = new Date()) {
  const timestamp = parseBirthDate(birthDate);
  if (timestamp == null) return null;
  const born = new Date(timestamp);
  let age = reference.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday = reference.getUTCMonth() < born.getUTCMonth()
    || (reference.getUTCMonth() === born.getUTCMonth() && reference.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

const formatDate = value => {
  const timestamp = parseBirthDate(value);
  if (timestamp == null) return 'Nincs adat';
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
  }).format(new Date(timestamp));
};

/** Attribute metadata. All new disciplinary categories use the larger value. */
export const ATTRIBUTES = [
  {
    key: 'birthDate', label: 'Fiatalabb játékos', icon: '🎂', higherWins: true,
    hint: 'A fiatalabb nyer ↓', optional: true,
    format: (value, card) => {
      const age = calculateAge(card?.birthDate);
      return value == null ? 'Nincs adat' : `${age} év · ${formatDate(card.birthDate)}`;
    },
  },
  { key: 'appearances', label: 'Mérkőzések', icon: '👕', higherWins: true, hint: 'A több nyer', format: value => `${value}` },
  { key: 'starts', label: 'Kezdőként', icon: '▶', higherWins: true, hint: 'A több nyer', format: value => `${value}` },
  { key: 'goals', label: 'Gólok', icon: '⚽', higherWins: true, hint: 'A több nyer', format: value => `${value}` },
  { key: 'squads', label: 'Meccskeretben', icon: '📋', higherWins: true, hint: 'A több nyer', optional: true, format: value => `${value}` },
  { key: 'overallScore', label: 'Játékospontszám', icon: '★', higherWins: true, hint: 'A több nyer', optional: true, format: value => `${value}/100` },
  { key: 'yellowCards', label: 'Több sárga lap', icon: '🟨', higherWins: true, hint: 'A több nyer', format: value => `${value}` },
  { key: 'totalDismissals', label: 'Több kiállítás', icon: '🟥', higherWins: true, hint: 'A több nyer', format: value => `${value}` },
];

export const ATTRIBUTE_BY_KEY = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.key, attribute]));

/** Return a comparable primitive, or null for unknown/malformed data. */
export function attributeValue(card, attributeKey) {
  if (!card || !ATTRIBUTE_BY_KEY[attributeKey]) return null;
  if (attributeKey === 'birthDate') return parseBirthDate(card.birthDate);
  const value = card.stats?.[attributeKey];
  return isFiniteNumber(value) ? value : null;
}

export const hasAttributeData = (card, attributeKey) => attributeValue(card, attributeKey) != null;

export function formatAttribute(card, attributeKey) {
  const attribute = ATTRIBUTE_BY_KEY[attributeKey];
  if (!attribute) return 'Nincs adat';
  const value = attributeValue(card, attributeKey);
  return value == null ? 'Nincs adat' : attribute.format(value, card);
}

/** Backward-compatible normalisation for older tracked JSON payloads. */
export function normaliseCard(card) {
  const stats = { ...card.stats };
  const secondYellow = isFiniteNumber(stats.secondYellowRedCards) ? stats.secondYellowRedCards : null;
  let totalDismissals = isFiniteNumber(stats.totalDismissals) ? stats.totalDismissals : null;

  if (totalDismissals == null && isFiniteNumber(stats.redCards)) {
    // The MLSZ export used by the app exposes a single red-card/kiállítás count.
    // Only add a second-yellow value when a source actually provides one.
    totalDismissals = stats.redCards + (secondYellow ?? 0);
  }

  return {
    ...card,
    birthDate: parseBirthDate(card.birthDate) == null ? null : card.birthDate,
    nation: card.nation ?? '',
    position: card.position ?? '',
    stats: { ...stats, secondYellowRedCards: secondYellow, totalDismissals },
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
  const age = calculateAge(birthDate);
  const overallScore = Math.min(99, 30 + Math.round(
    appearances * 0.8 + starts * 0.6 + goals * 2.2 - yellowCards * 0.5 - redCards * 4
  ));

  return {
    id: `mock-${String(index + 1).padStart(2, '0')}`,
    name: `Próbajátékos ${String(index + 1).padStart(2, '0')}`,
    club: MOCK_CLUBS[index % MOCK_CLUBS.length],
    nation: 'Fiktív',
    position: 'Nincs adat',
    birthDate,
    stats: {
      age, appearances, starts, goals, squads: appearances,
      yellowCards, redCards, secondYellowRedCards: 0,
      totalDismissals: redCards, overallScore,
    },
    meta: { fictional: true, imageUrl: null },
  };
};

export const MOCK_PLAYERS = Array.from({ length: 52 }, (_, index) => makeMockPlayer(index));

/** Validate required core data while allowing explicitly optional nulls. */
export function validatePlayers(cards) {
  const problems = [];
  const required = ATTRIBUTES.filter(attribute => !attribute.optional);

  cards.forEach((card, index) => {
    if (!card?.id || !card?.name) problems.push(`card ${index}: missing id or name`);
    for (const attribute of required) {
      if (attributeValue(card, attribute.key) == null) {
        problems.push(`${card?.name ?? `card ${index}`}: ${attribute.key} is missing or invalid`);
      }
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

    console.info(`[players] ${cards.length} valós NB I-játékos betöltve${payload.season ? ` · ${payload.season}` : ''}`);
    return { players: cards, source: 'real', meta: Array.isArray(payload) ? null : payload };
  } catch (error) {
    console.info(`[players] Fiktív tartalékpakli használata: ${error.message}`);
    return { players: MOCK_PLAYERS, source: 'mock', meta: null };
  }
}
