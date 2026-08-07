import fs from 'node:fs';
import path from 'node:path';

import { buildNormalizedDatabase, PROJECT_ROOT } from './migrate-normalized-database.mjs';

export const MIN_VALID_HEIGHT_CM = 140;
export const MAX_VALID_HEIGHT_CM = 220;
export const BASELINE_HEIGHT_COUNT = 285;
export const EXPECTED_PLAYER_COUNT = 440;

export function isValidHeightCm(value) {
  return Number.isInteger(value) && value >= MIN_VALID_HEIGHT_CM && value <= MAX_VALID_HEIGHT_CM;
}

const percent = (known, total) => total ? Number((known / total * 100).toFixed(1)) : 0;

export function createHeightCoverageAudit(players, { baselineKnown = BASELINE_HEIGHT_COUNT } = {}) {
  const list = Array.isArray(players) ? players : [];
  const clubs = new Map();
  const invalid = [];
  const missing = [];

  for (const player of list) {
    const club = player?.clubName ?? player?.club ?? 'Ismeretlen klub';
    if (!clubs.has(club)) clubs.set(club, { club, players: 0, known: 0, missing: 0, invalid: 0, missingPlayers: [] });
    const clubAudit = clubs.get(club);
    clubAudit.players += 1;

    const heightCm = player?.heightCm ?? player?.stats?.heightCm ?? null;
    if (heightCm == null) {
      clubAudit.missing += 1;
      clubAudit.missingPlayers.push({
        id: player?.id ?? null,
        name: player?.displayName ?? player?.name ?? null,
        birthDate: player?.dateOfBirth ?? player?.birthDate ?? null,
      });
      missing.push({
        id: player?.id ?? null,
        name: player?.displayName ?? player?.name ?? null,
        club,
        birthDate: player?.dateOfBirth ?? player?.birthDate ?? null,
      });
      continue;
    }

    if (!isValidHeightCm(heightCm)) {
      clubAudit.invalid += 1;
      invalid.push({ id: player?.id ?? null, name: player?.displayName ?? player?.name ?? null, club, heightCm });
      continue;
    }

    clubAudit.known += 1;
  }

  const clubRows = [...clubs.values()]
    .map(row => ({ ...row, coveragePercent: percent(row.known, row.players) }))
    .sort((a, b) => a.club.localeCompare(b.club, 'hu'));
  const known = clubRows.reduce((sum, row) => sum + row.known, 0);

  return {
    schemaVersion: 1,
    season: '2025/26',
    checkedAt: '2026-08-08',
    validation: {
      minimumHeightCm: MIN_VALID_HEIGHT_CM,
      maximumHeightCm: MAX_VALID_HEIGHT_CM,
      integerOnly: true,
    },
    baseline: { known: baselineKnown, players: EXPECTED_PLAYER_COUNT, coveragePercent: percent(baselineKnown, EXPECTED_PLAYER_COUNT) },
    summary: {
      players: list.length,
      known,
      missing: missing.length,
      invalid: invalid.length,
      coveragePercent: percent(known, list.length),
      deltaFromBaseline: known - baselineKnown,
    },
    clubs: clubRows,
    missingPlayers: missing,
    invalidPlayers: invalid,
  };
}

export function renderHeightCoverageMarkdown(audit) {
  const rows = audit.clubs.map(row => `| ${row.club} | ${row.players} | ${row.known} | ${row.missing} | ${row.coveragePercent.toFixed(1)}% |`);
  const missingSections = audit.clubs
    .filter(row => row.missingPlayers.length)
    .map(row => `### ${row.club}\n\n${row.missingPlayers.map(player => `- ${player.name} (${player.birthDate ?? 'születési dátum nélkül'})`).join('\n')}`)
    .join('\n\n');

  return `# Height Coverage Audit – NB I 2025/26\n\nEllenőrzés dátuma: **${audit.checkedAt}**\n\n## Összesítés\n\n- Játékosok: **${audit.summary.players}**\n- Ismert hiteles magasság: **${audit.summary.known}**\n- Hiányzó magasság: **${audit.summary.missing}**\n- Érvénytelen magasság: **${audit.summary.invalid}**\n- Lefedettség: **${audit.summary.coveragePercent.toFixed(1)}%**\n- Kiinduló lefedettség: **${audit.baseline.known}/${audit.baseline.players} (${audit.baseline.coveragePercent.toFixed(1)}%)**\n\n## Klub szerinti lefedettség\n\n| Klub | Játékos | Magasság ismert | Hiányzik | Lefedettség |\n| --- | ---: | ---: | ---: | ---: |\n${rows.join('\n')}\n\n## Hiányzó magasságú játékosok\n\n${missingSections || 'Nincs hiányzó rekord.'}\n`;
}

function writeReports(audit) {
  const jsonPath = path.join(PROJECT_ROOT, 'data/reports/height-coverage-2025-26.json');
  const markdownPath = path.join(PROJECT_ROOT, 'docs/data/height-coverage-2025-26.md');
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderHeightCoverageMarkdown(audit));
  return { jsonPath, markdownPath };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isCli) {
  const { output } = buildNormalizedDatabase();
  const audit = createHeightCoverageAudit(output.players);
  if (process.argv.includes('--write')) writeReports(audit);
  console.log('HEIGHT_COVERAGE_AUDIT_BEGIN');
  console.log(JSON.stringify(audit, null, 2));
  console.log('HEIGHT_COVERAGE_AUDIT_END');

  if (audit.summary.players !== EXPECTED_PLAYER_COUNT) {
    throw new Error(`Váratlan játékosszám: ${audit.summary.players} (várt: ${EXPECTED_PLAYER_COUNT})`);
  }
  if (audit.summary.invalid !== 0) throw new Error(`Érvénytelen magasságok: ${audit.summary.invalid}`);
  if (audit.summary.known < BASELINE_HEIGHT_COUNT) {
    throw new Error(`A magasságlefedettség romlott: ${audit.summary.known}/${audit.summary.players}`);
  }
}
