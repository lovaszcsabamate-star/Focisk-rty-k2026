/** Create a dependency-free, single-file preview build and complete database review. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';
import { filterCompleteCardsPayload } from '../js/data/complete-cards.js';
import { applyVerifiedPlayerCorrections } from '../js/data/verified-player-corrections.js';
import { auditAssetLicenses } from './audit-assets.mjs';
import {
  auditReviewedDatabase,
  writeDatabaseReviewFiles,
} from './database-review.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const assetAudit = auditAssetLicenses();
if (!assetAudit.ok) throw new Error('Az assetlicenc-ellenőrzés hibát talált; a kiadási build leállt.');

const registryFile = 'data/databases/registry.json';
const registry = JSON.parse(read(registryFile));
const defaultEntry = registry.databases?.find(entry => (
  entry?.enabled !== false && entry?.id === registry.defaultDatabaseId
));
if (!defaultEntry?.manifest) {
  throw new Error(`Az alapértelmezett adatbázis nincs helyesen regisztrálva: ${registry.defaultDatabaseId ?? 'ismeretlen'}`);
}

const databaseManifestFile = defaultEntry.manifest;
const databaseManifest = JSON.parse(read(databaseManifestFile));
if (databaseManifest.id !== defaultEntry.id || databaseManifest.enabled === false) {
  throw new Error(`Az adatbázis-manifest nem használható: ${databaseManifestFile}`);
}

const playerFile = databaseManifest.files?.players;
const normalizedPlayerFile = databaseManifest.files?.normalizedPlayers;
const enrichmentFiles = databaseManifest.files?.enrichments ?? [];
const correctionFiles = databaseManifest.files?.corrections ?? [];
const statPatchFiles = databaseManifest.files?.statPatches ?? [];
const directoryFile = databaseManifest.files?.clubDirectory;
if (!playerFile || !directoryFile || !Array.isArray(enrichmentFiles)
  || !Array.isArray(correctionFiles) || !Array.isArray(statPatchFiles)) {
  throw new Error(`Az adatbázis-manifest fájllistája hiányos: ${databaseManifestFile}`);
}
const sourceFiles = [
  registryFile,
  databaseManifestFile,
  playerFile,
  ...enrichmentFiles,
  ...correctionFiles,
  ...statPatchFiles,
  directoryFile,
];

const moduleOrder = [
  'js/app/configuration.js',
  'js/services/storage-service.js',
  'js/services/asset-service.js',
  'js/domain/deck-selection-domain.js',
  'js/deck-selection.js',
  'js/branding.js',
  'js/data/categories.js',
  'js/data/players.js',
  'js/engine.js',
  'js/penalties.js',
  'js/ai.js',
  'js/services/save-service.js',
  'js/services/turn-timing-service.js',
  'js/app/session-lifecycle-service.js',
  'js/game/game-mode-factory.js',
  'js/game/game-runtime.js',
  'js/banter.js',
  'js/ui/dom-primitives.js',
  'js/ui/card-component.js',
  'js/ui/scoreboard-component.js',
  'js/ui/attribute-picker-component.js',
  'js/ui.js',
  'js/ux.js',
  'js/ux-fixes.js',
  'js/matchday.js',
  'js/opponents.js',
  'js/pwa.js',
  'js/mobile-experience.js',
  'js/player-profile.js',
  'js/reliability-fixes.js',
  'js/usability-fixes.js',
  'js/focus-experience.js',
  'js/visual-settings-persistence.js',
  'js/visual-system.js',
  'js/legal-ui.js',
  'js/main.js',
];

const flattenModule = source => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');

const bundle = moduleOrder
  .map(file => `\n/* ===== ${file} ===== */\n${flattenModule(read(file))}`)
  .join('\n');
const basePayload = JSON.parse(read(playerFile));
const enrichmentParts = enrichmentFiles.map(file => JSON.parse(read(file)));
const correctionParts = correctionFiles.map(file => JSON.parse(read(file)));
const statPatchParts = statPatchFiles.map(file => JSON.parse(read(file)));
const directory = JSON.parse(read(directoryFile));
const rawEnrichment = {
  ...enrichmentParts[0],
  generatedAt: enrichmentParts.at(-1)?.generatedAt ?? enrichmentParts[0].generatedAt,
  sources: enrichmentParts.flatMap(part => part.sources ?? []),
  records: enrichmentParts.flatMap(part => part.records ?? []),
  clubDirectory: Array.isArray(directory?.clubs) ? directory.clubs : [],
};
const corrections = {
  schemaVersion: 1,
  checkedAt: correctionParts.at(-1)?.checkedAt ?? null,
  addSources: correctionParts.flatMap(part => part.addSources ?? []),
  recordPatches: correctionParts.flatMap(part => part.recordPatches ?? []),
  verifiedCorrections: correctionParts.flatMap(part => part.verifiedCorrections ?? []),
  excludeRecords: correctionParts.flatMap(part => part.excludeRecords ?? []),
  additions: correctionParts.flatMap(part => part.additions ?? []),
};
const correctedPayload = applyVerifiedPlayerCorrections(basePayload, corrections.verifiedCorrections);
const enrichment = prepareClubEnrichment(rawEnrichment, corrections);
const enrichedPayload = applyClubEnrichmentPayload(correctedPayload, enrichment);
const payload = applyOfficialStatPatches(enrichedPayload, statPatchParts);
const reviewGeneratedAt = new Date().toISOString();
const databaseReview = auditReviewedDatabase(payload, {
  generatedAt: reviewGeneratedAt,
  sourceFiles,
  directory,
});
writeDatabaseReviewFiles(ROOT, payload, databaseReview);

let buildPayload = payload;
let buildDataSource = 'legacy-layered';
if (normalizedPlayerFile) {
  try {
    const normalizedPayload = JSON.parse(read(normalizedPlayerFile));
    if (normalizedPayload.databaseId !== databaseManifest.id) {
      throw new Error(`eltérő databaseId: ${normalizedPayload.databaseId ?? 'hiányzik'}`);
    }
    if (!Array.isArray(normalizedPayload.players)
      || normalizedPayload.players.length !== payload.players.length) {
      throw new Error('eltérő vagy hiányzó játékoslista');
    }
    const requiredModelVersion = databaseManifest.normalization?.playerModelVersion;
    if (requiredModelVersion != null
      && normalizedPayload.playerModel?.version !== requiredModelVersion) {
      throw new Error(`nem támogatott játékosmodell: ${normalizedPayload.playerModel?.version ?? 'ismeretlen'}`);
    }
    if ((normalizedPayload.playerModel?.validation?.errorCount ?? 0) > 0) {
      throw new Error('kritikus játékosmodell-validációs hiba');
    }
    buildPayload = {
      ...normalizedPayload,
      source: normalizedPayload.source ?? payload.source,
      enrichment: normalizedPayload.enrichment ?? payload.enrichment,
      verifiedPlayerCorrections: normalizedPayload.verifiedPlayerCorrections
        ?? payload.verifiedPlayerCorrections,
      officialStatPatches: normalizedPayload.officialStatPatches
        ?? payload.officialStatPatches,
    };
    buildDataSource = 'normalized';
  } catch (error) {
    console.warn(
      `[standalone] A normalizált adatbázis nem használható (${normalizedPlayerFile}): ${error.message}. `
      + 'A build a régi forrásrétegeket ágyazza be.',
    );
  }
}

const playablePayload = filterCompleteCardsPayload(buildPayload, {
  playerModel: { database: databaseManifest },
});
const safeJson = JSON.stringify(playablePayload).replace(/<\/script/gi, '<\\/script');
const safeBundle = bundle.replace(/<\/script/gi, '<\\/script');
let css = `${read('css/style.css')}\n\n${read('css/ux.css')}\n\n${read('css/matchday.css')}\n\n${read('css/opponents.css')}\n\n${read('css/pwa.css')}\n\n${read('css/mobile-experience.css')}\n\n${read('css/mobile-overlay-fix.css')}\n\n${read('css/player-profile.css')}\n\n${read('css/focus-experience.css')}\n\n${read('css/mobile-selection-fix.css')}\n\n${read('css/duel-emphasis.css')}\n\n${read('css/phase-refinements.css')}\n\n${read('css/visual-system.css')}\n\n${read('css/legal-ui.css')}`;

const playerPlaceholder = fs.readFileSync(path.join(ROOT, 'src/assets/placeholders/player-silhouette.svg')).toString('base64');
css = css.replaceAll('../src/assets/placeholders/player-silhouette.svg', `data:image/svg+xml;base64,${playerPlaceholder}`);

const backgroundFiles = [
  ['assets/pub/background.webp', 'image/webp'],
  ['assets/pub/background.jpg', 'image/jpeg'],
  ['assets/pub/background.png', 'image/png'],
];
const backgroundFile = backgroundFiles.find(([relative]) => {
  const license = assetAudit.byPath.get(relative);
  return license?.approvedForRelease === true && fs.existsSync(path.join(ROOT, relative));
});
if (backgroundFile) {
  const [relative, mime] = backgroundFile;
  const background = fs.readFileSync(path.join(ROOT, relative)).toString('base64');
  css += `\n#pub { background-image: linear-gradient(rgba(18,11,5,.36), rgba(18,11,5,.64)), url("data:${mime};base64,${background}") !important; }\n`;
}

const output = read('index.html')
  .replace('<link rel="stylesheet" href="css/style.css">', `<style>${css}</style>`)
  .replace('\n  <link rel="stylesheet" href="css/ux.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/matchday.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/opponents.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/pwa.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/mobile-experience.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/mobile-overlay-fix.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/player-profile.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/focus-experience.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/mobile-selection-fix.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/duel-emphasis.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/phase-refinements.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/visual-system.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/legal-ui.css">', '')
  .replace('<div id="app-loading" role=', '<div id="app-loading" hidden role=')
  .replace('  <script type="module" src="js/branding.js"></script>\n', '')
  .replace('  <script type="module" src="js/ux.js"></script>\n', '')
  .replace('  <script type="module" src="js/ux-fixes.js"></script>\n', '')
  .replace('  <script type="module" src="js/matchday.js"></script>\n', '')
  .replace('  <script type="module" src="js/opponents.js"></script>\n', '')
  .replace('  <script type="module" src="js/pwa.js"></script>\n', '')
  .replace('  <script type="module" src="js/player-profile.js"></script>\n', '')
  .replace('  <script type="module" src="js/reliability-fixes.js"></script>\n', '')
  .replace('  <script type="module" src="js/usability-fixes.js"></script>\n', '')
  .replace('  <script type="module" src="js/focus-experience.js"></script>\n', '')
  .replace('  <script type="module" src="js/visual-settings-persistence.js"></script>\n', '')
  .replace('  <script type="module" src="js/visual-system.js"></script>\n', '')
  .replace('  <script type="module" src="js/legal-ui.js"></script>\n', '')
  .replace(
    '<script type="module" src="js/bootstrap.js"></script>',
    `<script>globalThis.__EMBEDDED_PLAYER_DATA__ = ${safeJson};</script>\n<script type="module">${safeBundle}</script>`
  );

const outputPath = path.join(ROOT, 'Fociskartyak2026.html');
fs.writeFileSync(outputPath, output);

const conflicts = payload.players.flatMap(card =>
  (Array.isArray(card?.meta?.enrichmentConflicts) ? card.meta.enrichmentConflicts : [])
    .map(conflict => ({ playerId: card.id, playerName: card.name, ...conflict }))
);
const audit = {
  generatedAt: reviewGeneratedAt,
  databaseId: databaseManifest.id,
  databaseManifest: databaseManifestFile,
  baseDataset: playerFile,
  normalizedDataset: normalizedPlayerFile ?? null,
  standaloneDataSource: buildDataSource,
  reviewedDataset: 'data/players-reviewed.json',
  sourceFiles,
  playerCount: payload.players.length,
  registrationRecords: payload.selection?.registrationRecords ?? null,
  selection: payload.selection,
  coverage: payload.coverage,
  fieldCoverage: payload.enrichment?.fieldCoverage ?? [],
  officialStatFieldCoverage: payload.officialStatPatches?.fieldCoverage ?? [],
  clubSummary: payload.enrichment?.clubSummary ?? [],
  manualReview: [
    ...(payload.enrichment?.manualReview ?? []),
    ...(payload.officialStatPatches?.manualReview ?? []),
  ],
  databaseReview: databaseReview.summary,
  enrichment: payload.enrichment,
  verifiedPlayerCorrections: payload.verifiedPlayerCorrections ?? null,
  officialStatPatches: payload.officialStatPatches,
  exclusions: enrichment.excludedRecords ?? [],
  conflicts: [...conflicts, ...(payload.officialStatPatches?.conflicts ?? [])],
  corrections: [
    ...(payload.verifiedPlayerCorrections?.applied ?? []),
    ...(payload.officialStatPatches?.corrections ?? []),
  ],
};
const auditPath = path.join(ROOT, 'data/enrichment-audit.json');
fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(`Elkészült: ${outputPath}`);
console.log(`Adatbázis: ${databaseManifest.name} (${databaseManifest.id})`);
console.log(`Manifest: ${databaseManifestFile}`);
console.log(`Elsődleges build-adatforrás: ${buildDataSource}`);
console.log(`Adatfelülvizsgálati jelentés: ${auditPath}`);
