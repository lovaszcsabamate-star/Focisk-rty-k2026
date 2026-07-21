import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const duelCss = read('css/duel-emphasis.css');
const refinementCss = read('css/phase-refinements.css');
const focusJs = read('js/focus-experience.js');
const phaseSmoke = read('scripts/mobile-phase-smoke.mjs');
const profileCss = read('css/player-profile.css');
const profileJs = read('js/player-profile.js');
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
assert.match(refinementCss, /#pub\.is-battle-active\s+#felt\s*\{[^}]*battle-card-height[^}]*280px/s);
assert.doesNotMatch(duelCss, /margin-left:\s*-/i, 'Negatív margó átfedést okozhat a párbajnézetben.');

assert.match(focusJs, /setClass\(pub,\s*'is-battle-active',\s*battleActive\)/);
assert.match(focusJs, /pub\.classList\.add\('is-battle-transition'\)/);
assert.match(focusJs, /},\s*250\);/, 'A 200–300 ms-os átmeneti időzítés hiányzik.');
assert.match(focusJs, /queueMicrotask/);
assert.match(focusJs, /markChoiceCardSelected/);
assert.match(phaseSmoke, /Math\.abs\(result\.first\.width\s*-\s*result\.second\.width\)\s*<=\s*1/);
assert.match(phaseSmoke, /selection-phase-mobile\.png/);
assert.match(phaseSmoke, /battle-phase-mobile\.png/);

assert.match(profileCss, /#hud-scores \.score:first-child span:first-child\s*\{[^}]*text-overflow:\s*ellipsis;/s);
assert.match(profileCss, /#hud-scores \.penalty-score\s*\{[^}]*white-space:\s*nowrap;/s);
assert.match(profileCss, /\.final-score\s*\{[^}]*overflow-wrap:\s*anywhere;/s);

assert.match(profileJs, /PLAYER_NAME_STORAGE_KEY\s*=\s*'fociskartyak:player-name:v1'/);
assert.match(profileJs, /DEFAULT_PLAYER_NAME\s*=\s*'Játékos'/);
assert.match(profileJs, /fociskartyak:player-name-changed/);
assert.match(profileJs, /\['Penalties mód',\s*'Büntetőpárbaj'\]/);
assert.match(profileJs, /\['Tizenegyes mód',\s*'Büntetőpárbaj'\]/);

assert.doesNotMatch(indexHtml, />\s*Penalties(?: mód)?\s*</u, 'A fő HTML-ben angol Penalties felirat maradt.');
assert.match(indexHtml, /büntetőpárbaj móddal/i);
assert.match(indexHtml, /css\/phase-refinements\.css/);
assert.match(manifest.description, /büntetőpárbaj/i);
assert.match(serviceWorker, /fociskartyak-2026-v38/);
assert.match(serviceWorker, /css\/phase-refinements\.css/);

console.log('✓ A fázisváltás, azonos csatakártyák, mentett név és Büntetőpárbaj felirat regressziós ellenőrzése rendben');
