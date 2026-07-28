import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateNationalityAssignments } from '../js/data/nationalities.js';
import { buildNormalizedDatabase } from './migrate-normalized-database.mjs';
import { writeFederationAudit } from './audit-federations.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const DEFAULT_NATIONALITY_AUDIT_FILE = 'data/databases/hungary-nb1-2025-26/nationality-audit-report.json';

const HOME_NATION_CORRECTIONS = Object.freeze({
  ENG: 'GB-ENG',
  SCO: 'GB-SCT',
  WAL: 'GB-WLS',
  NIR: 'GB-NIR',
});

const SOURCE_CODE_ALIAS_CORRECTIONS = Object.freeze({
  BUL: 'BG',
  SUR: 'SR',
  TOG: 'TG',
});

const sourceNationalityCodes = player => String(
  player?.nationalityCode ?? player?.nation ?? '',
)
  .toLocaleUpperCase('en-US')
  .split(/\s*\/\s*|\s*;\s*|\s*,\s*/u)
  .map(value => value.trim())
  .filter(Boolean);

const verifiedCorrectionEntries = player => (
  Array.isArray(player?.meta?.verifiedCorrections)
    ? player.meta.verifiedCorrections
      .filter(entry => entry?.fieldsApplied?.includes('nation'))
      .map(entry => ({
        playerId: player.id,
        playerName: player.name,
        reason: 'verified-player-correction',
        correctionId: entry.correctionId ?? null,
        sourceCode: entry.previous?.nation ?? null,
        nationality: player.nationality,
        countryCode: player.countryCode,
        federation: player.federation ?? null,
        federationCode: player.federationCode ?? null,
        sourceUrl: entry.sourceUrl ?? null,
      }))
    : []
);

const inferredCorrectionEntries = player => {
  const verified = verifiedCorrectionEntries(player);
  if (verified.length) return verified;

  const codes = sourceNationalityCodes(player);
  const homeNationCode = codes.find(code => HOME_NATION_CORRECTIONS[code] === player.countryCode);
  if (homeNationCode) {
    return [{
      playerId: player.id,
      playerName: player.name,
      reason: 'home-nation-flag-separation',
      sourceCode: homeNationCode,
      previousFlagCode: 'GB',
      nationality: player.nationality,
      countryCode: player.countryCode,
      federation: player.federation ?? null,
      federationCode: player.federationCode ?? null,
      sourceUrl: player.sourceUrl ?? player.meta?.sourceUrl ?? null,
    }];
  }

  const aliasCode = codes.find(code => SOURCE_CODE_ALIAS_CORRECTIONS[code] === player.countryCode);
  if (aliasCode) {
    return [{
      playerId: player.id,
      playerName: player.name,
      reason: 'source-code-alias-resolution',
      sourceCode: aliasCode,
      nationality: player.nationality,
      countryCode: player.countryCode,
      federation: player.federation ?? null,
      federationCode: player.federationCode ?? null,
      sourceUrl: player.sourceUrl ?? player.meta?.sourceUrl ?? null,
    }];
  }

  return [];
};

const correctionSummary = corrections => corrections.reduce((summary, correction) => {
  summary[correction.reason] = (summary[correction.reason] ?? 0) + 1;
  return summary;
}, {});

export function buildNationalityAudit() {
  const { output } = buildNormalizedDatabase({ root: ROOT });
  const audit = validateNationalityAssignments(output.players);
  const corrections = output.players.flatMap(inferredCorrectionEntries);
  const playersWithFallback = output.players
    .filter(player => !player.countryCode)
    .map(player => ({ playerId: player.id, playerName: player.name }));
  const validFlagCount = output.players.length - playersWithFallback.length;

  return {
    schemaVersion: 3,
    auditDate: '2026-07-28',
    generatedAt: output.generatedAt ?? null,
    databaseId: output.databaseId,
    databaseVersion: output.databaseVersion,
    season: output.season,
    playerCount: output.players.length,
    checkedPlayers: output.players.length,
    correctedAssignments: corrections.length,
    correctionSummary: correctionSummary(corrections),
    corrections,
    missingNationality: audit.missingNationality,
    missingCountryCode: audit.missingCountryCode,
    missingFederation: audit.missingFederation,
    unknownCountryCode: audit.unknownCountryCode,
    britishMisassignments: audit.britishMisassignments,
    contradictions: audit.contradictions,
    federationContradictions: audit.federationContradictions,
    validFlagCount,
    fallbackIconCount: playersWithFallback.length,
    playersWithFallback,
    everyPlayerHasValidFlagOrFallback: validFlagCount + playersWithFallback.length === output.players.length,
    everyPlayerHasFederation: audit.missingFederation.length === 0,
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
  const federation = writeFederationAudit();
  console.log(`Nemzetiségi audit: ${path.relative(ROOT, target)}`);
  console.log(`Ellenőrzött játékosok: ${report.checkedPlayers}`);
  console.log(`Javított hozzárendelések: ${report.correctedAssignments}`);
  console.log(`Érvényes zászlók: ${report.validFlagCount}; szabályos helyettesítő ikonok: ${report.fallbackIconCount}`);
  console.log(`Hiányzó nemzetiség: ${report.missingNationality.length}; ismeretlen kód: ${report.unknownCountryCode.length}; hiányzó föderáció: ${report.missingFederation.length}; ellentmondás: ${report.contradictions.length + report.federationContradictions.length}`);
  console.log(`Föderációs audit: ${path.relative(ROOT, federation.target)}`);
  console.log(`Játszható válogatottak (${federation.report.playableNationalTeams.length}): ${federation.report.playableNationalTeams.map(team => `${team.name} (${team.playerCount})`).join(', ') || 'nincs'}`);
  console.log(`Játszható föderációk (${federation.report.playableFederationTeams.length}): ${federation.report.playableFederationTeams.map(team => `${team.name} (${team.playerCount})`).join(', ') || 'nincs'}`);
  if (report.missingFederation.length || report.federationContradictions.length) process.exitCode = 1;
}
