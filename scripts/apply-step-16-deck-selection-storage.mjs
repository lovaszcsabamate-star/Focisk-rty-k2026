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
  "import { APP_STORAGE_KEYS } from './app/configuration.js';\nimport { readStoredJson, readStoredString, removeStoredValue, writeStoredJson } from './services/storage-service.js';",
  `import {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  deckSelectionStorageService,
  readDeckSelection,
  saveDeckSelection,
} from './services/deck-selection-storage-service.js';`,
  'központi pakliválasztási tárolási import',
);

const domainExportEnd = `  validateDeckSelection,
};`;
deckSelection = replaceRequired(
  deckSelection,
  domainExportEnd,
  `${domainExportEnd}

export {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  readDeckSelection,
  saveDeckSelection,
};`,
  'tárolási kompatibilitási export',
);

const localStorageStart = deckSelection.indexOf('export const DECK_SELECTION_STORAGE_KEY');
const styleStart = deckSelection.indexOf("const STYLE_ID = 'deck-selection-styles';");
if (localStorageStart < 0 || styleStart < 0 || styleStart <= localStorageStart) {
  throw new Error('A helyi pakliválasztási tárolási blokk határai nem találhatók.');
}
deckSelection = `${deckSelection.slice(0, localStorageStart)}${deckSelection.slice(styleStart)}`;

deckSelection = replaceRequired(
  deckSelection,
  `    const hasSavedMatch = Boolean(readStoredString(SAVED_MATCH_STORAGE_KEY));
  if (hasSavedMatch && !window.confirm('A pakli cseréje törli a jelenlegi mentett mérkőzést. Folytatod?')) return;

  removeStoredValue(SAVED_MATCH_STORAGE_KEY);
  saveDeckSelection(next);
    window.location.reload();`,
  `    const hasSavedMatch = deckSelectionStorageService.hasSavedMatch();
    if (hasSavedMatch && !window.confirm('A pakli cseréje törli a jelenlegi mentett mérkőzést. Folytatod?')) return;

    deckSelectionStorageService.replace(next);
    window.location.reload();`,
  'UI paklicsere szolgáltatáson keresztül',
);

if (/APP_STORAGE_KEYS|readStoredJson|readStoredString|writeStoredJson|removeStoredValue|services\/storage-service/.test(deckSelection)) {
  throw new Error('A deck-selection.js még közvetlen tárolási függőséget tartalmaz.');
}
write('js/deck-selection.js', deckSelection);

let build = read('scripts/build-standalone.mjs');
build = replaceRequired(
  build,
  "  'js/domain/deck-selection-domain.js',\n  'js/deck-selection.js',",
  "  'js/domain/deck-selection-domain.js',\n  'js/services/deck-selection-storage-service.js',\n  'js/deck-selection.js',",
  'standalone tárolási szolgáltatás sorrend',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = sw.replace(
  /\/\/ Korábbi cache-verziók: fociskartyak-2026-v30 \.\.\. fociskartyak-2026-v\d+/,
  '// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v61',
);
sw = sw.replace(/const PWA_CACHE = 'fociskartyak-2026-v\d+';/, "const PWA_CACHE = 'fociskartyak-2026-v62';");
sw = replaceRequired(
  sw,
  "  './js/domain/deck-selection-domain.js',\n  './js/deck-selection.js',",
  "  './js/domain/deck-selection-domain.js',\n  './js/services/deck-selection-storage-service.js',\n  './js/deck-selection.js',",
  'PWA tárolási szolgáltatás cache',
);
write('sw.js', sw);

let pkg = read('package.json');
pkg = replaceRequired(
  pkg,
  'node --check js/services/storage-service.js && node --check js/services/asset-service.js',
  'node --check js/services/storage-service.js && node --check js/services/deck-selection-storage-service.js && node --check js/services/asset-service.js',
  'lint tárolási szolgáltatás',
);
pkg = replaceRequired(
  pkg,
  'node --check test/standalone-game-runtime.test.mjs && node --check test/deck-selection-domain.test.mjs',
  'node --check test/standalone-game-runtime.test.mjs && node --check test/deck-selection-storage-service.test.mjs && node --check test/deck-selection-domain.test.mjs',
  'lint tárolási teszt',
);
pkg = pkg.replaceAll(
  'node test/categories.test.mjs && node test/deck-selection-domain.test.mjs',
  'node test/categories.test.mjs && node test/deck-selection-storage-service.test.mjs && node test/deck-selection-domain.test.mjs',
);
pkg = replaceRequired(
  pkg,
  '"test:deck-selection-domain": "node test/deck-selection-domain.test.mjs",\n    "test:storage-service":',
  '"test:deck-selection-domain": "node test/deck-selection-domain.test.mjs",\n    "test:deck-selection-storage": "node test/deck-selection-storage-service.test.mjs",\n    "test:storage-service":',
  'tárolási npm tesztparancs',
);
write('package.json', pkg);

console.log('A 16. lépés pakliválasztási tárolási integrációja elkészült.');
