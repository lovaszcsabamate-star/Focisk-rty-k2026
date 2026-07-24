/** Browser session controller for Classic and Penalties modes. */

import { DIFFICULTY } from './ai.js';
import { GameRuntime } from './game/game-runtime.js';
import { createTurnTimingService } from './services/turn-timing-service.js';
import { createSessionLifecycleService } from './app/session-lifecycle-service.js';
import { createMenuController } from './app/menu-controller.js';
import { createResultController } from './app/result-controller.js';
import { createRoundController } from './app/round-controller.js';
import { UI } from './ui.js';
import { getLine } from './banter.js';
import { loadPlayers } from './data/players.js';
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
    this.rounds = createRoundController({
      ui: this.ui,
      runtime: this.runtime,
      getState: () => ({
        game: this.game,
        mode: this.mode,
        busy: this.busy,
        pendingAttribute: this.pendingAttribute,
        awaitingChooserCard: this.awaitingChooserCard,
      }),
      actions: {
        setBusy: value => { this.busy = value; },
        saveCurrentGame: () => this.saveCurrentGame(),
        showGameOver: () => this.showGameOver(),
      },
      wait: delayOrKey => this.delay(delayOrKey),
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
    return this.rounds.beginRound();
  }

  humanChoseAttribute(attributeKey) {
    return this.rounds.humanChoseAttribute(attributeKey);
  }

  aiChoosesAttribute() {
    return this.rounds.aiChoosesAttribute();
  }

  humanPlayedCard(card) {
    return this.rounds.humanPlayedCard(card);
  }

  revealAndScore(result) {
    return this.rounds.revealAndScore(result);
  }

  sayResultBanter(result) {
    return this.rounds.sayResultBanter(result);
  }

  showContinue() {
    return this.rounds.showContinue();
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
    return this.rounds.restoreSavedView();
  }

  finishRestoredAiMove() {
    return this.rounds.finishRestoredAiMove();
  }

  showGameOver() {
    return this.results.showGameOver();
  }
}

const { players, source, meta } = await loadPlayers();
new Session(players, source, meta);
