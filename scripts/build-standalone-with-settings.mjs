/** Build the standalone game, then inline sizing, team-selector, federation, playability, duel-history and Quick Match assets. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('./build-standalone.mjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUTPUT = path.join(ROOT, 'Fociskartyak2026.html');
const CSS_LINK = '  <link rel="stylesheet" href="css/visual-settings-persistence.css">';
const TEAM_SELECTOR_CSS_LINK = '  <link rel="stylesheet" href="css/deck-selection-menu.css">';
const QUICK_MATCH_CONTROLS_CSS_LINK = '  <link rel="stylesheet" href="css/quick-match-card-controls.css">';
const FEDERATION_CSS_LINK = '  <link rel="stylesheet" href="css/federation-teams.css">';
const JS_TAG = '  <script type="module" src="js/visual-settings-persistence.js"></script>';
const RECENT_DUELS_JS_TAG = '  <script type="module" src="js/recent-duels-experience.js"></script>';
const TEAM_SELECTOR_BUNDLE_MARKER = '/* ===== js/ui/deck-selection-menu-component.js ===== */';
const LEGAL_LAYER_MARKER = '/* ===== js/legal-ui.js · isolated UI class layer ===== */';

const sizingCss = fs.readFileSync(path.join(ROOT, 'css/visual-settings-persistence.css'), 'utf8');
const teamSelectorCss = fs.readFileSync(path.join(ROOT, 'css/deck-selection-menu.css'), 'utf8');
const quickMatchControlsCss = fs.readFileSync(path.join(ROOT, 'css/quick-match-card-controls.css'), 'utf8');
const federationCss = fs.readFileSync(path.join(ROOT, 'css/federation-teams.css'), 'utf8');
const sizingJs = fs.readFileSync(path.join(ROOT, 'js/visual-settings-persistence.js'), 'utf8')
  .replace(/<\/script/gi, '<\\/script');
const flattenInlineModule = source => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');
const quickMatchInlineBundle = [
  'js/data/federations.js',
  'js/domain/federation-domain.js',
  'js/domain/quick-match-domain.js',
  'js/services/quick-match-storage-service.js',
].map(file => `\n/* ===== ${file} ===== */\n${flattenInlineModule(fs.readFileSync(path.join(ROOT, file), 'utf8'))}`)
  .join('\n')
  .replace(/<\/script/gi, '<\\/script');
const federationAssets = [
  'assets/federations/federation-europe.svg',
  'assets/federations/federation-africa.svg',
  'assets/federations/federation-south-america.svg',
  'assets/federations/federation-concacaf.svg',
  'assets/federations/federation-asia.svg',
  'assets/federations/federation-oceania.svg',
];
const federationAssetDataUris = Object.fromEntries(federationAssets.map(relative => [
  relative,
  `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, relative)).toString('base64')}`,
]));
const playabilityFile = 'js/playability-visual-upgrade.js';
const playabilitySource = flattenInlineModule(fs.readFileSync(path.join(ROOT, playabilityFile), 'utf8'))
  .replace(/<\/script/gi, '<\\/script');
const playabilityInlineBundle = `
 /* ===== ${playabilityFile} · isolated UI class layer ===== */
 beginUiEnhancementLayer(${JSON.stringify(playabilityFile)});
 (() => {
 ${playabilitySource}
 })();
 commitUiEnhancementLayer(${JSON.stringify(playabilityFile)});
 `;
const recentDuelsFile = 'js/recent-duels-experience.js';
const recentDuelsSource = flattenInlineModule(fs.readFileSync(path.join(ROOT, recentDuelsFile), 'utf8'))
  .replace(/<\/script/gi, '<\\/script');
const recentDuelsInlineBundle = `
 /* ===== ${recentDuelsFile} · isolated UI class layer ===== */
 beginUiEnhancementLayer(${JSON.stringify(recentDuelsFile)});
 (() => {
 ${recentDuelsSource}
 })();
 commitUiEnhancementLayer(${JSON.stringify(recentDuelsFile)});
 `;
const runtimeSmokeCompatibility = `
 /* A motor böngészős regressziós tesztje programozott kattintással indítja a meglévő módokat. */
 if (globalThis.__runtimeSmoke) globalThis.__FOCISKARTYAK_QUICK_MATCH_BYPASS__ = true;
 `;

let output = fs.readFileSync(OUTPUT, 'utf8');
output = output
  .replace(CSS_LINK, `  <style>\n${sizingCss}\n  </style>`)
  .replace(TEAM_SELECTOR_CSS_LINK, `  <style>\n${teamSelectorCss}\n  </style>`)
  .replace(QUICK_MATCH_CONTROLS_CSS_LINK, `  <style>\n${quickMatchControlsCss}\n  </style>`)
  .replace(FEDERATION_CSS_LINK, `  <style>\n${federationCss}\n  </style>`)
  .replace(JS_TAG, `  <script>\n${sizingJs}\n  </script>`)
  .replace(RECENT_DUELS_JS_TAG, '')
  .replace(
    TEAM_SELECTOR_BUNDLE_MARKER,
    `${quickMatchInlineBundle}\n${runtimeSmokeCompatibility}\n${TEAM_SELECTOR_BUNDLE_MARKER}`,
  )
  .replace(
    LEGAL_LAYER_MARKER,
    `${recentDuelsInlineBundle}\n${playabilityInlineBundle}\n${LEGAL_LAYER_MARKER}`,
  );
for (const [assetPath, dataUri] of Object.entries(federationAssetDataUris)) {
  output = output.replaceAll(assetPath, dataUri);
}

if (output.includes(CSS_LINK) || output.includes(TEAM_SELECTOR_CSS_LINK)
  || output.includes(QUICK_MATCH_CONTROLS_CSS_LINK) || output.includes(FEDERATION_CSS_LINK)
  || output.includes(JS_TAG) || output.includes(RECENT_DUELS_JS_TAG)) {
  throw new Error('Az önálló buildből külső felületi asset maradt bent.');
}
if (!output.includes('Méretezés mentése') || !output.includes('fociskartyak.visual-sizing.v1')) {
  throw new Error('A méretezésmentés nem került be az önálló buildbe.');
}
if (!output.includes('quick-team-card') || !output.includes('quick-match-duel')) {
  throw new Error('A kétlépcsős Gyors meccs csapatválasztó stílusa nem került be az önálló buildbe.');
}
if (!output.includes('quick-match-help-toggle') || !output.includes('quick-random-team__ball')) {
  throw new Error('A kérdőjeles súgó vagy a focilabdás véletlengomb nem került be az önálló buildbe.');
}
if (!output.includes('buildQuickMatchCatalog') || !output.includes('quickMatchStorageService')) {
  throw new Error('A Gyors meccs központi domainje vagy tárolója nem került be az önálló buildbe.');
}
if (!output.includes('getPlayableFederationTeams') || !output.includes('quick-team-mark--federation')) {
  throw new Error('A föderációs csapatdomain vagy annak megjelenése nem került be az önálló buildbe.');
}
if (!output.includes('federation-europe') && !output.includes('data:image/svg+xml;base64,')) {
  throw new Error('A föderációs emblémák nem kerültek be az önálló buildbe.');
}
if (!output.includes('Kártyaalbum') || !output.includes('MATCH_LENGTHS')) {
  throw new Error('A játszhatósági és vizuális fejlesztési réteg nem került be az önálló buildbe.');
}
if (!output.includes('Legutóbbi párbajok') || !output.includes('A mérkőzés játékosa')) {
  throw new Error('A párbajelőzmény vagy a mérkőzés játékosa nem került be az önálló buildbe.');
}
if (!output.includes('.nationality-flag') || !output.includes('data:image/svg+xml;base64,')) {
  throw new Error('A nemzetiségi zászlóstílus vagy a helyi zászló-SVG nem került be az önálló buildbe.');
}
if (!output.includes('resolvePlayerNationality') || !output.includes('createPlayerFlagElement')) {
  throw new Error('A központi nemzetiségi feloldó vagy a játékoszászló-komponens hiányzik az önálló buildből.');
}

fs.writeFileSync(OUTPUT, output);
console.log('Méretezésmentés, Gyors meccs, kérdőjeles súgó, focilabdás véletlengomb, föderációs emblémák, párbajelőzmény, nemzetiségi zászlók és játszhatósági fejlesztések beágyazva az önálló buildbe.');
