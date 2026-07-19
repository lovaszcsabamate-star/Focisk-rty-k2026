/**
 * NB I card data and loader.
 *
 * The game loads the real 2025/26 deck from `data/players.json`. A deterministic
 * fictional fallback deck is kept so the application remains playable if the
 * JSON file is missing or malformed.
 *
 * Card shape:
 *   { id, name, club, nation, position,
 *     stats: { age, appearances, starts, goals,
 *              yellowCards, redCards, overallScore },
 *     meta?: { imageUrl, sourceUrl, ... } }
 */

/** `higherWins:false` means the smaller value wins that comparison. */
export const ATTRIBUTES = [
  { key: 'age',          label: 'Életkor',         unit: 'év',   higherWins: false, format: v => `${v} év` },
  { key: 'appearances',  label: 'Mérkőzések',      unit: '',     higherWins: true,  format: v => `${v}` },
  { key: 'starts',       label: 'Kezdőként',       unit: '',     higherWins: true,  format: v => `${v}` },
  { key: 'goals',        label: 'Gólok',           unit: '',     higherWins: true,  format: v => `${v}` },
  { key: 'yellowCards',  label: 'Sárga lapok',     unit: '',     higherWins: false, format: v => `${v}` },
  { key: 'redCards',     label: 'Piros lapok',     unit: '',     higherWins: false, format: v => `${v}` },
  { key: 'overallScore', label: 'Játékospontszám', unit: '/100', higherWins: true,  format: v => `${v}/100` },
];

export const ATTRIBUTE_BY_KEY = Object.fromEntries(
  ATTRIBUTES.map(attribute => [attribute.key, attribute])
);

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
  const age = 18 + (index * 5) % 19;
  const overallScore = Math.min(99, 30 + Math.round(
    appearances * 0.8 + starts * 0.6 + goals * 2.2 - yellowCards * 0.5 - redCards * 4
  ));

  return {
    id: `mock-${String(index + 1).padStart(2, '0')}`,
    name: `Próbajátékos ${String(index + 1).padStart(2, '0')}`,
    club: MOCK_CLUBS[index % MOCK_CLUBS.length],
    nation: 'Fiktív',
    position: 'Nincs adat',
    stats: { age, appearances, starts, goals, yellowCards, redCards, overallScore },
    meta: { fictional: true, imageUrl: null },
  };
};

export const MOCK_PLAYERS = Array.from(
  { length: 52 },
  (_, index) => makeMockPlayer(index)
);

/** Every card must contain all seven playable statistics as finite numbers. */
function validate(cards) {
  const problems = [];

  cards.forEach((card, index) => {
    if (!card?.id || !card?.name) {
      problems.push(`card ${index}: missing id or name`);
    }

    for (const attribute of ATTRIBUTES) {
      const value = card?.stats?.[attribute.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        problems.push(
          `${card?.name ?? `card ${index}`}: ${attribute.key} is ${JSON.stringify(value)}`
        );
      }
    }
  });

  const ids = new Set(cards.map(card => card?.id));
  if (ids.size !== cards.length) problems.push('duplicate card ids');

  return problems;
}

/**
 * Load the real NB I deck, falling back to the fictional deck on any error.
 *
 * @returns {Promise<{players: object[], source: string, meta: object|null}>}
 */
export async function loadPlayers(url = 'data/players.json') {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const payload = await response.json();
    const cards = Array.isArray(payload) ? payload : payload.players;
    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error('no players array');
    }

    const problems = validate(cards);
    if (problems.length) {
      throw new Error(
        `${problems.length} invalid card(s):\n  ${problems.slice(0, 5).join('\n  ')}`
      );
    }

    console.info(
      `[players] Loaded ${cards.length} NB I players` +
      (payload.season ? ` — ${payload.season}` : '') +
      (payload.generatedAt ? ` (built ${payload.generatedAt.slice(0, 10)})` : '')
    );

    return {
      players: cards,
      source: 'real',
      meta: Array.isArray(payload) ? null : payload,
    };
  } catch (error) {
    const reason = error instanceof SyntaxError ? 'malformed JSON' : error.message;
    console.info(`[players] Using fictional fallback deck (${reason}).`);
    return { players: MOCK_PLAYERS, source: 'mock', meta: null };
  }
}
