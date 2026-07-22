/** Add deck selection to the generated single-file build without changing its runtime dependencies. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const outputPath = path.join(ROOT, 'Fociskartyak2026.html');
const helperPath = path.join(ROOT, 'js/deck-selection.js');
const MAIN_MARKER = '\n/* ===== js/main.js ===== */';
const HELPER_MARKER = '\n/* ===== js/deck-selection.js ===== */';

const flattenModule = source => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');

if (!fs.existsSync(outputPath)) throw new Error(`Hiányzó önálló build: ${outputPath}`);
if (!fs.existsSync(helperPath)) throw new Error(`Hiányzó pakliválasztó modul: ${helperPath}`);

let html = fs.readFileSync(outputPath, 'utf8');
if (!html.includes(MAIN_MARKER)) throw new Error('Az önálló buildben nem található a main.js beszúrási pontja.');

if (!html.includes(HELPER_MARKER)) {
  const helper = flattenModule(fs.readFileSync(helperPath, 'utf8')).replace(/<\/script/gi, '<\\/script');
  const initialiseSelection = `
/* ===== standalone deck selection bootstrap ===== */
const standaloneFullPayload = globalThis.__EMBEDDED_PLAYER_DATA__;
if (standaloneFullPayload?.players) {
  const standaloneDeckSelection = readDeckSelection(standaloneFullPayload.players);
  globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ = standaloneFullPayload;
  globalThis.__FOCISKARTYAK_DECK_SELECTION__ = standaloneDeckSelection;
  globalThis.__EMBEDDED_PLAYER_DATA__ = applyDeckSelectionToPayload(standaloneFullPayload, standaloneDeckSelection);
  installDeckSelectionMenu(standaloneFullPayload, standaloneDeckSelection);
}
`;
  html = html.replace(MAIN_MARKER, `${HELPER_MARKER}\n${helper}\n${initialiseSelection}${MAIN_MARKER}`);
  fs.writeFileSync(outputPath, html);
}

console.log(`Pakliválasztás beépítve az önálló játékfájlba: ${outputPath}`);
