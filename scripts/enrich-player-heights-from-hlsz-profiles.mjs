import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('.');
const DATABASE_FILE = path.join(ROOT, 'data/databases/hungary-nb1-2025-26/players.normalized.json');
const ENRICHMENT_FILE = path.join(ROOT, 'data/club-official-enrichment-25-all-club-heights.json');
const REPORT_FILE = path.join(ROOT, 'data/databases/hungary-nb1-2025-26/height-enrichment-report.json');
const CACHE_DIR = path.join(ROOT, '.cache/player-heights/hlsz-profiles');
const DELAY_MS = Number(process.env.HEIGHT_REQUEST_DELAY_MS ?? 3500);
const CHECKED_AT = new Date().toISOString().slice(0, 10);
const SOURCE_ID = 'hlsz-individual-profiles-heights-2025-26';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;
const finiteHeight = value => Number.isInteger(value) && value >= 140 && value <= 220;

function key(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('hu-HU')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slug(value) {
  return key(value).replace(/ /g, '-');
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function htmlLines(value) {
  return decodeHtml(String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/td|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseProfile(html, player) {
  const lines = htmlLines(html);
  const birthIndex = lines.findIndex(line => line.includes(player.birthDate));
  if (birthIndex < 0) return { heightCm: null, reason: 'birth-date-not-found' };

  const expectedTokens = key(player.name).split(' ').filter(Boolean);
  const headingWindow = key(lines.slice(Math.max(0, birthIndex - 18), birthIndex).join(' '));
  const matchedTokens = expectedTokens.filter(token => headingWindow.includes(token));
  if (expectedTokens.length >= 2 && matchedTokens.length < Math.min(2, expectedTokens.length)) {
    return { heightCm: null, reason: 'name-not-confirmed' };
  }

  for (let index = birthIndex; index <= Math.min(lines.length - 1, birthIndex + 12); index += 1) {
    const combined = `${lines[index]} ${lines[index + 1] ?? ''}`;
    if (!/magass[aá]g/i.test(combined) && !/\bcm\b/i.test(combined)) continue;
    const match = combined.match(/\b(1[4-9]\d|2[01]\d|220)\s*cm\b/i);
    if (!match) continue;
    const heightCm = Number(match[1]);
    return finiteHeight(heightCm)
      ? { heightCm, reason: 'exact-profile-name-birth-height' }
      : { heightCm: null, reason: 'height-out-of-range' };
  }
  return { heightCm: null, reason: 'height-not-published' };
}

async function fetchProfile(url, cacheName) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, cacheName);
  try {
    const cached = await fs.readFile(cacheFile, 'utf8');
    if (cached.length > 500) return { html: cached, status: 200, cached: true };
  } catch {}

  if (fetchProfile.requestCount > 0) await sleep(DELAY_MS);
  fetchProfile.requestCount += 1;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; Fociskartyak2026DataAudit/1.0; public-data verification)',
      'accept-language': 'hu-HU,hu;q=0.9,en;q=0.8',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) return { html: '', status: response.status, cached: false };
  const html = await response.text();
  if (html.length > 500) await fs.writeFile(cacheFile, html);
  return { html, status: response.status, cached: false };
}
fetchProfile.requestCount = 0;

function clubIds(player) {
  const ids = player?.meta?.clubIds;
  if (Array.isArray(ids) && ids.length) return ids;
  return [player?.clubId, player?.meta?.clubId].filter(Boolean);
}

async function main() {
  const database = JSON.parse(await fs.readFile(DATABASE_FILE, 'utf8'));
  const enrichment = JSON.parse(await fs.readFile(ENRICHMENT_FILE, 'utf8'));
  const report = JSON.parse(await fs.readFile(REPORT_FILE, 'utf8'));
  const byId = new Map((database.players ?? []).map(player => [player.id, player]));
  const existingIds = new Set((enrichment.records ?? []).map(record => `${record.clubId}|${record.birthDate}|${key(record.name)}`));
  const resolved = [];
  const audits = [];

  for (const unresolved of report.unresolved ?? []) {
    const player = byId.get(unresolved.id);
    if (!player || !unresolved.birthDate || !unresolved.name) {
      audits.push({ playerId: unresolved.id, status: 'skipped', reason: 'missing-player-or-identity' });
      continue;
    }
    const profileSlug = slug(unresolved.name);
    if (!profileSlug) {
      audits.push({ playerId: unresolved.id, status: 'skipped', reason: 'missing-slug' });
      continue;
    }
    const url = `https://hlsz.hu/${unresolved.birthDate}/${profileSlug}`;
    const cacheName = `${unresolved.birthDate}-${profileSlug}.html`;
    try {
      const response = await fetchProfile(url, cacheName);
      if (response.status !== 200 || !response.html) {
        audits.push({ playerId: unresolved.id, name: unresolved.name, url, status: 'not-found', httpStatus: response.status });
        continue;
      }
      const parsed = parseProfile(response.html, unresolved);
      if (!finiteHeight(parsed.heightCm)) {
        audits.push({ playerId: unresolved.id, name: unresolved.name, url, status: 'unresolved', reason: parsed.reason, cached: response.cached });
        continue;
      }
      const playerClubIds = clubIds(player);
      const clubId = playerClubIds[0] ?? unresolved.clubIds?.[0] ?? null;
      if (!clubId) {
        audits.push({ playerId: unresolved.id, name: unresolved.name, url, status: 'unresolved', reason: 'missing-club-id' });
        continue;
      }
      const duplicateKey = `${clubId}|${unresolved.birthDate}|${key(unresolved.name)}`;
      if (existingIds.has(duplicateKey)) continue;
      existingIds.add(duplicateKey);
      resolved.push({
        sourceId: SOURCE_ID,
        clubId,
        name: player.name,
        birthDate: unresolved.birthDate,
        heightCm: parsed.heightCm,
        meta: {
          sourcePlayerUrl: url,
          matchReason: parsed.reason,
        },
      });
      audits.push({ playerId: unresolved.id, name: unresolved.name, url, status: 'resolved', heightCm: parsed.heightCm, cached: response.cached });
    } catch (error) {
      audits.push({ playerId: unresolved.id, name: unresolved.name, url, status: 'failed', error: error.message });
    }
  }

  if (resolved.length) {
    const sourceExists = (enrichment.sources ?? []).some(source => source.id === SOURCE_ID);
    if (!sourceExists) {
      enrichment.sources.push({
        id: SOURCE_ID,
        name: 'HLSZ – egyedi játékosprofilok',
        url: 'https://hlsz.hu/',
        checkedAt: CHECKED_AT,
        season: '2025/26',
        fields: ['heightCm'],
        scope: 'A HLSZ nyilvános, születési dátumot és játékosnevet tartalmazó egyedi profiloldalán számszerűen közölt magasság.',
      });
    }
    enrichment.records.push(...resolved);
    enrichment.records.sort((a, b) => a.clubId.localeCompare(b.clubId) || a.name.localeCompare(b.name, 'hu'));
    enrichment.batch.heightRecordCount = enrichment.records.length;
    enrichment.generatedAt = new Date().toISOString();
    enrichment.policy.primarySources = [...new Set([...(enrichment.policy.primarySources ?? []), 'HLSZ individual player profiles'])];
  }

  const resolvedIds = new Set(audits.filter(item => item.status === 'resolved').map(item => item.playerId));
  const remaining = (report.unresolved ?? []).filter(item => !resolvedIds.has(item.id));
  for (const item of remaining) {
    item.reason = 'A klubkeret-, részletes keret- és HLSZ egyedi profilforrások egyikében sem volt egyértelmű, számszerűen megadott magasság.';
  }
  report.generatedAt = new Date().toISOString();
  report.generatedRecords = enrichment.records.length;
  report.projected = {
    knownHeights: report.before.knownHeights + enrichment.records.length,
    missingHeights: remaining.length,
  };
  report.profileAudit = {
    sourceId: SOURCE_ID,
    checkedAt: CHECKED_AT,
    requestDelayMs: DELAY_MS,
    attemptedProfiles: audits.length,
    resolvedProfiles: resolved.length,
    unresolvedProfiles: remaining.length,
    statusCounts: audits.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {}),
    records: audits,
  };
  report.unresolved = remaining;

  await fs.writeFile(ENRICHMENT_FILE, jsonText(enrichment));
  await fs.writeFile(REPORT_FILE, jsonText(report));
  console.log(`HLSZ egyedi profilok: ${audits.length} ellenőrzés, ${resolved.length} új magasság, ${remaining.length} feloldatlan.`);
}

await main();
