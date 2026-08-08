import assert from 'node:assert/strict';

import { createRoundController } from '../js/app/round-controller.js';
import { AI, HUMAN, PHASE } from '../js/engine.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const elementFactory = (_tag, _className, text = '') => ({
  type: 'button',
  textContent: text,
  dataset: {},
  setAttribute() {},
  addEventListener() {},
});

const createUi = () => {
  const calls = { busy: [], renderHands: 0, renderScores: 0, picker: 0 };
  const picker = { replaceChildren() { calls.picker += 1; } };
  return {
    calls,
    dom: {
      picker,
      duel: { replaceChildren() {} },
      verdict: { replaceChildren() {}, className: '' },
    },
    setInteractionBusy(value) { calls.busy.push(Boolean(value)); },
    closeInspector() {},
    renderScores() { calls.renderScores += 1; },
    renderHands() { calls.renderHands += 1; },
    showAttributePicker() {},
    hideAttributePicker() {},
    say() {},
    setPrompt() {},
    showDuel() {},
    showVerdict() {},
    async showSuddenDeath() {},
    showToast() {},
  };
};

const baseActions = state => ({
  setBusy(value) { state.busy = Boolean(value); },
  saveCurrentGame() { return true; },
  showGameOver() { state.gameOverShown = true; },
});

{
  const gate = deferred();
  const game = {
    chooser: AI,
    phase: PHASE.CHOOSE_ATTRIBUTE,
    availableAttributeKeys: () => ['heightCm'],
    isOver: false,
  };
  const state = { game, mode: 'classic', busy: false, pendingAttribute: null, awaitingChooserCard: false };
  let aiChoices = 0;
  const runtime = {
    selectHumanAttribute() {},
    chooseAiAttribute() { aiChoices += 1; return { attribute: 'heightCm', cardId: 'ai-1' }; },
    commitHumanChooserCard() {},
    playAiCard() {},
    playHumanCard() {},
    advance() { return { reshuffled: false }; },
    clearPendingChoice() {},
  };
  const ui = createUi();
  const controller = createRoundController({
    ui,
    runtime,
    getState: () => state,
    actions: baseActions(state),
    wait: () => gate.promise,
    elementFactory,
    attributeRegistry: { heightCm: { label: 'Magasabb játékos' } },
    attributeValueFn: () => 180,
    getBanterLine: () => null,
    getIdleLine: () => null,
  });

  const pending = controller.aiChoosesAttribute();
  assert.equal(controller.hasActiveOperation(), true);
  assert.equal(state.busy, true);
  controller.cancelPendingOperations();
  assert.equal(state.busy, false);
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(aiChoices, 0, 'A megszakított, régi AI Promise nem hajthat végre késői kategóriaválasztást.');
  assert.equal(controller.hasActiveOperation(), false);
}

{
  const firstWait = deferred();
  let waitIndex = 0;
  const game = {
    chooser: AI,
    phase: PHASE.CHOOSE_CARD,
    attribute: 'heightCm',
    isOver: false,
    lastResult: null,
  };
  const state = { game, mode: 'classic', busy: false, pendingAttribute: null, awaitingChooserCard: false };
  let humanPlays = 0;
  const result = {
    attribute: 'heightCm',
    winner: HUMAN,
    humanCard: { id: 'h1', name: 'H', heightCm: 190 },
    aiCard: { id: 'a1', name: 'A', heightCm: 180 },
    potScooped: 0,
  };
  const runtime = {
    selectHumanAttribute() {},
    chooseAiAttribute() {},
    commitHumanChooserCard() {},
    playAiCard() { return result; },
    playHumanCard() { humanPlays += 1; game.phase = PHASE.REVEAL; game.lastResult = result; return result; },
    advance() { return { reshuffled: false }; },
    clearPendingChoice() {},
  };
  const ui = createUi();
  const controller = createRoundController({
    ui,
    runtime,
    getState: () => state,
    actions: baseActions(state),
    wait: () => {
      waitIndex += 1;
      return waitIndex === 1 ? firstWait.promise : Promise.resolve();
    },
    elementFactory,
    attributeRegistry: { heightCm: { label: 'Magasabb játékos' } },
    attributeValueFn: card => card.heightCm,
    getBanterLine: () => null,
    getIdleLine: () => null,
  });

  const first = controller.humanPlayedCard({ id: 'h1' });
  const second = await controller.humanPlayedCard({ id: 'h1' });
  assert.equal(second, false, 'Gyors dupla koppintás közben a második kártyalerakás blokkolandó.');
  assert.equal(humanPlays, 1, 'Egy kártya csak egyszer kerülhet a motorba.');
  firstWait.resolve();
  assert.equal(await first, true);
  assert.equal(state.busy, false);
  assert.equal(controller.hasActiveOperation(), false);
}

{
  const game = {
    chooser: HUMAN,
    phase: PHASE.CHOOSE_ATTRIBUTE,
    availableAttributeKeys: () => ['heightCm'],
    isOver: false,
  };
  const state = { game, mode: 'classic', busy: true, pendingAttribute: null, awaitingChooserCard: false };
  const ui = createUi();
  const runtime = {
    selectHumanAttribute() {},
    chooseAiAttribute() {},
    commitHumanChooserCard() {},
    playAiCard() {},
    playHumanCard() {},
    advance() { return { reshuffled: false }; },
    clearPendingChoice() {},
  };
  const controller = createRoundController({
    ui,
    runtime,
    getState: () => state,
    actions: baseActions(state),
    wait: () => Promise.resolve(),
    elementFactory,
    attributeRegistry: { heightCm: { label: 'Magasabb játékos' } },
    attributeValueFn: () => 180,
    getBanterLine: () => null,
    getIdleLine: () => null,
  });
  assert.equal(controller.recoverCurrentView(), true);
  assert.equal(state.busy, false, 'Recovery után az interakciós locknak fel kell oldódnia.');
  assert.ok(ui.calls.renderScores > 0);
}

console.log('✓ Round operation liveness: stale Promise, dupla kártya és recovery lock regresszió zöld.');
