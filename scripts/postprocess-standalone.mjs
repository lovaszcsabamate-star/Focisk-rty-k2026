/** Add deck selection and tournament upgrades to the generated single-file build. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const outputPath = path.join(ROOT, 'Fociskartyak2026.html');
const helperPath = path.join(ROOT, 'js/deck-selection.js');
const rapidTournamentPath = path.join(ROOT, 'js/tournament-rapid-upgrade.js');
const rapidTournamentStylePath = path.join(ROOT, 'css/tournament-rapid-upgrade.css');
const experienceTournamentStylePath = path.join(ROOT, 'css/tournament-experience-v2.css');
const flowTournamentPaths = [
  path.join(ROOT, 'js/tournament/tournament-flow-shared.js'),
  path.join(ROOT, 'js/tournament/tournament-flow-wizard.js'),
  path.join(ROOT, 'js/tournament/tournament-flow-runtime.js'),
  path.join(ROOT, 'js/tournament-flow-upgrade.js'),
];
const experienceTournamentPaths = [
  path.join(ROOT, 'js/tournament/tournament-experience-v2-shared.js'),
  path.join(ROOT, 'js/tournament/tournament-experience-v2-wizard.js'),
  path.join(ROOT, 'js/tournament/tournament-experience-v2-runtime.js'),
  path.join(ROOT, 'js/tournament-experience-v2.js'),
  path.join(ROOT, 'js/tournament/tournament-experience-v2-presets.js'),
];
const MAIN_MARKER = '\n/* ===== js/main.js ===== */';
const TOURNAMENT_IIFE_MARKER = '/* ===== Torna mód · önálló IIFE ===== */';
const TOURNAMENT_IIFE_END = '\n })();';
const HELPER_MARKER = '\n/* ===== js/deck-selection.js ===== */';
const RAPID_TOURNAMENT_MARKER = '\n/* ===== js/tournament-rapid-upgrade.js ===== */';
const FLOW_TOURNAMENT_MARKER = '\n/* ===== js/tournament-flow-upgrade.js ===== */';
const EXPERIENCE_TOURNAMENT_MARKER = '\n/* ===== js/tournament-experience-v2.js ===== */';
const RAPID_TOURNAMENT_STYLE_MARKER = 'data-standalone-tournament-rapid-upgrade';
const EXPERIENCE_TOURNAMENT_STYLE_MARKER = 'data-standalone-tournament-experience-v2';
const FLOW_BRIDGE_NAME = '__FociskartyakTournamentFlowShared';

const flattenModule = source => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');

const flowBridge = `
globalThis.${FLOW_BRIDGE_NAME} = Object.freeze({
  FLOW_VERSION, MINIMUM_CARDS, TOURNAMENT_CATEGORY, TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE, TOURNAMENT_STATUS, closeTournamentLayers,
  createTournament, deckRuntime, difficultyLabel, escapeHtml, formatLabel,
  makePanel, matchModeLabel, players, runtime, safeTournamentName,
  saveAndVerifyTournament, selectParticipants, showPanel, tournamentMatches,
  tournamentNextHumanMatch, tournamentProgress, tournamentRoundForMatch,
  tournamentStorageService, tournamentTeamById,
});
`;

const experienceDependencies = `
const {
  FLOW_VERSION, MINIMUM_CARDS, TOURNAMENT_CATEGORY, TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE, TOURNAMENT_STATUS, closeTournamentLayers,
  createTournament, deckRuntime, difficultyLabel, escapeHtml, formatLabel,
  makePanel, matchModeLabel, players, runtime, safeTournamentName,
  saveAndVerifyTournament, selectParticipants, showPanel, tournamentMatches,
  tournamentNextHumanMatch, tournamentProgress, tournamentRoundForMatch,
  tournamentStorageService, tournamentTeamById,
} = globalThis.${FLOW_BRIDGE_NAME};
`;

function flattenExperienceModule(filePath) {
  let source = flattenModule(fs.readFileSync(filePath, 'utf8'));
  if (filePath.endsWith('tournament-experience-v2-wizard.js')) {
    source = source
      .replaceAll('initials(', 'experienceWizardInitials(')
      .replace('const initials =', 'const experienceWizardInitials =')
      .replaceAll('normaliseParticipantIds(', 'normaliseWizardParticipantIds(');
  }
  return source;
}

function assertFlowRuntimeScope(source) {
  const tournamentStart = source.indexOf(TOURNAMENT_IIFE_MARKER);
  const flowStart = source.indexOf(FLOW_TOURNAMENT_MARKER, tournamentStart);
  const experienceStart = source.indexOf(EXPERIENCE_TOURNAMENT_MARKER, flowStart);
  const mainStart = source.indexOf(MAIN_MARKER, tournamentStart);
  const tournamentEnd = source.lastIndexOf(TOURNAMENT_IIFE_END, mainStart);
  if (!(tournamentStart >= 0 && flowStart > tournamentStart
    && experienceStart > flowStart && tournamentEnd > experienceStart && mainStart > tournamentEnd)) {
    throw new Error('A többlépcsős Torna mód nem a meglévő torna-futtatókörnyezetben található.');
  }
}

if (!fs.existsSync(outputPath)) throw new Error(`Hiányzó önálló build: ${outputPath}`);
if (!fs.existsSync(helperPath)) throw new Error(`Hiányzó pakliválasztó modul: ${helperPath}`);
if (!fs.existsSync(rapidTournamentPath)) throw new Error(`Hiányzó tornafejlesztési modul: ${rapidTournamentPath}`);
if (!fs.existsSync(rapidTournamentStylePath)) throw new Error(`Hiányzó tornafejlesztési stílus: ${rapidTournamentStylePath}`);
if (!fs.existsSync(experienceTournamentStylePath)) throw new Error(`Hiányzó Torna mód v2 stílus: ${experienceTournamentStylePath}`);
for (const flowTournamentPath of [...flowTournamentPaths, ...experienceTournamentPaths]) {
  if (!fs.existsSync(flowTournamentPath)) throw new Error(`Hiányzó tornaválasztási modul: ${flowTournamentPath}`);
}

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
  globalThis.FociskartyakDeckSelectionRuntime = Object.freeze({
    buildQuickMatchCatalog,
    quickMatchEntriesForCategory,
    resolveQuickMatchSelection,
    stageQuickMatch,
    TOURNAMENT_LINEUP_STORAGE_KEY,
    QUICK_MATCH_CATEGORY,
  });
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

if (!html.includes(EXPERIENCE_TOURNAMENT_STYLE_MARKER)) {
  const styles = fs.readFileSync(experienceTournamentStylePath, 'utf8').replace(/<\/style/gi, '<\\/style');
  const styleBlock = `<style ${EXPERIENCE_TOURNAMENT_STYLE_MARKER}>\n${styles}\n</style>\n`;
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

if (!html.includes(FLOW_TOURNAMENT_MARKER)) {
  const flowTournament = flowTournamentPaths
    .map(flowTournamentPath => flattenModule(fs.readFileSync(flowTournamentPath, 'utf8')))
    .join('\n')
    .replace(/<\/script/gi, '<\\/script');
  const tournamentStart = html.indexOf(TOURNAMENT_IIFE_MARKER);
  const mainStart = html.indexOf(MAIN_MARKER, tournamentStart);
  const tournamentEnd = html.lastIndexOf(TOURNAMENT_IIFE_END, mainStart);
  if (tournamentStart < 0 || mainStart < 0 || tournamentEnd < tournamentStart) {
    throw new Error('Az önálló Torna mód futtatókörnyezete nem található.');
  }
  html = `${html.slice(0, tournamentEnd)}${FLOW_TOURNAMENT_MARKER}\n{\n${flowTournament}\n${flowBridge}\n}\n${html.slice(tournamentEnd)}`;
}

if (!html.includes(EXPERIENCE_TOURNAMENT_MARKER)) {
  if (!html.includes(`globalThis.${FLOW_BRIDGE_NAME}`)) {
    throw new Error('A Torna mód v2 kompatibilitási hídja hiányzik az önálló buildből.');
  }
  const experienceTournament = experienceTournamentPaths
    .map(flattenExperienceModule)
    .join('\n')
    .replace("new URL('../../css/tournament-experience-v2.css', import.meta.url).href", "'css/tournament-experience-v2.css'")
    .replace(/<\/script/gi, '<\\/script');
  const tournamentStart = html.indexOf(TOURNAMENT_IIFE_MARKER);
  const mainStart = html.indexOf(MAIN_MARKER, tournamentStart);
  const tournamentEnd = html.lastIndexOf(TOURNAMENT_IIFE_END, mainStart);
  if (tournamentStart < 0 || mainStart < 0 || tournamentEnd < tournamentStart) {
    throw new Error('Az önálló Torna mód futtatókörnyezete nem található.');
  }
  html = `${html.slice(0, tournamentEnd)}${EXPERIENCE_TOURNAMENT_MARKER}\n{\n${experienceDependencies}\n${experienceTournament}\n}\n${html.slice(tournamentEnd)}`;
}

assertFlowRuntimeScope(html);

if (!html.includes(RAPID_TOURNAMENT_MARKER)
  || !html.includes(RAPID_TOURNAMENT_STYLE_MARKER)
  || !html.includes('globalThis.FociskartyakTournament?.read?.()')
  || !html.includes('tournament-match-intro-trigger')
  || !html.includes('tournament-match-summary')) {
  throw new Error('A gyors tornaélmény-fejlesztés nem került be az önálló buildbe.');
}

if (!html.includes(FLOW_TOURNAMENT_MARKER)
  || !html.includes('FociskartyakDeckSelectionRuntime')
  || !html.includes('Tovább a tornában')
  || !html.includes('Vissza a tornaághoz')
  || !html.includes('Kilépés a főmenübe')
  || !html.includes('Magyar Bajnokság')
  || !html.includes('Világkupa')) {
  throw new Error('A többlépcsős tornaválasztás nem került be az önálló buildbe.');
}

if (!html.includes(EXPERIENCE_TOURNAMENT_MARKER)
  || !html.includes(EXPERIENCE_TOURNAMENT_STYLE_MARKER)
  || !html.includes('FociskartyakTournamentExperience')
  || !html.includes('FociskartyakTournamentQuickPresets')
  || !html.includes('Rövid torna')
  || !html.includes('Klasszikus torna')
  || !html.includes('Hosszú bajnokság')
  || !html.includes('Tovább a csapatválasztáshoz')
  || !html.includes('Elkészült a torna sorsolása')
  || !html.includes('normaliseWizardParticipantIds')) {
  throw new Error('A Torna mód v2 élményrétege nem került be az önálló buildbe.');
}

html = html.replace(/[ \t]+$/gm, '');
fs.writeFileSync(outputPath, html);

console.log(`Pakliválasztás és tornafejlesztések beépítve az önálló játékfájlba: ${outputPath}`);
