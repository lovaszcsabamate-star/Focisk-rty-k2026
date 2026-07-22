import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const index = read('index.html');
const css = read('css/usability-audit-2026.css');
const js = read('js/usability-audit-2026.js');
const preview = read('scripts/usability-preview-gallery.mjs');

assert.match(index, /css\/legal-ui\.css[\s\S]*css\/usability-audit-2026\.css/u, 'Az audit CSS-nek utolsóként kell betöltődnie.');
assert.match(index, /js\/legal-ui\.js[\s\S]*js\/usability-audit-2026\.js[\s\S]*js\/bootstrap\.js/u, 'Az audit JS-nek a meglévő javítások után, a bootstrap előtt kell futnia.');
assert.match(css, /min-height:\s*44px/u, 'Az érintési célok minimuma hiányzik.');
assert.match(css, /@media \(max-width: 360px\)/u);
assert.match(css, /@media \(max-width: 390px\)/u);
assert.match(css, /@media \(max-width: 768px\)/u);
assert.match(css, /@media \(max-width: 1023px\)/u);
assert.match(css, /@media \(min-width: 1024px\)/u);
assert.match(css, /prefers-reduced-motion:\s*reduce/u);
assert.match(css, /\.score--human/u);
assert.match(css, /\.score--opponent/u);
assert.match(js, /MISSING_TEXT/u, 'A hibás helyőrzők szűrése hiányzik.');
assert.match(js, /window\.confirm/u, 'A veszélyes műveletek megerősítése hiányzik.');
assert.match(js, /deck-selector__search/u, 'A kereshető pakliválasztás hiányzik.');
assert.match(js, /MIN_FILTERED_DECK_SIZE/u, 'A 11 lapos minimum indoklása hiányzik.');
assert.match(js, /event\.isTrusted/u, 'A dupla aktiválás elleni védelem hiányzik.');
assert.match(js, /aria-busy/u);
assert.match(preview, /01-kezdokepernyo-jatekmodvalasztas\.png/u);
assert.match(preview, /02-csapat-nemzetisegvalasztas\.png/u);
assert.match(preview, /03-kartyavalasztas-asztali\.png/u);
assert.match(preview, /04-kartyavalasztas-mobil\.png/u);
assert.match(preview, /05-csata-azonos-kartyakkal\.png/u);
assert.match(preview, /06-merkozes-vegi-eredmeny\.png/u);

console.log('✓ A 2026-os kezelhetőségi audit statikus regressziós tesztje sikeres.');
