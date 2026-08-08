import assert from 'node:assert/strict';

import { createRoundController } from '../js/app/round-controller.js';

const calls = [];
const buttons = [];
const picker = {
  children: [],
  replaceChildren(...children) {
    this.children = children;
    calls.push(['picker', ...children]);
  },
};
const game = {
  chooser: 'human',
  phase: 'reveal',
  attribute: 'goals',
  isOver: false,
  lastResult: {
    attribute: 'goals',
    winner: 'human',
    humanCard: { name: 'Hazai', stats: { goals: 2 } },
    aiCard: { name: 'Vendég', stats: { goals: 1 } },
    potScooped: 0,
  },
  availableAttributeKeys: () => ['goals'],
};
const state = {
  game,
  mode: 'classic',
  busy: false,
  awaitingChooserCard: false,
  pendingAttribute: null,
};

const ui = {
  dom: {
    picker,
    duel: { replaceChildren: () => {} },
    verdict: { replaceChildren: () => {}, className: '' },
  },
  setInteractionBusy: value => calls.push(['interactionBusy', value]),
  closeInspector: () => calls.push(['closeInspector']),
  renderScores: () => calls.push(['scores']),
  renderHands: () => calls.push(['hands']),
  showAttributePicker: () => calls.push(['attributePicker']),
  hideAttributePicker: () => calls.push(['hideAttributePicker']),
  say: value => calls.push(['say', value]),
  setPrompt: (...parts) => calls.push(['prompt', ...parts]),
  showDuel: () => calls.push(['duel']),
  showVerdict: () => calls.push(['verdict']),
  showSuddenDeath: async () => {},
  showToast: (...parts) => calls.push(['toast', ...parts]),
};

const runtime = {
  selectHumanAttribute: () => {},
  chooseAiAttribute: () => ({ attribute: 'goals' }),
  commitHumanChooserCard: () => {},
  playAiCard: () => game.lastResult,
  playHumanCard: () => game.lastResult,
  advance: () => {
    throw new Error('ritka advance hiba');
  },
  clearPendingChoice: () => {},
};
const actions = {
  setBusy(value) {
    state.busy = value;
    calls.push(['busy', value]);
  },
  saveCurrentGame: () => calls.push(['save']),
  showGameOver: () => calls.push(['gameOver']),
};
const elementFactory = (_tag, className, text) => {
  const button = {
    className,
    text,
    type: 'button',
    callback: null,
    setAttribute: () => {},
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
  wait: async () => {},
  elementFactory,
  phaseRegistry: {
    CHOOSE_ATTRIBUTE: 'choose-attribute',
    CHOOSE_CARD: 'choose-card',
    REVEAL: 'reveal',
    GAME_OVER: 'game-over',
  },
  turnDelay: {
    AI_CHOOSE_ATTRIBUTE: 0,
    AI_CHOOSE_CARD: 0,
    HUMAN_CARD_REVEAL: 0,
    VERDICT_REVEAL: 0,
    RESULT_HOLD: 0,
    RESTORED_AI_MOVE: 0,
  },
  attributeRegistry: { goals: { label: 'Gólok' } },
  attributeValueFn: card => card.stats.goals,
  getBanterLine: key => key,
  getIdleLine: () => 'idle',
  humanId: 'human',
  aiId: 'ai',
});

const firstContinue = controller.showContinue();
assert.equal(firstContinue.text, 'Következő kör');
firstContinue.click();

assert.equal(state.busy, false, 'advance kivétel után a busy állapotnak fel kell oldódnia');
assert.ok(calls.some(call => call[0] === 'toast' && /helyreállítottuk/.test(call[1])), 'látható helyreállítási visszajelzés szükséges');
assert.ok(calls.some(call => call[0] === 'save'), 'a helyreállított állapotot menteni kell');
assert.ok(calls.some(call => call[0] === 'duel'), 'a REVEAL nézetet vissza kell építeni');
assert.ok(calls.some(call => call[0] === 'verdict'), 'az eredményt vissza kell rajzolni');
assert.ok(buttons.filter(button => button.text === 'Következő kör').length >= 2, 'új Következő kör gombnak kell megjelennie a hibás egyszeri gomb helyett');
assert.equal(picker.children.length, 1, 'a helyreállítás után egy aktív folytatás gomb maradjon');

console.log('✓ Körátmenet hiba esetén feloldja a busy állapotot és újra felkínálja a folytatást.');
