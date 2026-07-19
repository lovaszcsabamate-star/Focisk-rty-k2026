/**
 * Downloads with an on-disk cache and a progress line.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const mb = bytes => (bytes / 1024 / 1024).toFixed(1);

/**
 * Download `url` to `dest` unless it's already cached.
 * @returns {Promise<string>} dest
 */
export async function download(url, dest, { force = false } = {}) {
  if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`  cached  ${path.basename(dest)} (${mb(fs.statSync(dest).size)} MB)`);
    return dest;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  process.stdout.write(`  fetch   ${path.basename(dest)} … `);

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(
      `Download failed: ${res.status} ${res.statusText}\n  ${url}\n\n` +
      `If this is a 404 the upstream dataset may have moved. Check the current ` +
      `download URLs at https://github.com/dcaribou/transfermarkt-datasets and ` +
      `update baseUrl in pipeline/config.mjs.`
    );
  }

  // Write to a temp file first so an interrupted run can't poison the cache.
  const tmp = `${dest}.partial`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);

  console.log(`${mb(fs.statSync(dest).size)} MB`);
  return dest;
}

/** POST a SPARQL query and return parsed JSON bindings. */
export async function sparql(endpoint, query, userAgent) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Accept': 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: new URLSearchParams({ query }),
  });

  if (!res.ok) throw new Error(`SPARQL ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return json.results?.bindings ?? [];
}

/** Fetch a binary asset (player photo). Resolves to null on any failure. */
export async function downloadBinary(url, dest) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
    return dest;
  } catch {
    return null;
  }
}
