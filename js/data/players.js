/**
 * Card data.
 *
 * The game prefers REAL data from `data/players.json`, produced by
 * `node pipeline/build.mjs` (see pipeline/README.md). If that file isn't there
 * yet, it falls back to the fictional mock deck at the bottom of this file so
 * the game is always playable.
 *
 * The mock names are fictional on purpose: the stats are invented, and
 * attaching invented numbers to real footballers would misrepresent real
 * people. Real names arrive with real data, via the pipeline.
 *
 * Card shape:
 *   id            stable key, also used to resolve art: assets/portraits/<id>.png
 *   name, club, nation, position   flavour text (position drives nothing mechanical)
 *   stats.height        cm
 *   stats.marketValue   millions EUR
 *   stats.redCards      season count   (lower is better)
 *   stats.yellowCards   season count   (lower is better)
 *   stats.caps          senior international appearances
 *   stats.minutes       minutes played this season
 *   stats.assists       assists this season
 */

/** Attribute metadata. `higherWins:false` marks the "less is better" stats. */
export const ATTRIBUTES = [
  { key: 'height',      label: 'Height',         unit: 'cm',  higherWins: true,  format: v => `${v} cm` },
  { key: 'marketValue', label: 'Market Value',   unit: '€M',  higherWins: true,  format: v => `€${v.toFixed(1)}M` },
  { key: 'redCards',    label: 'Red Cards',      unit: '',    higherWins: false, format: v => `${v}` },
  { key: 'yellowCards', label: 'Yellow Cards',   unit: '',    higherWins: false, format: v => `${v}` },
  { key: 'caps',        label: 'Intl. Caps',     unit: '',    higherWins: true,  format: v => `${v}` },
  { key: 'minutes',     label: 'Minutes Played', unit: '',    higherWins: true,  format: v => `${v.toLocaleString('en-GB')}'` },
  { key: 'assists',     label: 'Assists',        unit: '',    higherWins: true,  format: v => `${v}` },
];

export const ATTRIBUTE_BY_KEY = Object.fromEntries(ATTRIBUTES.map(a => [a.key, a]));

const p = (id, name, club, nation, position, height, marketValue, redCards, yellowCards, caps, minutes, assists) =>
  ({ id, name, club, nation, position,
     stats: { height, marketValue, redCards, yellowCards, caps, minutes, assists } });

export const MOCK_PLAYERS = [
  // ── Goalkeepers ───────────────────────────────────────────────────────────
  p('gk-01', 'Emil Vandersar',   'Rotterdam Zuid',  'Netherlands', 'GK',  196,  42.0, 0,  2,  61, 3240,  1),
  p('gk-02', 'Tomás Reguero',    'Atlético Sierra', 'Spain',       'GK',  189,  28.5, 1,  4,  12, 2970,  0),
  p('gk-03', 'Kwesi Aboagye',    'Accra Union',     'Ghana',       'GK',  191,   9.0, 0,  1,  34, 2610,  0),
  p('gk-04', 'Lars Nyholm',      'Malmö Vind',      'Sweden',      'GK',  198,  15.5, 0,  3,   8, 3060,  1),
  p('gk-05', 'Dario Pellegatti', 'Verona Nera',     'Italy',       'GK',  187,   6.5, 1,  5,   0, 1980,  0),
  p('gk-06', 'Ruben Okonkwo',    'Lagos Harbour',   'Nigeria',     'GK',  193,  21.0, 0,  2,  47, 3150,  0),

  // ── Defenders ─────────────────────────────────────────────────────────────
  p('df-01', 'Anton Brekalo',    'Dinamo Sava',     'Croatia',     'CB',  194,  55.0, 2, 11,  73, 2880,  3),
  p('df-02', 'Marcel Dubois',    'Lyon Ouest',      'France',      'CB',  188,  78.0, 1,  8,  41, 3060,  2),
  p('df-03', 'Kofi Mensah',      'Kumasi Royals',   'Ghana',       'CB',  185,  12.5, 3, 13,  22, 2430,  1),
  p('df-04', 'Diego Salcedo',    'Rosario Plata',   'Argentina',   'LB',  176,  46.5, 0,  9,  29, 3195,  9),
  p('df-05', 'Finn Halvorsen',   'Bergen Storm',    'Norway',      'RB',  181,  33.0, 1,  7,  35, 2745, 11),
  p('df-06', 'Yuki Sakamoto',    'Osaka Crane',     'Japan',       'RB',  174,  24.0, 0,  4,  58, 2880,  6),
  p('df-07', 'Sander de Vries',  'Amsterdam Noord', 'Netherlands', 'CB',  192,  67.0, 1,  6,  52, 3330,  4),
  p('df-08', 'Ibrahim Traoré',   'Bamako Étoile',   'Mali',        'CB',  190,  18.0, 4, 14,  31, 2160,  0),
  p('df-09', 'Callum Whitmore',  'Sheffield Vale',  'England',     'LB',  179,  38.5, 1, 10,  17, 2925,  8),
  p('df-10', 'Rafael Pinto',     'Porto Alta',      'Portugal',    'CB',  186,  52.0, 2,  9,  44, 3015,  2),
  p('df-11', 'Nikola Petrović',  'Beograd Crveni',  'Serbia',      'CB',  197,  29.5, 2, 12,  38, 2610,  1),
  p('df-12', 'Ousmane Fall',     'Dakar Lions',     'Senegal',     'LB',  183,  41.0, 0,  6,  49, 2790,  7),
  p('df-13', 'Matthias Grün',    'Köln Anker',      'Germany',     'RB',  180,  26.0, 1,  8,   5, 2340,  5),
  p('df-14', 'Bruno Cardoso',    'Belo Sul',        'Brazil',      'CB',  189,  71.5, 1,  7,  26, 3105,  3),
  p('df-15', 'Aleksi Virtanen',  'Helsinki Frost',  'Finland',     'CB',  191,   8.5, 2, 10,  40, 2475,  1),
  p('df-16', 'Jorge Iturbe',     'Asunción Roja',   'Paraguay',    'RB',  177,  14.0, 3, 13,  55, 2565,  4),

  // ── Midfielders ───────────────────────────────────────────────────────────
  p('mf-01', 'Luca Bernardi',    'Milano Grigio',   'Italy',       'CM',  182,  92.0, 0,  5,  67, 3195, 14),
  p('mf-02', 'Ayoub El Amrani',  'Casablanca Or',   'Morocco',     'CM',  178,  58.0, 1,  9,  62, 2970, 10),
  p('mf-03', 'Henrik Solberg',   'Oslo Fjord',      'Norway',      'DM',  187,  34.5, 2, 12,  43, 3060,  3),
  p('mf-04', 'Paulo Renner',     'São Paulo Verde', 'Brazil',      'AM',  173, 118.0, 0,  4,  51, 2835, 19),
  p('mf-05', 'Declan Moore',     'Dublin Quays',    'Ireland',     'DM',  184,  22.5, 1, 11,  36, 2700,  2),
  p('mf-06', 'Kenji Watanabe',   'Tokyo Meridian',  'Japan',       'CM',  171,  47.0, 0,  6,  79, 3240, 12),
  p('mf-07', 'Viktor Meszáros',  'Budapest Vas',    'Hungary',     'AM',  176,  19.5, 1,  7,  33, 2385, 13),
  p('mf-08', 'Samuel Adeyemi',   'Ibadan Comets',   'Nigeria',     'CM',  180,  63.0, 2, 10,  28, 2880,  8),
  p('mf-09', 'Théo Lambert',     'Marseille Bleu',  'France',      'AM',  175, 105.0, 0,  3,  24, 2610, 17),
  p('mf-10', 'Andrés Quiroga',   'Bogotá Andes',    'Colombia',    'CM',  179,  31.0, 1,  8,  46, 3105,  9),
  p('mf-11', 'Stefan Novak',     'Praha Ocel',      'Czechia',     'DM',  190,  16.5, 3, 14,  19, 2520,  1),
  p('mf-12', 'Malik Diarra',     'Abidjan Palme',   'Ivory Coast', 'CM',  186,  44.0, 1,  9,  57, 2745,  6),
  p('mf-13', 'Owen Radcliffe',   'Leeds Kestrel',   'England',     'AM',  177,  86.5, 0,  5,  11, 2295, 15),
  p('mf-14', 'Ilja Kovalenko',   'Kyiv Kashtan',    'Ukraine',     'CM',  183,  25.0, 1,  6,  64, 2925,  7),
  p('mf-15', 'Mateo Bellucci',   'Napoli Azzurro',  'Italy',       'DM',  188,  39.5, 2, 11,   9, 3015,  4),
  p('mf-16', 'Jonas Wexell',     'Göteborg Anchor', 'Sweden',      'CM',  181,  11.0, 0,  7,  15, 1890,  5),

  // ── Forwards ──────────────────────────────────────────────────────────────
  p('fw-01', 'Elias Ferreira',   'Lisboa Dourado',  'Portugal',    'ST',  185, 145.0, 0,  4,  88, 3060, 16),
  p('fw-02', 'Karim Boulahia',   'Alger Corsaire',  'Algeria',     'ST',  182,  49.0, 1,  6,  53, 2610,  7),
  p('fw-03', 'Nathan Achterberg','Eindhoven Licht', 'Netherlands', 'LW',  174,  97.5, 0,  5,  30, 2790, 18),
  p('fw-04', 'Gustavo Marín',    'Montevideo Sol',  'Uruguay',     'ST',  191,  74.0, 2,  9,  61, 2925,  6),
  p('fw-05', 'Idris Kamara',     'Freetown Tide',   'Sierra Leone','RW',  178,  27.5, 1,  8,  42, 2430, 11),
  p('fw-06', 'Felix Brandner',   'Wien Sturm',      'Austria',     'ST',  193,  36.0, 1,  7,  26, 2565,  5),
  p('fw-07', 'Rodrigo Vela',     'Guadalajara Fé',  'Mexico',      'RW',  172,  81.0, 0,  6,  71, 3150, 20),
  p('fw-08', 'Anders Krogh',     'Aarhus Nord',     'Denmark',     'ST',  187,  13.5, 2, 10,  18, 2205,  3),
  p('fw-09', 'Junior Massaro',   'Recife Coral',    'Brazil',      'LW',  169, 132.0, 0,  3,  37, 2880, 22),
  p('fw-10', 'Sean Mulcahy',     'Glasgow Crown',   'Scotland',    'ST',  190,  20.5, 3, 12,  23, 2340,  4),
  p('fw-11', 'Amir Rahmani',     'Tehran Falcon',   'Iran',        'RW',  176,  17.0, 1,  9,  68, 2700,  9),
  p('fw-12', 'Lukas Wiedemann',  'Berlin Eisen',    'Germany',     'ST',  184,  68.5, 1,  5,  14, 2475, 10),
  p('fw-13', 'Tariq Al-Sabah',   'Doha Marine',     'Qatar',       'LW',  170,   7.5, 0,  4,  76, 2160,  8),
  p('fw-14', 'Cristian Ilie',    'București Lupii', 'Romania',     'ST',  186,  23.0, 2, 11,  45, 2745,  6),
];

if (MOCK_PLAYERS.length !== 52) {
  console.warn(`[players.js] Expected 52 mock cards, got ${MOCK_PLAYERS.length}.`);
}

// ── Loading real data ───────────────────────────────────────────────────────

/** Every card must carry all seven stats as finite numbers, or it's not playable. */
function validate(cards) {
  const problems = [];

  cards.forEach((card, i) => {
    if (!card?.id || !card?.name) problems.push(`card ${i}: missing id or name`);
    for (const attr of ATTRIBUTES) {
      const v = card?.stats?.[attr.key];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        problems.push(`${card?.name ?? `card ${i}`}: ${attr.key} is ${JSON.stringify(v)}`);
      }
    }
  });

  const ids = new Set(cards.map(c => c?.id));
  if (ids.size !== cards.length) problems.push('duplicate card ids');

  return problems;
}

/**
 * Load the deck: real data if the pipeline has run, otherwise the mock.
 *
 * Never throws — a broken or missing players.json falls back to the mock with
 * a console explanation, because an unplayable game is worse than a fake deck.
 *
 * @returns {Promise<{players: object[], source: string, meta: object|null}>}
 */
export async function loadPlayers(url = 'data/players.json') {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const payload = await res.json();
    const cards = Array.isArray(payload) ? payload : payload.players;
    if (!Array.isArray(cards) || cards.length === 0) throw new Error('no players array');

    const problems = validate(cards);
    if (problems.length) {
      throw new Error(`${problems.length} invalid card(s):\n  ` + problems.slice(0, 5).join('\n  '));
    }

    console.info(
      `[players] Loaded ${cards.length} real players` +
      (payload.season ? ` — ${payload.season}` : '') +
      (payload.generatedAt ? ` (built ${payload.generatedAt.slice(0, 10)})` : '')
    );
    return { players: cards, source: 'real', meta: payload.players ? payload : null };

  } catch (err) {
    const why = err instanceof SyntaxError ? 'malformed JSON' : err.message;
    console.info(
      `[players] Using the fictional mock deck (${why}).\n` +
      `          Run \`node pipeline/build.mjs\` to fetch real player data.`
    );
    return { players: MOCK_PLAYERS, source: 'mock', meta: null };
  }
}
