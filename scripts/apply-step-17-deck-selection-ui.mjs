import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található integrációs minta: ${label}`);
  return source.replace(search, replacement);
};

const deckSelectionFacade = `/** Pakliválasztási kompatibilitási homlokzat. */

import {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  readDeckSelection,
  saveDeckSelection,
} from './services/deck-selection-storage-service.js';
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
import {
  DECK_SELECTION_MENU_STYLE_ID,
  createDeckSelectionMenuController,
  installDeckSelectionMenu,
} from './ui/deck-selection-menu-component.js';

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
};

export {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  readDeckSelection,
  saveDeckSelection,
};

export {
  DECK_SELECTION_MENU_STYLE_ID,
  createDeckSelectionMenuController,
  installDeckSelectionMenu,
};
`;
write('js/deck-selection.js', deckSelectionFacade);

let build = read('scripts/build-standalone.mjs');
build = replaceRequired(
  build,
  "  'js/services/deck-selection-storage-service.js',\n  'js/deck-selection.js',",
  "  'js/services/deck-selection-storage-service.js',\n  'js/ui/deck-selection-menu-component.js',\n  'js/deck-selection.js',",
  'standalone UI-komponens sorrend',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = sw.replace(
  /\/\/ Korábbi cache-verziók: fociskartyak-2026-v30 \.\.\. fociskartyak-2026-v\d+/,
  '// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v62',
);
sw = sw.replace(/const PWA_CACHE = 'fociskartyak-2026-v\d+';/, "const PWA_CACHE = 'fociskartyak-2026-v63';");
sw = replaceRequired(
  sw,
  "  './js/services/deck-selection-storage-service.js',\n  './js/deck-selection.js',",
  "  './js/services/deck-selection-storage-service.js',\n  './js/ui/deck-selection-menu-component.js',\n  './js/deck-selection.js',",
  'PWA UI-komponens cache',
);
write('sw.js', sw);

let pkg = read('package.json');
pkg = replaceRequired(
  pkg,
  'node --check js/domain/deck-selection-domain.js && node --check js/deck-selection.js',
  'node --check js/domain/deck-selection-domain.js && node --check js/ui/deck-selection-menu-component.js && node --check js/deck-selection.js',
  'lint UI-komponens',
);
pkg = replaceRequired(
  pkg,
  'node --check test/deck-selection-storage-service.test.mjs && node --check test/deck-selection-domain.test.mjs',
  'node --check test/deck-selection-storage-service.test.mjs && node --check test/deck-selection-menu-component.test.mjs && node --check test/deck-selection-domain.test.mjs',
  'lint UI-komponensteszt',
);
pkg = pkg.replaceAll(
  'node test/deck-selection-storage-service.test.mjs && node test/deck-selection-domain.test.mjs',
  'node test/deck-selection-storage-service.test.mjs && node test/deck-selection-menu-component.test.mjs && node test/deck-selection-domain.test.mjs',
);
pkg = replaceRequired(
  pkg,
  '"test:deck-selection-storage": "node test/deck-selection-storage-service.test.mjs",\n    "test:storage-service":',
  '"test:deck-selection-storage": "node test/deck-selection-storage-service.test.mjs",\n    "test:deck-selection-menu": "node test/deck-selection-menu-component.test.mjs",\n    "test:storage-service":',
  'UI-komponens npm tesztparancs',
);
write('package.json', pkg);

console.log('A 17. lépés pakliválasztó UI-integrációja elkészült.');
