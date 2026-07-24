/** Browser session controller for Classic and Penalties modes. */

import { PHASE, HUMAN, AI } from './engine.js';
import { DIFFICULTY } from './ai.js';
import { GameRuntime } from './game/game-runtime.js';
import { TURN_DELAY, createTurnTimingService } from './services/turn-timing-service.js';
import { createSessionLifecycleService } from './app/session-lifecycle-service.js';
import { createMenuController } from './app/menu-controller.js';
import { createResultController } from './app/result-controller.js';
import { UI, el } from './ui.js';
import { getLine, getIdleChatter } from './banter.js';
import { ATTRIBUTE_BY_KEY, attributeValue, loadPlayers } from './data/players.js';
import {
  applyExperienceSettings,
  clearSavedMatch,
  DEFAULT_SETTINGS,
  hydrateGame,
  loadSettings,
  onboardingWasCompleted,
  readSavedMatch,
  saveBooleanSetting,
  setOnboardingCompleted,
  writeSavedMatch,
} from './mobile-experience.js';

const validDifficulty = value => Object.prototype.hasOwnProperty.call(DIFFICULTY, value);
const selectedOpponentDifficulty = () => {
  const id = globalThis.__FOCISKARTYAK_OPPONENT__?.id;
  return validDifficulty(id) ? id : (validDifficulty('medium') ? 'medium' : Object.keys(DIFFICULTY)[0]);
};

class Session {
  constructor(deck, source, meta) {
    this.deck = deck;
    this.source = source;
    this.meta = meta;
    this.runtime = new GameRuntime({ players: deck });
    this.timing = createTurnTimingService();
    this.lifecycle = createSessionLifecycleService();
    this.settings = { ...DEFAULT_SETTINGS, ...loadSettings() };
    this.ui = new UI({
      onAttribute: key => this.humanChoseAttribute(key),
      onCard: card => this.humanPlayedCard(card),
      onToggleSounds: () => this.toggleSetting('sounds'),
      onToggleCommentary: () => this.toggleSetting('commentary'),
      onPause: () => this.showPauseMenu(),
      onOpenSettings: () => this.showSettings(() => this.showTitleScreen({ offerOnboarding: false })),
    }, this.settings);
    this.busy = false;
    this.menu = createMenuController({
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
    this.results = createResultController({
      ui: this.ui,
      getState: () => ({
        mode: this.mode,
        difficulty: this.difficulty,
        result: this.runtime.result(),
      }),
      actions: {
        setBusy: value => { this.busy = value; },
        start: (mode, difficulty) => this.start(mode, difficulty),
        showTitleScreen: options => this.showTitleScreen(options),
        showPanel: (panel, returnAction) => this._showPanel(panel, returnAction),
      },
      clearSaved: clearSavedMatch,
    });
    applyExperienceSettings(this.settings);
    this.installLifecycleHandlers();
    this.showTitleScreen({ offerOnboarding: true });
  }

  get game() { return this.runtime.game; }
  get mode() { return this.runtime.mode; }
  get difficulty() { return this.runtime.difficulty; }
  get pendingAttribute() { return this.runtime.pendingAttribute; }
  get awaitingChooserCard() { return this.runtime.awaitingChooserCard; }

  delay(delayOrKey) {
    return this.timing.wait(delayOrKey, { animations: this.settings.animations });
  }

  toggleSetting(key, forcedValue) {
    if (!(key in this.settings)) return;
    this.settings[key] = forcedValue ?? !this.settings[key];
    saveBooleanSetting(key, this.settings[key]);
    this.ui.setSettings(this.settings);
    applyExperienceSettings(this.settings);
    if (key === 'sounds') this.ui.showToast(this.settings.sounds ? 'Hangok bekapcsolva' : 'Hangok kikapcsolva');
  }

  installLifecycleHandlers() {
    return this.lifecycle.install({
      onSave: () => this.saveCurrentGame(),
      onToast: (message, tone, duration) => this.ui.showToast(message, tone, duration),
      onBackAction: () => this.handleBackAction(),
    });
  }

  disposeLifecycleHandlers() {
    return this.lifecycle.dispose();
  }

  handleBackAction() {
    if (document.querySelector('#inspector')) {
      this.ui.closeInspector();
      return;
    }
    if (this.menu.handleBackAction()) return;
    if (this.game && !this.game.isOver) {
      this.showPauseMenu();
      return;
    }

    this.lifecycle.requestExit();
  }

  _showPanel(panel, returnAction = null) {
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

  start(mode, difficulty) {
    clearSavedMatch();
    this.runtime.start(mode, validDifficulty(difficulty) ? difficulty : selectedOpponentDifficulty());
    this.busy = false;
    this.ui.resetTable();
    this.ui.setMode(this.mode);

    if (this.mode === 'penalties') this.showPenaltyIntro();
    else this._beginMatch();
  }

  showPenaltyIntro() {
    return this.menu.showPenaltyIntro();
  }

  _beginMatch() {
    this._hidePanel();
    this.ui.say(getLine('gameStart'));
    this.beginRound();
  }

  beginRound() {
    const game = this.game;
    if (!game) return;
    this.busy = false;
    this.ui.setInteractionBusy(false);
    this.ui.closeInspector();
    this.ui.renderScores(game);
    this.ui.dom.duel.replaceChildren();
    this.ui.dom.verdict.replaceChildren();
    this.ui.dom.verdict.className = '';

    if (game.chooser === HUMAN) {
      this.ui.renderHands(game, { selectable: false });
      this.ui.showAttributePicker(game);
      this.saveCurrentGame();
    } else {
      this.aiChoosesAttribute();
    }
  }

  humanChoseAttribute(attributeKey) {
    if (this.busy || !this.game.availableAttributeKeys().includes(attributeKey)) return;
    this.runtime.selectHumanAttribute(attributeKey);
    this.ui.hideAttributePicker();
    this.ui.say(getLine('youChooseAttribute', { attributeKey }));
    this.ui.setPrompt('Te következel – válassz kártyát:', ATTRIBUTE_BY_KEY[attributeKey].label);
    this.ui.renderHands(this.game, { selectable: true, inspectAttribute: attributeKey });
    this.saveCurrentGame();
  }

  async aiChoosesAttribute() {
    const game = this.game;
    this.busy = true;
    this.ui.setInteractionBusy(true);
    this.ui.renderHands(game, { selectable: false });
    this.ui.setPrompt('A gép választ…');
    await this.delay(TURN_DELAY.AI_CHOOSE_ATTRIBUTE);
    if (this.game !== game) return;

    const choice = this.runtime.chooseAiAttribute();
    const label = ATTRIBUTE_BY_KEY[choice.attribute].label;
    this.ui.say(getLine('aiChooseAttribute', { attr: label, attributeKey: choice.attribute }));
    this.ui.setPrompt('A gép ezt választotta:', label);
    this.ui.showDuel(game, { opponentHidden: true });
    this.ui.renderHands(game, { selectable: true });
    this.busy = false;
    this.ui.setInteractionBusy(false);
    this.saveCurrentGame();
  }

  async humanPlayedCard(card) {
    if (this.busy || !this.game || this.game.phase === PHASE.GAME_OVER) return;
    this.busy = true;
    this.ui.setInteractionBusy(true);
    let result;

    try {
      if (this.awaitingChooserCard) {
        this.runtime.commitHumanChooserCard(card.id);
        this.ui.showDuel(this.game, { opponentHidden: true });
        this.ui.renderHands(this.game, { selectable: false });
        this.ui.setPrompt('A gép kártyát választ…');
        await this.delay(TURN_DELAY.AI_CHOOSE_CARD);
        result = this.runtime.playAiCard();
      } else {
        result = this.runtime.playHumanCard(card.id);
        this.ui.renderHands(this.game, { selectable: false });
        await this.delay(250);
      }
      await this.revealAndScore(result);
    } catch (error) {
      console.error('[round] A kör nem fejezhető be:', error);
      this.busy = false;
      this.ui.setInteractionBusy(false);
      this.ui.showToast('A kört nem sikerült lezárni. Próbáld újra.', 'error');
      this.saveCurrentGame();
    }
  }

  async revealAndScore(result) {
    this.ui.showDuel(this.game, { result });
    this.ui.setPrompt('Eredmény');
    await this.delay(320);
    this.ui.showVerdict(result, this.game);
    this.ui.renderScores(this.game);
    this.sayResultBanter(result);
    this.saveCurrentGame();

    if (result.enteredSuddenDeath) {
      this.ui.say(getLine('suddenDeath'));
      await this.ui.showSuddenDeath();
    } else {
      await this.delay(650);
    }

    if (this.game.isOver) {
      this.showGameOver();
      return;
    }
    this.busy = false;
    this.ui.setInteractionBusy(false);
    this.showContinue();
  }

  sayResultBanter(result) {
    const attribute = ATTRIBUTE_BY_KEY[result.attribute];
    const context = { card: result.humanCard.name, stat: attribute.label, attributeKey: result.attribute };
    if (result.winner === 'tie') {
      this.ui.say(getLine('tie', context));
      return;
    }

    const mine = attributeValue(result.humanCard, result.attribute);
    const theirs = attributeValue(result.aiCard, result.attribute);
    const spread = Math.abs(mine - theirs) / Math.max(Math.abs(mine), Math.abs(theirs), 1);
    if (result.winner === HUMAN) {
      this.ui.say(getLine('attributeWin', context));
      this.ui.say(getLine(spread > 0.55 ? 'youWinBig' : 'youWin', context));
    } else {
      this.ui.say(getLine(spread < 0.06 ? 'youLoseClose' : 'youLose', context));
    }
    if (result.potScooped > 0) this.ui.say(getLine('potScooped', context));
  }

  showContinue() {
    const label = this.mode === 'penalties' ? 'Következő párbaj' : 'Következő kör';
    const button = el('button', 'btn next-round-button', label);
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => {
      if (this.busy) return;
      this.busy = true;
      this.ui.setInteractionBusy(true);
      this.ui.dom.picker.replaceChildren();
      const { reshuffled } = this.runtime.advance();
      if (this.mode === 'penalties') {
        if (reshuffled) this.ui.say(getLine('reshuffle'));
      } else {
        this.ui.say(getIdleChatter());
      }
      this.busy = false;
      this.ui.setInteractionBusy(false);
      if (this.game.isOver) this.showGameOver();
      else this.beginRound();
    }, { once: true });
    this.ui.dom.picker.replaceChildren(button);
    this.saveCurrentGame();
  }

  saveCurrentGame() {
    if (!this.game || this.game.isOver) return false;
    return writeSavedMatch(this.runtime.toSavePayload(this.ui.uxStats));
  }

  resumeSavedMatch() {
    const saved = readSavedMatch();
    if (!saved) {
      this.ui.showToast('Nincs folytatható mentett játék', 'error');
      this.showTitleScreen({ offerOnboarding: false });
      return;
    }

    try {
      this.runtime.restore({
        ...saved,
        difficulty: validDifficulty(saved.difficulty) ? saved.difficulty : selectedOpponentDifficulty(),
      }, hydrateGame);
      this.ui.resetTable();
      this.ui.setMode(this.mode);
      if (saved.uxStats) this.ui.uxStats = saved.uxStats;
      this._hidePanel();
      this.busy = false;
      this.ui.setInteractionBusy(false);
      this.restoreSavedView();
      this.ui.showToast('Mentett játék folytatva', 'success');
    } catch (error) {
      console.error('[save] A mentett játék nem állítható vissza:', error);
      clearSavedMatch();
      this.ui.showToast('A mentés sérült, ezért új játék szükséges.', 'error', 3400);
      this.showTitleScreen({ offerOnboarding: false });
    }
  }

  restoreSavedView() {
    const game = this.game;
    this.ui.renderScores(game);

    if (game.phase === PHASE.CHOOSE_ATTRIBUTE) {
      if (this.awaitingChooserCard && this.pendingAttribute && game.chooser === HUMAN) {
        this.ui.setPrompt('Te következel – válassz kártyát:', ATTRIBUTE_BY_KEY[this.pendingAttribute]?.label);
        this.ui.renderHands(game, { selectable: true, inspectAttribute: this.pendingAttribute });
      } else {
        this.beginRound();
      }
      return;
    }

    if (game.phase === PHASE.CHOOSE_CARD) {
      this.ui.showDuel(game, { opponentHidden: true });
      if (game.chooser === AI) {
        this.ui.setPrompt('A gép ezt választotta:', ATTRIBUTE_BY_KEY[game.attribute]?.label);
        this.ui.renderHands(game, { selectable: true });
        this.runtime.clearPendingChoice();
      } else {
        this.ui.renderHands(game, { selectable: false });
        this.ui.setPrompt('A gép befejezi a félbemaradt kört…');
        this.finishRestoredAiMove();
      }
      return;
    }

    if (game.phase === PHASE.REVEAL && game.lastResult) {
      this.ui.renderHands(game, { selectable: false });
      this.ui.showDuel(game, { result: game.lastResult });
      this.ui.showVerdict(game.lastResult, game);
      this.showContinue();
      return;
    }

    if (game.phase === PHASE.GAME_OVER) this.showGameOver();
  }

  async finishRestoredAiMove() {
    this.busy = true;
    this.ui.setInteractionBusy(true);
    await this.delay(350);
    const result = this.runtime.playAiCard();
    await this.revealAndScore(result);
  }

  showGameOver() {
    return this.results.showGameOver();
  }
}

const { players, source, meta } = await loadPlayers();
new Session(players, source, meta);
