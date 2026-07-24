import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található integrációs pont: ${label}`);
  return source.replace(search, replacement);
};

let main = read('js/main.js');
main = replaceOnce(
  main,
  "import { createMenuController } from './app/menu-controller.js';\n",
  "import { createMenuController } from './app/menu-controller.js';\nimport { createResultController } from './app/result-controller.js';\n",
  'result-controller import',
);
main = replaceOnce(
  main,
  `    });
    applyExperienceSettings(this.settings);`,
  `    });
    this.results = createResultController({
      ui: this.ui,
      getState: () => ({
        mode: this.mode,
        difficulty: this.difficulty,
        result: this.runtime.result(),
      }),
      actions: {
        setBusy: value => { this.busy = value; },
        start: (mode, difficulty) => this.start(mode, difficulty),
        showTitleScreen: options => this.showTitleScreen(options),
        showPanel: (panel, returnAction) => this._showPanel(panel, returnAction),
      },
      clearSaved: clearSavedMatch,
    });
    applyExperienceSettings(this.settings);`,
  'result-controller példány',
);

const resultBlock = /  showGameOver\(\) \{[\s\S]*?\n  \}\n\}\n\nconst \{ players/;
if (!resultBlock.test(main)) throw new Error('A Session végeredmény-blokk nem található.');
main = main.replace(resultBlock, `  showGameOver() {
    return this.results.showGameOver();
  }
}

const { players`);
if (/result-kicker|result-stats|rematch-btn|Nem volt megnyert kategória/.test(main)) {
  throw new Error('A Session fájlban eredmény-DOM maradt.');
}
write('js/main.js', main);

const packageJson = JSON.parse(read('package.json'));
packageJson.scripts.lint = packageJson.scripts.lint
  .replace('node --check js/app/menu-controller.js', 'node --check js/app/menu-controller.js && node --check js/app/result-controller.js')
  .replace('node --check test/menu-controller.test.mjs', 'node --check test/menu-controller.test.mjs && node --check test/result-controller.test.mjs');
packageJson.scripts.test = packageJson.scripts.test.replace(
  'node test/menu-controller.test.mjs',
  'node test/menu-controller.test.mjs && node test/result-controller.test.mjs',
);
packageJson.scripts['test:all'] = packageJson.scripts['test:all'].replace(
  'node test/menu-controller.test.mjs',
  'node test/menu-controller.test.mjs && node test/result-controller.test.mjs',
);
packageJson.scripts['test:result-controller'] = 'node test/result-controller.test.mjs';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

let build = read('scripts/build-standalone.mjs');
build = replaceOnce(
  build,
  "  'js/app/menu-controller.js',\n",
  "  'js/app/menu-controller.js',\n  'js/app/result-controller.js',\n",
  'standalone modulrend',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = replaceOnce(sw, 'fociskartyak-2026-v30 ... fociskartyak-2026-v63', 'fociskartyak-2026-v30 ... fociskartyak-2026-v64', 'PWA cache előzmény');
sw = replaceOnce(sw, "const PWA_CACHE = 'fociskartyak-2026-v64';", "const PWA_CACHE = 'fociskartyak-2026-v65';", 'PWA cache verzió');
sw = replaceOnce(
  sw,
  "  './js/app/menu-controller.js',\n",
  "  './js/app/menu-controller.js',\n  './js/app/result-controller.js',\n",
  'PWA eredményvezérlő bejegyzés',
);
write('sw.js', sw);

console.log('✓ A 19. lépés eredményvezérlő-integrációja alkalmazva.');
