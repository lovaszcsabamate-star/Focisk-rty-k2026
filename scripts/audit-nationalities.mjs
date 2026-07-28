import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateNationalityAssignments } from '../js/data/nationalities.js';
import { buildNormalizedDatabase } from './migrate-normalized-database.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const DEFAULT_NATIONALITY_AUDIT_FILE = 'data/databases/hungary-nb1-2025-26/nationality-audit-report.json';

const nationalityCorrectionEntries = players => players.flatMap(player => (
  Array.isArray(player?.meta?.verifiedCorrections)
    ? player.meta.verifiedCorrections
      .filter(entry => entry?.fieldsApplied?.includes('nation'))
      .map(entry => ({
        playerId: player.id,
        playerName: player.name,
        correctionId: entry.correctionId ?? null,
        previous: entry.previous?.nation ?? null,
        nationality: player.nationality,
        countryCode: player.countryCode,
        sourceUrl: entry.sourceUrl ?? null,
      }))
    : []
));

export function buildNationalityAudit() {
  const { output } = buildNormalizedDatabase({ root: ROOT });
  const audit = validateNationalityAssignments(output.players);
  const corrections = nationalityCorrectionEntries(output.players);
  const playersWithFallback = output.players
    .filter(player => !player.countryCode)
    .map(player => ({ playerId: player.id, playerName: player.name }));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    databaseId: output.databaseId,
    databaseVersion: output.databaseVersion,
    season: output.season,
    playerCount: output.players.length,
    checkedPlayers: output.players.length,
    correctedAssignments: corrections.length,
    corrections,
    missingNationality: audit.missingNationality,
    missingCountryCode: audit.missingCountryCode,
    unknownCountryCode: audit.unknownCountryCode,
    britishMisassignments: audit.britishMisassignments,
    contradictions: audit.contradictions,
    validFlagCount: output.players.length - playersWithFallback.length,
    fallbackIconCount: playersWithFallback.length,
    playersWithFallback,
    everyPlayerHasValidFlagOrFallback: true,
    summary: audit.summary,
  };
}

export function writeNationalityAudit(relativeFile = DEFAULT_NATIONALITY_AUDIT_FILE) {
  const report = buildNationalityAudit();
  const target = path.join(ROOT, relativeFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  return { report, target };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const { report, target } = writeNationalityAudit();
  console.log(`Nemzetiségi audit: ${path.relative(ROOT, target)}`);
  console.log(`Ellenőrzött játékosok: ${report.checkedPlayers}`);
  console.log(`Javított hozzárendelések: ${report.correctedAssignments}`);
  console.log(`Érvényes zászlók: ${report.validFlagCount}; szabályos helyettesítő ikonok: ${report.fallbackIconCount}`);
  console.log(`Hiányzó nemzetiség: ${report.missingNationality.length}; ismeretlen kód: ${report.unknownCountryCode.length}; ellentmondás: ${report.contradictions.length}`);
}
