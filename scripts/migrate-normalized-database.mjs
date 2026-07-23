import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';
import { applyVerifiedPlayerCorrections } from '../js/data/verified-player-corrections.js';
import {
  CANONICAL_PLAYER_FIELDS,
  PLAYER_MODEL_VERSION,
  normalisePlayerPayload,
  validatePlayerPayload,
} from '../js/models/player-model.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..');
export const DEFAULT_MANIFEST_FILE = 'data/databases/hungary-nb1-2025-26/manifest.json';
export const DEFAULT_OUTPUT_FILE = 'data/databases/hungary-nb1-2025-26/players.normalized.json';
export const DEFAULT_REPORT_FILE = 'data/databases/hungary-nb1-2025-26/normalization-report.json';

const readText = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const readJson = (root, relative) => JSON.parse(readText(root, relative));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;

function combineEnrichments(parts, directory) {
  const valid = parts.filter(part => part && Array.isArray(part.records));
  if (!valid.length) return null;
  return {
    ...valid[0],
    generatedAt: valid.at(-1)?.generatedAt ?? valid[0].generatedAt,
    sources: valid.flatMap(part => part.sources ?? []),
    records: valid.flatMap(part => part.records ?? []),
    clubDirectory: Array.isArray(directory?.clubs) ? directory.clubs : [],
  };
}

function combineCorrections(parts) {
  const valid = parts.filter(Boolean);
  return {
    schemaVersion: 1,
    checkedAt: valid.at(-1)?.checkedAt ?? null,
    addSources: valid.flatMap(part => part.addSources ?? []),
    recordPatches: valid.flatMap(part => part.recordPatches ?? []),
    verifiedCorrections: valid.flatMap(part => part.verifiedCorrections ?? []),
    excludeRecords: valid.flatMap(part => part.excludeRecords ?? []),
    additions: valid.flatMap(part => part.additions ?? []),
  };
}

function sourceFileList(manifestFile, manifest) {
  const files = manifest?.files ?? {};
  return [
    manifestFile,
    files.players,
    files.clubDirectory,
    ...(files.enrichments ?? []),
    ...(files.corrections ?? []),
    ...(files.statPatches ?? []),
  ].filter(Boolean);
}

function sourceDigest(root, files) {
  const content = files
    .map(file => `${file}\n${readText(root, file)}`)
    .join('\n---FOCISKARTYAK-SOURCE-FILE---\n');
  return sha256(content);
}

function completenessSummary(players) {
  const missingFieldCounts = {};
  let ratioTotal = 0;
  let completeRecords = 0;

  for (const player of players) {
    const completeness = player.dataCompleteness ?? { ratio: 0, missingFields: [] };
    ratioTotal += completeness.ratio ?? 0;
    if ((completeness.missingFields ?? []).length === 0) completeRecords += 1;
    for (const field of completeness.missingFields ?? []) {
      missingFieldCounts[field] = (missingFieldCounts[field] ?? 0) + 1;
    }
  }

  return {
    averageRatio: players.length ? Number((ratioTotal / players.length).toFixed(4)) : 0,
    completeRecords,
    incompleteRecords: players.length - completeRecords,
    missingFieldCounts: Object.fromEntries(
      Object.entries(missingFieldCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'hu')),
    ),
  };
}

function assertPreserved(sourcePlayers, normalizedPlayers) {
  if (sourcePlayers.length !== normalizedPlayers.length) {
    throw new Error(`A migráció megváltoztatta a játékosszámot: ${sourcePlayers.length} -> ${normalizedPlayers.length}`);
  }

  const normalizedById = new Map(normalizedPlayers.map(player => [player.id, player]));
  const missingIds = [];
  const changedStats = [];
  const changedNames = [];

  for (const source of sourcePlayers) {
    const normalized = normalizedById.get(source.id);
    if (!normalized) {
      missingIds.push(source.id);
      continue;
    }
    if (normalized.name !== source.name) changedNames.push(source.id);
    if (JSON.stringify(normalized.stats ?? null) !== JSON.stringify(source.stats ?? null)) {
      changedStats.push(source.id);
    }
  }

  if (missingIds.length || changedNames.length || changedStats.length) {
    throw new Error(
      `A migráció adatot módosított: hiányzó azonosító=${missingIds.length}, `
      + `megváltozott név=${changedNames.length}, megváltozott stats=${changedStats.length}`,
    );
  }

  return {
    stablePlayerCount: true,
    stableIds: true,
    unchangedNames: true,
    unchangedStatsObjects: true,
  };
}

export function buildNormalizedDatabase({
  root = PROJECT_ROOT,
  manifestFile = DEFAULT_MANIFEST_FILE,
} = {}) {
  const manifest = readJson(root, manifestFile);
  const files = manifest.files ?? {};
  const enrichmentFiles = Array.isArray(files.enrichments) ? files.enrichments : [];
  const correctionFiles = Array.isArray(files.corrections) ? files.corrections : [];
  const statPatchFiles = Array.isArray(files.statPatches) ? files.statPatches : [];

  if (!files.players || !files.clubDirectory) {
    throw new Error(`Hiányos adatbázis-manifest: ${manifestFile}`);
  }

  const basePayload = readJson(root, files.players);
  const directory = readJson(root, files.clubDirectory);
  const enrichmentParts = enrichmentFiles.map(file => readJson(root, file));
  const correctionParts = correctionFiles.map(file => readJson(root, file));
  const statPatchParts = statPatchFiles.map(file => readJson(root, file));

  const corrections = combineCorrections(correctionParts);
  const correctedPayload = applyVerifiedPlayerCorrections(basePayload, corrections.verifiedCorrections);
  const combinedEnrichment = combineEnrichments(enrichmentParts, directory);
  const enrichment = combinedEnrichment
    ? prepareClubEnrichment(combinedEnrichment, corrections)
    : null;
  const enrichedPayload = enrichment
    ? applyClubEnrichmentPayload(correctedPayload, enrichment)
    : correctedPayload;
  const reviewedPayload = applyOfficialStatPatches(enrichedPayload, statPatchParts);
  const normalizedPayload = normalisePlayerPayload(reviewedPayload, { database: manifest });
  const validation = validatePlayerPayload(normalizedPayload.players);

  if (validation.errors.length) {
    throw new Error(
      `A normalizált adatbázis ${validation.errors.length} kritikus hibát tartalmaz: `
      + validation.errors.slice(0, 8).join('; '),
    );
  }

  const preservation = assertPreserved(reviewedPayload.players, normalizedPayload.players);
  const sources = sourceFileList(manifestFile, manifest);
  const deterministicGeneratedAt = reviewedPayload.generatedAt
    ?? manifest.lastUpdated
    ?? null;
  const playersDigest = sha256(JSON.stringify(normalizedPayload.players));
  const completeness = completenessSummary(normalizedPayload.players);

  const output = {
    schemaVersion: 1,
    databaseId: manifest.id,
    databaseVersion: manifest.version,
    name: manifest.name,
    competition: manifest.competition,
    country: manifest.country,
    season: manifest.season,
    generatedAt: deterministicGeneratedAt,
    playerModel: normalizedPayload.playerModel,
    migration: {
      schemaVersion: 1,
      playerModelVersion: PLAYER_MODEL_VERSION,
      sourceType: 'legacy-layered-database',
      sourceManifest: manifestFile,
      sourceFiles: sources,
      sourceDigest: sourceDigest(root, sources),
      playersDigest,
      canonicalFields: CANONICAL_PLAYER_FIELDS,
      sourceLayerCounts: {
        enrichments: enrichmentFiles.length,
        corrections: correctionFiles.length,
        statPatches: statPatchFiles.length,
      },
      preservation,
    },
    selection: reviewedPayload.selection ?? null,
    coverage: reviewedPayload.coverage ?? null,
    players: normalizedPayload.players,
  };

  const report = {
    schemaVersion: 1,
    databaseId: manifest.id,
    databaseVersion: manifest.version,
    generatedAt: deterministicGeneratedAt,
    outputFile: files.normalizedPlayers ?? DEFAULT_OUTPUT_FILE,
    reportFile: files.normalizationReport ?? DEFAULT_REPORT_FILE,
    playerModelVersion: PLAYER_MODEL_VERSION,
    playerCount: output.players.length,
    registrationRecords: reviewedPayload.selection?.registrationRecords ?? null,
    sourceFiles: sources,
    sourceDigest: output.migration.sourceDigest,
    playersDigest,
    sourceLayerCounts: output.migration.sourceLayerCounts,
    validation: {
      ...validation.summary,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    completeness,
    preservation,
  };

  return { manifest, output, report };
}

export function writeNormalizedDatabase({
  root = PROJECT_ROOT,
  manifestFile = DEFAULT_MANIFEST_FILE,
  check = false,
} = {}) {
  const result = buildNormalizedDatabase({ root, manifestFile });
  const outputFile = result.manifest.files?.normalizedPlayers ?? DEFAULT_OUTPUT_FILE;
  const reportFile = result.manifest.files?.normalizationReport ?? DEFAULT_REPORT_FILE;
  const expectedOutput = jsonText(result.output);
  const expectedReport = jsonText(result.report);

  if (check) {
    const actualOutput = readText(root, outputFile);
    const actualReport = readText(root, reportFile);
    if (actualOutput !== expectedOutput || actualReport !== expectedReport) {
      throw new Error('A commitolt normalizált adatbázis nem egyezik a reprodukálható migráció eredményével.');
    }
  } else {
    fs.mkdirSync(path.dirname(path.join(root, outputFile)), { recursive: true });
    fs.writeFileSync(path.join(root, outputFile), expectedOutput);
    fs.writeFileSync(path.join(root, reportFile), expectedReport);
  }

  return { ...result, outputFile, reportFile };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const check = process.argv.includes('--check');
  const result = writeNormalizedDatabase({ check });
  const action = check ? 'Ellenőrizve' : 'Elkészült';
  console.log(`${action}: ${result.outputFile}`);
  console.log(`Játékosok: ${result.output.players.length} · modell: v${PLAYER_MODEL_VERSION}`);
  console.log(`Forrásrétegek: ${result.report.sourceLayerCounts.enrichments} kiegészítés, ${result.report.sourceLayerCounts.corrections} korrekció, ${result.report.sourceLayerCounts.statPatches} statisztikai csomag`);
  console.log(`Validáció: ${result.report.validation.errorCount} hiba, ${result.report.validation.warningCount} figyelmeztetés`);
}
