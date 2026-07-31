/** Add deck selection and the rapid tournament upgrade to the generated single-file build. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const outputPath = path.join(ROOT, 'Fociskartyak2026.html');
const helperPath = path.join(ROOT, 'js/deck-selection.js');
const rapidTournamentPath = path.join(ROOT, 'js/tournament-rapid-upgrade.js');
const rapidTournamentStylePath = path.join(ROOT, 'css/tournament-rapid-upgrade.css');
const MAIN_MARKER = '\n/* ===== js/main.js ===== */';
const HELPER_MARKER = '\n/* ===== js/deck-selection.js ===== */';
const RAPID_TOURNAMENT_MARKER = '\n/* ===== js/tournament-rapid-upgrade.js ===== */';
const RAPID_TOURNAMENT_STYLE_MARKER = 'data-standalone-tournament-rapid-upgrade';

const flattenModule = source => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');

if (!fs.existsSync(outputPath)) throw new Error(`Hiányzó önálló build: ${outputPath}`);
if (!fs.existsSync(helperPath)) throw new Error(`Hiányzó pakliválasztó modul: ${helperPath}`);
if (!fs.existsSync(rapidTournamentPath)) throw new Error(`Hiányzó tornafejlesztési modul: ${rapidTournamentPath}`);
if (!fs.existsSync(rapidTournamentStylePath)) throw new Error(`Hiányzó tornafejlesztési stílus: ${rapidTournamentStylePath}`);

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
  html = html.replace(MAIN_MARKER, `${HELPER_MARKER}\n{\n${helper}\n${initialiseSelection}}\n${MAIN_MARKER}`);
}

if (!html.includes(RAPID_TOURNAMENT_STYLE_MARKER)) {
  const styles = fs.readFileSync(rapidTournamentStylePath, 'utf8').replace(/<\/style/gi, '<\\/style');
  const styleBlock = `<style ${RAPID_TOURNAMENT_STYLE_MARKER}>\n${styles}\n</style>\n`;
  if (!html.includes('</head>')) throw new Error('Az önálló buildből hiányzik a head lezárása.');
  html = html.replace('</head>', `${styleBlock}</head>`);
}

if (!html.includes(RAPID_TOURNAMENT_MARKER)) {
  const rapidTournament = flattenModule(fs.readFileSync(rapidTournamentPath, 'utf8'))
    .replace("new URL('../css/tournament-rapid-upgrade.css', import.meta.url).href", "'css/tournament-rapid-upgrade.css'")
    .replaceAll('tournamentStorageService.read()', 'globalThis.FociskartyakTournament?.read?.()')
    .replace(/^\s*ensureStylesheet\(\);\s*$/m, '')
    .replace(/<\/script/gi, '<\\/script');
  html = html.replace(
    MAIN_MARKER,
    `${RAPID_TOURNAMENT_MARKER}\n{\n${rapidTournament}\n}\n${MAIN_MARKER}`,
  );
}

if (!html.includes(RAPID_TOURNAMENT_MARKER)
  || !html.includes(RAPID_TOURNAMENT_STYLE_MARKER)
  || !html.includes('globalThis.FociskartyakTournament?.read?.()')
  || !html.includes('tournament-match-intro-trigger')
  || !html.includes('tournament-match-summary')) {
  throw new Error('A gyors tornaélmény-fejlesztés nem került be az önálló buildbe.');
}

html = html.replace(/[ \t]+$/gm, '');
fs.writeFileSync(outputPath, html);

console.log(`Pakliválasztás és gyors tornaélmény beépítve az önálló játékfájlba: ${outputPath}`);
