/**
 * Streaming CSV reader for gzipped files.
 *
 * appearances.csv is ~1.8M rows, so nothing here ever holds the whole file in
 * memory. Handles quoted fields, embedded commas, escaped quotes ("") and
 * newlines inside quotes.
 */

import fs from 'node:fs';
import zlib from 'node:zlib';

/** Split one CSV line into fields. Exported for the fixture tests. */
export function parseLine(line) {
  const out = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

/**
 * Yield each row of a (optionally gzipped) CSV as an object keyed by header.
 *
 * @param {string} path
 * @param {object} opts  { gzip = auto by extension }
 */
export async function* readCsv(path, { gzip = path.endsWith('.gz') } = {}) {
  let stream = fs.createReadStream(path);
  if (gzip) stream = stream.pipe(zlib.createGunzip());

  let buffer = '';
  let header = null;
  let inQuotes = false;
  let lineStart = 0;

  const emit = line => {
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (line === '') return null;
    const fields = parseLine(line);
    if (!header) { header = fields; return null; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = fields[i] ?? '';
    return row;
  };

  for await (const chunk of stream) {
    buffer += chunk.toString('utf8');

    // Scan for line breaks that are not inside a quoted field.
    for (let i = lineStart; i < buffer.length; i++) {
      const c = buffer[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === '\n' && !inQuotes) {
        const row = emit(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
        i = -1;
        lineStart = 0;
        if (row) yield row;
      }
    }
    lineStart = buffer.length;
  }

  if (buffer.length) {
    const row = emit(buffer);
    if (row) yield row;
  }
}

/** Read just the header row — used to validate the schema before a long run. */
export async function readHeader(path) {
  for await (const row of readCsv(path)) return Object.keys(row);
  return [];
}

/**
 * Resolve the columns we need against the file's actual header.
 *
 * The upstream dataset is community-maintained and can rename columns between
 * refreshes. Rather than silently producing empty stats, this throws with the
 * real header list so the mismatch is obvious and fixable.
 *
 * @param {string[]} header      actual columns in the file
 * @param {object}   spec        { logicalName: [candidate, candidate, ...] }
 * @param {string[]} required    logical names that must resolve
 * @returns {object} map of logicalName -> actual column name
 */
export function mapColumns(header, spec, required, fileLabel = 'file') {
  const found = {};
  const missing = [];

  for (const [logical, candidates] of Object.entries(spec)) {
    const hit = candidates.find(c => header.includes(c));
    if (hit) found[logical] = hit;
    else if (required.includes(logical)) missing.push(`${logical} (looked for: ${candidates.join(', ')})`);
  }

  if (missing.length) {
    throw new Error(
      `Schema mismatch in ${fileLabel}.\n\n` +
      `Could not find these required columns:\n  - ${missing.join('\n  - ')}\n\n` +
      `The file actually contains:\n  ${header.join(', ')}\n\n` +
      `The upstream dataset may have been restructured. Add the correct column ` +
      `name to the candidate list in pipeline/sources/transfermarkt.mjs.`
    );
  }
  return found;
}

/** Parse a possibly-empty numeric cell. */
export const num = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
