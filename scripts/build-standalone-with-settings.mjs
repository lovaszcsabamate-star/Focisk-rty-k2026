/** Build the standalone game, then inline sizing, team-selector, federation, tournament, playability, duel-history and Quick Match assets. */

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
const HELP_POPOVER_CSS_LINK = '  <link rel="stylesheet" href="css/help-popover.css">';
const FEDERATION_CSS_LINK = '  <link rel="stylesheet" href="css/federation-teams.css">';
const TOURNAMENT_CSS_LINK = '  <link rel="stylesheet" href="css/tournament-mode.css">';
const JS_TAG = '  <script type="module" src="js/visual-settings-persistence.js"></script>';
const RECENT_DUELS_JS_TAG = '  <script type="module" src="js/recent-duels-experience.js"></script>';
const HELP_POPOVER_JS_TAG = '  <script type="module" src="js/ui/help-popover-component.js"></script>';
const TEAM_SELECTOR_BUNDLE_MARKER = '/* ===== js/ui/deck-selection-menu-component.js ===== */';
const UI_RUNTIME_BUNDLE_MARKER = '/* ===== js/ui.js ===== */';
const QUICK_MATCH_CONTROLS_BUNDLE_MARKER = '/* ===== js/quick-match-card-controls.js · isolated UI class layer ===== */';
const UX_BUNDLE_MARKER = '/* ===== js/ux.js · isolated UI class layer ===== */';
const LEGAL_LAYER_MARKER = '/* ===== js/legal-ui.js · isolated UI class layer ===== */';
const MAIN_BUNDLE_MARKER = '/* ===== js/main.js ===== */';

const sizingCss = fs.readFileSync(path.join(ROOT, 'css/visual-settings-persistence.css'), 'utf8');
const teamSelectorCss = fs.readFileSync(path.join(ROOT, 'css/deck-selection-menu.css'), 'utf8');
const quickMatchControlsCss = fs.readFileSync(path.join(ROOT, 'css/quick-match-card-controls.css'), 'utf8');
const helpPopoverCss = fs.readFileSync(path.join(ROOT, 'css/help-popover.css'), 'utf8');
const federationCss = fs.readFileSync(path.join(ROOT, 'css/federation-teams.css'), 'utf8');
const tournamentCss = [
  fs.readFileSync(path.join(ROOT, 'css/tournament-mode.css'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'css/tournament-mode-v3.css'), 'utf8'),
].join('\n\n');
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

const tournamentFiles = [
  'js/tournament/tournament-domain.js',
  'js/tournament/tournament-state.js',
  'js/tournament/tournament-simulation.js',
  'js/services/tournament-storage-service.js',
  'js/tournament/tournament-ui.js',
  'js/tournament/tournament-setup-ui.js',
  'js/tournament/tournament-lineup-ui.js',
  'js/tournament-mode-v3.js',
];
const tournamentFileSet = new Set(tournamentFiles);
const resolveModuleSpecifier = (file, specifier) => path.posix.normalize(
  path.posix.join(path.posix.dirname(file), specifier),
);
const importBindings = clause => clause
  .trim()
  .replace(/^\{/, '')
  .replace(/\}$/, '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)
  .map(item => item.replace(/\s+as\s+/g, ': '))
  .join(', ');

function bundleTournamentModule(file) {
  let source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const internalImports = [];
  source = source.replace(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?\s*/g, (match, clause, specifier) => {
    const resolved = resolveModuleSpecifier(file, specifier);
    if (tournamentFileSet.has(resolved)) {
      const bindings = importBindings(clause);
      if (bindings) internalImports.push(bindings);
    }
    return '';
  });
  source = source.replace(/import\s+['"][^'"]+['"];?\s*/g, '');

  const exports = new Map();
  source = source.replace(/\bexport\s+(const|let|var|class|function|async\s+function)\s+([A-Za-z_$][\w$]*)/g, (match, kind, name) => {
    exports.set(name, name);
    return `${kind} ${name}`;
  });
  source = source.replace(/export\s*\{([\s\S]*?)\};?/g, (match, names) => {
    for (const item of names.split(',').map(value => value.trim()).filter(Boolean)) {
      const parts = item.split(/\s+as\s+/);
      exports.set(parts[1] ?? parts[0], parts[0]);
    }
    return '';
  });
  if (file === 'js/tournament-mode-v3.js') {
    source = source.replace(/\ninstallTournamentStyles\(\);\n/, '\n');
  }
  const exportEntries = [...exports.entries()]
    .map(([publicName, localName]) => publicName === localName ? localName : `${JSON.stringify(publicName)}: ${localName}`)
    .join(', ');
  const imports = internalImports.length
    ? `const { ${internalImports.join(', ')} } = __tournamentV3;`
    : '';
  return `
/* ===== ${file} ===== */
(() => {
${imports}
${source}
${exportEntries ? `Object.assign(__tournamentV3, { ${exportEntries} });` : ''}
})();`;
}

const tournamentSource = tournamentFiles.map(bundleTournamentModule)
  .join('\n')
  .replace(/<\/script/gi, '<\\/script');
const tournamentInlineBundle = `
 /* ===== Torna mód v3 · önálló modulnévtér ===== */
 (() => {
 const __tournamentV3 = Object.create(null);
 ${tournamentSource}
 })();
 `;
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
const helpPopoverFile = 'js/ui/help-popover-component.js';
const helpPopoverSource = flattenInlineModule(fs.readFileSync(path.join(ROOT, helpPopoverFile), 'utf8'))
  .replace(/<\/script/gi, '<\\/script');
const helpPopoverInlineBundle = `
 /* ===== ${helpPopoverFile} · önálló súgókomponens ===== */
 (() => {
 ${helpPopoverSource}
 })();
 `;
const runtimeSmokeCompatibility = `
 /* A motor böngészős regressziós tesztje programozott kattintással indítja a meglévő módokat. */
 if (globalThis.__runtimeSmoke) globalThis.__FOCISKARTYAK_QUICK_MATCH_BYPASS__ = true;
 `;

function moveIsolatedLayerBefore(output, layerMarker, nextMarker, layerFile) {
  const layerStart = output.indexOf(layerMarker);
  const nextStart = output.indexOf(nextMarker);
  const layerEndToken = `commitUiEnhancementLayer(${JSON.stringify(layerFile)});`;
  const layerEndStart = output.indexOf(layerEndToken, layerStart);
  if (layerStart < 0 || nextStart < 0 || layerEndStart < 0) {
    throw new Error(`Az önálló build UI-rétege nem rendezhető: ${layerFile}`);
  }
  const layerEnd = layerEndStart + layerEndToken.length;
  const layerBlock = output.slice(layerStart, layerEnd);
  const withoutLayer = `${output.slice(0, layerStart)}${output.slice(layerEnd)}`;
  const insertionPoint = withoutLayer.indexOf(nextMarker);
  if (insertionPoint < 0) throw new Error(`Hiányzó beszúrási pont az UI-réteghez: ${layerFile}`);
  return `${withoutLayer.slice(0, insertionPoint)}${layerBlock}\n${withoutLayer.slice(insertionPoint)}`;
}

function assertUiLayerRuntimeOrder(output) {
  const uiRuntimeIndex = output.indexOf(UI_RUNTIME_BUNDLE_MARKER);
  const firstLayerIndex = output.indexOf('beginUiEnhancementLayer(');
  const controlsIndex = output.indexOf(QUICK_MATCH_CONTROLS_BUNDLE_MARKER);
  const uxIndex = output.indexOf(UX_BUNDLE_MARKER);
  if (uiRuntimeIndex < 0 || firstLayerIndex < 0 || controlsIndex < 0 || uxIndex < 0) {
    throw new Error('Az önálló build UI-rétegsorrendje nem ellenőrizhető.');
  }
  if (firstLayerIndex < uiRuntimeIndex || controlsIndex < uiRuntimeIndex || controlsIndex > uxIndex) {
    throw new Error('UI enhancement réteg került a UI alaposztály inicializálása elé.');
  }
}

let output = fs.readFileSync(OUTPUT, 'utf8');
output = output
  .replace(CSS_LINK, `  <style>\n${sizingCss}\n  </style>`)
  .replace(TEAM_SELECTOR_CSS_LINK, `  <style>\n${teamSelectorCss}\n  </style>`)
  .replace(QUICK_MATCH_CONTROLS_CSS_LINK, `  <style>\n${quickMatchControlsCss}\n  </style>`)
  .replace(HELP_POPOVER_CSS_LINK, `  <style>\n${helpPopoverCss}\n  </style>`)
  .replace(FEDERATION_CSS_LINK, `  <style>\n${federationCss}\n  </style>`)
  .replace(TOURNAMENT_CSS_LINK, `  <style>\n${tournamentCss}\n  </style>`)
  .replace(JS_TAG, `  <script>\n${sizingJs}\n  </script>`)
  .replace(RECENT_DUELS_JS_TAG, '')
  .replace(HELP_POPOVER_JS_TAG, '')
  .replace(
    TEAM_SELECTOR_BUNDLE_MARKER,
    `${quickMatchInlineBundle}\n${runtimeSmokeCompatibility}\n${TEAM_SELECTOR_BUNDLE_MARKER}`,
  )
  .replace(
    LEGAL_LAYER_MARKER,
    `${helpPopoverInlineBundle}\n${recentDuelsInlineBundle}\n${playabilityInlineBundle}\n${LEGAL_LAYER_MARKER}`,
  )
  .replace(
    MAIN_BUNDLE_MARKER,
    `${tournamentInlineBundle}\n${MAIN_BUNDLE_MARKER}`,
  );

output = moveIsolatedLayerBefore(
  output,
  QUICK_MATCH_CONTROLS_BUNDLE_MARKER,
  UX_BUNDLE_MARKER,
  'js/quick-match-card-controls.js',
);
assertUiLayerRuntimeOrder(output);

for (const [assetPath, dataUri] of Object.entries(federationAssetDataUris)) {
  output = output.replaceAll(assetPath, dataUri);
}

if (output.includes(CSS_LINK) || output.includes(TEAM_SELECTOR_CSS_LINK)
  || output.includes(QUICK_MATCH_CONTROLS_CSS_LINK) || output.includes(HELP_POPOVER_CSS_LINK)
  || output.includes(FEDERATION_CSS_LINK) || output.includes(TOURNAMENT_CSS_LINK)
  || output.includes(JS_TAG) || output.includes(RECENT_DUELS_JS_TAG)
  || output.includes(HELP_POPOVER_JS_TAG)) {
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
if (!output.includes('createHelpPopover') || !output.includes('help-popover')) {
  throw new Error('A súgó-popover komponens nem került be az önálló buildbe.');
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
if (!output.includes('TOURNAMENT_FORMAT') || !output.includes('Torna mód')
  || !output.includes('tournamentStorageService') || !output.includes('.tournament-bracket')
  || !output.includes('Csapatösszeállítás') || !output.includes('Leszimulált mérkőzések')) {
  throw new Error('A Torna v3 domain, mentés, felület, keretépítés vagy stílus nem került be az önálló buildbe.');
}
if (!output.includes('Kártyaalbum') || !output.includes('MATCH_LENGTHS')) {
  throw new Error('A játszhatósági és vizuális fejlesztési réteg nem került be az önálló buildbe.');
}
if (!output.includes('Legutóbbi párbajok') || !output.includes('A mérkőzés játékosa')) {
  throw new Error('A párbajelőzmény vagy a mérkőzés játékosa nem került be az önálló buildbe.');
}
if (!output.includes('.nationality-flag') || !output.includes('data:image/svg+xml;base64,')) {
  throw new Error('A nemzetiségi zászlóstílus vagy a helyi zászló-SVG nem került be az önálló buildből.');
}
if (!output.includes('resolvePlayerNationality') || !output.includes('createPlayerFlagElement')) {
  throw new Error('A központi nemzetiségi feloldó vagy a játékoszászló-komponens hiányzik az önálló buildből.');
}

fs.writeFileSync(OUTPUT, output);
console.log('Méretezésmentés, Gyors meccs, Torna mód v3, kérdőjeles súgó, focilabdás véletlengomb, föderációs emblémák, párbajelőzmény, nemzetiségi zászlók és játszhatósági fejlesztések beágyazva az önálló buildbe.');
