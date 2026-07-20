/** Create a dependency-free, single-file preview build. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const moduleOrder = [
  'js/data/players.js',
  'js/engine.js',
  'js/penalties.js',
  'js/ai.js',
  'js/banter.js',
  'js/ui.js',
  'js/ux.js',
  'js/ux-fixes.js',
  'js/matchday.js',
  'js/pwa.js',
  'js/main.js',
];

const flattenModule = source => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\};?\s*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|class|function|async\s+function)\b)/g, '');

const bundle = moduleOrder
  .map(file => `\n/* ===== ${file} ===== */\n${flattenModule(read(file))}`)
  .join('\n');
const basePayload = JSON.parse(read('data/players.json'));
const rawEnrichment = JSON.parse(read('data/club-official-enrichment.json'));
const corrections = JSON.parse(read('data/club-official-corrections.json'));
const enrichment = prepareClubEnrichment(rawEnrichment, corrections);
const payload = applyClubEnrichmentPayload(basePayload, enrichment);
const safeJson = JSON.stringify(payload).replace(/<\/script/gi, '<\\/script');
const safeBundle = bundle.replace(/<\/script/gi, '<\\/script');
let css = `${read('css/style.css')}\n\n${read('css/ux.css')}\n\n${read('css/matchday.css')}\n\n${read('css/pwa.css')}`;

const backgroundFiles = [
  ['assets/pub/background.webp', 'image/webp'],
  ['assets/pub/background.jpg', 'image/jpeg'],
  ['assets/pub/background.png', 'image/png'],
];
const backgroundFile = backgroundFiles.find(([relative]) => fs.existsSync(path.join(ROOT, relative)));
if (backgroundFile) {
  const [relative, mime] = backgroundFile;
  const background = fs.readFileSync(path.join(ROOT, relative)).toString('base64');
  css += `\n#pub { background-image: linear-gradient(rgba(18,11,5,.36), rgba(18,11,5,.64)), url("data:${mime};base64,${background}") !important; }\n`;
}

const output = read('index.html')
  .replace('<link rel="stylesheet" href="css/style.css">', `<style>${css}</style>`)
  .replace('\n  <link rel="stylesheet" href="css/ux.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/matchday.css">', '')
  .replace('\n  <link rel="stylesheet" href="css/pwa.css">', '')
  .replace('  <script type="module" src="js/ux.js"></script>\n', '')
  .replace('  <script type="module" src="js/ux-fixes.js"></script>\n', '')
  .replace('  <script type="module" src="js/matchday.js"></script>\n', '')
  .replace('  <script type="module" src="js/pwa.js"></script>\n', '')
  .replace(
    '<script type="module" src="js/bootstrap.js"></script>',
    `<script>globalThis.__EMBEDDED_PLAYER_DATA__ = ${safeJson};</script>\n<script type="module">${safeBundle}</script>`
  );

const outputPath = path.join(ROOT, 'Fociskartyak2026.html');
fs.writeFileSync(outputPath, output);
console.log(`Elkészült: ${outputPath}`);
console.log(`${payload.players.length} játékoskártya beágyazva.`);
console.log(`${payload.enrichment?.matchedRecords ?? 0}/${payload.enrichment?.records ?? 0} hivatalos klubrekord illesztve.`);
console.log(`${payload.enrichment?.addedPlayers ?? 0} igazolt hiányzó játékos hozzáadva.`);
