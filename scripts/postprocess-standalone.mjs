/** Finalise the downloadable single-file build and embed deck selection support. */

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

// A külön letöltött HTML mellett nincs manifest vagy külső ikonfájl. Ezek PWA-ban
// hasznosak, az egyfájlos kiadásban viszont felesleges hibás fájlkéréseket okoznának.
html = html
  .replace(/\s*<link\s+rel="manifest"\s+href="manifest\.webmanifest"\s*>\s*/gi, '\n')
  .replace(/\s*<link\s+rel="icon"[^>]*href="src\/assets\/placeholders\/app-icon\.svg"[^>]*>\s*/gi, '\n');

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
  html = html.replace(MAIN_MARKER, `${HELPER_MARKER}\n{\n${helper}\n${initialiseSelection}}\n${MAIN_MARKER}`);
}

fs.writeFileSync(outputPath, html);
console.log(`Letölthető, külső fájloktól független játék elkészült: ${outputPath}`);
