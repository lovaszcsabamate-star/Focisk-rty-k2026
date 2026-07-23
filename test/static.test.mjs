import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const readJson = relative => JSON.parse(read(relative));

const html = read('../index.html');
const mobile = read('../mobil.html');
const mobileQr = read('../assets/qr/mobil-eleres.svg');
const css = read('../css/style.css');
const matchdayCss = read('../css/matchday.css');
const mobileExperienceCss = read('../css/mobile-experience.css');
const mobileOverlayFixCss = read('../css/mobile-overlay-fix.css');
const matchdayJs = read('../js/matchday.js');
const mobileExperienceJs = read('../js/mobile-experience.js');
const pwaCss = read('../css/pwa.css');
const pwaJs = read('../js/pwa.js');
const bootstrap = read('../js/bootstrap.js');
const databaseRegistryModule = read('../js/database/database-registry.js');
const clubEnrichment = read('../js/data/club-enrichment.js');
const clubStatPatches = read('../js/data/club-stat-patches.js');
const serviceWorker = read('../sw.js');
const databaseRegistry = readJson('../data/databases/registry.json');
const databaseEntry = databaseRegistry.databases.find(entry => entry.id === databaseRegistry.defaultDatabaseId);
const databaseManifest = readJson(`../${databaseEntry.manifest}`);
const directory = readJson('../data/club-official-sources.json');
const paksNyir = readJson('../data/club-official-enrichment-3-paks-nyir.json');
const ujpest = readJson('../data/club-official-enrichment-4-ujpest.json');
const other = readJson('../data/club-official-enrichment-5-other.json');
const etoPuskas = readJson('../data/club-official-enrichment-6-eto-puskas.json');
const kisvardaStats = readJson('../data/club-official-stat-patches-kisvarda.json');
const kisvardaSelected2 = readJson('../data/club-official-enrichment-8-kisvarda-selected10.json');
const kisvardaSelectedStats2 = readJson('../data/club-official-stat-patches-kisvarda-selected10-2.json');
const kisvardaFinal8 = readJson('../data/club-official-enrichment-10-kisvarda-final8.json');
const kisvardaCompletion = readJson('../data/club-official-enrichment-11-kisvarda-completion.json');
const dvtkCompletion = readJson('../data/club-official-enrichment-12-dvtk-completion.json');
const mtkCompletion = readJson('../data/club-official-enrichment-13-mtk-completion.json');
const nyiregyhazaCompletion = readJson('../data/club-official-enrichment-14-nyiregyhaza-completion.json');
const nyiregyhazaNationalities = readJson('../data/club-official-enrichment-15-nyiregyhaza-nationalities.json');
const kazincbarcikaCompletion = readJson('../data/club-official-enrichment-16-kazincbarcika-completion.json');
const ujpestCompletion = readJson('../data/club-official-enrichment-17-ujpest-completion.json');
const paksCompletion = readJson('../data/club-official-enrichment-18-paks-completion.json');
const zteCompletion = readJson('../data/club-official-enrichment-19-zte-completion.json');
const etoCompletion = readJson('../data/club-official-enrichment-21-eto-completion.json');
const kisvardaNationalities = readJson('../data/club-official-enrichment-22-kisvarda-nationalities.json');
const finalMissingBasic = readJson('../data/club-official-enrichment-23-final-missing-basic.json');
const kisvardaFinalStats = readJson('../data/club-official-stat-patches-kisvarda-final8.json');
const ferencvarosStats = readJson('../data/club-official-stat-patches-ferencvaros.json');
const dvtkStats = readJson('../data/club-official-stat-patches-dvtk.json');
const mtkStats = readJson('../data/club-official-stat-patches-mtk.json');
const nyiregyhazaStats = readJson('../data/club-official-stat-patches-nyiregyhaza.json');
const kazincbarcikaStats = readJson('../data/club-official-stat-patches-kazincbarcika.json');
const ujpestStats = readJson('../data/club-official-stat-patches-ujpest.json');
const zteStats = readJson('../data/club-official-stat-patches-zte.json');
const corrections2 = readJson('../data/club-official-corrections-2.json');
const corrections3 = readJson('../data/club-official-corrections-3.json');
const manifest = readJson('../manifest.webmanifest');
const buildScript = read('../scripts/build-standalone.mjs');
const workflow = read('../.github/workflows/verify-and-build.yml');
const main = read('../js/main.js');
const launcher = read('../JATEK_INDITASA.bat');
const standalone = read('../Fociskartyak2026.html');

assert.match(html, /<html lang="hu">/);
for (const id of ['hud-settings', 'penalty-board', 'sudden-death-banner', 'attribute-picker', 'app-loading']) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(html, /manifest\.webmanifest/);
assert.match(html, /css\/mobile-experience\.css/);
assert.match(html, /css\/mobile-overlay-fix\.css/);
assert.match(html, /js\/bootstrap\.js/);
assert.doesNotMatch(html, /<script type="module" src="js\/main\.js"><\/script>/);
assert.match(mobile, /Játék indítása/);
assert.match(mobile, /Alkalmazás telepítése/);
assert.match(mobile, /Főképernyőhöz adás/);
assert.match(mobileQr, /viewBox="0 0 41 41"/);
assert.match(css, /@media \(max-width: 900px\)/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.match(css, /\.mode-penalties \.hand[^}]*overflow-x: auto/s);
assert.match(matchdayCss, /\.match-scoreboard/);
assert.match(matchdayJs, /KÖVETKEZŐ VÁLASZTÓ/);
assert.match(pwaCss, /\.pwa-install-guide/);
assert.match(pwaJs, /beforeinstallprompt/);
assert.match(pwaJs, /serviceWorker\.register/);
assert.match(mobileExperienceCss, /safe-area-inset-top/);
assert.match(mobileExperienceCss, /@media \(max-width: 320px\)/);
assert.match(mobileExperienceCss, /prefers-reduced-motion/);
assert.match(mobileOverlayFixCss, /#overlay-body\.panel/);
assert.match(mobileExperienceJs, /saved-match:v2/);
assert.match(mobileExperienceJs, /hydrateGame/);
assert.match(mobileExperienceJs, /kevesebb életkor a jobb/);
assert.match(bootstrap, /showFatalError/);
assert.match(bootstrap, /retry-load-btn/);
assert.match(bootstrap, /getDefaultDatabase/);
assert.match(databaseRegistryModule, /loadDatabaseRegistry/);
assert.match(databaseRegistryModule, /validateDatabaseManifest/);
assert.match(buildScript, /databaseManifestFile/);
assert.match(serviceWorker, /data\/databases\/registry\.json/);
assert.match(serviceWorker, /data\/databases\/hungary-nb1-2025-26\/manifest\.json/);

assert.equal(databaseRegistry.defaultDatabaseId, 'hungary-nb1-2025-26');
assert.equal(databaseEntry.enabled, true);
assert.equal(databaseManifest.id, databaseEntry.id);
assert.equal(databaseManifest.files.enrichments.length, 23);
assert.equal(databaseManifest.files.corrections.length, 5);
assert.equal(databaseManifest.files.statPatches.length, 13);

const dataFiles = [
  databaseManifest.files.players,
  databaseManifest.files.clubDirectory,
  ...databaseManifest.files.enrichments,
  ...databaseManifest.files.corrections,
  ...databaseManifest.files.statPatches,
];
for (const file of dataFiles) {
  assert.equal(fs.existsSync(new URL(`../${file}`, import.meta.url)), true, `Hiányzó manifest-fájl: ${file}`);
  assert.match(serviceWorker, new RegExp(file.replaceAll('.', '\\.').replaceAll('/', '\\/')));
}

assert.match(bootstrap, /applyOfficialStatPatches/);
assert.match(buildScript, /applyOfficialStatPatches/);
assert.match(clubEnrichment, /existing MLSZ values always win/);
assert.match(clubEnrichment, /clubShirtNumbers/);
assert.match(clubEnrichment, /clubOfficialByClub/);
assert.match(clubStatPatches, /clubOfficialStatsByClub/);
assert.match(clubStatPatches, /correctedFieldCounts/);
assert.match(clubStatPatches, /officialStatConsensus/);
assert.match(clubStatPatches, /consensusPromotedPlayers/);
assert.match(clubStatPatches, /derivedSubstituteAppearancesCount/);
assert.match(serviceWorker, /fociskartyak-2026-v30/);
assert.match(serviceWorker, /request\.mode === 'navigate'/);
assert.match(buildScript, /enrichment-audit\.json/);
assert.match(buildScript, /officialStatFieldCoverage/);
assert.match(buildScript, /corrections/);
assert.match(workflow, /data\/enrichment-audit\.json/);
assert.match(workflow, /test:mobile-layout/);

assert.equal(directory.clubs.length, 12);
assert.equal(new Set(directory.clubs.map(club => club.clubId)).size, 12);
assert.equal(paksNyir.records.length, 60);
assert.equal(ujpest.records.length, 26);
assert.equal(other.records.length, 46);
assert.equal(etoPuskas.records.length, 58);
assert.equal(kisvardaStats.rows.length, 30);
assert.equal(kisvardaSelected2.batch.playerCount, 10);
assert.equal(new Set(kisvardaSelected2.batch.playerIds).size, 10);
assert.equal(kisvardaSelectedStats2.rows.length, 10);
assert.deepEqual(kisvardaSelectedStats2.overrides['Jasmin Mesanovic'], ['starts', 'substituteAppearances']);
assert.equal(kisvardaFinal8.batch.playerCount, 8);
assert.equal(kisvardaCompletion.batch.playerCount, 2);
assert.equal(dvtkCompletion.batch.playerCount, 1);
assert.equal(mtkCompletion.batch.playerCount, 4);
assert.equal(nyiregyhazaCompletion.batch.playerCount, 39);
assert.equal(nyiregyhazaNationalities.batch.playerCount, 39);
assert.equal(nyiregyhazaNationalities.records.length, 39);
assert.equal(kazincbarcikaCompletion.batch.playerCount, 40);
assert.equal(kazincbarcikaCompletion.records.length, 40);
assert.equal(ujpestCompletion.batch.playerCount, 41);
assert.equal(ujpestCompletion.records.length, 41);
assert.equal(paksCompletion.batch.playerCount, 33);
assert.equal(paksCompletion.records.length, 33);
assert.equal(zteCompletion.batch.playerCount, 43);
assert.equal(zteCompletion.records.length, 43);
assert.equal(etoCompletion.batch.playerCount, 35);
assert.equal(etoCompletion.records.length, 35);
assert.equal(kisvardaNationalities.batch.playerCount, 21);
assert.equal(kisvardaNationalities.records.length, 21);
assert.equal(finalMissingBasic.batch.playerCount, finalMissingBasic.records.length);
assert.equal(
  finalMissingBasic.batch.heightRecordCount,
  finalMissingBasic.records.filter(record => Number.isFinite(record.heightCm)).length,
);
assert.equal(finalMissingBasic.records.filter(record => record.nation || record.position).length, 7);
assert.equal(kisvardaFinalStats.rows.length, 8);
assert.equal(ferencvarosStats.rows.length, 42);
assert.equal(ferencvarosStats.batch.playerCount, 42);
assert.equal(ferencvarosStats.source.clubId, 'ferencvarosi-tc');
assert.equal(dvtkStats.rows.length, 45);
assert.equal(dvtkStats.batch.playerCount, 45);
assert.equal(dvtkStats.source.clubId, 'dvtk');
assert.equal(mtkStats.rows.length, 36);
assert.equal(mtkStats.batch.playerCount, 36);
assert.equal(mtkStats.source.clubId, 'mtk-budapest');
assert.equal(nyiregyhazaStats.rows.length, 39);
assert.equal(nyiregyhazaStats.batch.playerCount, 39);
assert.equal(nyiregyhazaStats.source.clubId, 'nyiregyhaza-spartacus-fc');
assert.equal(kazincbarcikaStats.rows.length, 40);
assert.equal(kazincbarcikaStats.batch.playerCount, 40);
assert.equal(kazincbarcikaStats.source.clubId, 'kolorcity-kazincbarcika-sc');
assert.equal(ujpestStats.rows.length, 41);
assert.equal(ujpestStats.batch.playerCount, 41);
assert.equal(ujpestStats.source.clubId, 'ujpest-fc');
assert.equal(zteStats.rows.length, 43);
assert.equal(zteStats.batch.playerCount, 43);
assert.equal(zteStats.source.clubId, 'zte-fc');
assert.equal(corrections2.recordPatches.length, 2);
assert.equal(corrections2.excludeRecords.length, 11);
assert.equal(corrections3.recordPatches.length, 2);
assert.equal(corrections3.excludeRecords.length, 5);
assert.ok(directory.clubs.every(club => club.officialUrl && club.officialRosterUrl && club.status));
assert.equal(
  directory.clubs.find(club => club.clubId === 'kisvarda-master-good').status,
  'complete-38-of-38-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'dvtk').status,
  'complete-45-of-45-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'mtk-budapest').status,
  'complete-36-of-36-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'nyiregyhaza-spartacus-fc').status,
  'complete-39-of-39-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'kolorcity-kazincbarcika-sc').status,
  'complete-40-of-40-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'ujpest-fc').status,
  'complete-41-of-41-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'paksi-fc').status,
  'complete-33-of-33-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'eto-fc').status,
  'complete-35-of-35-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'zte-fc').status,
  'complete-43-of-43-player-review',
);

assert.equal(manifest.display, 'standalone');
assert.equal(manifest.orientation, 'portrait-primary');
const hasScalableApprovedIcon = manifest.icons.some(icon =>
  icon.sizes === 'any'
  && icon.type === 'image/svg+xml'
  && icon.src === 'src/assets/placeholders/app-icon.svg'
);
const hasRasterInstallIcons = manifest.icons.some(icon => icon.sizes === '192x192')
  && manifest.icons.some(icon => icon.sizes === '512x512');
assert.ok(hasScalableApprovedIcon || hasRasterInstallIcons, 'Hiányzik a skálázható vagy 192/512 px-es PWA-ikon.');
assert.match(main, /Klasszikus mód/);
assert.match(main, /Penalties mód/);
assert.match(main, /Játék folytatása/);
assert.match(main, /handleBackAction/);
assert.match(launcher, /Fociskartyak2026\.html/);
assert.match(standalone, /globalThis\.__EMBEDDED_PLAYER_DATA__/);
assert.match(standalone, /officialClubDirectory/);
assert.match(standalone, /officialClubStatPatches/);
assert.match(standalone, /"minutes":3161/);
assert.match(standalone, /"updatedExistingPlayers":\d+/);
assert.match(standalone, /"unmatchedRecords":0/);
assert.match(standalone, /"correctionCount":2/);
assert.match(standalone, /saved-match:v2/);
assert.doesNotMatch(standalone, /<script type="module" src=/);
assert.doesNotMatch(standalone, /<link rel="stylesheet" href=/);

console.log('✓ Magyar, reszponzív, menthető és mobilbarát offline felületi szerződés: rendben');
