import assert from 'node:assert/strict';

import { createRoundController, RoundControllerError } from '../js/app/round-controller.js';

const calls = [];
const dom = {
  duel: { replaceChildren: (...args) => calls.push(['duelClear', ...args]) },
  verdict: { replaceChildren: (...args) => calls.push(['verdictClear', ...args]), className: '' },
  picker: { replaceChildren: (...args) => calls.push(['pickerReplace', ...args]) },
};
const ui = {
  dom,
  setInteractionBusy: value => calls.push(['uiBusy', value]),
  closeInspector: () => calls.push(['closeInspector']),
  renderScores: () => calls.push(['renderScores']),
  renderHands: (_game, options) => calls.push(['renderHands', options]),
  showAttributePicker: () => calls.push(['pickerShow']),
  hideAttributePicker: () => calls.push(['pickerHide']),
  say: line => calls.push(['say', line]),
  setPrompt: (...args) => calls.push(['prompt', ...args]),
  showDuel: (_game, options) => calls.push(['duel', options]),
  showVerdict: () => calls.push(['verdict']),
  showSuddenDeath: async () => calls.push(['suddenDeath']),
  showToast: (...args) => calls.push(['toast', ...args]),
};
const game = {
  chooser: 'human',
  phase: 'choose_attribute',
  attribute: null,
  lastResult: null,
  isOver: false,
  availableAttributeKeys: () => ['goals'],
};
const runtime = {
  selectHumanAttribute: attribute => {
    calls.push(['selectHumanAttribute', attribute]);
    game.attribute = attribute;
  },
  chooseAiAttribute: () => ({ attribute: 'goals', cardId: 'ai-1' }),
  commitHumanChooserCard: id => calls.push(['commitHumanChooserCard', id]),
  playAiCard: () => ({ winner: 'human', attribute: 'goals', humanCard: { name: 'A', stats: { goals: 2 } }, aiCard: { name: 'B', stats: { goals: 1 } }, potScooped: 0 }),
  playHumanCard: id => {
    calls.push(['playHumanCard', id]);
    return { winner: 'human', attribute: 'goals', humanCard: { name: 'A', stats: { goals: 2 } }, aiCard: { name: 'B', stats: { goals: 1 } }, potScooped: 0 };
  },
  advance: () => ({ reshuffled: false }),
  clearPendingChoice: () => calls.push(['clearPendingChoice']),
};
const state = {
  game,
  mode: 'classic',
  busy: false,
  pendingAttribute: null,
  awaitingChooserCard: false,
};
const actions = {
  setBusy: value => {
    state.busy = value;
    calls.push(['busy', value]);
  },
  saveCurrentGame: () => calls.push(['save']),
  showGameOver: () => calls.push(['gameOver']),
};
const elementFactory = (_tag, className, text) => ({
  className,
  textContent: text,
  type: '',
  handlers: {},
  setAttribute() {},
  addEventListener(type, handler) { this.handlers[type] = handler; },
});
const phaseRegistry = {
  CHOOSE_ATTRIBUTE: 'choose_attribute',
  CHOOSE_CARD: 'choose_card',
  REVEAL: 'reveal',
  GAME_OVER: 'game_over',
};
const turnDelay = {
  AI_CHOOSE_ATTRIBUTE: 1,
  AI_CHOOSE_CARD: 1,
  HUMAN_CARD_REVEAL: 1,
  VERDICT_REVEAL: 1,
  RESULT_HOLD: 1,
  RESTORED_AI_MOVE: 1,
};
const controller = createRoundController({
  ui,
  runtime,
  getState: () => state,
  actions,
  wait: async delay => calls.push(['wait', delay]),
  elementFactory,
  phaseRegistry,
  turnDelay,
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
  'recoverCurrentView',
  'cancelPendingOperations',
  'hasActiveOperation',
  'activeOperationKind',
]);
assert.equal(controller.hasActiveOperation(), false);
assert.equal(controller.activeOperationKind(), null);

assert.equal(controller.beginRound(), true);
assert.ok(calls.some(call => call[0] === 'pickerShow'));
assert.ok(calls.some(call => call[0] === 'save'));
assert.equal(controller.humanChoseAttribute('goals'), true);
assert.ok(calls.some(call => call[0] === 'selectHumanAttribute' && call[1] === 'goals'));
assert.ok(calls.some(call => call[0] === 'pickerHide'));

assert.throws(() => createRoundController({
  ui: {}, runtime, getState: () => state, actions, wait: async () => {},
}), error => error instanceof RoundControllerError && error.code === 'INVALID_UI');
assert.throws(() => createRoundController({
  ui, runtime: {}, getState: () => state, actions, wait: async () => {},
}), error => error instanceof RoundControllerError && error.code === 'INVALID_RUNTIME');
assert.throws(() => createRoundController({
  ui, runtime, getState: null, actions, wait: async () => {},
}), error => error instanceof RoundControllerError && error.code === 'INVALID_STATE_ADAPTER');

console.log('✓ Körvezérlő alkalmazási szolgáltatás, operation-token recovery és restore adapter: rendben');
