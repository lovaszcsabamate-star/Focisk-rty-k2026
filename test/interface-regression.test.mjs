import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const readJson = relative => JSON.parse(read(relative));

const uiJs = read('../js/ui.js');
const mainJs = read('../js/main.js');
const roundControllerJs = read('../js/app/round-controller.js');
const menuControllerJs = read('../js/app/menu-controller.js');
const opponentsJs = read('../js/opponents.js');
const reliabilityJs = read('../js/reliability-fixes.js');
const pwaJs = read('../js/pwa.js');
const pwaCss = read('../css/pwa.css');
const indexHtml = read('../index.html');
const pipelineJs = read('../js/ui/ui-enhancement-pipeline.js');
const serviceWorker = read('../sw.js');
const manifest = readJson('../manifest.webmanifest');

assert.match(uiJs, /showOverlay\(node\)/);
assert.match(uiJs, /focusOverlayBody\(\)/);
assert.match(uiJs, /aria-modal/);
assert.match(uiJs, /focusableOverlayNodes/);
assert.match(uiJs, /event\.key === 'Tab'/);
assert.match(uiJs, /event\.key === 'Escape'/);
assert.match(uiJs, /showToast\(message/);
assert.match(uiJs, /aria-live/);
assert.match(uiJs, /setInteractionBusy/);
assert.match(uiJs, /setMode\(mode\)/);
assert.match(uiJs, /renderPenaltyBoard/);
assert.match(uiJs, /showSuddenDeath/);
assert.match(uiJs, /hideSuddenDeath/);
assert.match(uiJs, /resetTable\(\)/);
assert.match(uiJs, /closeInspector\(\)/);
assert.match(uiJs, /finiteDetail\(card\.stats\.redCards\)/);
assert.match(uiJs, /finiteDetail\(card\.stats\.secondYellowRedCards\)/);
assert.match(uiJs, /Kijátszom ezt a lapot/);
assert.match(uiJs, /Ez a lap nem használható/);
assert.match(uiJs, /onToggleSounds/);
assert.match(uiJs, /onToggleCommentary/);
assert.match(uiJs, /onPause/);
assert.match(uiJs, /onOpenSettings/);
assert.match(uiJs, /this\.settings = \{ sounds: true, commentary: true/);

assert.match(mainJs, /onToggleSounds/);
assert.match(mainJs, /onToggleCommentary/);
assert.match(mainJs, /onPause/);
assert.match(mainJs, /onOpenSettings/);
assert.match(mainJs, /saveCurrentGame\(\)/);
assert.match(mainJs, /resumeSavedMatch\(\)/);
assert.match(mainJs, /showPauseMenu\(\)/);
assert.match(mainJs, /showSettings\(returnAction\)/);
assert.match(mainJs, /showRules\(returnAction\)/);
assert.match(mainJs, /this\.lifecycle = createSessionLifecycleService/);
assert.match(mainJs, /this\.rounds = createRoundController/);
assert.match(mainJs, /this\.quickMatch = createQuickMatchController/);
assert.match(mainJs, /mode === 'quick-match'/);
assert.match(mainJs, /mode === 'penalties'/);
assert.match(mainJs, /clearSavedMatch\(\)/);
assert.match(mainJs, /readSavedMatch\(\)/);
assert.match(mainJs, /writeSavedMatch\(/);
assert.match(mainJs, /hydrateGame/);
assert.match(mainJs, /loadSettings\(\)/);
assert.match(mainJs, /applyExperienceSettings/);
assert.match(mainJs, /onboardingWasCompleted/);
assert.match(mainJs, /setOnboardingCompleted/);
assert.doesNotMatch(mainJs, /addEventListener\('pagehide'/);
assert.doesNotMatch(mainJs, /addEventListener\('visibilitychange'/);
assert.doesNotMatch(mainJs, /addEventListener\('popstate'/);
assert.doesNotMatch(mainJs, /addEventListener\('error'/);
assert.doesNotMatch(mainJs, /addEventListener\('unhandledrejection'/);
assert.doesNotMatch(mainJs, /new Promise\(resolve => setTimeout/);
assert.doesNotMatch(mainJs, /_recordUxStat\(/);
assert.doesNotMatch(mainJs, /getLine\('error'/);
assert.doesNotMatch(mainJs, /el\('button', 'btn', 'Következő kör'/);

assert.match(roundControllerJs, /runtime\.selectHumanAttribute/);
assert.match(roundControllerJs, /runtime\.commitHumanChooserCard/);
assert.match(roundControllerJs, /runtime\.chooseAiAttribute/);
assert.match(roundControllerJs, /runtime\.playHumanCard/);
assert.match(roundControllerJs, /runtime\.playAiCard/);
assert.match(roundControllerJs, /runtime\.advance/);
assert.match(roundControllerJs, /showNextRoundButton/);
assert.match(roundControllerJs, /showContinue/);
assert.match(roundControllerJs, /showGameOver/);
assert.match(roundControllerJs, /recordUxStat/);
assert.match(roundControllerJs, /getBanterLine/);
assert.match(roundControllerJs, /showError/);

assert.match(menuControllerJs, /showTitleScreen/);
assert.match(menuControllerJs, /showPauseMenu/);
assert.match(menuControllerJs, /startFromMenu/);
assert.match(menuControllerJs, /confirmReplaceSavedGame/);
assert.match(menuControllerJs, /showSettings/);
assert.match(menuControllerJs, /showRules/);
assert.match(menuControllerJs, /showOnboarding/);
assert.match(menuControllerJs, /showPenaltyIntro/);
assert.match(menuControllerJs, /readSaved\(\)/);
assert.match(menuControllerJs, /clearSaved\(\)/);
assert.match(menuControllerJs, /onboardingCompleted\(\)/);
assert.doesNotMatch(menuControllerJs, /new GameRuntime/);

assert.match(reliabilityJs, /recordedRounds\s*>=\s*resolvedRounds/);
assert.match(reliabilityJs, /RELIABILITY_LEGACY_OPPONENT_IDS/);
assert.match(reliabilityJs, /__FOCISKARTYAK_SELECT_OPPONENT__/);
assert.match(reliabilityJs, /game\.mode\s*===\s*'penalties'\s*\?\s*'BÜNTETŐPÁRBAJ'/);
assert.match(opponentsJs, /export function selectOpponentById/);
assert.match(opponentsJs, /__FOCISKARTYAK_SELECT_OPPONENT__\s*=\s*selectOpponentById/);

assert.match(pwaJs, /pwaShowUpdateNotice/);
assert.match(pwaJs, /navigator\.serviceWorker\.addEventListener\('controllerchange'/);
assert.match(pwaJs, /30 \* 60 \* 1000/);
assert.match(pwaCss, /\.pwa-update-notice\s*\{/);
assert.match(pwaCss, /safe-area-inset-bottom/);

assert.doesNotMatch(indexHtml, />\s*Penalties(?: mód)?\s*</u, 'A fő HTML-ben angol Penalties felirat maradt.');
assert.match(indexHtml, /klasszikus/i);
assert.match(indexHtml, /büntetőpárbaj/i);
assert.match(indexHtml, /Gyors meccs/i);
assert.match(indexHtml, /css\/phase-refinements\.css/);
assert.doesNotMatch(indexHtml, /js\/(?:player-profile|reliability-fixes|usability-fixes|focus-experience)\.js/);
assert.match(
  pipelineJs,
  /\.\.\/player-profile\.js[\s\S]*\.\.\/reliability-fixes\.js[\s\S]*\.\.\/usability-fixes\.js[\s\S]*\.\.\/focus-experience\.js/,
);
assert.match(manifest.description, /klasszikus/i);
assert.match(manifest.description, /büntetőpárbaj/i);
assert.match(manifest.description, /Gyors meccs/i);
assert.match(serviceWorker, /const PWA_CACHE = 'fociskartyak-2026-v\d+';/);
assert.match(serviceWorker, /Promise\.allSettled\(PWA_SHELL/);
assert.match(serviceWorker, /async function networkFirst/);
assert.match(serviceWorker, /freshCodeOrData/);

console.log('✓ Interfész-regresszió: a Klasszikus, Büntetőpárbaj és Gyors meccs magyar felülete rendben');
