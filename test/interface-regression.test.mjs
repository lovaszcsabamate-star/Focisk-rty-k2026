import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const duelCss = read('css/duel-emphasis.css');
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
assert.match(duelCss, /aspect-ratio:\s*132\s*\/\s*232/);
assert.doesNotMatch(duelCss, /margin-left:\s*-/i, 'Negatív margó átfedést okozhat a párbajnézetben.');

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
assert.match(manifest.description, /büntetőpárbaj/i);
assert.match(serviceWorker, /fociskartyak-2026-v36/);

console.log('✓ A párbajelrendezés, a mentett név és a Büntetőpárbaj felirat regressziós ellenőrzése rendben');
