import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található integrációs minta: ${label}`);
  return source.replace(search, replacement);
};

let deckSelection = read('js/deck-selection.js');
deckSelection = replaceRequired(
  deckSelection,
  "import { readStoredJson, readStoredString, removeStoredValue, writeStoredJson } from './services/storage-service.js';",
  `import { readStoredJson, readStoredString, removeStoredValue, writeStoredJson } from './services/storage-service.js';
import {
  MIN_FILTERED_DECK_SIZE,
  RANDOM_DECK_SELECTION,
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalClubKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
} from './domain/deck-selection-domain.js';

export {
  MIN_FILTERED_DECK_SIZE,
  RANDOM_DECK_SELECTION,
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalClubKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
};`,
  'domain import és kompatibilitási export',
);

const domainStart = deckSelection.indexOf('export const MIN_FILTERED_DECK_SIZE = 11;');
const storageStart = deckSelection.indexOf('export function readDeckSelection');
if (domainStart < 0 || storageStart < 0 || storageStart <= domainStart) {
  throw new Error('A pakliválasztási domainblokk határai nem találhatók.');
}
deckSelection = `${deckSelection.slice(0, domainStart)}export const DECK_SELECTION_STORAGE_KEY = APP_STORAGE_KEYS.deckSelection;
export const SAVED_MATCH_STORAGE_KEY = APP_STORAGE_KEYS.savedMatch;

${deckSelection.slice(storageStart)}`;

const payloadStart = deckSelection.indexOf('export function applyDeckSelectionToPayload');
const uiStart = deckSelection.indexOf("const STYLE_ID = 'deck-selection-styles';");
if (payloadStart < 0 || uiStart < 0 || uiStart <= payloadStart) {
  throw new Error('A payload-domainblokk határai nem találhatók.');
}
deckSelection = `${deckSelection.slice(0, payloadStart)}${deckSelection.slice(uiStart)}`;

deckSelection = replaceRequired(
  deckSelection,
  "entries.find(entry => fold(entry.label) === fold(draft.value))",
  "entries.find(entry => canonicalClubKey(entry.label) === canonicalClubKey(draft.value))",
  'klubválasztás normalizálása',
);
deckSelection = replaceRequired(
  deckSelection,
  '  const pool = safePlayers(players);',
  '  const pool = Array.isArray(players) ? players : [];',
  'UI játékoslista biztonságos kezelése',
);
if (/const NATION_ALIASES|const NATION_PRESENTATION|const fold\s*=|const safePlayers\s*=|function canonicalNationKey|function resolveDeckSelection|function applyDeckSelectionToPayload/.test(deckSelection)) {
  throw new Error('A domainlogika nem került ki teljesen a kompatibilitási/UI-modulból.');
}
write('js/deck-selection.js', deckSelection);

let build = read('scripts/build-standalone.mjs');
build = replaceRequired(
  build,
  "  'js/services/asset-service.js',\n  'js/deck-selection.js',",
  "  'js/services/asset-service.js',\n  'js/domain/deck-selection-domain.js',\n  'js/deck-selection.js',",
  'standalone domainmodul-sorrend',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = sw.replace(
  /\/\/ Korábbi cache-verziók: fociskartyak-2026-v30 \.\.\. fociskartyak-2026-v\d+/,
  '// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v60',
);
sw = sw.replace(/const PWA_CACHE = 'fociskartyak-2026-v\d+';/, "const PWA_CACHE = 'fociskartyak-2026-v61';");
sw = replaceRequired(
  sw,
  "  './js/models/player-model.js',\n  './js/deck-selection.js',",
  "  './js/models/player-model.js',\n  './js/domain/deck-selection-domain.js',\n  './js/deck-selection.js',",
  'PWA domainmodul-cache',
);
write('sw.js', sw);

let pkg = read('package.json');
pkg = replaceRequired(
  pkg,
  'node --check js/legal-ui.js && node --check js/deck-selection.js',
  'node --check js/legal-ui.js && node --check js/domain/deck-selection-domain.js && node --check js/deck-selection.js',
  'lint domainmodul',
);
pkg = replaceRequired(
  pkg,
  'node --check test/standalone-game-runtime.test.mjs && node --check test/deck-selection.test.mjs',
  'node --check test/standalone-game-runtime.test.mjs && node --check test/deck-selection-domain.test.mjs && node --check test/deck-selection.test.mjs',
  'lint domainteszt',
);
pkg = pkg.replaceAll(
  'node test/categories.test.mjs && node test/deck-selection.test.mjs',
  'node test/categories.test.mjs && node test/deck-selection-domain.test.mjs && node test/deck-selection.test.mjs',
);
pkg = replaceRequired(
  pkg,
  '"test:category-registry": "node test/category-registry.test.mjs",\n    "test:storage-service":',
  '"test:category-registry": "node test/category-registry.test.mjs",\n    "test:deck-selection-domain": "node test/deck-selection-domain.test.mjs",\n    "test:storage-service":',
  'domain npm tesztparancs',
);
write('package.json', pkg);

console.log('A 15. lépés pakliválasztási domainintegrációja elkészült.');
