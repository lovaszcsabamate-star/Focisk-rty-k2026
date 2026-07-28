/** Build the standalone game, then inline sizing, team-selector and Quick Match assets. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('./build-standalone.mjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUTPUT = path.join(ROOT, 'Fociskartyak2026.html');
const CSS_LINK = '  <link rel="stylesheet" href="css/visual-settings-persistence.css">';
const TEAM_SELECTOR_CSS_LINK = '  <link rel="stylesheet" href="css/deck-selection-menu.css">';
const JS_TAG = '  <script type="module" src="js/visual-settings-persistence.js"></script>';
const TEAM_SELECTOR_BUNDLE_MARKER = '/* ===== js/ui/deck-selection-menu-component.js ===== */';

const sizingCss = fs.readFileSync(path.join(ROOT, 'css/visual-settings-persistence.css'), 'utf8');
const teamSelectorCss = fs.readFileSync(path.join(ROOT, 'css/deck-selection-menu.css'), 'utf8');
const sizingJs = fs.readFileSync(path.join(ROOT, 'js/visual-settings-persistence.js'), 'utf8')
  .replace(/<\/script/gi, '<\\/script');
const flattenInlineModule = source => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');
const quickMatchInlineBundle = [
  'js/domain/quick-match-domain.js',
  'js/services/quick-match-storage-service.js',
].map(file => `\n/* ===== ${file} ===== */\n${flattenInlineModule(fs.readFileSync(path.join(ROOT, file), 'utf8'))}`)
  .join('\n')
  .replace(/<\/script/gi, '<\\/script');

let output = fs.readFileSync(OUTPUT, 'utf8');
output = output
  .replace(CSS_LINK, `  <style>\n${sizingCss}\n  </style>`)
  .replace(TEAM_SELECTOR_CSS_LINK, `  <style>\n${teamSelectorCss}\n  </style>`)
  .replace(JS_TAG, `  <script>\n${sizingJs}\n  </script>`)
  .replace(TEAM_SELECTOR_BUNDLE_MARKER, `${quickMatchInlineBundle}\n${TEAM_SELECTOR_BUNDLE_MARKER}`);

if (output.includes(CSS_LINK) || output.includes(TEAM_SELECTOR_CSS_LINK) || output.includes(JS_TAG)) {
  throw new Error('Az önálló buildből külső felületi asset maradt bent.');
}
if (!output.includes('Méretezés mentése') || !output.includes('fociskartyak.visual-sizing.v1')) {
  throw new Error('A méretezésmentés nem került be az önálló buildbe.');
}
if (!output.includes('quick-team-card') || !output.includes('quick-match-duel')) {
  throw new Error('A kétlépcsős Gyors meccs csapatválasztó stílusa nem került be az önálló buildbe.');
}
if (!output.includes('buildQuickMatchCatalog') || !output.includes('quickMatchStorageService')) {
  throw new Error('A Gyors meccs központi domainje vagy tárolója nem került be az önálló buildbe.');
}

fs.writeFileSync(OUTPUT, output);
console.log('Méretezésmentés és kétlépcsős Gyors meccs csapatválasztó beágyazva az önálló buildbe.');
