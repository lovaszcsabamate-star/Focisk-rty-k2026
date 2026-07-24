import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található integrációs pont: ${label}`);
  return source.replace(search, replacement);
};

let main = read('js/main.js');
main = replaceOnce(main, "import { PHASE, HUMAN, AI } from './engine.js';\n", '', 'engine UI-konstans import eltávolítása');
main = replaceOnce(
  main,
  "import { TURN_DELAY, createTurnTimingService } from './services/turn-timing-service.js';",
  "import { createTurnTimingService } from './services/turn-timing-service.js';",
  'turn timing import',
);
main = replaceOnce(
  main,
  "import { createResultController } from './app/result-controller.js';\n",
  "import { createResultController } from './app/result-controller.js';\nimport { createRoundController } from './app/round-controller.js';\n",
  'round-controller import',
);
main = replaceOnce(main, "import { UI, el } from './ui.js';", "import { UI } from './ui.js';", 'UI import');
main = replaceOnce(main, "import { getLine, getIdleChatter } from './banter.js';", "import { getLine } from './banter.js';", 'banter import');
main = replaceOnce(main, "import { ATTRIBUTE_BY_KEY, attributeValue, loadPlayers } from './data/players.js';", "import { loadPlayers } from './data/players.js';", 'player import');
main = replaceOnce(
  main,
  `      clearSaved: clearSavedMatch,
    });
    applyExperienceSettings(this.settings);`,
  `      clearSaved: clearSavedMatch,
    });
    this.rounds = createRoundController({
      ui: this.ui,
      runtime: this.runtime,
      getState: () => ({
        game: this.game,
        mode: this.mode,
        busy: this.busy,
        pendingAttribute: this.pendingAttribute,
        awaitingChooserCard: this.awaitingChooserCard,
      }),
      actions: {
        setBusy: value => { this.busy = value; },
        saveCurrentGame: () => this.saveCurrentGame(),
        showGameOver: () => this.showGameOver(),
      },
      wait: delayOrKey => this.delay(delayOrKey),
    });
    applyExperienceSettings(this.settings);`,
  'round-controller példány',
);

const roundBlock = /  beginRound\(\) \{[\s\S]*?\n  saveCurrentGame\(\) \{/;
if (!roundBlock.test(main)) throw new Error('A Session körvezérlési blokk nem található.');
main = main.replace(roundBlock, `  beginRound() {
    return this.rounds.beginRound();
  }

  humanChoseAttribute(attributeKey) {
    return this.rounds.humanChoseAttribute(attributeKey);
  }

  aiChoosesAttribute() {
    return this.rounds.aiChoosesAttribute();
  }

  humanPlayedCard(card) {
    return this.rounds.humanPlayedCard(card);
  }

  revealAndScore(result) {
    return this.rounds.revealAndScore(result);
  }

  sayResultBanter(result) {
    return this.rounds.sayResultBanter(result);
  }

  showContinue() {
    return this.rounds.showContinue();
  }

  saveCurrentGame() {`);

const restoreBlock = /  restoreSavedView\(\) \{[\s\S]*?\n  showGameOver\(\) \{/;
if (!restoreBlock.test(main)) throw new Error('A Session mentett körnézet blokk nem található.');
main = main.replace(restoreBlock, `  restoreSavedView() {
    return this.rounds.restoreSavedView();
  }

  finishRestoredAiMove() {
    return this.rounds.finishRestoredAiMove();
  }

  showGameOver() {`);

if (/A gép választ…|Következő párbaj|potScooped|A gép befejezi a félbemaradt kört/.test(main)) {
  throw new Error('A Session fájlban körvezérlési UI-logika maradt.');
}
write('js/main.js', main);

let staticTest = read('test/static.test.mjs');
staticTest = replaceOnce(
  staticTest,
  "const gameRuntime = read('../js/game/game-runtime.js');\n",
  "const gameRuntime = read('../js/game/game-runtime.js');\nconst roundController = read('../js/app/round-controller.js');\n",
  'statikus körvezérlő forrás',
);
staticTest = replaceOnce(
  staticTest,
  `assert.match(main, /runtime.playHumanCard/);
assert.match(main, /runtime.playAiCard/);`,
  `assert.match(roundController, /runtime.playHumanCard/);
assert.match(roundController, /runtime.playAiCard/);`,
  'statikus runtime műveletek',
);
write('test/static.test.mjs', staticTest);

const packageJson = JSON.parse(read('package.json'));
packageJson.scripts.lint = packageJson.scripts.lint
  .replace('node --check js/app/result-controller.js', 'node --check js/app/result-controller.js && node --check js/app/round-controller.js')
  .replace('node --check test/result-controller.test.mjs', 'node --check test/result-controller.test.mjs && node --check test/round-controller.test.mjs');
packageJson.scripts.test = packageJson.scripts.test.replace(
  'node test/result-controller.test.mjs',
  'node test/result-controller.test.mjs && node test/round-controller.test.mjs',
);
packageJson.scripts['test:all'] = packageJson.scripts['test:all'].replace(
  'node test/result-controller.test.mjs',
  'node test/result-controller.test.mjs && node test/round-controller.test.mjs',
);
packageJson.scripts['test:round-controller'] = 'node test/round-controller.test.mjs';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

let build = read('scripts/build-standalone.mjs');
build = replaceOnce(
  build,
  "  'js/app/result-controller.js',\n",
  "  'js/app/result-controller.js',\n  'js/app/round-controller.js',\n",
  'standalone modulrend',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = replaceOnce(sw, 'fociskartyak-2026-v30 ... fociskartyak-2026-v64', 'fociskartyak-2026-v30 ... fociskartyak-2026-v65', 'PWA cache előzmény');
sw = replaceOnce(sw, "const PWA_CACHE = 'fociskartyak-2026-v65';", "const PWA_CACHE = 'fociskartyak-2026-v66';", 'PWA cache verzió');
sw = replaceOnce(
  sw,
  "  './js/app/result-controller.js',\n",
  "  './js/app/result-controller.js',\n  './js/app/round-controller.js',\n",
  'PWA körvezérlő bejegyzés',
);
write('sw.js', sw);

console.log('✓ A 20. lépés körvezérlő-integrációja alkalmazva.');
