import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ResultControllerError,
  createResultController,
} from '../js/app/result-controller.js';

const readSource = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const calls = [];
const buttons = new Map();
const panelFactory = (_tag, className) => {
  const panel = {
    className,
    innerHTML: '',
    querySelector(selector) {
      if (!buttons.has(selector)) {
        buttons.set(selector, {
          addEventListener(_event, callback) { this.callback = callback; },
          click() { this.callback?.(); },
        });
      }
      return buttons.get(selector);
    },
  };
  calls.push(['panel', panel]);
  return panel;
};

const cardA = { id: 'a', name: 'A Játékos', club: 'Paksi FC', stats: { goals: 5, cards: 1 } };
const cardB = { id: 'b', name: 'B Játékos', club: 'DVTK', stats: { goals: 2, cards: 3 } };
const cardC = { id: 'c', name: 'C Játékos', club: 'Újpest FC', stats: { goals: 4, cards: 0 } };
const state = {
  mode: 'classic',
  difficulty: 'd-raven',
  opponent: { name: 'D. Raven', level: 5, overall: 87 },
  game: {
    log: [
      { round: 1, attribute: 'goals', humanCard: cardA, aiCard: cardB, winner: 'human' },
      { round: 2, attribute: 'cards', humanCard: cardB, aiCard: cardC, winner: 'ai' },
      { round: 3, attribute: 'goals', humanCard: cardA, aiCard: cardC, winner: 'human' },
      { round: 4, attribute: 'cards', humanCard: cardB, aiCard: cardB, winner: 'tie' },
    ],
  },
  result: {
    winner: 'human',
    human: 30,
    ai: 22,
    undecided: 2,
  },
};
const ui = {
  setInteractionBusy: value => calls.push(['interactionBusy', value]),
  say: line => calls.push(['say', line]),
};
const actions = {
  setBusy: value => calls.push(['busy', value]),
  start: (mode, difficulty) => calls.push(['start', mode, difficulty]),
  showTitleScreen: options => calls.push(['title', options]),
  showPanel: (panel, returnAction) => calls.push(['showPanel', panel, returnAction]),
};
let cleared = 0;
const controller = createResultController({
  ui,
  getState: () => state,
  actions,
  clearSaved: () => { cleared += 1; },
  elementFactory: panelFactory,
  getBanterLine: key => `banter:${key}`,
  attributeRegistry: {
    goals: { icon: '⚽', label: 'Gólok' },
    cards: { icon: '🟨', label: 'Sárga lapok' },
  },
  attributeValueFn: (card, key) => card.stats[key],
  humanId: 'human',
  aiId: 'ai',
});

assert.equal(Object.isFrozen(controller), true);
assert.deepEqual(Object.keys(controller), ['bestCategoryLabel', 'showGameOver']);
assert.equal(controller.bestCategoryLabel({ bestCategories: [] }), 'Nem volt megnyert kategória');
assert.equal(controller.bestCategoryLabel({ bestCategories: ['goals', 'cards'] }), '⚽ Gólok, 🟨 Sárga lapok');

const classicPanel = controller.showGameOver();
assert.equal(cleared, 1);
assert.match(classicPanel.className, /result-panel--win/);
assert.match(classicPanel.innerHTML, /GYŐZELEM/);
assert.match(classicPanel.innerHTML, /JÁTÉKOS 30–22 GÉP/);
assert.match(classicPanel.innerHTML, /Lejátszott körök<\/dt><dd>4/);
assert.match(classicPanel.innerHTML, /Megnyert párbajok<\/dt><dd>2/);
assert.match(classicPanel.innerHTML, /A gép nyert párbajai<\/dt><dd>1/);
assert.match(classicPanel.innerHTML, /Döntetlen párbajok<\/dt><dd>1/);
assert.match(classicPanel.innerHTML, /⚽ Gólok · 2 győzelem/);
assert.match(classicPanel.innerHTML, /D\. Raven · 5\. szint · OVR 87/);
assert.match(classicPanel.innerHTML, /A mérkőzés játékosa/);
assert.match(classicPanel.innerHTML, /A Játékos/);
assert.match(classicPanel.innerHTML, /Paksi FC · 2 megnyert párbaj/);
assert.match(classicPanel.innerHTML, /2 lap a döntetlenpakliban maradt/);
assert.deepEqual(calls.find(call => call[0] === 'say'), ['say', 'banter:gameOverWin']);
buttons.get('#rematch-btn').click();
assert.deepEqual(calls.at(-1), ['start', 'classic', 'd-raven']);
buttons.get('#menu-btn').click();
assert.deepEqual(calls.at(-1), ['title', { offerOnboarding: false }]);

buttons.clear();
state.mode = 'penalties';
state.difficulty = 'hard';
state.result = {
  winner: 'ai',
  human: 4,
  ai: 5,
  duels: 10,
  stage: 'hirtelen halál',
  bestCategories: ['goals'],
  bestCategoryWins: 3,
};
const penaltyPanel = controller.showGameOver();
assert.equal(cleared, 2);
assert.match(penaltyPanel.className, /result-panel--loss/);
assert.match(penaltyPanel.innerHTML, /Hirtelen halál/);
assert.match(penaltyPanel.innerHTML, /VERESÉG/);
assert.match(penaltyPanel.innerHTML, /Felhasznált párbajok/);
assert.match(penaltyPanel.innerHTML, /⚽ Gólok \(3 gól\)/);
buttons.get('#rematch-btn').click();
assert.deepEqual(calls.at(-1), ['start', 'penalties', 'hard']);

assert.throws(
  () => createResultController(),
  error => error instanceof ResultControllerError && error.code === 'INVALID_UI',
);
assert.throws(
  () => createResultController({ ui, actions, getState: null }),
  error => error instanceof ResultControllerError && error.code === 'INVALID_STATE_ADAPTER',
);
assert.throws(
  () => createResultController({ ui, getState: () => state, actions: {} }),
  error => error instanceof ResultControllerError && error.code === 'INVALID_ACTIONS',
);
assert.throws(
  () => createResultController({ ui, getState: () => state, actions, clearSaved: null }),
  error => error instanceof ResultControllerError && error.code === 'INVALID_PERSISTENCE_ADAPTER',
);
assert.throws(
  () => createResultController({
    ui,
    getState: () => ({ mode: 'classic', difficulty: 'medium', result: null }),
    actions,
    clearSaved() {},
    elementFactory: panelFactory,
  }).showGameOver(),
  error => error instanceof ResultControllerError && error.code === 'INVALID_RESULT',
);

const controllerSource = readSource('../js/app/result-controller.js');
const mainSource = readSource('../js/main.js');
const buildSource = readSource('../scripts/build-standalone.mjs');
const serviceWorkerSource = readSource('../sw.js');

assert.match(controllerSource, /summariseClassicMatch/);
assert.match(controllerSource, /Legsikeresebb kategória/);
assert.match(controllerSource, /A mérkőzés játékosa/);
assert.match(controllerSource, /Visszavágó/);
assert.match(controllerSource, /Vissza a főmenübe/);
assert.doesNotMatch(controllerSource, /mobile-experience\.js/);
assert.match(mainSource, /\.\/app\/result-controller\.js/);
assert.match(mainSource, /this\.results\s*=\s*createResultController/);
assert.match(mainSource, /game:\s*this\.game/);
assert.match(mainSource, /opponent:\s*getActiveOpponent\(\)/);
assert.match(mainSource, /return this\.results\.showGameOver\(\)/);
assert.doesNotMatch(mainSource, /result-kicker|result-stats|rematch-btn|Nem volt megnyert kategória/);
assert.ok(
  buildSource.indexOf("'js/domain/match-summary.js'")
    < buildSource.indexOf("'js/app/result-controller.js'"),
  'az összesítő domainlogika az eredményvezérlő előtt szerepel',
);
assert.ok(
  buildSource.indexOf("'js/app/result-controller.js'")
    < buildSource.indexOf("'js/main.js'"),
  'az eredményvezérlő a Session belépési pont előtt szerepel',
);
assert.match(serviceWorkerSource, /\.\/js\/app\/result-controller\.js/);
assert.match(serviceWorkerSource, /\.\/js\/domain\/match-summary\.js/);
assert.match(serviceWorkerSource, /const PWA_CACHE = 'fociskartyak-2026-v\d+';/);

console.log('✓ Részletes Klasszikus végeredmény és Büntetőpárbaj-regresszió: rendben');
