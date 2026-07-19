import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const launcher = fs.readFileSync(new URL('../JATEK_INDITASA.bat', import.meta.url), 'utf8');
const standalone = fs.readFileSync(new URL('../Fociskartyak2026.html', import.meta.url), 'utf8');

assert.match(html, /<html lang="hu">/);
for (const id of ['hud-settings', 'penalty-board', 'sudden-death-banner', 'attribute-picker']) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(css, /@media \(max-width: 900px\)/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.match(css, /\.mode-penalties \.hand[^}]*overflow-x: auto/s);
assert.match(css, /\.attempt--win/);
assert.match(css, /\.attempt--loss/);
assert.match(css, /\.attempt--tie/);
assert.match(main, /Klasszikus mód/);
assert.match(main, /Penalties mód/);
assert.match(main, /Következő párbaj/);
assert.match(main, /Vissza a főmenübe/);
assert.match(launcher, /Fociskartyak2026\.html/);
assert.match(launcher, /start "" "%GAME%"/);
assert.match(standalone, /globalThis\.__EMBEDDED_PLAYER_DATA__/);
assert.doesNotMatch(standalone, /<script type="module" src=/);
assert.doesNotMatch(standalone, /<link rel="stylesheet" href=/);

console.log('✓ Magyar és reszponzív felületi szerződés: rendben');
