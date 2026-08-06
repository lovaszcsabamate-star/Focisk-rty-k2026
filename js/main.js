/** Browser session controller for Classic and Penalties modes. */

import { DIFFICULTY } from './ai.js';
import { GameRuntime } from './game/game-runtime.js';
import { createTurnTimingService } from './services/turn-timing-service.js';
import { consumeQuickMatchLaunch } from './services/quick-match-storage-service.js';
import {
  inspectSeasonSavedMatch,
  SEASON_SAVE_STATUS,
} from './services/season-save-service.js';
import { createSessionLifecycleService } from './app/session-lifecycle-service.js';
import { createMenuController } from './app/menu-controller.js';
import { createResultController } from './app/result-controller.js';
import { createRoundController } from './app/round-controller.js';
import { UI, el } from './ui.js';
import { getLine } from './banter.js';
import { loadPlayers } from './data/players.js';
import {
  applyExperienceSettings,
  clearSeasonSavedMatch,
  DEFAULT_SETTINGS,
  hydrateSeasonGame,
  loadSettings,
  onboardingWasCompleted,
  readSeasonSavedMatch,
  saveBooleanSetting,
  setOnboardingCompleted,
  writeSeasonSavedMatch,
} from './mobile-experience.js';

const validDifficulty = value => Object.prototype.hasOwnProperty.call(DIFFICULTY, value);
const selectedOpponentDifficulty = () => {
  const id = globalThis.__FOCISKARTYAK_OPPONENT__?.id;
  return validDifficulty(id) ? id : (validDifficulty('medium') ? 'medium' : Object.keys(DIFFICULTY)[0]);
};

const saveProblemMessage = inspection => {
  switch (inspection?.code) {
    case SEASON_SAVE_STATUS.SEASON_MISMATCH:
      return 'Ez a mentés egy másik szezonhoz tartozik, ezért nem folytatható a jelenlegi adatbázissal.';
    case SEASON_SAVE_STATUS.DATABASE_MISMATCH:
      return 'Ez a mentés egy másik játékos-adatbázishoz tartozik, ezért nem folytatható.';
    case SEASON_SAVE_STATUS.UNSUPPORTED_VERSION:
      return 'A mentés egy nem támogatott játékverzióval készült.';
    case SEASON_SAVE_STATUS.MISSING_CARD:
      return 'A mentés olyan játékoskártyát tartalmaz, amely már nem érhető el a jelenlegi adatbázisban.';
    case SEASON_SAVE_STATUS.INVALID_JSON:
    case SEASON_SAVE_STATUS.INVALID_SCHEMA:
    default:
      return 'A mentett játék sérült vagy már nem kompatibilis ezzel a verzióval.';
  }
};

class Session {
  constructor(deck, source, meta, { quickMatchLaunch = null } = {}) {
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
    this.launchInProgress = false;
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
      readSaved: readSeasonSavedMatch,
      clearSaved: clearSeasonSavedMatch,
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
      clearSaved: clearSeasonSavedMatch,
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

    if (quickMatchLaunch) {
      this.start(quickMatchLaunch.mode, quickMatchLaunch.difficulty);
    } else {
      const saveInspection = inspectSeasonSavedMatch();
      if (saveInspection.hasStoredValue && !saveInspection.ok) this.showSaveProblem(saveInspection);
      else this.showTitleScreen({ offerOnboarding: true });
    }
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

  _setLaunchControlsDisabled(disabled) {
    const buttons = document.querySelectorAll('#overlay button');
    buttons.forEach(button => {
      const stateKey = 'launchPreviousDisabled';
      const ariaKey = 'launchPreviousAriaDisabled';
      if (disabled) {
        if (!(stateKey in button.dataset)) {
          button.dataset[stateKey] = String(Boolean(button.disabled));
          button.dataset[ariaKey] = button.getAttribute('aria-disabled') ?? '';
        }
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        return;
      }
      if (!(stateKey in button.dataset)) return;
      button.disabled = button.dataset[stateKey] === 'true';
      if (button.dataset[ariaKey]) button.setAttribute('aria-disabled', button.dataset[ariaKey]);
      else button.removeAttribute('aria-disabled');
      delete button.dataset[stateKey];
      delete button.dataset[ariaKey];
    });
  }

  _runLaunch(operation, { retry = null, onError = null } = {}) {
    if (this.launchInProgress) return false;
    this.launchInProgress = true;
    this.busy = true;
    this.ui.setInteractionBusy(false);
    this._setLaunchControlsDisabled(true);
    this.ui.showToast('Mérkőzés előkészítése…', 'info', 1400);

    try {
      return operation();
    } catch (error) {
      console.error('[launch] A mérkőzés előkészítése sikertelen:', error);
      if (typeof onError === 'function') onError(error);
      else this.showLaunchError(retry);
      return false;
    } finally {
      this.launchInProgress = false;
      this.busy = false;
      this.ui.setInteractionBusy(false);
      this._setLaunchControlsDisabled(false);
    }
  }

  showLaunchError(retry = null) {
    const panel = el('div', 'confirm-panel launch-error-panel');
    panel.innerHTML = `
      <p class="eyebrow">Indítási hiba</p>
      <h1>A mérkőzés nem indult el</h1>
      <p>A korábbi játék és mentés változatlan maradt. Próbáld újra, vagy térj vissza.</p>
      <div class="result-actions">
        ${typeof retry === 'function' ? '<button class="btn" id="retry-launch-btn">Újrapróbálás</button>' : ''}
        <button class="btn btn--ghost" id="launch-back-btn">Vissza</button>
      </div>
    `;
    panel.querySelector('#retry-launch-btn')?.addEventListener('click', retry, { once: true });
    const back = () => {
      if (this.game && !this.game.isOver) this.showPauseMenu();
      else this.showTitleScreen({ offerOnboarding: false });
    };
    panel.querySelector('#launch-back-btn').addEventListener('click', back, { once: true });
    this._showPanel(panel, back);
  }

  showSaveProblem(inspection) {
    console.error('[save] A mentett játék nem folytatható:', {
      code: inspection?.code,
      errors: inspection?.errors ?? [],
      warnings: inspection?.warnings ?? [],
    });
    const panel = el('div', 'confirm-panel save-error-panel');
    panel.innerHTML = `
      <p class="eyebrow">Mentési probléma</p>
      <h1>A játék nem folytatható</h1>
      <p>${saveProblemMessage(inspection)}</p>
      <div class="result-actions">
        <button class="btn btn--danger" id="delete-invalid-save-btn">Mentés törlése</button>
        <button class="btn btn--ghost" id="invalid-save-back-btn">Vissza a főmenübe</button>
      </div>
    `;
    const back = () => this.showTitleScreen({ offerOnboarding: false });
    panel.querySelector('#delete-invalid-save-btn').addEventListener('click', () => {
      if (!clearSeasonSavedMatch()) {
        this.ui.showToast('A mentést nem sikerült törölni.', 'error', 3000);
        return;
      }
      this.ui.showToast('A hibás mentés törölve.', 'success');
      back();
    }, { once: true });
    panel.querySelector('#invalid-save-back-btn').addEventListener('click', back, { once: true });
    this._showPanel(panel, back);
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
    const resolvedDifficulty = validDifficulty(difficulty) ? difficulty : selectedOpponentDifficulty();
    return this._runLaunch(() => {
      this.runtime.start(mode, resolvedDifficulty);
      this.ui.resetTable();
      this.ui.setMode(this.mode);
      if (!clearSeasonSavedMatch() && inspectSeasonSavedMatch().hasStoredValue) {
        console.warn('[save] A korábbi mentést nem sikerült eltávolítani az új játék indítása után.');
      }

      if (this.mode === 'penalties') this.showPenaltyIntro();
      else this._beginMatch();
      return true;
    }, {
      retry: () => this.start(mode, difficulty),
    });
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
    return writeSeasonSavedMatch(this.runtime.toSavePayload(this.ui.uxStats));
  }

  resumeSavedMatch() {
    const inspection = inspectSeasonSavedMatch();
    if (inspection.code === SEASON_SAVE_STATUS.NO_SAVE) {
      this.ui.showToast('Nincs folytatható mentett játék', 'error');
      this.showTitleScreen({ offerOnboarding: false });
      return false;
    }
    if (!inspection.ok || !inspection.value) {
      this.showSaveProblem(inspection);
      return false;
    }

    const saved = inspection.value;
    return this._runLaunch(() => {
      this.runtime.restore({
        ...saved,
        difficulty: validDifficulty(saved.difficulty) ? saved.difficulty : selectedOpponentDifficulty(),
      }, hydrateSeasonGame);
      this.ui.resetTable();
      this.ui.setMode(this.mode);
      if (saved.uxStats) this.ui.uxStats = saved.uxStats;
      this._hidePanel();
      this.restoreSavedView();
      this.ui.showToast(
        inspection.warnings.length
          ? 'A mentés figyelmeztetéssel, de sikeresen folytatva.'
          : 'Mentett játék folytatva',
        inspection.warnings.length ? 'info' : 'success',
        3000,
      );
      return true;
    }, {
      retry: () => this.resumeSavedMatch(),
      onError: error => this.showSaveProblem({
        ...inspection,
        ok: false,
        value: null,
        code: SEASON_SAVE_STATUS.INVALID_SCHEMA,
        errors: [...inspection.errors, error?.message ?? 'ismeretlen visszaállítási hiba'],
      }),
    });
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
const quickMatchLaunch = consumeQuickMatchLaunch();
new Session(players, source, meta, { quickMatchLaunch });
