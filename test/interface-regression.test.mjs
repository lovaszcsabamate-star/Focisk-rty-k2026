import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const mobileCss = read('css/mobile-experience.css');
const ui = read('js/ui.js');
const main = read('js/main.js');
const profile = read('js/player-profile.js');
const reliability = read('js/reliability-fixes.js');
const opponents = read('js/opponents.js');
const pwa = read('js/pwa.js');
const pwaCss = read('css/pwa.css');
const phaseSmoke = read('scripts/mobile-phase-smoke.mjs');
const indexHtml = read('index.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const serviceWorker = read('sw.js');

assert.match(mobileCss, /#duel\s*\{[^}]*display:\s*grid;/s);
assert.match(mobileCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
assert.match(mobileCss, /--battle-card-width/);
assert.match(mobileCss, /--battle-card-height/);
assert.match(mobileCss, /#pub\.is-battle-active\s+#duel\s*>\s*\.duel-slot\s+\.card\s*\{[^}]*--card-w:\s*var\(--battle-card-width\);[^}]*--card-h:\s*var\(--battle-card-height\);/s);
assert.doesNotMatch(mobileCss, /duel-slot:(?:first|last)-child\s+\.card\s*\{[^}]*(?:width|height|--card-w|--card-h):/s);
assert.match(mobileCss, /\.card--choice\.is-selected\s*\{[^}]*outline:\s*3px\s+solid/s);
assert.match(mobileCss, /#pub\.is-battle-transition\s+#player-zone/);
assert.match(mobileCss, /#inspector\.is-battle-transition\s*\{[^}]*opacity:\s*0;/s);
assert.match(mobileCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.doesNotMatch(mobileCss, /margin-left:\s*-/i);

assert.match(ui, /setPhaseState\(phase\)/);
assert.match(ui, /setInteractionBusy\(busy\)/);
assert.match(ui, /event\.key === 'Tab'/);
assert.match(ui, /event\.key === 'Escape'/);
assert.match(ui, /_inspectorReturnFocus/);
assert.match(main, /actionToken/);
assert.match(main, /beginBattleTransition/);
assert.match(ui, /beginBattleTransition\(cardId\)/);
assert.match(main, /await this\.delay\(250\)/);
assert.match(phaseSmoke, /Math\.abs\(result\.first\.width\s*-\s*result\.second\.width\)\s*<=\s*1/);

assert.match(profile, /PLAYER_NAME_STORAGE_KEY\s*=\s*'fociskartyak:player-name:v1'/);
assert.match(profile, /DEFAULT_PLAYER_NAME\s*=\s*'Játékos'/);
assert.match(profile, /MAX_PLAYER_NAME_LENGTH\s*=\s*24/);
assert.match(profile, /subscribePlayerName/);
assert.doesNotMatch(profile, /MutationObserver/);
assert.doesNotMatch(profile, /replaceAll\(['"]Penalties/);

assert.match(reliability, /shouldSuppressRestoredVerdictFeedback/);
assert.match(reliability, /recordedRounds\s*>=\s*resolvedRounds/);
assert.match(reliability, /LEGACY_OPPONENT_IDS/);
assert.match(reliability, /__FOCISKARTYAK_SELECT_OPPONENT__/);
assert.match(opponents, /export function selectOpponentById/);
assert.match(opponents, /__FOCISKARTYAK_SELECT_OPPONENT__\s*=\s*selectOpponentById/);

assert.match(pwa, /pwaShowUpdateNotice/);
assert.match(pwa, /navigator\.serviceWorker\.addEventListener\('controllerchange'/);
assert.match(pwaCss, /\.pwa-update-notice\s*\{/);
assert.match(pwaCss, /safe-area-inset-bottom/);

assert.doesNotMatch(indexHtml, />\s*Penalties(?: mód)?\s*</u);
assert.doesNotMatch(indexHtml, /focus-experience\.js|phase-refinements\.css/);
assert.match(indexHtml, /büntetőpárbaj móddal/i);
assert.match(manifest.description, /büntetőpárbaj/i);
assert.match(serviceWorker, /const PWA_CACHE = 'fociskartyak-2026-v43';/);
assert.match(serviceWorker, /Promise\.allSettled\(PWA_SHELL/);
assert.match(serviceWorker, /async function networkFirst/);
assert.match(serviceWorker, /freshCodeOrData/);
assert.match(serviceWorker, /js\/reliability-fixes\.js/);
assert.doesNotMatch(serviceWorker, /focus-experience\.js|phase-refinements\.css/);

for (const deleted of [
  'js/focus-experience.js',
  'css/mobile-overlay-fix.css', 'css/player-profile.css', 'css/focus-experience.css',
  'css/mobile-selection-fix.css', 'css/duel-emphasis.css', 'css/phase-refinements.css',
]) assert.equal(fs.existsSync(path.join(ROOT, deleted)), false, `Felesleges javítóréteg maradt: ${deleted}`);

console.log('✓ A konszolidált kártyanézet, profil, offline mód és fázisváltás regressziós ellenőrzése rendben');
