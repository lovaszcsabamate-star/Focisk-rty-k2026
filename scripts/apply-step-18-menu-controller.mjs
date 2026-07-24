import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található integrációs pont: ${label}`);
  return source.replace(search, replacement);
};

let menuController = read('js/app/menu-controller.js');
menuController = replaceOnce(
  menuController,
  `import {
  clearSavedMatch,
  onboardingWasCompleted,
  readSavedMatch,
  setOnboardingCompleted,
} from '../mobile-experience.js';
`,
  '',
  'DOM-függő mobilélmény-import eltávolítása',
);
menuController = replaceOnce(
  menuController,
  `  readSaved = readSavedMatch,
  clearSaved = clearSavedMatch,
  onboardingCompleted = onboardingWasCompleted,
  setOnboardingCompletedValue = setOnboardingCompleted,
`,
  `  readSaved,
  clearSaved,
  onboardingCompleted,
  setOnboardingCompletedValue,
`,
  'perzisztencia alapértelmezések eltávolítása',
);
menuController = replaceOnce(
  menuController,
  `  if (typeof elementFactory !== 'function') {
    throw new MenuControllerError('INVALID_ELEMENT_FACTORY', 'A menüvezérlő elemgyártó függvénye kötelező.');
  }

`,
  `  if (typeof elementFactory !== 'function') {
    throw new MenuControllerError('INVALID_ELEMENT_FACTORY', 'A menüvezérlő elemgyártó függvénye kötelező.');
  }
  const persistence = { readSaved, clearSaved, onboardingCompleted, setOnboardingCompletedValue };
  Object.keys(persistence).forEach(method => (
    menuControllerAssertMethod(persistence, method, 'INVALID_PERSISTENCE_ADAPTER')
  ));

`,
  'perzisztencia adapter validációja',
);
write('js/app/menu-controller.js', menuController);

let main = read('js/main.js');
main = replaceOnce(
  main,
  "import { createSessionLifecycleService } from './app/session-lifecycle-service.js';\n",
  "import { createSessionLifecycleService } from './app/session-lifecycle-service.js';\nimport { createMenuController } from './app/menu-controller.js';\n",
  'menu-controller import',
);
main = main.replace(
  "import { PHASE, HUMAN, AI, GAME_DECK_SIZE } from './engine.js';",
  "import { PHASE, HUMAN, AI } from './engine.js';",
);
main = replaceOnce(
  main,
  '    this.overlayReturn = null;\n',
  `    this.menu = createMenuController({
      ui: this.ui,
      getState: () => ({
        deck: this.deck,
        source: this.source,
        meta: this.meta,
        settings: this.settings,
        game: this.game,
        mode: this.mode,
        difficulty: this.difficulty,
      }),
      actions: {
        saveCurrentGame: () => this.saveCurrentGame(),
        prepareTitleScreen: () => {
          this.busy = false;
          this.ui.setInteractionBusy(false);
          this.runtime.reset();
          this.ui.setMode('classic');
          this.ui.resetTable();
        },
        resumeSavedMatch: () => this.resumeSavedMatch(),
        start: (mode, difficulty) => this.start(mode, difficulty),
        toggleSetting: (key, value) => this.toggleSetting(key, value),
        beginMatch: () => this._beginMatch(),
      },
      readSaved: readSavedMatch,
      clearSaved: clearSavedMatch,
      onboardingCompleted: onboardingWasCompleted,
      setOnboardingCompletedValue: setOnboardingCompleted,
    });
`,
  'Session menüvezérlő példány',
);
main = replaceOnce(
  main,
  `    if (!this.ui.dom.overlay.hidden && this.overlayReturn) {
      const action = this.overlayReturn;
      this.overlayReturn = null;
      action();
      return;
    }
`,
  `    if (this.menu.handleBackAction()) return;
`,
  'overlay visszalépés',
);

const menuBlockPattern = /  _showPanel\(panel, returnAction = null\) \{[\s\S]*?\n  start\(mode, difficulty\) \{/;
if (!menuBlockPattern.test(main)) throw new Error('A fő menümetódus-blokk nem található.');
main = main.replace(menuBlockPattern, `  _showPanel(panel, returnAction = null) {
    return this.menu.showPanel(panel, returnAction);
  }

  _hidePanel() {
    return this.menu.hidePanel();
  }

  showTitleScreen(options = {}) {
    return this.menu.showTitleScreen(options);
  }

  _savedTimeLabel(iso) {
    return this.menu.savedTimeLabel(iso);
  }

  _deckLabel() {
    return this.menu.deckLabel();
  }

  selectedDifficulty(panel) {
    return this.menu.selectedDifficulty(panel);
  }

  startFromMenu(mode, panel) {
    return this.menu.startFromMenu(mode, panel);
  }

  confirmReplaceSavedGame(mode, difficulty) {
    return this.menu.confirmReplaceSavedGame(mode, difficulty);
  }

  showOnboarding(forced = false) {
    return this.menu.showOnboarding(forced);
  }

  showRules(returnAction) {
    return this.menu.showRules(returnAction);
  }

  showSettings(returnAction) {
    return this.menu.showSettings(returnAction);
  }

  showPauseMenu() {
    return this.menu.showPauseMenu();
  }

  start(mode, difficulty) {`);

const penaltyIntroPattern = /  showPenaltyIntro\(\) \{[\s\S]*?\n  _beginMatch\(\) \{/;
if (!penaltyIntroPattern.test(main)) throw new Error('A Büntetőpárbaj-intro blokk nem található.');
main = main.replace(penaltyIntroPattern, `  showPenaltyIntro() {
    return this.menu.showPenaltyIntro();
  }

  _beginMatch() {`);

if (/this\.overlayReturn|A hátsó asztal bajnoksága|onboarding-progress|settings-list|pause-actions/.test(main)) {
  throw new Error('A Session fájlban menü-DOM vagy régi overlay-állapot maradt.');
}
write('js/main.js', main);

const packageJson = JSON.parse(read('package.json'));
packageJson.scripts.lint = packageJson.scripts.lint
  .replace('node --check js/app/session-lifecycle-service.js', 'node --check js/app/session-lifecycle-service.js && node --check js/app/menu-controller.js')
  .replace('node --check test/session-lifecycle-service.test.mjs', 'node --check test/session-lifecycle-service.test.mjs && node --check test/menu-controller.test.mjs');
packageJson.scripts.test = packageJson.scripts.test.replace(
  'node test/session-lifecycle-service.test.mjs',
  'node test/session-lifecycle-service.test.mjs && node test/menu-controller.test.mjs',
);
packageJson.scripts['test:all'] = packageJson.scripts['test:all'].replace(
  'node test/session-lifecycle-service.test.mjs',
  'node test/session-lifecycle-service.test.mjs && node test/menu-controller.test.mjs',
);
packageJson.scripts['test:menu-controller'] = 'node test/menu-controller.test.mjs';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

let build = read('scripts/build-standalone.mjs');
build = replaceOnce(
  build,
  "  'js/mobile-experience.js',\n",
  "  'js/mobile-experience.js',\n  'js/app/menu-controller.js',\n",
  'standalone modulrend',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = replaceOnce(sw, 'fociskartyak-2026-v30 ... fociskartyak-2026-v62', 'fociskartyak-2026-v30 ... fociskartyak-2026-v63', 'PWA cache előzmény');
sw = replaceOnce(sw, "const PWA_CACHE = 'fociskartyak-2026-v63';", "const PWA_CACHE = 'fociskartyak-2026-v64';", 'PWA cache verzió');
sw = replaceOnce(
  sw,
  "  './js/mobile-experience.js',\n",
  "  './js/mobile-experience.js',\n  './js/app/menu-controller.js',\n",
  'PWA menüvezérlő bejegyzés',
);
write('sw.js', sw);

console.log('✓ A 18. lépés menüvezérlő-integrációja alkalmazva.');
