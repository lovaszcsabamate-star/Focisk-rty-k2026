/**
 * Builds data/players.json — the real 52-card deck.
 *
 *   node pipeline/build.mjs                 full run (downloads ~200MB, cached)
 *   node pipeline/build.mjs --no-caps       skip the Wikidata lookup
 *   node pipeline/build.mjs --portraits     also download player photos
 *   node pipeline/build.mjs --refresh       ignore the download cache
 *
 * The game falls back to the bundled mock deck if this file doesn't exist, so
 * it stays playable before you ever run this.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from './config.mjs';
import { download, downloadBinary } from './lib/net.mjs';
import * as tm from './sources/transfermarkt.mjs';
import { fetchCaps } from './sources/wikidata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const resolve = p => path.resolve(HERE, p);

const args = new Set(process.argv.slice(2));
const OPTS = {
  caps:      !args.has('--no-caps') && CONFIG.wikidata.enabled,
  portraits: args.has('--portraits'),
  refresh:   args.has('--refresh'),
};

/** Transfermarkt sub-position -> short code shown on the card. */
const POSITION_CODES = {
  'Goalkeeper': 'GK',
  'Centre-Back': 'CB', 'Left-Back': 'LB', 'Right-Back': 'RB',
  'Defensive Midfield': 'DM', 'Central Midfield': 'CM', 'Attacking Midfield': 'AM',
  'Left Midfield': 'LM', 'Right Midfield': 'RM',
  'Left Winger': 'LW', 'Right Winger': 'RW',
  'Centre-Forward': 'ST', 'Second Striker': 'SS',
};
const FALLBACK_CODES = { Goalkeeper: 'GK', Defender: 'DF', Midfield: 'MF', Attack: 'FW' };

export const shortPosition = p =>
  POSITION_CODES[p.subPosition] || FALLBACK_CODES[p.position] || '—';

/**
 * Pick `count` players from `pool` that are recognisable *and* spread across
 * the market-value range.
 *
 * Taking the top N by value squashes the range and makes that attribute
 * boring — every card reads €80–120M and the comparison is a coin flip.
 * Sampling the league uniformly fixes the range but fills the deck with
 * players nobody at the table has heard of.
 *
 * So: rank by value and sample the *whole* range, but with a power curve that
 * clusters picks toward the expensive end. Position 0 (most valuable) and the
 * last position are both always represented, guaranteeing real spread.
 *
 * `exponent` 1 = uniform, higher = more top-heavy.
 */
export function selectSpread(pool, count, { exponent = 1.8 } = {}) {
  if (pool.length <= count) return pool.slice();

  const ranked = pool.slice().sort((a, b) => b.marketValue - a.marketValue);
  const used = new Set();
  const picked = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    let idx = Math.round(Math.pow(t, exponent) * (ranked.length - 1));
    // Collisions are possible at the top where the curve is flat; step to the
    // next free slot. Terminates because count < ranked.length.
    while (used.has(idx)) idx = (idx + 1) % ranked.length;
    used.add(idx);
    picked.push(ranked[idx]);
  }
  return picked;
}

async function main() {
  console.log(`\nSuper Mega Fotbal 2026 — deck builder`);
  console.log(`  season ${CONFIG.season.label}, competitions ${CONFIG.competitions.join(', ')}\n`);

  // 1. Download -----------------------------------------------------------
  const cacheDir = resolve(CONFIG.cacheDir);
  const files = tm.files(cacheDir);

  for (const [key, name] of Object.entries(CONFIG.files)) {
    await download(`${CONFIG.baseUrl}/${name}`, files[key], { force: OPTS.refresh });
  }

  // 2. Validate the competition codes before the expensive scan -----------
  const comps = await tm.verifyCompetitions(files.competitions, CONFIG.competitions);
  if (comps) for (const c of comps) console.log(`  league  ${c.id}  ${c.name}`);

  // 3. Aggregate season stats ---------------------------------------------
  const totals = await tm.aggregateAppearances(files.appearances, {
    competitions: CONFIG.competitions,
    season: CONFIG.season,
  });

  // 4. Join player attributes ---------------------------------------------
  let candidates = await tm.readPlayers(files.players, totals);
  console.log(`  join    ${candidates.length.toLocaleString()} players with height + valuation`);

  candidates = candidates.filter(p => p.minutes >= CONFIG.minMinutes);
  console.log(`  filter  ${candidates.length.toLocaleString()} with >= ${CONFIG.minMinutes} minutes`);

  if (candidates.length < CONFIG.deck.size) {
    throw new Error(
      `Only ${candidates.length} eligible players — need ${CONFIG.deck.size}.\n` +
      `Lower CONFIG.minMinutes or widen CONFIG.season / CONFIG.competitions.`
    );
  }

  // 5. Caps from Wikidata --------------------------------------------------
  // Done before selection so we can prefer players whose caps we actually know.
  let caps = new Map();
  if (OPTS.caps) {
    // Only look up a shortlist — the top few hundred by value covers anyone
    // who could plausibly make the deck, and keeps us polite to Wikidata.
    const shortlist = candidates
      .slice().sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, CONFIG.deck.size * 12)
      .map(p => p.tmId);
    caps = await fetchCaps(shortlist, CONFIG.wikidata);
  } else {
    console.log(`  caps    skipped (--no-caps)`);
  }

  for (const p of candidates) {
    p.caps = caps.get(p.tmId) ?? null;
  }

  // 6. Select the deck -----------------------------------------------------
  const deck = [];
  const shortfalls = [];

  for (const [position, count] of Object.entries(CONFIG.deck.byPosition)) {
    const inPosition = candidates.filter(p => p.position === position);

    // Prefer players with known caps; top up from the rest only if we must.
    const known = inPosition.filter(p => p.caps !== null);
    const unknown = inPosition.filter(p => p.caps === null);

    let chosen = selectSpread(known, Math.min(count, known.length));
    if (chosen.length < count) {
      const filler = selectSpread(unknown, count - chosen.length);
      shortfalls.push(`${position}: ${filler.length}`);
      chosen = chosen.concat(filler);
    }

    if (chosen.length < count) {
      throw new Error(
        `Not enough ${position} candidates (${chosen.length}/${count}). ` +
        `Lower CONFIG.minMinutes or adjust CONFIG.deck.byPosition.`
      );
    }
    deck.push(...chosen);
  }

  if (shortfalls.length) {
    console.log(
      `\n  ! caps unknown for some picks (${shortfalls.join(', ')}).\n` +
      `    They are recorded as 0 with "capsKnown": false — an unknown value,\n` +
      `    NOT a verified zero. Re-run with better Wikidata coverage, or set\n` +
      `    a larger deck.byPosition pool, if that matters to you.`
    );
  }

  // 7. Emit ----------------------------------------------------------------
  const cards = deck.map(p => ({
    id: `tm-${p.tmId}`,
    name: p.name,
    club: p.club,
    nation: p.nation,
    position: shortPosition(p),
    stats: {
      height:      p.height,
      marketValue: Math.round((p.marketValue / 1_000_000) * 10) / 10,   // € millions
      redCards:    p.red,
      yellowCards: p.yellow,
      caps:        p.caps ?? 0,
      minutes:     p.minutes,
      assists:     p.assists,
    },
    meta: {
      transfermarktId: p.tmId,
      capsKnown: p.caps !== null,
      goals: p.goals,
      appearances: p.apps,
      imageUrl: p.imageUrl || null,
    },
  }));

  const payload = {
    generatedAt: new Date().toISOString(),
    season: CONFIG.season.label,
    competitions: CONFIG.competitions,
    count: cards.length,
    source: {
      stats: 'transfermarkt-datasets (https://github.com/dcaribou/transfermarkt-datasets)',
      caps: OPTS.caps ? 'Wikidata (P54/P1350, joined on P2446)' : 'not fetched',
      note: 'Transfermarkt-derived data. Fine for personal use; check licensing before shipping commercially.',
    },
    players: cards,
  };

  const outPath = resolve(CONFIG.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log(`\n  wrote   ${path.relative(process.cwd(), outPath)} (${cards.length} cards)`);
  summarise(cards);

  // 8. Optional portraits --------------------------------------------------
  if (OPTS.portraits) await downloadPortraits(cards);

  console.log(`\nDone. Reload the game — it picks up data/players.json automatically.\n`);
}

/** Print the stat ranges, so a bad build is obvious at a glance. */
function summarise(cards) {
  const keys = ['height', 'marketValue', 'redCards', 'yellowCards', 'caps', 'minutes', 'assists'];
  console.log(`\n  Stat ranges:`);
  for (const k of keys) {
    const vals = cards.map(c => c.stats[k]);
    const min = Math.min(...vals), max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const distinct = new Set(vals).size;
    const flag = distinct <= 2 ? '   <-- suspiciously flat, check the source column' : '';
    console.log(`    ${k.padEnd(12)} min ${String(min).padStart(7)}  max ${String(max).padStart(7)}  avg ${avg.toFixed(1).padStart(8)}  distinct ${distinct}${flag}`);
  }
  const unknownCaps = cards.filter(c => !c.meta.capsKnown).length;
  if (unknownCaps) console.log(`\n    ${unknownCaps} card(s) have caps recorded as 0 but unverified.`);
}

async function downloadPortraits(cards) {
  const dir = resolve(CONFIG.portraits.dir);
  const withImages = cards.filter(c => c.meta.imageUrl);
  console.log(`\n  portraits: ${withImages.length} available`);

  let done = 0, ok = 0;
  const queue = withImages.slice();
  const workers = Array.from({ length: CONFIG.portraits.concurrency }, async () => {
    while (queue.length) {
      const card = queue.shift();
      const ext = (card.meta.imageUrl.match(/\.(png|jpg|jpeg|webp)/i)?.[1] ?? 'jpg').toLowerCase();
      const saved = await downloadBinary(card.meta.imageUrl, path.join(dir, `${card.id}.${ext}`));
      done++; if (saved) ok++;
      process.stdout.write(`\r  portraits ${done}/${withImages.length} (${ok} saved)`);
    }
  });
  await Promise.all(workers);
  console.log(`\n  Portraits saved to ${path.relative(process.cwd(), dir)}. Your own art at the same id wins if you add it.`);
}

// Only run when invoked directly, so the transform helpers above can be
// imported by the fixture tests.
const invokedDirectly = process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  main().catch(err => {
    console.error(`\nBuild failed:\n\n${err.message}\n`);
    process.exit(1);
  });
}
