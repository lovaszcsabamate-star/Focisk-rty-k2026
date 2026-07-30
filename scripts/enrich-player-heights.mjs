import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DATABASE_FILE = path.join(ROOT, 'data/databases/hungary-nb1-2025-26/players.normalized.json');
const MANIFEST_FILE = path.join(ROOT, 'data/databases/hungary-nb1-2025-26/manifest.json');
const OUTPUT_RELATIVE = 'data/club-official-enrichment-25-all-club-heights.json';
const OUTPUT_FILE = path.join(ROOT, OUTPUT_RELATIVE);
const REPORT_FILE = path.join(ROOT, 'data/databases/hungary-nb1-2025-26/height-enrichment-report.json');
const CACHE_DIR = path.join(ROOT, '.cache/player-heights');
const CHECKED_AT = new Date().toISOString().slice(0, 10);
const REQUEST_DELAY_MS = Number(process.env.HEIGHT_REQUEST_DELAY_MS ?? 3500);
const MAX_RETRIES = 3;

const CLUBS = [
  { clubId: 'dvsc', clubName: 'DVSC', hlsz: 'https://hlsz.hu/debrecen', tm: 'https://www.transfermarkt.com/debreceni-vsc/kader/verein/84/saison_id/2025/plus/1' },
  { clubId: 'dvtk', clubName: 'DVTK', hlsz: 'https://hlsz.hu/diosgyor', tm: 'https://www.transfermarkt.com/diosgyori-vtk/kader/verein/9241/saison_id/2025/plus/1' },
  { clubId: 'eto', clubName: 'ETO FC Győr', hlsz: 'https://hlsz.hu/eto-fc-gyor', tm: 'https://www.transfermarkt.com/eto-fc/kader/verein/6055/saison_id/2025/plus/1' },
  { clubId: 'ferencvaros', clubName: 'Ferencvárosi TC', hlsz: 'https://hlsz.hu/ferencvarosi-tc', tm: 'https://www.transfermarkt.com/ferencvarosi-tc/kader/verein/279/saison_id/2025/plus/1' },
  { clubId: 'kazincbarcika', clubName: 'Kazincbarcikai SC', hlsz: 'https://hlsz.hu/kazincbarcika', tm: 'https://www.transfermarkt.com/kazincbarcikai-sc/kader/verein/24031/saison_id/2025/plus/1' },
  { clubId: 'kisvarda', clubName: 'Kisvárda FC', hlsz: 'https://hlsz.hu/kisvarda', tm: 'https://www.transfermarkt.com/kisvarda-fc/kader/verein/30613/saison_id/2025/plus/1' },
  { clubId: 'mtk', clubName: 'MTK Budapest', hlsz: 'https://hlsz.hu/mtk', tm: 'https://www.transfermarkt.com/mtk-budapest/kader/verein/634/saison_id/2025/plus/1' },
  { clubId: 'nyiregyhaza', clubName: 'Nyíregyháza Spartacus', hlsz: 'https://hlsz.hu/nyiregyhaza', tm: 'https://www.transfermarkt.com/nyiregyhaza-spartacus/kader/verein/6058/saison_id/2025/plus/1' },
  { clubId: 'paks', clubName: 'Paksi FC', hlsz: 'https://hlsz.hu/paks', tm: 'https://www.transfermarkt.com/paksi-fc/kader/verein/12163/saison_id/2025/plus/1' },
  { clubId: 'puskas-akademia', clubName: 'Puskás Akadémia FC', hlsz: 'https://hlsz.hu/puskas-akademia', tm: 'https://www.transfermarkt.com/puskas-akademia-fc/kader/verein/37169/saison_id/2025/plus/1' },
  { clubId: 'ujpest', clubName: 'Újpest FC', hlsz: 'https://hlsz.hu/ujpest-fc', tm: 'https://www.transfermarkt.com/ujpest-fc/kader/verein/708/saison_id/2025/plus/1' },
  { clubId: 'zte', clubName: 'ZTE FC', hlsz: 'https://hlsz.hu/zte', tm: 'https://www.transfermarkt.com/zalaegerszegi-te-fc/kader/verein/1391/saison_id/2025/plus/1' },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;
const finiteHeight = value => Number.isInteger(value) && value >= 140 && value <= 220;

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

function stripHtml(value) {
  return decodeHtml(String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
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

function textKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleUpperCase('hu-HU')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function nameTokens(value) {
  return [...new Set(textKey(value).split(' ').filter(token => token.length > 1))];
}

function namesCompatible(a, b) {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (!left.length || !right.length) return false;
  const leftSorted = [...left].sort().join('|');
  const rightSorted = [...right].sort().join('|');
  if (leftSorted === rightSorted) return true;
  const overlap = left.filter(token => right.includes(token)).length;
  return overlap >= 2 && overlap / Math.min(left.length, right.length) >= 0.66;
}

function toIsoDate(value) {
  const source = String(value ?? '').trim();
  const iso = source.match(/\b(\d{4})[-.](\d{2})[-.](\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = source.match(/\b(\d{2})[/.](\d{2})[/.](\d{4})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return null;
}

function parseHeight(value) {
  const source = String(value ?? '').replace(/\u00a0/g, ' ');
  const cm = source.match(/\b(1[4-9]\d|2[01]\d|220)\s*cm\b/i);
  if (cm) return Number(cm[1]);
  const metres = source.match(/\b([12])[,.](\d{2})\s*m\b/i);
  if (metres) {
    const result = Number(metres[1]) * 100 + Number(metres[2]);
    return finiteHeight(result) ? result : null;
  }
  return null;
}

function playerClubIds(player) {
  const ids = player?.meta?.clubIds;
  if (Array.isArray(ids) && ids.length) return ids;
  return [player?.clubId, player?.meta?.clubId].filter(Boolean);
}

function playerBirthDate(player) {
  return player?.dateOfBirth ?? player?.birthDate ?? null;
}

function parseTransfermarkt(html) {
  const results = [];
  const rowPattern = /<tr\b[^>]*class="[^"]*\b(?:odd|even)\b[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const match of html.matchAll(rowPattern)) {
    const row = match[1];
    const profile = row.match(/<a\b[^>]*href="([^"]*\/profil\/spieler\/\d+)[^"]*"[^>]*(?:title="([^"]+)")?[^>]*>([\s\S]*?)<\/a>/i);
    if (!profile) continue;
    const rowText = stripHtml(row);
    const birthDate = toIsoDate(rowText);
    const heightCm = parseHeight(rowText);
    if (!birthDate || !finiteHeight(heightCm)) continue;
    const titleName = decodeHtml(profile[2] ?? '').trim();
    const anchorName = stripHtml(profile[3]);
    const imageAlt = row.match(/<img\b[^>]*alt="([^"]+)"/i)?.[1] ?? '';
    const name = titleName || anchorName || decodeHtml(imageAlt).trim();
    if (!name) continue;
    results.push({
      name,
      birthDate,
      heightCm,
      profileUrl: new URL(profile[1], 'https://www.transfermarkt.com').href,
    });
  }
  return deduplicateSourceRows(results);
}

function likelyHlszName(line) {
  const cleaned = String(line ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bTOP\s*500!?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 4 || cleaned.length > 80) return null;
  const key = textKey(cleaned);
  if (!key || /^(RESZLETEK|AKTUALIS KLUBJA|SZULETESI DATUM|MAGASSAG|POSZT|ALLAMPOLGARSAG)$/.test(key)) return null;
  if (/^\d+$/.test(key)) return null;
  return cleaned;
}

function parseHlsz(html) {
  const lines = htmlLines(html);
  const results = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (textKey(lines[index]) !== 'SZULETESI DATUM') continue;
    const birthDate = toIsoDate(lines[index + 1] ?? '');
    if (!birthDate) continue;
    let heightCm = null;
    for (let cursor = index + 1; cursor <= Math.min(lines.length - 1, index + 10); cursor += 1) {
      const combined = `${lines[cursor]} ${lines[cursor + 1] ?? ''}`;
      if (textKey(lines[cursor]).startsWith('MAGASSAG') || /\bcm\b/i.test(combined)) {
        heightCm = parseHeight(combined);
        if (heightCm) break;
      }
    }
    if (!finiteHeight(heightCm)) continue;
    let detailsIndex = -1;
    for (let cursor = index - 1; cursor >= Math.max(0, index - 30); cursor -= 1) {
      if (textKey(lines[cursor]).includes('RESZLETEK')) {
        detailsIndex = cursor;
        break;
      }
    }
    const searchFrom = detailsIndex >= 0 ? detailsIndex - 1 : index - 1;
    let name = null;
    for (let cursor = searchFrom; cursor >= Math.max(0, searchFrom - 8); cursor -= 1) {
      const candidate = likelyHlszName(lines[cursor]);
      if (!candidate) continue;
      if (/^\([^)]*\)$/.test(lines[cursor])) continue;
      name = candidate;
      break;
    }
    if (!name) continue;
    results.push({ name, birthDate, heightCm });
  }
  return deduplicateSourceRows(results);
}

function deduplicateSourceRows(rows) {
  const result = new Map();
  for (const row of rows) {
    const key = `${textKey(row.name)}|${row.birthDate}`;
    const current = result.get(key);
    if (!current || current.heightCm === row.heightCm) result.set(key, row);
  }
  return [...result.values()];
}

async function fetchWithCache(url, cacheName) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, cacheName);
  try {
    const cached = await fs.readFile(cacheFile, 'utf8');
    if (cached.length > 1000) return { html: cached, cached: true };
  } catch {}

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    if (attempt > 1 || fetchWithCache.requestCount > 0) await sleep(REQUEST_DELAY_MS * attempt);
    fetchWithCache.requestCount += 1;
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; Fociskartyak2026DataAudit/1.0; public-data verification)',
          'accept-language': 'hu-HU,hu;q=0.9,en;q=0.8',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (html.length < 1000) throw new Error(`Túl rövid válasz (${html.length} bájt)`);
      await fs.writeFile(cacheFile, html);
      return { html, cached: false };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${url}: ${lastError?.message ?? 'ismeretlen lekérési hiba'}`);
}
fetchWithCache.requestCount = 0;

function choosePlayer(sourceRow, clubId, players) {
  const byClubAndBirth = players.filter(player =>
    playerClubIds(player).includes(clubId)
      && playerBirthDate(player) === sourceRow.birthDate
      && !finiteHeight(player.heightCm ?? player?.stats?.heightCm)
  );
  if (!byClubAndBirth.length) return { player: null, reason: 'no-club-birth-match' };
  const byName = byClubAndBirth.filter(player => namesCompatible(player.name, sourceRow.name));
  if (byName.length === 1) return { player: byName[0], reason: 'club-birth-name' };
  if (byClubAndBirth.length === 1 && nameTokens(sourceRow.name).length >= 2) {
    return { player: byClubAndBirth[0], reason: 'unique-club-birth' };
  }
  return { player: null, reason: byName.length > 1 ? 'ambiguous-name' : 'ambiguous-club-birth' };
}

function addSourceMatch(matches, conflicts, sourceRow, club, source) {
  const player = sourceRow.player;
  const existing = matches.get(player.id);
  const candidate = {
    player,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    sourceKind: source.kind,
    sourcePlayerName: sourceRow.name,
    sourcePlayerUrl: sourceRow.profileUrl ?? null,
    heightCm: sourceRow.heightCm,
    matchReason: sourceRow.matchReason,
    club,
  };
  if (!existing) {
    matches.set(player.id, candidate);
    return;
  }
  if (existing.heightCm !== candidate.heightCm) {
    conflicts.push({
      playerId: player.id,
      playerName: player.name,
      kept: { sourceId: existing.sourceId, heightCm: existing.heightCm },
      offered: { sourceId: candidate.sourceId, heightCm: candidate.heightCm },
    });
  }
  if (existing.sourceKind !== 'hlsz' && candidate.sourceKind === 'hlsz') matches.set(player.id, candidate);
}

async function main() {
  const database = JSON.parse(await fs.readFile(DATABASE_FILE, 'utf8'));
  const manifest = JSON.parse(await fs.readFile(MANIFEST_FILE, 'utf8'));
  const players = database.players ?? [];
  const beforeKnown = players.filter(player => finiteHeight(player.heightCm ?? player?.stats?.heightCm)).length;
  const targets = players.filter(player => !finiteHeight(player.heightCm ?? player?.stats?.heightCm));
  const matches = new Map();
  const conflicts = [];
  const sourceFailures = [];
  const sourceAudits = [];

  for (const club of CLUBS) {
    const sources = [
      { id: `hlsz-${club.clubId}-heights-2025-26`, name: `HLSZ – ${club.clubName} játékoskeret`, url: club.hlsz, kind: 'hlsz', parser: parseHlsz },
      { id: `transfermarkt-${club.clubId}-heights-2025-26`, name: `Transfermarkt – ${club.clubName} részletes keret 2025/26`, url: club.tm, kind: 'transfermarkt', parser: parseTransfermarkt },
    ];
    for (const source of sources) {
      try {
        const cacheName = `${club.clubId}-${source.kind}.html`;
        const fetched = await fetchWithCache(source.url, cacheName);
        const rows = source.parser(fetched.html);
        let matchedRows = 0;
        for (const row of rows) {
          const selection = choosePlayer(row, club.clubId, targets);
          if (!selection.player) continue;
          matchedRows += 1;
          addSourceMatch(matches, conflicts, {
            ...row,
            player: selection.player,
            matchReason: selection.reason,
          }, club, source);
        }
        sourceAudits.push({
          sourceId: source.id,
          clubId: club.clubId,
          sourceKind: source.kind,
          url: source.url,
          parsedRows: rows.length,
          matchedRows,
          cached: fetched.cached,
          status: 'ok',
        });
      } catch (error) {
        sourceFailures.push({ sourceId: source.id, clubId: club.clubId, url: source.url, error: error.message });
        sourceAudits.push({ sourceId: source.id, clubId: club.clubId, sourceKind: source.kind, url: source.url, parsedRows: 0, matchedRows: 0, status: 'failed', error: error.message });
      }
    }
  }

  const selected = [...matches.values()].sort((a, b) => a.club.clubId.localeCompare(b.club.clubId) || a.player.name.localeCompare(b.player.name, 'hu'));
  const sourcesById = new Map();
  for (const item of selected) {
    if (!sourcesById.has(item.sourceId)) {
      sourcesById.set(item.sourceId, {
        id: item.sourceId,
        clubId: item.club.clubId,
        clubName: item.club.clubName,
        name: item.sourceName,
        url: item.sourceUrl,
        checkedAt: CHECKED_AT,
        season: '2025/26',
        fields: ['heightCm'],
        scope: item.sourceKind === 'hlsz'
          ? 'A HLSZ nyilvános játékoskeret-oldalán számszerűen közölt magasság, névvel és születési dátummal ellenőrizve.'
          : 'A Transfermarkt 2025/26-os részletes keretoldalán számszerűen közölt magasság, névvel és születési dátummal ellenőrizve.',
      });
    }
  }

  const output = {
    schemaVersion: 1,
    season: '2025/26',
    generatedAt: new Date().toISOString(),
    batch: {
      id: 'all-club-verified-heights-2025-26',
      targetPlayerCount: targets.length,
      heightRecordCount: selected.length,
      rule: 'Csak hiányzó magasság tölthető ki. Az illesztéshez azonos szezonklub és pontos születési dátum szükséges; a név egyezését tokenalapon is ellenőrizzük.',
    },
    policy: {
      primarySources: ['HLSZ', 'Transfermarkt 2025/26 detailed squad pages'],
      heightUnit: 'cm',
      heightRange: { minimum: 140, maximum: 220 },
      overwriteExisting: false,
      requestDelayMs: REQUEST_DELAY_MS,
      cacheDirectory: '.cache/player-heights',
      rule: 'Becsült vagy következtetett érték nem kerülhet az adatbázisba; üres vagy bizonytalan forrásadat változatlanul hiányzó marad.',
    },
    sources: [...sourcesById.values()],
    records: selected.map(item => ({
      sourceId: item.sourceId,
      clubId: item.club.clubId,
      name: item.player.name,
      aliases: item.sourcePlayerName && textKey(item.sourcePlayerName) !== textKey(item.player.name) ? [item.sourcePlayerName] : undefined,
      birthDate: playerBirthDate(item.player),
      heightCm: item.heightCm,
      meta: {
        sourcePlayerUrl: item.sourcePlayerUrl,
        matchReason: item.matchReason,
      },
    })),
  };
  for (const record of output.records) if (!record.aliases) delete record.aliases;

  const matchedIds = new Set(selected.map(item => item.player.id));
  const unresolved = targets
    .filter(player => !matchedIds.has(player.id))
    .map(player => ({
      id: player.id,
      name: player.name,
      birthDate: playerBirthDate(player),
      clubIds: playerClubIds(player),
      appearances: player.appearances ?? player?.stats?.appearances ?? null,
      reason: 'A két ellenőrzött keretforrás egyikében sem volt egyértelmű, számszerűen megadott magasság.',
    }));

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    season: '2025/26',
    before: { players: players.length, knownHeights: beforeKnown, missingHeights: targets.length },
    generatedRecords: selected.length,
    projected: { knownHeights: beforeKnown + selected.length, missingHeights: unresolved.length },
    sourceAudits,
    sourceFailures,
    conflicts,
    unresolved,
  };

  await fs.writeFile(OUTPUT_FILE, jsonText(output));
  await fs.writeFile(REPORT_FILE, jsonText(report));

  const enrichments = manifest?.files?.enrichments;
  if (!Array.isArray(enrichments)) throw new Error('A manifest files.enrichments mezője hiányzik.');
  if (!enrichments.includes(OUTPUT_RELATIVE)) enrichments.push(OUTPUT_RELATIVE);
  manifest.lastUpdated = CHECKED_AT;
  await fs.writeFile(MANIFEST_FILE, jsonText(manifest));

  console.log(`Magasság-audit: ${beforeKnown}/${players.length} ismert -> várhatóan ${beforeKnown + selected.length}/${players.length}.`);
  console.log(`Új, ellenőrzött rekordok: ${selected.length}; feloldatlan: ${unresolved.length}; forráshibák: ${sourceFailures.length}; konfliktusok: ${conflicts.length}.`);
  if (selected.length < 50) throw new Error(`Túl kevés új magasságot sikerült kinyerni (${selected.length}); a források vagy a parser ellenőrzése szükséges.`);
}

await main();
