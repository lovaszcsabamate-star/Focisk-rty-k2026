import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const index = read('index.html');
const manifest = read('manifest.webmanifest');
const css = read('css/visual-system.css');
const sizingCss = read('css/visual-settings-persistence.css');
const legalCss = read('css/legal-ui.css');
const visual = read('js/visual-system.js');
const sizingPersistence = read('js/visual-settings-persistence.js');
const usability = read('js/usability-fixes.js');
const branding = read('js/branding.js');
const legalUi = read('js/legal-ui.js');
const licenses = JSON.parse(read('src/assets/licenses/assets-licenses.json'));

assert.match(index, /css\/visual-system\.css/, 'A központi vizuális CSS nincs betöltve.');
assert.match(index, /css\/visual-settings-persistence\.css/, 'A méretezésmentés visszajelző stílusa nincs betöltve.');
assert.match(index, /css\/legal-ui\.css/, 'A kezdőképernyős jogi stílus nincs betöltve.');
assert.match(index, /js\/branding\.js[\s\S]*js\/visual-settings-persistence\.js[\s\S]*js\/visual-system\.js[\s\S]*js\/legal-ui\.js[\s\S]*js\/bootstrap\.js/, 'A méretezés visszaállításának a vizuális rendszer előtt kell futnia.');
assert.match(index, /src\/assets\/placeholders\/app-icon\.svg/, 'Az aktív felületnek a jóváhagyott semleges alkalmazásikont kell használnia.');
assert.doesNotMatch(index, /assets\/icons\/(?:icon|apple-touch-icon)/, 'Jóváhagyatlan korábbi projektikon nem maradhat az aktív felületen.');
assert.match(manifest, /src\/assets\/placeholders\/app-icon\.svg/, 'A PWA-manifestnek a jóváhagyott semleges alkalmazásikont kell használnia.');
assert.doesNotMatch(manifest, /assets\/icons\//, 'A PWA-manifest nem hivatkozhat a korábbi, nem jóváhagyott ikonokra.');

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

assert.match(legalCss, /#pub #player-hand:not\(\.hand--selection\) \.card/, 'A két játékmód közös kézkártya-méretezése hiányzik.');
assert.match(legalCss, /\.pile__inspect\s*\{/, 'Hiányzik az egyetlen kézszintű nagyító gomb.');
assert.match(legalCss, /\.card__inspect\s*\{[\s\S]*display:\s*none\s*!important/, 'A kártyánkénti nagyítókat el kell rejteni.');
assert.match(legalCss, /#inspector-stable-backdrop/, 'Hiányzik a villanásmentes, stabil inspector-háttér.');
assert.match(legalCss, /#hud-settings \.icon-toggle[\s\S]*58px/, 'A mobilos felső ikonok nagyítása hiányzik.');
assert.match(legalCss, /#player-hand\.hand--selection[\s\S]*padding-left:\s*16px\s*!important/, 'Az első lap bal oldali biztonsági térköze hiányzik.');
assert.match(legalCss, /#pub:has\(#attribute-picker > \.attr-btn--mobile\)[\s\S]*--card-w:\s*clamp\(138px, 39vw, 158px\)/, 'Kategóriaválasztáskor nem nőnek meg a kártyák.');

assert.match(usability, /node\.querySelector\('\.card__inspect'\)\?\.remove\(\)/, 'A kártyánkénti nagyítót futásidőben is el kell távolítani.');
assert.match(usability, /syncHandInspectorButton/, 'Hiányzik az egyetlen kézszintű nagyító szinkronizálása.');
assert.match(usability, /INSPECTOR_BACKDROP_ID\s*=\s*'inspector-stable-backdrop'/, 'A nagyított nézet stabil háttere nincs bekötve.');
assert.match(usability, /largeCard\.classList\.add\('inspector__playable-card'\)/, 'A nagyított lap nem választható koppintással.');
assert.match(usability, /playButton\.click\(\)/, 'A nagyított lap koppintása nem indítja el a meglévő kiválasztási folyamatot.');
assert.match(usability, /stepInspectorWithoutBackdropFlash/, 'Hiányzik a simított kártyalapozás.');

assert.match(visual, /localStorage/, 'A megjelenési beállításokat helyben kell menteni.');
assert.match(visual, /requestFullscreen/, 'Hiányzik a teljes képernyős beállítás.');
assert.match(visual, /highContrast/, 'Hiányzik a nagy kontrasztú mód.');
assert.match(visual, /card\.tabIndex = 0/, 'A választható kártyáknak billentyűzettel fókuszálhatónak kell lenniük.');
assert.match(visual, /event\.key !== 'Enter' && event\.key !== ' '/, 'Hiányzik az Enter/Szóköz kártyaválasztás.');
assert.match(visual, /független projekt/, 'Hiányzik a játéktér független projekt jelzése.');

assert.match(sizingPersistence, /SIZING_BACKUP_KEY\s*=\s*'fociskartyak\.visual-sizing\.v1'/, 'Hiányzik a külön méretezési mentési kulcs.');
assert.match(sizingPersistence, /restoreExplicitSizing\(\)/, 'A mentett méretezést induláskor vissza kell tölteni.');
assert.match(sizingPersistence, /Méretezés mentése/, 'Hiányzik a méretezés mentése gomb.');
assert.match(sizingPersistence, /localStorage\.setItem/, 'A méretezés mentésének helyi tárhelyet kell használnia.');
assert.match(sizingPersistence, /selectionCardWidth[\s\S]*battleCardWidth[\s\S]*cardGap[\s\S]*battlefieldHeight/, 'Nem minden méretérték kerül mentésre.');
assert.match(sizingCss, /\.appearance-save-status[\s\S]*data-state='saved'/, 'Hiányzik a sikeres méretezésmentés vizuális visszajelzése.');

assert.match(legalUi, /Büntetőpárbaj/, 'A játékmód magyar felirata nincs egységesítve.');
assert.match(legalUi, /Nem áll hivatalos kapcsolatban/, 'Hiányzik a kezdőképernyős jogi tájékoztatás.');

assert.match(branding, /allowOfficialBranding:\s*false/, 'A hivatalos arculat alapértékének false-nak kell lennie.');
assert.match(branding, /isRemoteAssetUrl\(value\) \|\| isProtectedUnapprovedArt\(value\)/, 'A külső és jóváhagyatlan képkéréseket blokkolni kell.');
assert.match(branding, /player-silhouette\.svg/, 'Hiányzik a semleges játékoshelyettesítő.');
assert.match(branding, /app-icon\.svg/, 'A jóváhagyott alkalmazásikonnak a futásidejű allowlistben is szerepelnie kell.');

const placeholders = licenses.filter(asset => asset.sourceType === 'placeholder' || asset.filePath.endsWith('/app-icon.svg'));
assert.ok(placeholders.length >= 3, 'Játékos-, klub- és alkalmazásikon-helyettesítő szükséges.');
assert.ok(placeholders.every(asset => asset.approvedForRelease === true), 'A projekt saját helyettesítő assetjeinek jóváhagyottnak kell lenniük.');
assert.ok(licenses.filter(asset => ['club-logo', 'league-logo'].includes(asset.assetType) && asset.sourceType !== 'placeholder')
  .every(asset => asset.approvedForRelease !== true), 'Nem jóváhagyott hivatalos logó nem kerülhet kiadásra.');

console.log('Vizuális rendszer: rendben.');
