/**
 * International caps, from Wikidata.
 *
 * Caps are the one card attribute the Transfermarkt dataset doesn't carry.
 * Wikidata models them as:
 *
 *   player  --P54 (member of sports team)-->  national team
 *                 qualifier P1350 (number of matches played) = caps
 *
 * The join is exact, not name-based: Wikidata stores the Transfermarkt player
 * ID as property P2446, so we look players up by the same ID the CSV uses.
 * Name matching would silently mismatch players who share a name.
 *
 * Coverage is partial and often lags reality — treat the result as
 * best-effort. Players with no Wikidata entry come back as null, and the
 * caller decides what to do with them.
 */

import { sparql } from '../lib/net.mjs';

const QUERY = ids => `
SELECT ?tmId (MAX(?caps) AS ?maxCaps) WHERE {
  VALUES ?tmId { ${ids.map(id => `"${id}"`).join(' ')} }
  ?player wdt:P2446 ?tmId .
  ?player p:P54 ?membership .
  ?membership ps:P54 ?team ;
              pq:P1350 ?caps .
  ?team wdt:P31 wd:Q6979593 .   # national association football team
}
GROUP BY ?tmId`;

/**
 * @param {string[]} tmIds  Transfermarkt player IDs
 * @returns {Promise<Map<string, number>>} tmId -> caps (only those found)
 */
export async function fetchCaps(tmIds, { endpoint, userAgent, batchSize = 150 }) {
  const caps = new Map();

  for (let i = 0; i < tmIds.length; i += batchSize) {
    const batch = tmIds.slice(i, i + batchSize);
    process.stdout.write(`\r  caps    ${Math.min(i + batchSize, tmIds.length)}/${tmIds.length} looked up…`);

    try {
      const rows = await sparql(endpoint, QUERY(batch), userAgent);
      for (const row of rows) {
        const n = Number(row.maxCaps?.value);
        if (Number.isFinite(n)) caps.set(row.tmId.value, Math.round(n));
      }
    } catch (err) {
      // Wikidata rate-limits and occasionally times out. A missing batch costs
      // us caps for those players, not the whole run.
      console.log(`\n  ! caps batch failed (${err.message.slice(0, 80)}) — continuing`);
    }
  }

  process.stdout.write(`\r  caps    ${caps.size}/${tmIds.length} players matched on Wikidata\n`);
  return caps;
}
