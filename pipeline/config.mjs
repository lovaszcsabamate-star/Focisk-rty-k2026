/**
 * Pipeline configuration. Everything you'd reasonably want to tweak lives here.
 */

export const CONFIG = {
  /**
   * Public CSV exports of https://github.com/dcaribou/transfermarkt-datasets
   * (also mirrored on Kaggle as davidcariboo/player-scores). Refreshed weekly.
   */
  baseUrl: 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data',

  files: {
    players:      'players.csv.gz',
    appearances:  'appearances.csv.gz',
    competitions: 'competitions.csv.gz',
  },

  /**
   * Transfermarkt competition codes for the top-5 European leagues.
   * If these don't match, the build prints every code found in
   * competitions.csv so you can correct them.
   */
  competitions: ['GB1', 'ES1', 'IT1', 'L1', 'FR1'],

  /**
   * Season window. Appearances are filtered by date, because the appearances
   * table is per-match. Inclusive start, exclusive end.
   */
  season: {
    label: '2025/26',
    from:  '2025-07-01',
    to:    '2026-06-30',
  },

  /** A card is only interesting if the player actually played. */
  minMinutes: 600,

  /** Deck composition — must total 52. */
  deck: {
    size: 52,
    byPosition: {
      Goalkeeper: 6,
      Defender:   16,
      Midfield:   16,
      Attack:     14,
    },
  },

  /**
   * International caps. Not in the Transfermarkt dataset, so they're enriched
   * from Wikidata, joined on the Transfermarkt player ID (property P2446) —
   * an exact join, not fuzzy name matching.
   */
  wikidata: {
    enabled: true,
    endpoint: 'https://query.wikidata.org/sparql',
    // Wikidata asks for a descriptive UA with contact info on API clients.
    userAgent: 'SuperMegaFotbal2026/0.1 (card game data pipeline; contact: set-your-email-here)',
    batchSize: 150,
  },

  /** Legacy output kept separate from the game's complete NB I database. */
  output: '../data/legacy-transfermarkt-deck.json',

  /** Downloaded CSVs are cached here so re-runs are fast. */
  cacheDir: '.cache',

  /** Optional: download player photos into assets/portraits/. */
  portraits: {
    dir: '../assets/portraits',
    concurrency: 4,
  },
};
