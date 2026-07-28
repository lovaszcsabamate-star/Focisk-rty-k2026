import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePlayerFederationData } from '../js/domain/federation-domain.js';
import { buildNormalizedDatabase } from './migrate-normalized-database.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const DEFAULT_FEDERATION_AUDIT_FILE = 'data/databases/hungary-nb1-2025-26/federation-audit-report.json';

const nationalTeamSummary = team => ({
  countryCode: team.countryCode,
  name: team.label,
  federationCode: team.federationCode,
  playerCount: team.count,
});

const federationTeamSummary = team => ({
  federationCode: team.federationCode,
  name: team.label,
  playerCount: team.count,
  badge: team.badge,
});

export function buildFederationAudit() {
  const { output } = buildNormalizedDatabase({ root: ROOT });
  const audit = validatePlayerFederationData(output.players);
  return {
    schemaVersion: 1,
    auditDate: '2026-07-28',
    generatedAt: output.generatedAt ?? null,
    databaseId: output.databaseId,
    databaseVersion: output.databaseVersion,
    season: output.season,
    minimumTeamSize: 11,
    playerCount: output.players.length,
    missingFederation: audit.missingFederation,
    unmappedCountries: audit.unmappedCountries,
    contradictions: audit.contradictions,
    duplicatePlayerIds: audit.duplicatePlayerIds,
    countries: audit.countries,
    federations: audit.federations,
    playableNationalTeams: audit.playableNationalTeams.map(nationalTeamSummary),
    playableFederationTeams: audit.playableFederationTeams.map(federationTeamSummary),
    summary: audit.summary,
  };
}

export function writeFederationAudit(relativeFile = DEFAULT_FEDERATION_AUDIT_FILE) {
  const report = buildFederationAudit();
  const target = path.join(ROOT, relativeFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  return { report, target };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const { report, target } = writeFederationAudit();
  console.log(`Föderációs audit: ${path.relative(ROOT, target)}`);
  console.log(`Föderációhoz rendelt országok: ${report.summary.mappedCountryCount}`);
  console.log(`Játszható válogatottak (${report.playableNationalTeams.length}): ${report.playableNationalTeams.map(team => `${team.name} (${team.playerCount})`).join(', ') || 'nincs'}`);
  console.log(`Játszható föderációk (${report.playableFederationTeams.length}): ${report.playableFederationTeams.map(team => `${team.name} (${team.playerCount})`).join(', ') || 'nincs'}`);
  console.log(`Hiányzó föderáció: ${report.missingFederation.length}; nem leképezett ország: ${report.unmappedCountries.length}; ellentmondás: ${report.contradictions.length}`);
  if (report.missingFederation.length || report.unmappedCountries.length || report.contradictions.length || report.duplicatePlayerIds.length) {
    process.exitCode = 1;
  }
}
