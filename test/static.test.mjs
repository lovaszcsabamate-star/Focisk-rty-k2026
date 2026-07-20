import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../mobil.html', import.meta.url), 'utf8');
const mobileQr = fs.readFileSync(new URL('../assets/qr/mobil-eleres.svg', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const matchdayCss = fs.readFileSync(new URL('../css/matchday.css', import.meta.url), 'utf8');
const mobileExperienceCss = fs.readFileSync(new URL('../css/mobile-experience.css', import.meta.url), 'utf8');
const matchdayJs = fs.readFileSync(new URL('../js/matchday.js', import.meta.url), 'utf8');
const mobileExperienceJs = fs.readFileSync(new URL('../js/mobile-experience.js', import.meta.url), 'utf8');
const pwaCss = fs.readFileSync(new URL('../css/pwa.css', import.meta.url), 'utf8');
const pwaJs = fs.readFileSync(new URL('../js/pwa.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../js/bootstrap.js', import.meta.url), 'utf8');
const clubEnrichment = fs.readFileSync(new URL('../js/data/club-enrichment.js', import.meta.url), 'utf8');
const clubStatPatches = fs.readFileSync(new URL('../js/data/club-stat-patches.js', import.meta.url), 'utf8');
const serviceWorker = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const directory = JSON.parse(fs.readFileSync(new URL('../data/club-official-sources.json', import.meta.url), 'utf8'));
const paksNyir = JSON.parse(fs.readFileSync(new URL('../data/club-official-enrichment-3-paks-nyir.json', import.meta.url), 'utf8'));
const ujpest = JSON.parse(fs.readFileSync(new URL('../data/club-official-enrichment-4-ujpest.json', import.meta.url), 'utf8'));
const other = JSON.parse(fs.readFileSync(new URL('../data/club-official-enrichment-5-other.json', import.meta.url), 'utf8'));
const etoPuskas = JSON.parse(fs.readFileSync(new URL('../data/club-official-enrichment-6-eto-puskas.json', import.meta.url), 'utf8'));
const kisvardaStats = JSON.parse(fs.readFileSync(new URL('../data/club-official-stat-patches-kisvarda.json', import.meta.url), 'utf8'));
const corrections2 = JSON.parse(fs.readFileSync(new URL('../data/club-official-corrections-2.json', import.meta.url), 'utf8'));
const corrections3 = JSON.parse(fs.readFileSync(new URL('../data/club-official-corrections-3.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
const buildScript = fs.readFileSync(new URL('../scripts/build-standalone.mjs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/verify-and-build.yml', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const launcher = fs.readFileSync(new URL('../JATEK_INDITASA.bat', import.meta.url), 'utf8');
const standalone = fs.readFileSync(new URL('../Fociskartyak2026.html', import.meta.url), 'utf8');

assert.match(html, /<html lang="hu">/);
for (const id of ['hud-settings', 'penalty-board', 'sudden-death-banner', 'attribute-picker', 'app-loading']) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(html, /manifest\.webmanifest/);
assert.match(html, /css\/mobile-experience\.css/);
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
assert.match(mobileExperienceCss, /\.setting-switch/);
assert.match(mobileExperienceJs, /saved-match:v2/);
assert.match(mobileExperienceJs, /writeSavedMatch/);
assert.match(mobileExperienceJs, /hydrateGame/);
assert.match(mobileExperienceJs, /Legjobb saját/);
assert.match(mobileExperienceJs, /navigator\.vibrate/);
assert.match(bootstrap, /showFatalError/);
assert.match(bootstrap, /retry-load-btn/);

for (const file of [
  'club-official-enrichment.json',
  'club-official-enrichment-2.json',
  'club-official-enrichment-3-paks-nyir.json',
  'club-official-enrichment-4-ujpest.json',
  'club-official-enrichment-5-other.json',
  'club-official-enrichment-6-eto-puskas.json',
  'club-official-corrections.json',
  'club-official-corrections-2.json',
  'club-official-corrections-3.json',
  'club-official-stat-patches-kisvarda.json',
  'club-official-sources.json',
]) {
  assert.match(bootstrap, new RegExp(file.replaceAll('.', '\\.')));
  assert.match(buildScript, new RegExp(file.replaceAll('.', '\\.')));
  assert.match(serviceWorker, new RegExp(file.replaceAll('.', '\\.')));
}
assert.match(bootstrap, /club-stat-patches\.js/);
assert.match(buildScript, /club-stat-patches\.js/);
assert.match(serviceWorker, /club-stat-patches\.js/);
assert.match(bootstrap, /applyOfficialStatPatches/);
assert.match(buildScript, /applyOfficialStatPatches/);
assert.match(bootstrap, /combineEnrichments/);
assert.match(bootstrap, /combineCorrections/);
assert.match(clubEnrichment, /existing MLSZ values always win/);
assert.match(clubEnrichment, /clubShirtNumbers/);
assert.match(clubEnrichment, /clubOfficialByClub/);
assert.match(clubEnrichment, /clubSummary/);
assert.match(clubEnrichment, /manualReview/);
assert.match(clubStatPatches, /clubOfficialStatsByClub/);
assert.match(clubStatPatches, /multiClubMetadataOnly/);
assert.match(serviceWorker, /fociskartyak-2026-v12/);
assert.match(serviceWorker, /mobile-experience\.css/);
assert.match(serviceWorker, /mobile-experience\.js/);
assert.match(serviceWorker, /request\.mode === 'navigate'/);
assert.match(buildScript, /enrichment-audit\.json/);
assert.match(buildScript, /officialStatFieldCoverage/);
assert.match(buildScript, /officialStatPatches/);
assert.match(buildScript, /clubSummary/);
assert.match(buildScript, /mobile-experience\.css/);
assert.match(buildScript, /mobile-experience\.js/);
assert.match(workflow, /data\/enrichment-audit\.json/);

assert.equal(directory.clubs.length, 12);
assert.equal(new Set(directory.clubs.map(club => club.clubId)).size, 12);
assert.equal(paksNyir.records.length, 60);
assert.equal(ujpest.records.length, 26);
assert.equal(other.records.length, 46);
assert.equal(etoPuskas.records.length, 58);
assert.equal(etoPuskas.records.filter(record => record.clubId === 'eto-fc').length, 28);
assert.equal(etoPuskas.records.filter(record => record.clubId === 'puskas-akademia-fc').length, 30);
assert.equal(kisvardaStats.rows.length, 30);
assert.deepEqual(kisvardaStats.fields, [
  'name', 'appearances', 'starts', 'minutes', 'substituteAppearances',
  'goals', 'assists', 'yellowCards', 'redCards', 'secondYellowRedCards', 'totalDismissals',
]);
assert.equal(kisvardaStats.source.clubId, 'kisvarda-master-good');
assert.equal(kisvardaStats.source.additionalUrls.length, 2);
assert.equal(corrections2.recordPatches.length, 2);
assert.equal(corrections2.excludeRecords.length, 11);
assert.equal(corrections3.recordPatches.length, 2);
assert.equal(corrections3.excludeRecords.length, 5);
assert.ok(corrections3.recordPatches.some(item => item.aliases?.includes('ARUTIUNIAN GEORGII')));
assert.ok(corrections3.recordPatches.some(item => item.aliases?.includes('DÁRDAI PÁL')));
assert.ok(directory.clubs.every(club => club.officialUrl && club.officialRosterUrl && club.status));
assert.equal(directory.clubs.find(club => club.clubId === 'eto-fc').status, 'structured-season-roster-imported');
assert.equal(
  directory.clubs.find(club => club.clubId === 'kisvarda-master-good').status,
  'official-season-statistics-imported',
);

assert.equal(manifest.display, 'standalone');
assert.equal(manifest.orientation, 'portrait-primary');
assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
assert.match(main, /Klasszikus mód/);
assert.match(main, /Penalties mód/);
assert.match(main, /Játék folytatása/);
assert.match(main, /Következő párbaj/);
assert.match(main, /Vissza a főmenübe/);
assert.match(main, /showPauseMenu/);
assert.match(main, /showOnboarding/);
assert.match(main, /resumeSavedMatch/);
assert.match(main, /handleBackAction/);
assert.match(launcher, /Fociskartyak2026\.html/);
assert.match(launcher, /start "" "%GAME%"/);
assert.match(standalone, /globalThis\.__EMBEDDED_PLAYER_DATA__/);
assert.match(standalone, /officialClubDirectory/);
assert.match(standalone, /clubOfficialEnrichment/);
assert.match(standalone, /officialClubStatPatches/);
assert.match(standalone, /officialStatPatches/);
assert.match(standalone, /ARUTIUNIAN GEORGII/);
assert.match(standalone, /"minutes":3161/);
assert.match(standalone, /"updatedExistingPlayers":1/);
assert.match(standalone, /"unmatchedRecords":0/);
assert.match(standalone, /saved-match:v2/);
assert.doesNotMatch(standalone, /<script type="module" src=/);
assert.doesNotMatch(standalone, /<link rel="stylesheet" href=/);

console.log('✓ Magyar, reszponzív, menthető és mobilbarát offline felületi szerződés: rendben');
