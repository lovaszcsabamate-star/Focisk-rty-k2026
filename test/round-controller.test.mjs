import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  RoundControllerError,
  createRoundController,
} from '../js/app/round-controller.js';

const readSource = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const calls = [];
const slot = name => ({
  className: 'old',
  replaceChildren: (...children) => calls.push([name, ...children]),
});
const ui = {
  dom: { duel: slot('duel'), verdict: slot('verdict'), picker: slot('picker') },
  setInteractionBusy: value => calls.push(['interactionBusy', value]),
  closeInspector: () => calls.push(['closeInspector']),
  renderScores: game => calls.push(['scores', game]),
  renderHands: (game, options) => calls.push(['hands', game, options]),
  showAttributePicker: game => calls.push(['pickerShow', game]),
  hideAttributePicker: () => calls.push(['pickerHide']),
  say: line => calls.push(['say', line]),
  setPrompt: (...parts) => calls.push(['prompt', ...parts]),
  showDuel: (game, options) => calls.push(['showDuel', game, options]),
  showVerdict: (result, game) => calls.push(['verdictShow', result, game]),
  showSuddenDeath: async () => calls.push(['suddenDeath']),
  showToast: (...args) => calls.push(['toast', ...args]),
};

const game = {
  chooser: 'human',
  phase: 'choose_attribute',
  attribute: 'goals',
  isOver: false,
  lastResult: null,
  availableAttributeKeys: () => ['goals'],
};
const state = {
  game,
  mode: 'classic',
  busy: false,
  pendingAttribute: null,
  awaitingChooserCard: false,
};
const runtime = {
  selectHumanAttribute: key => calls.push(['selectAttribute', key]),
  chooseAiAttribute: () => ({ attribute: 'goals' }),
  commitHumanChooserCard: id => calls.push(['commitChooserCard', id]),
  playAiCard: () => ({
    attribute: 'goals', winner: 'ai', humanCard: { name: 'A', stats: { goals: 1 } },
    aiCard: { name: 'B', stats: { goals: 2 } }, potScooped: 0,
  }),
  playHumanCard: id => ({
    id, attribute: 'goals', winner: 'human', humanCard: { name: 'A', stats: { goals: 4 } },
    aiCard: { name: 'B', stats: { goals: 1 } }, potScooped: 0,
  }),
  advance: () => ({ reshuffled: false }),
  clearPendingChoice: () => calls.push(['clearPendingChoice']),
};
const actions = {
  setBusy(value) { state.busy = value; calls.push(['busy', value]); },
  saveCurrentGame: () => calls.push(['save']),
  showGameOver: () => calls.push(['gameOver']),
};
const buttons = [];
const elementFactory = (_tag, className, text) => {
  const button = {
    className,
    text,
    setAttribute: (name, value) => calls.push(['attribute', name, value]),
    addEventListener(_event, callback) { this.callback = callback; },
    click() { this.callback?.(); },
  };
  buttons.push(button);
  return button;
};
const controller = createRoundController({
  ui,
  runtime,
  getState: () => state,
  actions,
  wait: async delay => calls.push(['wait', delay]),
  elementFactory,
  phaseRegistry: {
    CHOOSE_ATTRIBUTE: 'choose_attribute',
    CHOOSE_CARD: 'choose_card',
    REVEAL: 'reveal',
    GAME_OVER: 'game_over',
  },
  turnDelay: { AI_CHOOSE_ATTRIBUTE: 10, AI_CHOOSE_CARD: 20 },
  attributeRegistry: { goals: { label: 'Gólok' } },
  attributeValueFn: card => card.stats.goals,
  getBanterLine: key => `banter:${key}`,
  getIdleLine: () => 'idle',
  humanId: 'human',
  aiId: 'ai',
});

assert.equal(Object.isFrozen(controller), true);
assert.deepEqual(Object.keys(controller), [
  'beginRound',
  'humanChoseAttribute',
  'aiChoosesAttribute',
  'humanPlayedCard',
  'revealAndScore',
  'sayResultBanter',
  'showContinue',
  'restoreSavedView',
  'finishRestoredAiMove',
]);

assert.equal(controller.beginRound(), true);
assert.ok(calls.some(call => call[0] === 'pickerShow'));
assert.ok(calls.some(call => call[0] === 'save'));
assert.equal(controller.humanChoseAttribute('goals'), true);
assert.ok(calls.some(call => call[0] === 'selectAttribute' && call[1] === 'goals'));
assert.ok(calls.some(call => call[0] === 'prompt' && call[2] === 'Gólok'));

state.game.chooser = 'ai';
await controller.aiChoosesAttribute();
assert.ok(calls.some(call => call[0] === 'wait' && call[1] === 10));
assert.ok(calls.some(call => call[0] === 'say' && call[1] === 'banter:aiChooseAttribute'));

state.game.chooser = 'human';
state.busy = false;
await controller.humanPlayedCard({ id: 'card-1' });
assert.ok(calls.some(call => call[0] === 'verdictShow'));
assert.ok(calls.some(call => call[0] === 'say' && call[1] === 'banter:attributeWin'));
assert.ok(buttons.some(button => button.text === 'Következő kör'));

state.busy = false;
const continueButton = controller.showContinue();
continueButton.click();
assert.ok(calls.some(call => call[0] === 'say' && call[1] === 'idle'));

state.game.phase = 'choose_card';
state.game.chooser = 'ai';
state.game.attribute = 'goals';
assert.equal(controller.restoreSavedView(), true);
assert.ok(calls.some(call => call[0] === 'clearPendingChoice'));

state.game.phase = 'game_over';
controller.restoreSavedView();
assert.ok(calls.some(call => call[0] === 'gameOver'));

assert.throws(
  () => createRoundController(),
  error => error instanceof RoundControllerError && error.code === 'INVALID_UI',
);
assert.throws(
  () => createRoundController({ ui, runtime, getState: null, actions, wait: async () => {} }),
  error => error instanceof RoundControllerError && error.code === 'INVALID_STATE_ADAPTER',
);
assert.throws(
  () => createRoundController({ ui, runtime, getState: () => state, actions: {}, wait: async () => {} }),
  error => error instanceof RoundControllerError && error.code === 'INVALID_ACTIONS',
);
assert.throws(
  () => createRoundController({ ui, runtime, getState: () => state, actions, wait: null }),
  error => error instanceof RoundControllerError && error.code === 'INVALID_TIMING_ADAPTER',
);

const controllerSource = readSource('../js/app/round-controller.js');
const mainSource = readSource('../js/main.js');
const buildSource = readSource('../scripts/build-standalone.mjs');
const serviceWorkerSource = readSource('../sw.js');

assert.match(controllerSource, /A gép választ/);
assert.match(controllerSource, /Következő párbaj/);
assert.match(controllerSource, /A gép befejezi a félbemaradt kört/);
assert.doesNotMatch(controllerSource, /mobile-experience\.js/);
assert.match(mainSource, /\.\/app\/round-controller\.js/);
assert.match(mainSource, /this\.rounds\s*=\s*createRoundController/);
assert.match(mainSource, /return this\.rounds\.beginRound\(\)/);
assert.match(mainSource, /return this\.rounds\.restoreSavedView\(\)/);
assert.doesNotMatch(mainSource, /A gép választ…|Következő párbaj|potScooped|finishRestoredAiMove\(\) \{\s*this\.busy/s);
assert.ok(
  buildSource.indexOf("'js/app/result-controller.js'")
    < buildSource.indexOf("'js/app/round-controller.js'"),
  'a körvezérlő az eredményvezérlő után szerepel',
);
assert.ok(
  buildSource.indexOf("'js/app/round-controller.js'")
    < buildSource.indexOf("'js/main.js'"),
  'a körvezérlő a Session előtt szerepel',
);
assert.match(serviceWorkerSource, /\.\/js\/app\/round-controller\.js/);
assert.match(serviceWorkerSource, /const PWA_CACHE = 'fociskartyak-2026-v\d+';/);

console.log('✓ Körvezérlő alkalmazási szolgáltatás és Session-integráció: rendben');
