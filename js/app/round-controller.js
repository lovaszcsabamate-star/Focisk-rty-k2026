/** A körök, lapválasztás és mentett körnézet központi alkalmazási vezérlője. */

import { AI, HUMAN, PHASE } from '../engine.js';
import { TURN_DELAY } from '../services/turn-timing-service.js';
import { ATTRIBUTE_BY_KEY, attributeValue } from '../data/players.js';
import { getIdleChatter, getLine } from '../banter.js';
import { el } from '../ui.js';

export class RoundControllerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoundControllerError';
    this.code = code;
  }
}

const roundControllerRequiredActions = Object.freeze([
  'setBusy',
  'saveCurrentGame',
  'showGameOver',
]);

const roundControllerAssertMethod = (target, method, code) => {
  if (typeof target?.[method] !== 'function') {
    throw new RoundControllerError(code, `A körvezérlőből hiányzik a(z) ${method} művelet.`);
  }
};

export function createRoundController({
  ui,
  runtime,
  getState,
  actions,
  wait,
  elementFactory = el,
  phaseRegistry = PHASE,
  turnDelay = TURN_DELAY,
  attributeRegistry = ATTRIBUTE_BY_KEY,
  attributeValueFn = attributeValue,
  getBanterLine = getLine,
  getIdleLine = getIdleChatter,
  humanId = HUMAN,
  aiId = AI,
} = {}) {
  for (const method of [
    'setInteractionBusy', 'closeInspector', 'renderScores', 'renderHands',
    'showAttributePicker', 'hideAttributePicker', 'say', 'setPrompt',
    'showDuel', 'showVerdict', 'showSuddenDeath', 'showToast',
  ]) roundControllerAssertMethod(ui, method, 'INVALID_UI');
  for (const method of [
    'selectHumanAttribute', 'chooseAiAttribute', 'commitHumanChooserCard',
    'playAiCard', 'playHumanCard', 'advance', 'clearPendingChoice',
  ]) roundControllerAssertMethod(runtime, method, 'INVALID_RUNTIME');
  if (typeof getState !== 'function') {
    throw new RoundControllerError('INVALID_STATE_ADAPTER', 'A körvezérlő állapotadaptere kötelező.');
  }
  roundControllerRequiredActions.forEach(method => roundControllerAssertMethod(actions, method, 'INVALID_ACTIONS'));
  if (typeof wait !== 'function') {
    throw new RoundControllerError('INVALID_TIMING_ADAPTER', 'A körvezérlő időzítési adaptere kötelező.');
  }
  if (typeof elementFactory !== 'function') {
    throw new RoundControllerError('INVALID_ELEMENT_FACTORY', 'A körvezérlő elemgyártó függvénye kötelező.');
  }

  const state = () => getState() ?? {};
  const setBusy = value => {
    actions.setBusy(value);
    ui.setInteractionBusy(value);
  };

  const beginRound = () => {
    const current = state();
    const game = current.game;
    if (!game) return false;
    setBusy(false);
    ui.closeInspector();
    ui.renderScores(game);
    ui.dom?.duel?.replaceChildren?.();
    ui.dom?.verdict?.replaceChildren?.();
    if (ui.dom?.verdict) ui.dom.verdict.className = '';

    if (game.chooser === humanId) {
      ui.renderHands(game, { selectable: false });
      ui.showAttributePicker(game);
      actions.saveCurrentGame();
    } else {
      void aiChoosesAttribute();
    }
    return true;
  };

  const humanChoseAttribute = attributeKey => {
    const current = state();
    const game = current.game;
    const humanChoiceWindow = game?.phase === phaseRegistry.CHOOSE_ATTRIBUTE
      && game?.chooser === humanId;
    if (!humanChoiceWindow || !game.availableAttributeKeys?.().includes(attributeKey)) return false;

    /* A kategóriagomb csak az emberi választási ablakban látható. Egy korábbi
       animációból vagy overlayből visszamaradt busy jelző ezért nem tilthatja le
       a valódi választást: az állapotot itt a domainfázis alapján helyreállítjuk. */
    if (current.busy) setBusy(false);

    runtime.selectHumanAttribute(attributeKey);
    ui.hideAttributePicker();
    ui.say(getBanterLine('youChooseAttribute', { attributeKey }));
    ui.setPrompt('Te következel – válassz kártyát:', attributeRegistry[attributeKey]?.label);
    ui.renderHands(game, { selectable: true, inspectAttribute: attributeKey });
    actions.saveCurrentGame();
    return true;
  };

  const aiChoosesAttribute = async () => {
    const game = state().game;
    if (!game) return false;
    setBusy(true);
    ui.renderHands(game, { selectable: false });
    ui.setPrompt('A gép választ…');
    await wait(turnDelay.AI_CHOOSE_ATTRIBUTE);
    if (state().game !== game) return false;

    const choice = runtime.chooseAiAttribute();
    const label = attributeRegistry[choice.attribute]?.label;
    ui.say(getBanterLine('aiChooseAttribute', { attr: label, attributeKey: choice.attribute }));
    ui.setPrompt('A gép ezt választotta:', label);
    ui.showDuel(game, { opponentHidden: true });
    ui.renderHands(game, { selectable: true });
    setBusy(false);
    actions.saveCurrentGame();
    return true;
  };

  const sayResultBanter = result => {
    const attribute = attributeRegistry[result.attribute];
    if (!attribute) return;
    const context = { card: result.humanCard.name, stat: attribute.label, attributeKey: result.attribute };
    if (result.winner === 'tie') {
      ui.say(getBanterLine('tie', context));
      return;
    }

    const mine = attributeValueFn(result.humanCard, result.attribute);
    const theirs = attributeValueFn(result.aiCard, result.attribute);
    const spread = Math.abs(mine - theirs) / Math.max(Math.abs(mine), Math.abs(theirs), 1);
    if (result.winner === humanId) {
      ui.say(getBanterLine('attributeWin', context));
      ui.say(getBanterLine(spread > 0.55 ? 'youWinBig' : 'youWin', context));
    } else {
      ui.say(getBanterLine(spread < 0.06 ? 'youLoseClose' : 'youLose', context));
    }
    if (result.potScooped > 0) ui.say(getBanterLine('potScooped', context));
  };

  const showContinue = () => {
    const current = state();
    const label = current.mode === 'penalties' ? 'Következő párbaj' : 'Következő kör';
    const button = elementFactory('button', 'btn next-round-button', label);
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => {
      if (state().busy) return;
      setBusy(true);
      ui.dom?.picker?.replaceChildren?.();
      const { reshuffled } = runtime.advance();
      const afterAdvance = state();
      if (afterAdvance.mode === 'penalties') {
        if (reshuffled) ui.say(getBanterLine('reshuffle'));
      } else {
        ui.say(getIdleLine());
      }
      setBusy(false);
      if (afterAdvance.game?.isOver) actions.showGameOver();
      else beginRound();
    }, { once: true });
    ui.dom?.picker?.replaceChildren?.(button);
    actions.saveCurrentGame();
    return button;
  };

  const revealAndScore = async result => {
    const game = state().game;
    if (!game) return false;
    ui.showDuel(game, { result });
    ui.setPrompt('Eredmény');
    await wait(320);
    ui.showVerdict(result, game);
    ui.renderScores(game);
    sayResultBanter(result);
    actions.saveCurrentGame();

    if (result.enteredSuddenDeath) {
      ui.say(getBanterLine('suddenDeath'));
      await ui.showSuddenDeath();
    } else {
      await wait(650);
    }

    if (state().game?.isOver) {
      actions.showGameOver();
      return true;
    }
    setBusy(false);
    showContinue();
    return true;
  };

  const humanPlayedCard = async card => {
    const current = state();
    const game = current.game;
    if (current.busy || !game || game.phase === phaseRegistry.GAME_OVER) return false;
    setBusy(true);
    let result;

    try {
      if (current.awaitingChooserCard) {
        runtime.commitHumanChooserCard(card.id);
        ui.showDuel(game, { opponentHidden: true });
        ui.renderHands(game, { selectable: false });
        ui.setPrompt('A gép kártyát választ…');
        await wait(turnDelay.AI_CHOOSE_CARD);
        result = runtime.playAiCard();
      } else {
        result = runtime.playHumanCard(card.id);
        ui.renderHands(game, { selectable: false });
        await wait(250);
      }
      await revealAndScore(result);
      return true;
    } catch (error) {
      console.error('[round] A kör nem fejezhető be:', error);
      setBusy(false);
      ui.showToast('A kört nem sikerült lezárni. Próbáld újra.', 'error');
      actions.saveCurrentGame();
      return false;
    }
  };

  const finishRestoredAiMove = async () => {
    setBusy(true);
    await wait(350);
    const result = runtime.playAiCard();
    return revealAndScore(result);
  };

  const restoreSavedView = () => {
    const current = state();
    const game = current.game;
    if (!game) return false;
    ui.renderScores(game);

    if (game.phase === phaseRegistry.CHOOSE_ATTRIBUTE) {
      if (current.awaitingChooserCard && current.pendingAttribute && game.chooser === humanId) {
        ui.setPrompt('Te következel – válassz kártyát:', attributeRegistry[current.pendingAttribute]?.label);
        ui.renderHands(game, { selectable: true, inspectAttribute: current.pendingAttribute });
      } else {
        beginRound();
      }
      return true;
    }

    if (game.phase === phaseRegistry.CHOOSE_CARD) {
      ui.showDuel(game, { opponentHidden: true });
      if (game.chooser === aiId) {
        ui.setPrompt('A gép ezt választotta:', attributeRegistry[game.attribute]?.label);
        ui.renderHands(game, { selectable: true });
        runtime.clearPendingChoice();
      } else {
        ui.renderHands(game, { selectable: false });
        ui.setPrompt('A gép befejezi a félbemaradt kört…');
        void finishRestoredAiMove();
      }
      return true;
    }

    if (game.phase === phaseRegistry.REVEAL && game.lastResult) {
      ui.renderHands(game, { selectable: false });
      ui.showDuel(game, { result: game.lastResult });
      ui.showVerdict(game.lastResult, game);
      showContinue();
      return true;
    }

    if (game.phase === phaseRegistry.GAME_OVER) actions.showGameOver();
    return true;
  };

  return Object.freeze({
    beginRound,
    humanChoseAttribute,
    aiChoosesAttribute,
    humanPlayedCard,
    revealAndScore,
    sayResultBanter,
    showContinue,
    restoreSavedView,
    finishRestoredAiMove,
  });
}
