import fs from 'node:fs';
import path from 'node:path';

import { isValidHeightCm, MAX_VALID_HEIGHT_CM, MIN_VALID_HEIGHT_CM } from '../js/data/height.js';
import { buildNormalizedDatabase, PROJECT_ROOT } from './migrate-normalized-database.mjs';

export const BASELINE_HEIGHT_COUNT = 285;
export const EXPECTED_PLAYER_COUNT = 440;
export const EXPECTED_REGISTRATION_COUNT = 464;

const CLUB_NAMES = Object.freeze({
  dvsc: 'DVSC',
  dvtk: 'DVTK',
  'eto-fc': 'ETO FC',
  'ferencvarosi-tc': 'Ferencvárosi TC',
  'kisvarda-master-good': 'Kisvárda Master Good',
  'kolorcity-kazincbarcika-sc': 'Kolorcity Kazincbarcika SC',
  'mtk-budapest': 'MTK Budapest',
  'nyiregyhaza-spartacus-fc': 'Nyíregyháza Spartacus FC',
  'paksi-fc': 'Paksi FC',
  'puskas-akademia-fc': 'Puskás Akadémia FC',
  'ujpest-fc': 'Újpest FC',
  'zte-fc': 'ZTE FC',
});

const percent = (known, total) => total ? Number((known / total * 100).toFixed(1)) : 0;
const playerName = player => player?.displayName ?? player?.name ?? null;
const birthDate = player => player?.dateOfBirth ?? player?.birthDate ?? null;
const playerHeight = player => player?.heightCm ?? player?.stats?.heightCm ?? null;

function registrationClubIds(player) {
  const ids = Array.isArray(player?.meta?.clubIds) ? player.meta.clubIds.filter(Boolean) : [];
  if (ids.length) return [...new Set(ids)];
  if (player?.meta?.clubId) return [player.meta.clubId];
  return [];
}

export function createHeightCoverageAudit(players, { baselineKnown = BASELINE_HEIGHT_COUNT } = {}) {
  const list = Array.isArray(players) ? players : [];
  const clubs = new Map(Object.entries(CLUB_NAMES).map(([clubId, club]) => [clubId, {
    clubId, club, players: 0, known: 0, missing: 0, invalid: 0, missingPlayers: [],
  }]));
  const invalid = [];
  const missing = [];
  let registrationRecords = 0;

  for (const player of list) {
    const heightCm = playerHeight(player);
    const missingEntry = {
      id: player?.id ?? null,
      name: playerName(player),
      birthDate: birthDate(player),
      clubIds: registrationClubIds(player),
    };

    if (heightCm == null) missing.push(missingEntry);
    else if (!isValidHeightCm(heightCm)) invalid.push({ ...missingEntry, heightCm });

    const clubIds = registrationClubIds(player);
    registrationRecords += clubIds.length;
    for (const clubId of clubIds) {
      if (!clubs.has(clubId)) {
        clubs.set(clubId, { clubId, club: clubId, players: 0, known: 0, missing: 0, invalid: 0, missingPlayers: [] });
      }
      const clubAudit = clubs.get(clubId);
      clubAudit.players += 1;
      if (heightCm == null) {
        clubAudit.missing += 1;
        clubAudit.missingPlayers.push({ id: player?.id ?? null, name: playerName(player), birthDate: birthDate(player) });
      } else if (!isValidHeightCm(heightCm)) {
        clubAudit.invalid += 1;
      } else {
        clubAudit.known += 1;
      }
    }
  }

  const clubRows = [...clubs.values()]
    .map(row => ({ ...row, coveragePercent: percent(row.known, row.players) }))
    .sort((a, b) => a.club.localeCompare(b.club, 'hu'));
  const known = list.filter(player => isValidHeightCm(playerHeight(player))).length;

  return {
    schemaVersion: 2,
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
      registrationRecords,
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

  return `# Height Coverage Audit – NB I 2025/26\n\nEllenőrzés dátuma: **${audit.checkedAt}**\n\n## Összesítés\n\n- Egyedi játékosok: **${audit.summary.players}**\n- Szezonbeli klubregisztrációk: **${audit.summary.registrationRecords}**\n- Ismert hiteles magasság: **${audit.summary.known}**\n- Hiányzó magasság: **${audit.summary.missing}**\n- Érvénytelen magasság: **${audit.summary.invalid}**\n- Lefedettség: **${audit.summary.coveragePercent.toFixed(1)}%**\n- Kiinduló lefedettség: **${audit.baseline.known}/${audit.baseline.players} (${audit.baseline.coveragePercent.toFixed(1)}%)**\n\n## Klub szerinti lefedettség\n\nA klubtábla regisztrációszintű, ezért a klubonkénti játékosszámok összege 464. A klubváltó játékos magassága személyadatként ugyanaz minden regisztrációjánál.\n\n| Klub | Játékos | Magasság ismert | Hiányzik | Lefedettség |\n| --- | ---: | ---: | ---: | ---: |\n${rows.join('\n')}\n\n## Hiányzó magasságú játékosok\n\n${missingSections || 'Nincs hiányzó rekord.'}\n`;
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
  if (audit.summary.registrationRecords !== EXPECTED_REGISTRATION_COUNT) {
    throw new Error(`Váratlan klubregisztráció-szám: ${audit.summary.registrationRecords} (várt: ${EXPECTED_REGISTRATION_COUNT})`);
  }
  if (audit.clubs.length !== 12) throw new Error(`Váratlan klubszám: ${audit.clubs.length} (várt: 12)`);
  if (audit.summary.invalid !== 0) throw new Error(`Érvénytelen magasságok: ${audit.summary.invalid}`);
  if (audit.summary.known < BASELINE_HEIGHT_COUNT) {
    throw new Error(`A magasságlefedettség romlott: ${audit.summary.known}/${audit.summary.players}`);
  }
}
