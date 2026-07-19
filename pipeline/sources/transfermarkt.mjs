/**
 * Transfermarkt dataset source.
 *
 * Supplies 6 of the 7 card attributes:
 *   height        <- players.height_in_cm
 *   marketValue   <- players.market_value_in_eur
 *   minutes       <- SUM(appearances.minutes_played)
 *   assists       <- SUM(appearances.assists)
 *   yellowCards   <- SUM(appearances.yellow_cards)
 *   redCards      <- SUM(appearances.red_cards)
 *
 * International caps come from Wikidata (see ../sources/wikidata.mjs).
 *
 * COLUMN NAMES: the candidate lists below are the schema this pipeline expects.
 * If the upstream dataset renames something, mapColumns() throws with the real
 * header list rather than quietly emitting zeroes.
 */

import path from 'node:path';
import { readCsv, readHeader, mapColumns, num } from '../lib/csv.mjs';

const PLAYER_COLUMNS = {
  id:          ['player_id'],
  name:        ['name', 'player_name', 'pretty_name'],
  firstName:   ['first_name'],
  lastName:    ['last_name'],
  club:        ['current_club_name', 'club_name', 'current_club_domestic_competition_id'],
  nation:      ['country_of_citizenship', 'country_of_birth'],
  position:    ['position'],
  subPosition: ['sub_position'],
  height:      ['height_in_cm'],
  marketValue: ['market_value_in_eur', 'highest_market_value_in_eur'],
  image:       ['image_url'],
  lastSeason:  ['last_season'],
};
const PLAYER_REQUIRED = ['id', 'position', 'height', 'marketValue'];

const APPEARANCE_COLUMNS = {
  playerId:    ['player_id'],
  competition: ['competition_id'],
  date:        ['date'],
  minutes:     ['minutes_played'],
  assists:     ['assists'],
  yellow:      ['yellow_cards'],
  red:         ['red_cards'],
  goals:       ['goals'],
};
const APPEARANCE_REQUIRED = ['playerId', 'competition', 'date', 'minutes', 'assists', 'yellow', 'red'];

/**
 * Sanity-check the competition codes against competitions.csv, so a typo
 * produces a helpful list instead of an empty deck.
 */
export async function verifyCompetitions(file, wanted) {
  const seen = new Map();
  for await (const row of readCsv(file)) {
    const id = row.competition_id ?? row.id;
    if (id) seen.set(id, row.name ?? row.competition_name ?? '');
  }
  if (seen.size === 0) return;   // unexpected shape; don't block the run

  const missing = wanted.filter(c => !seen.has(c));
  if (missing.length === wanted.length) {
    const sample = [...seen.entries()].slice(0, 40).map(([id, n]) => `  ${id}  ${n}`).join('\n');
    throw new Error(
      `None of the configured competition codes exist in competitions.csv.\n` +
      `Configured: ${wanted.join(', ')}\n\nSome codes that do exist:\n${sample}\n\n` +
      `Fix CONFIG.competitions in pipeline/config.mjs.`
    );
  }
  if (missing.length) {
    console.log(`  ! unknown competition codes ignored: ${missing.join(', ')}`);
  }
  return wanted.filter(c => seen.has(c)).map(id => ({ id, name: seen.get(id) }));
}

/**
 * Stream appearances and total each player's season stats.
 * @returns {Promise<Map<string, object>>} playerId -> totals
 */
export async function aggregateAppearances(file, { competitions, season }) {
  const header = await readHeader(file);
  const col = mapColumns(header, APPEARANCE_COLUMNS, APPEARANCE_REQUIRED, 'appearances.csv');

  const wanted = new Set(competitions);
  const totals = new Map();
  let scanned = 0, kept = 0;

  for await (const row of readCsv(file)) {
    scanned++;
    if (scanned % 250_000 === 0) process.stdout.write(`\r  scan    ${scanned.toLocaleString()} appearances…`);

    if (!wanted.has(row[col.competition])) continue;

    const date = row[col.date];
    if (!date || date < season.from || date > season.to) continue;

    const id = row[col.playerId];
    let t = totals.get(id);
    if (!t) { t = { minutes: 0, assists: 0, yellow: 0, red: 0, goals: 0, apps: 0 }; totals.set(id, t); }

    t.minutes += num(row[col.minutes]) ?? 0;
    t.assists += num(row[col.assists]) ?? 0;
    t.yellow  += num(row[col.yellow])  ?? 0;
    t.red     += num(row[col.red])     ?? 0;
    t.goals   += num(row[col.goals])   ?? 0;
    t.apps    += 1;
    kept++;
  }

  process.stdout.write(`\r  scan    ${scanned.toLocaleString()} appearances, ${kept.toLocaleString()} in scope, ${totals.size.toLocaleString()} players\n`);

  if (totals.size === 0) {
    throw new Error(
      `No appearances matched.\n` +
      `  competitions: ${competitions.join(', ')}\n` +
      `  season window: ${season.from} … ${season.to}\n\n` +
      `Most likely the season window has no data yet — check CONFIG.season in ` +
      `pipeline/config.mjs against how recent the dataset refresh is.`
    );
  }
  return totals;
}

/** Read players.csv, keeping only those with season totals. */
export async function readPlayers(file, totals) {
  const header = await readHeader(file);
  const col = mapColumns(header, PLAYER_COLUMNS, PLAYER_REQUIRED, 'players.csv');

  const out = [];
  for await (const row of readCsv(file)) {
    const id = row[col.id];
    const t = totals.get(id);
    if (!t) continue;

    const height = num(row[col.height]);
    const value = num(row[col.marketValue]);

    // A card needs a real height and a real valuation to be playable.
    if (!height || height < 140 || height > 220) continue;
    if (!value || value <= 0) continue;

    const name = row[col.name]
      || [row[col.firstName], row[col.lastName]].filter(Boolean).join(' ')
      || `Player ${id}`;

    out.push({
      tmId: id,
      name: name.trim(),
      club: (row[col.club] ?? '').trim(),
      nation: (row[col.nation] ?? '').trim(),
      position: (row[col.position] ?? '').trim(),
      subPosition: (row[col.subPosition] ?? '').trim(),
      imageUrl: (row[col.image] ?? '').trim(),
      height,
      marketValue: value,
      ...t,
    });
  }
  return out;
}

export const files = cacheDir => ({
  players:      path.join(cacheDir, 'players.csv.gz'),
  appearances:  path.join(cacheDir, 'appearances.csv.gz'),
  competitions: path.join(cacheDir, 'competitions.csv.gz'),
});
