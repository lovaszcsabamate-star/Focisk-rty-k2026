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

const enrichmentFiles = [
  'data/club-official-enrichment.json',
  'data/club-official-enrichment-2.json',
  'data/club-official-enrichment-3-paks-nyir.json',
  'data/club-official-enrichment-4-ujpest.json',
  'data/club-official-enrichment-5-other.json',
  'data/club-official-enrichment-6-eto-puskas.json',
  'data/club-official-enrichment-7-kisvarda-selected10.json',
  'data/club-official-enrichment-8-kisvarda-selected10.json',
  'data/club-official-enrichment-9-kisvarda-selected10.json',
  'data/club-official-enrichment-10-kisvarda-final8.json',
  'data/club-official-enrichment-11-kisvarda-completion.json',
  'data/club-official-enrichment-12-dvtk-completion.json',
  'data/club-official-enrichment-13-mtk-completion.json',
  'data/club-official-enrichment-14-nyiregyhaza-completion.json',
  'data/club-official-enrichment-15-nyiregyhaza-nationalities.json',
  'data/club-official-enrichment-16-kazincbarcika-completion.json',
  'data/club-official-enrichment-17-ujpest-completion.json',
  'data/club-official-enrichment-18-paks-completion.json',
  'data/club-official-enrichment-19-zte-completion.json',
  'data/club-official-enrichment-20-puskas-completion.json',
  'data/club-official-enrichment-21-eto-completion.json',
  'data/club-official-enrichment-22-kisvarda-nationalities.json',
  'data/club-official-enrichment-23-final-missing-basic.json',
];
const correctionFiles = [
  'data/club-official-corrections.json',
  'data/club-official-corrections-2.json',
  'data/club-official-corrections-3.json',
  'data/club-official-corrections-4-kisvarda-selected10-2.json',
  'data/club-official-corrections-5-puskas.json',
];
const statPatchFiles = [
  'data/club-official-stat-patches-kisvarda.json',
  'data/club-official-stat-patches-kisvarda-selected10.json',
  'data/club-official-stat-patches-kisvarda-selected10-2.json',
  'data/club-official-stat-patches-kisvarda-selected10-3.json',
  'data/club-official-stat-patches-kisvarda-final8.json',
  'data/club-official-stat-patches-ferencvaros.json',
  'data/club-official-stat-patches-dvtk.json',
  'data/club-official-stat-patches-mtk.json',
  'data/club-official-stat-patches-nyiregyhaza.json',
  'data/club-official-stat-patches-kazincbarcika.json',
  'data/club-official-stat-patches-ujpest.json',
  'data/club-official-stat-patches-zte.json',
  'data/club-official-stat-patches-puskas.json',
];
const directoryFile = 'data/club-official-sources.json';
const sourceFiles = [...enrichmentFiles, ...correctionFiles, ...statPatchFiles, directoryFile];

const moduleOrder = [
  'js/branding.js',
  'js/data/players.js',
  'js/engine.js',
  'js/penalties.js',
  'js/ai.js',
  'js/banter.js',
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
const basePayload = JSON.parse(read('data/players.json'));
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

const playablePayload = filterCompleteCardsPayload(payload);
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
  baseDataset: 'data/players.json',
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
console.log(`Audit: ${auditPath}`);
console.log(`Felülvizsgált adatbázis: ${path.join(ROOT, 'data/players-reviewed.json')}`);
console.log(`${playablePayload.players.length} teljes játékoskártya beágyazva; ${playablePayload.completenessFilter.excludedIncompleteCards} hiányos rekord kizárva.`);
console.log(`${payload.players.length} forrásrekord és ${payload.selection?.registrationRecords ?? 0} klubregisztráció megőrizve az auditban.`);
console.log(`${payload.enrichment?.clubSummary?.length ?? 0} klub hivatalos forrása ellenőrizve.`);
console.log(`${payload.enrichment?.matchedRecords ?? 0}/${payload.enrichment?.records ?? 0} hivatalos klubrekord illesztve.`);
console.log(`${payload.officialStatPatches?.matchedRecords ?? 0}/${payload.officialStatPatches?.records ?? 0} hivatalos szezonstatisztika illesztve.`);
console.log(`${(payload.enrichment?.unmatchedRecords ?? 0) + (payload.officialStatPatches?.unmatchedRecords ?? 0)} rekord kézi ellenőrzésre vár.`);
console.log(`${payload.enrichment?.updatedExistingPlayers ?? 0} meglévő MLSZ-rekord kiegészítve.`);
console.log(`${payload.enrichment?.addedPlayers ?? 0} új, igazolt játékos hozzáadva.`);
console.log(`${payload.verifiedPlayerCorrections?.appliedFields ?? 0} bizonyított alapadat-korrekció alkalmazva.`);
console.log(`${payload.officialStatPatches?.correctionCount ?? 0} bizonyított statisztikai korrekció alkalmazva.`);
console.log(`Adatellenőrzés: ${databaseReview.summary.errorCount} kritikus hiba, ${databaseReview.summary.warningCount} figyelmeztetés.`);
