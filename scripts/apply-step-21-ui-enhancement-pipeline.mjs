import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található integrációs pont: ${label}`);
  return source.replace(search, replacement);
};

let bootstrap = read('js/bootstrap.js');
bootstrap = replaceOnce(
  bootstrap,
  "} from './deck-selection.js';\n",
  "} from './deck-selection.js';\nimport { installUiEnhancementPipeline } from './ui/ui-enhancement-pipeline.js';\n",
  'pipeline import',
);
bootstrap = replaceOnce(
  bootstrap,
  'try {\n  const loaded = await loadDatabase();',
  'try {\n  await installUiEnhancementPipeline();\n  const loaded = await loadDatabase();',
  'pipeline bootstrap await',
);
write('js/bootstrap.js', bootstrap);

let index = read('index.html');
const enhancementScripts = [
  'ux.js',
  'ux-fixes.js',
  'matchday.js',
  'opponents.js',
  'player-profile.js',
  'reliability-fixes.js',
  'usability-fixes.js',
  'focus-experience.js',
  'visual-settings-persistence.js',
  'visual-system.js',
  'legal-ui.js',
];
for (const file of enhancementScripts) {
  index = replaceOnce(index, `  <script type="module" src="js/${file}"></script>\n`, '', `index script: ${file}`);
}
write('index.html', index);

const packageJson = JSON.parse(read('package.json'));
packageJson.scripts.lint = packageJson.scripts.lint
  .replace('node --check js/ui/deck-selection-menu-component.js', 'node --check js/ui/deck-selection-menu-component.js && node --check js/ui/ui-enhancement-pipeline.js')
  .replace('node --check test/ui-components.test.mjs', 'node --check test/ui-components.test.mjs && node --check test/ui-enhancement-pipeline.test.mjs');
packageJson.scripts.test = packageJson.scripts.test.replace(
  'node test/ui-components.test.mjs',
  'node test/ui-components.test.mjs && node test/ui-enhancement-pipeline.test.mjs',
);
packageJson.scripts['test:all'] = packageJson.scripts['test:all'].replace(
  'node test/ui-components.test.mjs',
  'node test/ui-components.test.mjs && node test/ui-enhancement-pipeline.test.mjs',
);
packageJson.scripts['test:ui-enhancement-pipeline'] = 'node test/ui-enhancement-pipeline.test.mjs';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

let build = read('scripts/build-standalone.mjs');
build = replaceOnce(
  build,
  "  'js/legal-ui.js',\n  'js/main.js',",
  "  'js/legal-ui.js',\n  'js/ui/ui-enhancement-pipeline.js',\n  'js/main.js',",
  'standalone pipeline modulrend',
);
build = replaceOnce(
  build,
  '<script>globalThis.__EMBEDDED_PLAYER_DATA__ = ${safeJson};</script>\\n<script type="module">${safeBundle}</script>',
  '<script>globalThis.__EMBEDDED_PLAYER_DATA__ = ${safeJson}; globalThis.__FOCISKARTYAK_UI_ENHANCEMENTS_PRELOADED__ = true;</script>\\n<script type="module">${safeBundle}</script>',
  'standalone preloaded marker',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = replaceOnce(sw, 'fociskartyak-2026-v30 ... fociskartyak-2026-v65', 'fociskartyak-2026-v30 ... fociskartyak-2026-v66', 'PWA cache előzmény');
sw = replaceOnce(sw, "const PWA_CACHE = 'fociskartyak-2026-v66';", "const PWA_CACHE = 'fociskartyak-2026-v67';", 'PWA cache verzió');
sw = replaceOnce(
  sw,
  "  './js/ui/deck-selection-menu-component.js',\n",
  "  './js/ui/deck-selection-menu-component.js',\n  './js/ui/ui-enhancement-pipeline.js',\n",
  'PWA pipeline bejegyzés',
);
write('sw.js', sw);

console.log('✓ A 21. lépés UI enhancement pipeline-integrációja alkalmazva.');
