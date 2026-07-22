/** Embed the final usability layer into the already generated standalone HTML. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(ROOT, 'Fociskartyak2026.html');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

if (!fs.existsSync(outputPath)) {
  throw new Error('Hiányzik a Fociskartyak2026.html; előbb futtasd a build-standalone lépést.');
}

const STYLE_LINK = '  <link rel="stylesheet" href="css/usability-audit-2026.css">\n';
const SCRIPT_TAG = '  <script type="module" src="js/usability-audit-2026.js"></script>\n';
const CSS_MARKER = '/* ===== css/usability-audit-2026.css ===== */';
const JS_MARKER = '/* ===== js/usability-audit-2026.js ===== */';
const MAIN_MARKER = '/* ===== js/main.js ===== */';

const flattenModule = source => source
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*$/gm, '')
  .replace(/^import\s+['"][^'"]+['"];\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');

let html = fs.readFileSync(outputPath, 'utf8')
  .replace(STYLE_LINK, '')
  .replace(SCRIPT_TAG, '');

if (!html.includes(CSS_MARKER)) {
  const css = `${CSS_MARKER}\n${read('css/usability-audit-2026.css')}`;
  if (!html.includes('</style>')) throw new Error('Az önálló HTML nem tartalmaz beágyazott stílusblokkot.');
  html = html.replace('</style>', `\n${css}\n</style>`);
}

if (!html.includes(JS_MARKER)) {
  const source = flattenModule(read('js/usability-audit-2026.js')).replace(/<\/script/gi, '<\\/script');
  const injected = `${JS_MARKER}\n${source}\n\n${MAIN_MARKER}`;
  if (!html.includes(MAIN_MARKER)) throw new Error('Az önálló modulcsomagból hiányzik a main.js jelölő.');
  html = html.replace(MAIN_MARKER, injected);
}

if (/<(?:script|link)\b[^>]*(?:src|href)=["'](?:js|css)\//iu.test(html)) {
  throw new Error('Az önálló kiadásban külső JavaScript- vagy CSS-hivatkozás maradt.');
}

fs.writeFileSync(outputPath, html);
console.log('✓ A kezelhetőségi audit CSS- és JavaScript-rétege beágyazva az önálló kiadásba.');
