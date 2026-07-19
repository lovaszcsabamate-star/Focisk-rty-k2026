/**
 * Offline tests for the pipeline's transform logic.
 *
 *   node pipeline/test/transform.test.mjs
 *
 * These build gzipped CSV fixtures in the *expected upstream schema* and run
 * the real parsing/aggregation/selection code over them.
 *
 * IMPORTANT: fixtures prove the transform is correct given that schema. They
 * cannot prove the schema matches the live dataset — that's what the
 * mapColumns() guard is for, and it's tested here too.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { parseLine, readCsv, readHeader, mapColumns, num } from '../lib/csv.mjs';
import { aggregateAppearances, readPlayers, verifyCompetitions } from '../sources/transfermarkt.mjs';
import { selectSpread, shortPosition } from '../build.mjs';

let failures = 0;
const ok = msg => console.log(`  ✓ ${msg}`);
const bad = msg => { failures++; console.error(`  ✗ ${msg}`); };
const eq = (actual, expected, msg) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  a === e ? ok(msg) : bad(`${msg}\n      expected ${e}\n      got      ${a}`);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fotbal-fixtures-'));
const writeGz = (name, text) => {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, zlib.gzipSync(Buffer.from(text, 'utf8')));
  return p;
};

// ── 1. CSV line parsing ─────────────────────────────────────────────────────

console.log('\nCSV parsing:');
eq(parseLine('a,b,c'), ['a', 'b', 'c'], 'plain fields');
eq(parseLine('a,"b,c",d'), ['a', 'b,c', 'd'], 'quoted comma');
eq(parseLine('a,"say ""hi""",c'), ['a', 'say "hi"', 'c'], 'escaped quotes');
eq(parseLine('a,,c'), ['a', '', 'c'], 'empty field');
eq(parseLine('"Ødegaard, M.",x'), ['Ødegaard, M.', 'x'], 'unicode + quoted comma');

// A name containing a newline inside quotes — the case that breaks naive
// line-splitting parsers.
const trickyCsv = 'player_id,name\n1,"Multi\nLine Name"\n2,Normal\n';
const trickyPath = writeGz('tricky.csv.gz', trickyCsv);
const trickyRows = [];
for await (const row of readCsv(trickyPath)) trickyRows.push(row);
eq(trickyRows.length, 2, 'newline inside quoted field does not split the row');
eq(trickyRows[0].name, 'Multi\nLine Name', 'embedded newline preserved');
eq(trickyRows[1].name, 'Normal', 'row after embedded newline still parses');

eq(num(''), null, 'empty numeric -> null');
eq(num('abc'), null, 'non-numeric -> null');
eq(num('0'), 0, 'zero parses as 0, not null');

// ── 2. Schema guard ─────────────────────────────────────────────────────────

console.log('\nSchema guard:');
try {
  mapColumns(['player_id', 'name'], { height: ['height_in_cm'] }, ['height'], 'players.csv');
  bad('missing required column should have thrown');
} catch (err) {
  const m = err.message;
  if (m.includes('height_in_cm') && m.includes('player_id, name') && m.includes('players.csv')) {
    ok('missing column throws, naming both the wanted and the actual columns');
  } else bad(`error message unhelpful:\n${m}`);
}
eq(
  mapColumns(['player_id', 'pretty_name'], { name: ['name', 'pretty_name'] }, ['name']),
  { name: 'pretty_name' },
  'falls back to an alternate column name'
);

// ── 3. Appearance aggregation ───────────────────────────────────────────────

console.log('\nAggregation:');
const appearances = [
  'player_id,game_id,competition_id,date,goals,assists,minutes_played,yellow_cards,red_cards',
  '1,100,GB1,2025-08-10,1,1,90,1,0',
  '1,101,GB1,2025-09-10,0,2,75,0,1',
  '1,102,GB1,2024-09-10,5,5,90,3,3',   // previous season — must be excluded
  '1,103,NL1,2025-09-20,9,9,90,9,9',   // wrong competition — must be excluded
  '2,104,ES1,2025-10-01,0,0,45,2,0',
  '3,105,IT1,2026-01-15,0,3,90,0,0',
].join('\n') + '\n';
const appPath = writeGz('appearances.csv.gz', appearances);

const totals = await aggregateAppearances(appPath, {
  competitions: ['GB1', 'ES1', 'IT1', 'L1', 'FR1'],
  season: { from: '2025-07-01', to: '2026-06-30' },
});

eq(totals.get('1'), { minutes: 165, assists: 3, yellow: 1, red: 1, goals: 1, apps: 2 },
   'sums only in-season, in-competition rows');
eq(totals.has('3'), true, 'player from a third league included');
eq(totals.size, 3, 'no phantom players');

// Out-of-range season should fail loudly rather than emit an empty deck.
try {
  await aggregateAppearances(appPath, {
    competitions: ['GB1'],
    season: { from: '2030-01-01', to: '2030-12-31' },
  });
  bad('empty result should have thrown');
} catch (err) {
  err.message.includes('No appearances matched')
    ? ok('empty season window throws with a diagnosis')
    : bad(`wrong error: ${err.message}`);
}

// ── 4. Player join and filtering ────────────────────────────────────────────

console.log('\nPlayer join:');
const players = [
  'player_id,name,current_club_name,country_of_citizenship,position,sub_position,height_in_cm,market_value_in_eur,image_url',
  '1,"Real Name",Club A,England,Midfield,Central Midfield,180,50000000,http://img/1.png',
  '2,No Height,Club B,Spain,Attack,Centre-Forward,,20000000,',      // no height -> dropped
  '3,No Value,Club C,Italy,Defender,Centre-Back,190,,',              // no value  -> dropped
  '4,Not Playing,Club D,France,Attack,Left Winger,175,90000000,',    // no appearances -> dropped
  '5,Absurd Height,Club E,Brazil,Attack,Centre-Forward,400,10000000,', // implausible -> dropped
].join('\n') + '\n';
const playersPath = writeGz('players.csv.gz', players);

const joined = await readPlayers(playersPath, totals);
eq(joined.map(p => p.tmId), ['1'], 'drops players missing height, value, or appearances');
eq(joined[0].name, 'Real Name', 'quoted name parsed');
eq(joined[0].minutes, 165, 'season totals carried onto the player');
eq(joined[0].marketValue, 50000000, 'market value in raw euros at this stage');

// Implausible heights must be rejected, not silently shipped onto a card.
const totalsWide = new Map([['5', { minutes: 90, assists: 0, yellow: 0, red: 0, goals: 0, apps: 1 }]]);
eq((await readPlayers(playersPath, totalsWide)).length, 0, 'rejects a 400cm height');

// ── 5. Competition-code validation ──────────────────────────────────────────

console.log('\nCompetition codes:');
const compsPath = writeGz('competitions.csv.gz',
  'competition_id,name\nGB1,Premier League\nES1,LaLiga\nIT1,Serie A\n');
try {
  await verifyCompetitions(compsPath, ['XX9', 'ZZ1']);
  bad('all-invalid codes should have thrown');
} catch (err) {
  err.message.includes('GB1') && err.message.includes('Premier League')
    ? ok('bad codes throw and list the codes that do exist')
    : bad(`unhelpful error: ${err.message}`);
}
eq((await verifyCompetitions(compsPath, ['GB1', 'ES1'])).map(c => c.id), ['GB1', 'ES1'],
   'valid codes pass through');

// ── 6. Deck selection ───────────────────────────────────────────────────────

console.log('\nSelection:');
const pool = Array.from({ length: 400 }, (_, i) => ({ tmId: String(i), marketValue: (400 - i) * 100_000 }));
const picked = selectSpread(pool, 16);
eq(picked.length, 16, 'selects the requested count');
eq(new Set(picked.map(p => p.tmId)).size, 16, 'no duplicate picks');

const values = picked.map(p => p.marketValue);
const spread = Math.max(...values) / Math.min(...values);
spread > 3
  ? ok(`spans a wide value range (${spread.toFixed(1)}x top-to-bottom)`)
  : bad(`value range too flat (${spread.toFixed(1)}x) — the deck would be boring`);

eq(picked[0].tmId, '0', 'always includes the most valuable player in the pool');

// Top-heavy bias: more than half the picks should come from the top third of
// the ranked pool, or the deck fills with unrecognisable names.
const topThird = picked.filter(p => Number(p.tmId) < pool.length / 3).length;
topThird > picked.length / 2
  ? ok(`biased toward recognisable players (${topThird}/${picked.length} from the top third)`)
  : bad(`only ${topThird}/${picked.length} picks from the top third — too obscure`);

eq(selectSpread([{ marketValue: 1 }, { marketValue: 2 }], 5).length, 2,
   'a pool smaller than the request returns everything, not undefined padding');

console.log('\nPositions:');
eq(shortPosition({ subPosition: 'Centre-Back', position: 'Defender' }), 'CB', 'sub-position wins');
eq(shortPosition({ subPosition: '', position: 'Midfield' }), 'MF', 'falls back to broad position');
eq(shortPosition({ subPosition: 'Unknown Role', position: 'Attack' }), 'FW', 'unknown sub-position falls back');
eq(shortPosition({ subPosition: '', position: '' }), '—', 'nothing known still renders');

// ── Done ────────────────────────────────────────────────────────────────────

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nAll pipeline transform checks passed.\n');
process.exit(failures ? 1 : 0);
