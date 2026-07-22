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

const STYLE_LINKS = [
  '  <link rel="stylesheet" href="css/usability-audit-2026.css">\n',
  '  <link rel="stylesheet" href="css/usability-mobile-selection-fix.css">\n',
];
const SCRIPT_TAG = '  <script type="module" src="js/usability-audit-2026.js"></script>\n';
const CSS_MARKER = '/* ===== css/usability-audit-2026.css ===== */';
const JS_MARKER = '/* ===== js/usability-audit-2026.js ===== */';
const MAIN_MARKER = '/* ===== js/main.js ===== */';
const ICON_PATH = 'src/assets/placeholders/app-icon.svg';
const iconDataUri = `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, ICON_PATH)).toString('base64')}`;

const flattenModule = source => source
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*$/gm, '')
  .replace(/^import\s+['"][^'"]+['"];\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');

let html = fs.readFileSync(outputPath, 'utf8');
for (const link of STYLE_LINKS) html = html.replace(link, '');
html = html
  .replace(SCRIPT_TAG, '')
  .replaceAll(ICON_PATH, iconDataUri);

if (!html.includes(CSS_MARKER)) {
  const css = [
    `${CSS_MARKER}\n${read('css/usability-audit-2026.css')}`,
    `/* ===== css/usability-mobile-selection-fix.css ===== */\n${read('css/usability-mobile-selection-fix.css')}`,
  ].join('\n\n');
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
