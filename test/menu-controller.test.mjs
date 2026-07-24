import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  MenuControllerError,
  createMenuController,
} from '../js/app/menu-controller.js';

const readSource = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const state = {
  deck: Array.from({ length: 24 }, (_, index) => ({ id: `p-${index}` })),
  source: 'real',
  meta: { season: '2025/26', selection: { exactBirthDates: 18 } },
  settings: { sounds: true },
  game: null,
  mode: 'classic',
  difficulty: 'medium',
};
const calls = [];
const ui = {
  dom: { overlay: { hidden: true } },
  showOverlay(panel) {
    calls.push(['showOverlay', panel]);
    this.dom.overlay.hidden = false;
  },
  hideOverlay() {
    calls.push(['hideOverlay']);
    this.dom.overlay.hidden = true;
  },
  showToast(message) { calls.push(['toast', message]); },
};
const actions = {
  saveCurrentGame: () => calls.push(['saveCurrentGame']),
  prepareTitleScreen: () => calls.push(['prepareTitleScreen']),
  resumeSavedMatch: () => calls.push(['resumeSavedMatch']),
  start: (mode, difficulty) => calls.push(['start', mode, difficulty]),
  toggleSetting: (key, value) => calls.push(['toggleSetting', key, value]),
  beginMatch: () => calls.push(['beginMatch']),
};
const controller = createMenuController({
  ui,
  getState: () => state,
  actions,
  difficultyRegistry: {
    easy: { label: 'Könnyű' },
    medium: { label: 'Közepes' },
    hard: { label: 'Nehéz' },
  },
  focusFrame: callback => callback(),
});

assert.equal(Object.isFrozen(controller), true);
assert.deepEqual(Object.keys(controller), [
  'showPanel',
  'hidePanel',
  'handleBackAction',
  'showTitleScreen',
  'savedTimeLabel',
  'deckLabel',
  'selectedDifficulty',
  'startFromMenu',
  'confirmReplaceSavedGame',
  'showOnboarding',
  'showRules',
  'showSettings',
  'showPauseMenu',
  'showPenaltyIntro',
]);

let focused = 0;
let returned = 0;
const panel = {
  querySelector(selector) {
    assert.equal(selector, 'button, input, summary');
    return { focus: options => { focused += 1; assert.deepEqual(options, { preventScroll: true }); } };
  },
};
controller.showPanel(panel, () => { returned += 1; });
assert.equal(focused, 1);
assert.equal(ui.dom.overlay.hidden, false);
assert.equal(controller.handleBackAction(), true);
assert.equal(returned, 1);
assert.equal(controller.handleBackAction(), false);
controller.showPanel(panel);
controller.hidePanel();
assert.equal(ui.dom.overlay.hidden, true);

assert.equal(controller.savedTimeLabel('hibás'), 'mentett mérkőzés');
assert.match(controller.savedTimeLabel('2026-07-24T10:30:00.000Z'), /^mentve:/);
assert.equal(controller.deckLabel(), '✓ 24 valós NB I-kártya · 2025/26 · 18 pontos születési dátum');
state.source = 'fallback';
assert.match(controller.deckLabel(), /Fiktív tartalékpakli/);
state.source = 'real';

assert.equal(controller.selectedDifficulty({
  querySelector: () => ({ value: 'hard' }),
}), 'hard');
assert.equal(controller.selectedDifficulty({
  querySelector: () => ({ value: 'ismeretlen' }),
}), 'medium');

assert.throws(
  () => createMenuController(),
  error => error instanceof MenuControllerError && error.code === 'INVALID_UI',
);
assert.throws(
  () => createMenuController({ ui, actions, getState: null }),
  error => error instanceof MenuControllerError && error.code === 'INVALID_STATE_ADAPTER',
);
assert.throws(
  () => createMenuController({ ui, getState: () => state, actions: {} }),
  error => error instanceof MenuControllerError && error.code === 'INVALID_ACTIONS',
);

const controllerSource = readSource('../js/app/menu-controller.js');
const mainSource = readSource('../js/main.js');
const buildSource = readSource('../scripts/build-standalone.mjs');
const serviceWorkerSource = readSource('../sw.js');

assert.match(controllerSource, /A hátsó asztal bajnoksága/);
assert.match(controllerSource, /Játékszabályok/);
assert.match(controllerSource, /Útmutató újraindítása/);
assert.match(controllerSource, /A játék szünetel/);
assert.match(controllerSource, /11 lap\. 5 rendes párbaj\./);
assert.match(mainSource, /\.\/app\/menu-controller\.js/);
assert.match(mainSource, /this\.menu\s*=\s*createMenuController/);
assert.match(mainSource, /this\.menu\.handleBackAction\(\)/);
assert.doesNotMatch(mainSource, /this\.overlayReturn|A hátsó asztal bajnoksága|onboarding-progress|settings-list|pause-actions/);
assert.ok(
  buildSource.indexOf("'js/mobile-experience.js'")
    < buildSource.indexOf("'js/app/menu-controller.js'"),
  'a menüvezérlő a mobil élmény és mentési kompatibilitási réteg után szerepel',
);
assert.ok(
  buildSource.indexOf("'js/app/menu-controller.js'")
    < buildSource.indexOf("'js/main.js'"),
  'a menüvezérlő a Session belépési pont előtt szerepel',
);
assert.match(serviceWorkerSource, /\.\/js\/app\/menu-controller\.js/);

console.log('✓ Menüvezérlő alkalmazási szolgáltatás és Session-integráció: rendben');
