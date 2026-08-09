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

  // A token nem időalapú watchdog. Egy token pontosan egy aszinkron körtranzakció
  // tulajdonjoga, ezért egy régi Promise nem oldhatja fel egy újabb művelet lockját,
  // és nem hajthat végre késői AI-akciót új játékállapoton.
  let operationSerial = 0;
  let activeOperation = null;
  const beginOperation = kind => {
    const token = ++operationSerial;
    activeOperation = Object.freeze({ token, kind: String(kind || 'round') });
    setBusy(true);
    return token;
  };
  const ownsOperation = token => activeOperation?.token === token;
  const releaseOperation = token => {
    if (!ownsOperation(token)) return false;
    activeOperation = null;
    setBusy(false);
    return true;
  };
  const cancelPendingOperations = () => {
    operationSerial += 1;
    activeOperation = null;
    setBusy(false);
    return true;
  };
  const operationStillCurrent = (token, game) => ownsOperation(token) && state().game === game;
  const abandonStaleOperation = (token, game) => {
    if (operationStillCurrent(token, game)) return false;
    if (ownsOperation(token)) releaseOperation(token);
    return true;
  };

  const showRetryAction = ({ message, action, label = 'Gépi kör újrapróbálása', token = null }) => {
    if (token != null) releaseOperation(token);
    else cancelPendingOperations();
    ui.showToast(message, 'error', 3400);
    const button = elementFactory('button', 'btn round-retry-button', label);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => {
      if (state().busy || activeOperation) return;
      ui.dom?.picker?.replaceChildren?.();
      void action();
    }, { once: true });
    ui.dom?.picker?.replaceChildren?.(button);
    actions.saveCurrentGame();
    return false;
  };

  const beginRound = () => {
    const current = state();
    const game = current.game;
    if (!game) return false;
    cancelPendingOperations();
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
    const validHumanCategoryPhase = Boolean(
      game
      && game.chooser === humanId
      && game.phase === phaseRegistry.CHOOSE_ATTRIBUTE
      && game.availableAttributeKeys?.().includes(attributeKey),
    );
    if (!validHumanCategoryPhase) return false;

    /* A kategóriaválasztó kizárólag az ember CHOOSE_ATTRIBUTE fázisában látható.
       Ha itt mégis foglalt maradt a munkamenet, az egy korábbi UI-átmenet
       beragadt jelzője, nem valódi párhuzamos kör. Helyreállítjuk, hogy a Tovább
       gomb megbízhatóan átváltson a kártyaválasztásra. */
    if (current.busy || activeOperation) cancelPendingOperations();

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
    if (!game || activeOperation) return false;
    const token = beginOperation('ai-choose-attribute');

    try {
      ui.renderHands(game, { selectable: false });
      ui.setPrompt('A gép választ…');
      await wait(turnDelay.AI_CHOOSE_ATTRIBUTE);
      if (abandonStaleOperation(token, game)) return false;

      const choice = runtime.chooseAiAttribute();
      if (abandonStaleOperation(token, game)) return false;
      const label = attributeRegistry[choice.attribute]?.label;
      ui.say(getBanterLine('aiChooseAttribute', { attr: label, attributeKey: choice.attribute }));
      ui.setPrompt('A gép ezt választotta:', label);
      ui.showDuel(game, { opponentHidden: true });
      ui.renderHands(game, { selectable: true });
      releaseOperation(token);
      actions.saveCurrentGame();
      return true;
    } catch (error) {
      console.error('[round] A gép kategóriaválasztása megszakadt:', error);
      if (abandonStaleOperation(token, game)) return false;

      if (game.phase === phaseRegistry.CHOOSE_ATTRIBUTE && game.chooser === aiId) {
        return showRetryAction({
          message: 'A gép nem tudott kategóriát választani. Próbáld újra.',
          action: aiChoosesAttribute,
          token,
        });
      }

      releaseOperation(token);
      ui.showToast('A gépi kör megakadt, ezért a játéknézetet helyreállítottuk.', 'error', 3400);
      actions.saveCurrentGame();
      restoreSavedView();
      return false;
    }
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
      if (state().busy || activeOperation) return;
      const token = beginOperation('advance-round');
      ui.dom?.picker?.replaceChildren?.();
      try {
        const { reshuffled } = runtime.advance();
        if (abandonStaleOperation(token, state().game)) return;
        const afterAdvance = state();
        if (afterAdvance.mode === 'penalties') {
          if (reshuffled) ui.say(getBanterLine('reshuffle'));
        } else {
          ui.say(getIdleLine());
        }
        releaseOperation(token);
        if (afterAdvance.game?.isOver) actions.showGameOver();
        else beginRound();
      } catch (error) {
        console.error('[round] A következő kör indítása megszakadt:', error);
        releaseOperation(token);
        ui.showToast('A következő kör indítása megakadt. A játéknézetet helyreállítottuk.', 'error', 3600);
        actions.saveCurrentGame();
        restoreSavedView();
      }
    }, { once: true });
    ui.dom?.picker?.replaceChildren?.(button);
    actions.saveCurrentGame();
    return button;
  };

  const revealAndScore = async (result, existingToken = null) => {
    const game = state().game;
    if (!game) return false;
    const token = existingToken ?? beginOperation('reveal-result');
    if (!ownsOperation(token)) return false;

    try {
      ui.showDuel(game, { result });
      ui.setPrompt('Eredmény');
      await wait(turnDelay.VERDICT_REVEAL);
      if (abandonStaleOperation(token, game)) return false;
      ui.showVerdict(result, game);
      ui.renderScores(game);
      sayResultBanter(result);
      actions.saveCurrentGame();

      if (result.enteredSuddenDeath) {
        ui.say(getBanterLine('suddenDeath'));
        await ui.showSuddenDeath();
      } else {
        await wait(turnDelay.RESULT_HOLD);
      }
      if (abandonStaleOperation(token, game)) return false;

      if (state().game?.isOver) {
        releaseOperation(token);
        actions.showGameOver();
        return true;
      }
      releaseOperation(token);
      showContinue();
      return true;
    } catch (error) {
      console.error('[round] Az eredmény megjelenítése megszakadt:', error);
      if (abandonStaleOperation(token, game)) return false;
      releaseOperation(token);
      ui.showToast('Az eredménynézet megszakadt. A játéknézetet helyreállítottuk.', 'error', 3400);
      actions.saveCurrentGame();
      restoreSavedView();
      return false;
    }
  };

  const humanPlayedCard = async card => {
    const current = state();
    const game = current.game;
    if (current.busy || activeOperation || !game || game.phase === phaseRegistry.GAME_OVER) return false;
    const token = beginOperation('human-card');
    let result;

    try {
      if (current.awaitingChooserCard) {
        runtime.commitHumanChooserCard(card.id);
        ui.showDuel(game, { opponentHidden: true });
        ui.renderHands(game, { selectable: false });
        ui.setPrompt('A gép kártyát választ…');
        await wait(turnDelay.AI_CHOOSE_CARD);
        if (abandonStaleOperation(token, game)) return false;
        result = runtime.playAiCard();
      } else {
        result = runtime.playHumanCard(card.id);
        ui.renderHands(game, { selectable: false });
        await wait(turnDelay.HUMAN_CARD_REVEAL);
        if (abandonStaleOperation(token, game)) return false;
      }
      return await revealAndScore(result, token);
    } catch (error) {
      console.error('[round] A kör nem fejezhető be:', error);
      if (abandonStaleOperation(token, game)) return false;

      if (game.phase === phaseRegistry.CHOOSE_CARD && game.chooser === humanId) {
        return showRetryAction({
          message: 'A gép kártyaválasztása megszakadt. A kör biztonságosan folytatható.',
          action: finishRestoredAiMove,
          token,
        });
      }

      releaseOperation(token);
      ui.showToast('A kört nem sikerült lezárni. A játéknézetet helyreállítottuk.', 'error', 3400);
      actions.saveCurrentGame();
      restoreSavedView();
      return false;
    }
  };

  const finishRestoredAiMove = async () => {
    const game = state().game;
    if (!game || activeOperation) return false;
    const token = beginOperation('restore-ai-card');

    try {
      await wait(turnDelay.RESTORED_AI_MOVE);
      if (abandonStaleOperation(token, game)) return false;
      const result = runtime.playAiCard();
      return await revealAndScore(result, token);
    } catch (error) {
      console.error('[round] A félbemaradt gépi kör nem folytatható:', error);
      if (abandonStaleOperation(token, game)) return false;

      if (game.phase === phaseRegistry.CHOOSE_CARD && game.chooser === humanId) {
        return showRetryAction({
          message: 'A gép kártyaválasztása továbbra sem sikerült. Próbáld újra.',
          action: finishRestoredAiMove,
          token,
        });
      }

      releaseOperation(token);
      ui.showToast('A kör eredménynézetét helyreállítottuk.', 'error', 3200);
      actions.saveCurrentGame();
      restoreSavedView();
      return false;
    }
  };

  const restoreSavedView = () => {
    const current = state();
    const game = current.game;
    if (!game) return false;
    if (activeOperation) cancelPendingOperations();
    else setBusy(false);
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

  const recoverCurrentView = () => {
    cancelPendingOperations();
    ui.closeInspector();
    ui.dom?.picker?.replaceChildren?.();
    return restoreSavedView();
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
    recoverCurrentView,
    cancelPendingOperations,
    hasActiveOperation: () => Boolean(activeOperation),
    activeOperationKind: () => activeOperation?.kind ?? null,
  });
}
