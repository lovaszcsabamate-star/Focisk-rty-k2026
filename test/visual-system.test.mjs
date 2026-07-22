import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const index = read('index.html');
const css = read('css/visual-system.css');
const visual = read('js/visual-system.js');
const branding = read('js/branding.js');
const licenses = JSON.parse(read('src/assets/licenses/assets-licenses.json'));

assert.match(index, /css\/visual-system\.css/, 'A központi vizuális CSS nincs betöltve.');
assert.match(index, /js\/branding\.js[\s\S]*js\/visual-system\.js[\s\S]*js\/bootstrap\.js/, 'A branding guardnak és a vizuális rendszernek a bootstrap előtt kell futnia.');

for (const variable of [
  '--selection-card-width', '--battle-card-target', '--card-aspect-ratio', '--card-gap',
  '--card-radius', '--battlefield-height', '--panel-background', '--accent-color',
  '--animation-speed', '--mobile-selection-card-width',
]) {
  assert.ok(css.includes(variable), `Hiányzó központi CSS-változó: ${variable}`);
}

assert.match(css, /#pub\.is-battle-active #duel > \.duel-slot \.card\s*\{[\s\S]*width:\s*var\(--battle-card-width\)/, 'Mindkét csatakártyának közös méretszabályt kell használnia.');
assert.doesNotMatch(css, /duel-slot:first-child \.card\s*\{[\s\S]{0,180}(?:width|--card-w|scale)/, 'Nem lehet oldalanként eltérő csatakártya-méret.');
assert.match(css, /#player-hand\.hand--selection[\s\S]*overflow-x:\s*auto/, 'A választási kéznek vízszintesen görgethetőnek kell lennie.');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'Hiányzik a prefers-reduced-motion támogatás.');
assert.match(css, /\.duel-slot\.winner::after[\s\S]*GYŐZTES/, 'A győzelmet nem csak színnel kell jelezni.');
assert.match(css, /\.duel-slot\.loser::after[\s\S]*VESZTES/, 'A vereséget nem csak színnel kell jelezni.');

assert.match(visual, /localStorage/, 'A megjelenési beállításokat helyben kell menteni.');
assert.match(visual, /requestFullscreen/, 'Hiányzik a teljes képernyős beállítás.');
assert.match(visual, /highContrast/, 'Hiányzik a nagy kontrasztú mód.');
assert.match(visual, /card\.tabIndex = 0/, 'A választható kártyáknak billentyűzettel fókuszálhatónak kell lenniük.');
assert.match(visual, /event\.key !== 'Enter' && event\.key !== ' '/, 'Hiányzik az Enter/Szóköz kártyaválasztás.');
assert.match(visual, /független projekt/, 'Hiányzik a független projekt jelzése.');

assert.match(branding, /allowOfficialBranding:\s*false/, 'A hivatalos arculat alapértékének false-nak kell lennie.');
assert.match(branding, /isRemoteAssetUrl\(value\) \|\| isProtectedUnapprovedArt\(value\)/, 'A külső és jóváhagyatlan képkéréseket blokkolni kell.');
assert.match(branding, /player-silhouette\.svg/, 'Hiányzik a semleges játékoshelyettesítő.');

const placeholders = licenses.filter(asset => asset.sourceType === 'placeholder');
assert.ok(placeholders.length >= 2, 'Legalább játékos- és klubhelyettesítő asset szükséges.');
assert.ok(placeholders.every(asset => asset.approvedForRelease === true), 'A projekt saját helyettesítő assetjeinek jóváhagyottnak kell lenniük.');
assert.ok(licenses.filter(asset => ['club-logo', 'league-logo'].includes(asset.assetType) && asset.sourceType !== 'placeholder')
  .every(asset => asset.approvedForRelease !== true), 'Nem jóváhagyott hivatalos logó nem kerülhet kiadásra.');

console.log('Vizuális rendszer: rendben.');
