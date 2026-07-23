import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const write = (path, content) => fs.writeFileSync(new URL(path, root), content);
const replace = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Nem található UI-integrációs részlet: ${label}`);
  return source.replace(before, after);
};

let build = read('scripts/build-standalone.mjs');
build = replace(
  build,
  `  'js/banter.js',
  'js/ui.js',`,
  `  'js/banter.js',
  'js/ui/dom.js',
  'js/ui/card-view.js',
  'js/ui/scoreboard-view.js',
  'js/ui/match-view.js',
  'js/ui/feedback-view.js',
  'js/ui.js',`,
  'önálló build modulrend',
);
write('scripts/build-standalone.mjs', build);

let serviceWorker = read('sw.js');
serviceWorker = replace(
  serviceWorker,
  '// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v51',
  '// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v52',
  'cache előzmény',
);
serviceWorker = replace(
  serviceWorker,
  "const PWA_CACHE = 'fociskartyak-2026-v52';",
  "const PWA_CACHE = 'fociskartyak-2026-v53';",
  'cache verzió',
);
serviceWorker = replace(
  serviceWorker,
  `  './js/banter.js',
  './js/ui.js',`,
  `  './js/banter.js',
  './js/ui/dom.js',
  './js/ui/card-view.js',
  './js/ui/scoreboard-view.js',
  './js/ui/match-view.js',
  './js/ui/feedback-view.js',
  './js/ui.js',`,
  'PWA UI komponensek',
);
write('sw.js', serviceWorker);

const packagePath = 'package.json';
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts['test:ui-components'] = 'node test/ui-components.test.mjs';
packageJson.scripts.lint = replace(
  packageJson.scripts.lint,
  'node --check js/ui.js',
  'node --check js/ui/dom.js && node --check js/ui/card-view.js && node --check js/ui/scoreboard-view.js && node --check js/ui/match-view.js && node --check js/ui/feedback-view.js && node --check js/ui.js',
  'lint UI komponensek',
);
packageJson.scripts.lint = replace(
  packageJson.scripts.lint,
  'node --check test/standalone-game-runtime.test.mjs',
  'node --check test/standalone-game-runtime.test.mjs && node --check test/ui-components.test.mjs',
  'lint UI komponens teszt',
);
for (const key of ['test', 'test:all']) {
  packageJson.scripts[key] = replace(
    packageJson.scripts[key],
    'node test/standalone-game-runtime.test.mjs',
    'node test/standalone-game-runtime.test.mjs && node test/ui-components.test.mjs',
    `${key} UI komponens teszt`,
  );
}
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

for (const path of [
  'scripts/apply-step7-ui-components.mjs',
  '.github/workflows/step7-ui-components.yml',
]) {
  const url = new URL(path, root);
  if (fs.existsSync(url)) fs.unlinkSync(url);
}

console.log('✓ Az UI-komponensek bekerültek az önálló buildbe, a PWA cache-be és a tesztláncba.');
