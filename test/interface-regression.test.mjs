import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const duelCss = read('css/duel-emphasis.css');
const refinementCss = read('css/phase-refinements.css');
const focusJs = read('js/focus-experience.js');
const reliabilityJs = read('js/reliability-fixes.js');
const usabilityJs = read('js/usability-fixes.js');
const opponentsJs = read('js/opponents.js');
const pipelineJs = read('js/ui/ui-enhancement-pipeline.js');
const pwaJs = read('js/pwa.js');
const pwaCss = read('css/pwa.css');
const phaseSmoke = read('scripts/mobile-phase-smoke.mjs');
const profileCss = read('css/player-profile.css');
const profileJs = read('js/player-profile.js');
const configurationJs = read('js/app/configuration.js');
const indexHtml = read('index.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const serviceWorker = read('sw.js');

assert.match(duelCss, /#duel\s*\{[^}]*display:\s*grid;/s, 'A párbajnézet nem rácsos elrendezésű.');
assert.match(
  duelCss,
  /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/,
  'A két kártya nem külön, szimmetrikus oszlopban jelenik meg.',
);
assert.match(duelCss, /#duel\s*>\s*\.duel-slot\s+\.card\s*\{[^}]*max-width:\s*100%;/s);
assert.match(duelCss, /aspect-ratio:\s*var\(--card-aspect-ratio\)/);
assert.match(
  duelCss,
  /#pub\.is-battle-active\s+#duel\s*>\s*\.duel-slot\s+\.card\s*\{[^}]*--card-w:\s*var\(--battle-card-width\);[^}]*--card-h:\s*var\(--battle-card-height\);/s,
  'A két csatakártyát nem ugyanaz a méretezési szabály vezérli.',
);
assert.doesNotMatch(
  duelCss,
  /duel-slot:(?:first|last)-child\s+\.card\s*\{[^}]*(?:width|height|--card-w|--card-h):/s,
  'Oldalanként eltérő kártyaméret maradt a csatafázisban.',
);
assert.match(duelCss, /\.card--choice\.is-selected\s*\{[^}]*outline:\s*3px\s+solid\s+var\(--brass-light\)/s);
assert.match(duelCss, /#pub\.is-battle-transition\s+#player-zone/);
assert.match(refinementCss, /#inspector\.is-battle-transition\s*\{[^}]*opacity:\s*0;/s);
assert.match(refinementCss, /\.card--choice\.is-selected::before\s*\{[^}]*content:\s*none;/s);
assert.match(refinementCss, /\.card--choice\.is-selected::after\s*\{[^}]*width:\s*max-content;[^}]*height:\s*auto;/s);
assert.match(refinementCss, /#attribute-picker:has\(> \.attr-btn--mobile\)\s*\{[^}]*grid-auto-flow:\s*column;[^}]*scroll-snap-type:\s*x mandatory;/s);
assert.match(refinementCss, /#attribute-picker:has\(> \.attr-btn--mobile\) \.attr-btn--mobile\s*\{[^}]*min-height:\s*132px;[^}]*scroll-snap-align:\s*center;/s);
assert.match(refinementCss, /#inspector \.inspector__shell\s*\{[^}]*grid-template-columns:\s*44px minmax\(0, 1fr\) 44px;/s);
assert.match(refinementCss, /#inspector \.card--large\s*\{[^}]*calc\(100vw - 116px\)/s);
assert.match(refinementCss, /#pub\.is-battle-active\s+#felt\s*\{[^}]*battle-card-height[^}]*280px/s);
assert.match(refinementCss, /\.card__name\s*\{[^}]*text-overflow:\s*clip\s*!important;[^}]*-webkit-line-clamp:\s*unset\s*!important;/s);
assert.match(refinementCss, /\.card__name--compact\s*\{/);
assert.doesNotMatch(duelCss, /margin-left:\s*-/i, 'Negatív margó átfedést okozhat a párbajnézetben.');

assert.match(focusJs, /setClass\(pub,\s*'is-battle-active',\s*battleActive\)/);
assert.match(focusJs, /pub\.classList\.add\('is-battle-transition'\)/);
assert.match(focusJs, /},\s*250\);/, 'A 200–300 ms-os átmeneti időzítés hiányzik.');
assert.match(focusJs, /queueMicrotask/);
assert.match(focusJs, /markChoiceCardSelected/);
assert.match(focusJs, /handleDirectChoicePlay/);
assert.match(focusJs, /card\.dataset\.battleTransitionBypass/);
assert.match(phaseSmoke, /Math\.abs\(result\.first\.width\s*-\s*result\.second\.width\)\s*<=\s*1/);
assert.match(phaseSmoke, /selection-phase-mobile\.png/);
assert.match(phaseSmoke, /battle-phase-mobile\.png/);

assert.match(usabilityJs, /document\.removeEventListener\('keydown', this\._inspectorKeys\)/);
assert.match(usabilityJs, /event\.key === 'Tab'/);
assert.match(usabilityJs, /_inspectorReturnFocus/);
assert.match(usabilityJs, /scrollIntoView/);
assert.match(usabilityJs, /INSPECTOR_SWIPE_DISTANCE\s*=\s*44/);
assert.match(usabilityJs, /pointerup/);
assert.match(usabilityJs, /this\._inspectorStep\(deltaX < 0 \? 1 : -1\)/);
assert.match(usabilityJs, /event\.target\.closest\?\.\('button, a, input, select, textarea, \[role="button"\]'\)/);
assert.match(usabilityJs, /export function cardPlayerDisplayName/);
assert.match(usabilityJs, /profileSlugName/);
assert.match(usabilityJs, /UI\.prototype\.renderCard\s*=\s*function renderCardWithReadableName/);
assert.match(usabilityJs, /nameNode\.textContent\s*=\s*displayName/);
assert.match(usabilityJs, /\.replace\(\/\[…\]\+\/gu,\s*' '\)/);

assert.match(profileCss, /#hud-scores \.score:first-child span:first-child\s*\{[^}]*text-overflow:\s*ellipsis;/s);
assert.match(profileCss, /#hud-scores \.penalty-score\s*\{[^}]*white-space:\s*nowrap;/s);
assert.match(profileCss, /\.final-score\s*\{[^}]*overflow-wrap:\s*anywhere;/s);

assert.match(profileJs, /PLAYER_NAME_STORAGE_KEY\s*=\s*APP_STORAGE_KEYS\.playerName/);
assert.match(configurationJs, /playerName:\s*'fociskartyak:player-name:v1'/, 'A játékosnév tárolási kulcsának változatlannak kell maradnia.');
assert.match(profileJs, /DEFAULT_PLAYER_NAME\s*=\s*'Játékos'/);
assert.match(profileJs, /fociskartyak:player-name-changed/);
assert.match(profileJs, /\['Penalties mód',\s*'Büntetőpárbaj'\]/);
assert.match(profileJs, /\['Tizenegyes mód',\s*'Büntetőpárbaj'\]/);

assert.match(reliabilityJs, /shouldSuppressRestoredVerdictFeedback/);
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
assert.match(indexHtml, /büntetőpárbaj móddal/i);
assert.match(indexHtml, /css\/phase-refinements\.css/);
assert.doesNotMatch(indexHtml, /js\/(?:player-profile|reliability-fixes|usability-fixes|focus-experience)\.js/);
assert.match(
  pipelineJs,
  /\.\.\/player-profile\.js[\s\S]*\.\.\/reliability-fixes\.js[\s\S]*\.\.\/usability-fixes\.js[\s\S]*\.\.\/focus-experience\.js/,
);
assert.match(manifest.description, /büntetőpárbaj/i);
assert.match(serviceWorker, /const PWA_CACHE = 'fociskartyak-2026-v\d+';/);
assert.match(serviceWorker, /Promise\.allSettled\(PWA_SHELL/);
assert.match(serviceWorker, /async function networkFirst/);
assert.match(serviceWorker, /freshCodeOrData/);
assert.match(serviceWorker, /js\/reliability-fixes\.js/);
assert.match(serviceWorker, /js\/usability-fixes\.js/);
assert.match(serviceWorker, /css\/phase-refinements\.css/);

console.log('✓ A kártyanevek, kategóriakarusszel, kijelölés, kétirányú kártyanézegető, frissítés és offline mód rendben');
