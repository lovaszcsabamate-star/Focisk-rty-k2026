/** Browser session controller for Classic and Penalties modes. */

import { PHASE, HUMAN, AI, GAME_DECK_SIZE } from './engine.js';
import { DIFFICULTY } from './ai.js';
import { GameRuntime } from './game/game-runtime.js';
import { TURN_DELAY, createTurnTimingService } from './services/turn-timing-service.js';
import { createSessionLifecycleService } from './app/session-lifecycle-service.js';
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
    this.overlayReturn = null;
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
    if (!this.ui.dom.overlay.hidden && this.overlayReturn) {
      const action = this.overlayReturn;
      this.overlayReturn = null;
      action();
      return;
    }
    if (this.game && !this.game.isOver) {
      this.showPauseMenu();
      return;
    }

    this.lifecycle.requestExit();
  }

  _showPanel(panel, returnAction = null) {
    this.overlayReturn = returnAction;
    this.ui.showOverlay(panel);
    requestAnimationFrame(() => panel.querySelector('button, input, summary')?.focus({ preventScroll: true }));
  }

  _hidePanel() {
    this.overlayReturn = null;
    this.ui.hideOverlay();
  }

  showTitleScreen({ offerOnboarding = false } = {}) {
    if (this.game && !this.game.isOver) this.saveCurrentGame();
    this.busy = false;
    this.ui.setInteractionBusy(false);
    this.runtime.reset();
    this.ui.setMode('classic');
    this.ui.resetTable();

    const saved = readSavedMatch();
    const panel = el('div', 'menu-panel mobile-home');
    panel.innerHTML = `
      <p class="eyebrow">A hátsó asztal bajnoksága</p>
      <h1>Fociskártyák 2026</h1>
      <p>Válassz ellenfelet és játékmódot. A játék internet nélkül is teljes értékűen működik.</p>

      ${saved ? `
        <button class="btn btn--continue" id="continue-btn">
          <span>▶ Játék folytatása</span>
          <small>${saved.mode === 'penalties' ? 'Tizenegyes mód' : 'Klasszikus mód'} · ${this._savedTimeLabel(saved.savedAt)}</small>
        </button>
      ` : ''}

      <h2 class="menu-section-title">Új játék</h2>
      <div class="primary-mode-actions">
        <button class="btn mode-start" id="start-btn"><span>🃏 Klasszikus mód</span><small>52 lapos kártyameccs</small></button>
        <button class="btn mode-start" id="penalties-btn"><span>⚽ Penalties mód</span><small>11 lap, öt rendes párbaj</small></button>
      </div>

      <details class="opponent-details">
        <summary>👤 Ellenfél kiválasztása</summary>
        <div class="difficulty" aria-label="Nehézség">
          ${Object.entries(DIFFICULTY).slice(0, 3).map(([key, difficulty], index) => `
            <label><input type="radio" name="difficulty" value="${key}" ${index === 1 ? 'checked' : ''}><span>${difficulty.label}</span></label>
          `).join('')}
        </div>
      </details>

      <div class="secondary-menu-actions">
        <button class="btn btn--ghost" id="rules-btn">📖 Játékszabályok</button>
        <button class="btn btn--ghost" id="settings-btn">⚙ Beállítások</button>
      </div>
      <div class="deck-source">${this._deckLabel()}</div>
    `;

    panel.querySelector('#continue-btn')?.addEventListener('click', () => this.resumeSavedMatch(), { once: true });
    panel.querySelector('#start-btn').addEventListener('click', () => this.startFromMenu('classic', panel), { once: true });
    panel.querySelector('#penalties-btn').addEventListener('click', () => this.startFromMenu('penalties', panel), { once: true });
    panel.querySelector('#rules-btn').addEventListener('click', () => this.showRules(() => this.showTitleScreen({ offerOnboarding: false })), { once: true });
    panel.querySelector('#settings-btn').addEventListener('click', () => this.showSettings(() => this.showTitleScreen({ offerOnboarding: false })), { once: true });

    this._showPanel(panel);
    if (offerOnboarding && !onboardingWasCompleted()) {
      setTimeout(() => this.showOnboarding(false), 0);
    }
  }

  _savedTimeLabel(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'mentett mérkőzés';
    return `mentve: ${date.toLocaleDateString('hu-HU')} ${date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}`;
  }

  _deckLabel() {
    if (this.source !== 'real') return '⚠ Fiktív tartalékpakli – a valós adatfájl nem töltődött be.';
    const exact = this.meta?.selection?.exactBirthDates;
    const dateNote = Number.isFinite(exact) ? ` · ${exact} pontos születési dátum` : '';
    return `✓ ${this.deck.length} valós NB I-kártya · ${this.meta?.season ?? '2025/26'}${dateNote}`;
  }

  selectedDifficulty(panel) {
    const checked = panel?.querySelector('input[name=difficulty]:checked')?.value;
    return validDifficulty(checked) ? checked : selectedOpponentDifficulty();
  }

  startFromMenu(mode, panel) {
    const difficulty = this.selectedDifficulty(panel);
    if (readSavedMatch()) {
      this.confirmReplaceSavedGame(mode, difficulty);
      return;
    }
    this.start(mode, difficulty);
  }

  confirmReplaceSavedGame(mode, difficulty) {
    const panel = el('div', 'confirm-panel');
    panel.innerHTML = `
      <p class="eyebrow">Mentett mérkőzés</p>
      <h1>Új játékot indítasz?</h1>
      <p>A jelenlegi mentés törlődik. Ezt később nem lehet visszaállítani.</p>
      <div class="result-actions">
        <button class="btn" id="replace-save-btn">Igen, új játék</button>
        <button class="btn btn--ghost" id="keep-save-btn">Mégse</button>
      </div>
    `;
    panel.querySelector('#replace-save-btn').addEventListener('click', () => {
      clearSavedMatch();
      this.start(mode, difficulty);
    }, { once: true });
    panel.querySelector('#keep-save-btn').addEventListener('click', () => this.showTitleScreen({ offerOnboarding: false }), { once: true });
    this._showPanel(panel, () => this.showTitleScreen({ offerOnboarding: false }));
  }

  showOnboarding(forced = false) {
    const slides = [
      ['🎮', 'Válassz játékmódot', 'A Klasszikus mód hosszabb kártyameccs, a Penalties gyors tizenegyespárbaj.'],
      ['🃏', 'Nézd meg a saját lapjaidat', 'A kéz oldalra húzható. Koppints egy kártyára, a nagyítóval pedig megnyithatod a részleteit.'],
      ['📊', 'Válassz kategóriát', 'A gomb megmutatja, hogy több vagy kevesebb érték számít jobbnak, és a legjobb saját értékedet is.'],
      ['🏆', 'Gyűjts több lapot', 'A kör győztese viszi a lapokat. Döntetlennél a lapok a közös pakliba kerülnek.'],
    ];
    let index = 0;
    const panel = el('div', 'onboarding-panel');
    panel.innerHTML = `
      <button class="onboarding-skip" id="onboarding-skip" type="button">Átugrás</button>
      <div class="onboarding-progress" aria-label="Bemutató állapota"></div>
      <div class="onboarding-slide" aria-live="polite"></div>
      <label class="onboarding-never"><input type="checkbox" id="onboarding-never" checked> Ne mutasd újra</label>
      <div class="onboarding-actions">
        <button class="btn btn--ghost" id="onboarding-back" type="button">Vissza</button>
        <button class="btn" id="onboarding-next" type="button">Tovább</button>
      </div>
    `;
    const slide = panel.querySelector('.onboarding-slide');
    const progress = panel.querySelector('.onboarding-progress');
    const back = panel.querySelector('#onboarding-back');
    const next = panel.querySelector('#onboarding-next');
    const never = panel.querySelector('#onboarding-never');

    const finish = () => {
      if (never.checked) setOnboardingCompleted(true);
      else if (forced) setOnboardingCompleted(false);
      this.showTitleScreen({ offerOnboarding: false });
    };
    const render = () => {
      const [icon, title, text] = slides[index];
      slide.innerHTML = `<div class="onboarding-icon">${icon}</div><h1>${title}</h1><p>${text}</p>`;
      progress.replaceChildren(...slides.map((_, step) => {
        const dot = el('span', `onboarding-dot${step === index ? ' is-active' : ''}`);
        dot.setAttribute('aria-label', `${step + 1}. lépés${step === index ? ', aktuális' : ''}`);
        return dot;
      }));
      back.disabled = index === 0;
      next.textContent = index === slides.length - 1 ? 'Kezdjük' : 'Tovább';
    };
    back.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
    next.addEventListener('click', () => {
      if (index === slides.length - 1) finish();
      else { index += 1; render(); }
    });
    panel.querySelector('#onboarding-skip').addEventListener('click', finish, { once: true });
    render();
    this._showPanel(panel, finish);
  }

  showRules(returnAction) {
    const panel = el('div', 'rules-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">Súgó</p>
      <h1>Játékszabályok</h1>
      <section class="rule-card" data-rules="classic">
        <h2>🃏 Klasszikus mód</h2>
        <p><b>${Math.min(GAME_DECK_SIZE, this.deck.length)} véletlenszerű lap</b> kerül játékba. A két fél körönként felváltva választ kategóriát. A győztes viszi a két lapot és a döntetlenpaklit.</p>
      </section>
      <section class="rule-card" data-rules="penalties">
        <h2>⚽ Penalties mód</h2>
        <p>Mindkét fél 11 lapot kap. Öt rendes párbaj következik; döntetlennél hirtelen halál. Azonos értéknél nincs gól.</p>
      </section>
      <section class="rule-card">
        <h2>📊 Kategóriák</h2>
        <p>A kategóriagomb mindig jelzi, hogy a több vagy a kevesebb érték a jobb. Csak olyan kategória választható, amelyhez mindkét oldalon van hiteles adat.</p>
      </section>
      <button class="btn" id="rules-back-btn">Vissza</button>
    `;
    panel.querySelector('#rules-back-btn').addEventListener('click', returnAction, { once: true });
    this._showPanel(panel, returnAction);
  }

  showSettings(returnAction) {
    const panel = el('div', 'settings-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">Személyre szabás</p>
      <h1>Beállítások</h1>
      <div class="settings-list"></div>
      <div class="settings-actions">
        <button class="btn btn--ghost" id="replay-guide-btn">Útmutató újraindítása</button>
        ${readSavedMatch() ? '<button class="btn btn--danger" id="delete-save-btn">Mentett játék törlése</button>' : ''}
        <button class="btn" id="settings-back-btn">Kész</button>
      </div>
    `;
    const rows = [
      ['sounds', '🔊 Hangok', 'Rövid gomb- és eredményhangok'],
      ['commentary', '💬 Kommentárok', 'A hátsó asztal beszólásai'],
      ['vibration', '📳 Rezgés', 'Rövid visszajelzés a kör eredményéről'],
      ['animations', '✨ Animációk', 'Kártya- és eredményátmenetek'],
      ['largeText', '🔎 Nagyobb szöveg', 'Nagyobb kezelőelemek és feliratok'],
      ['simplified', '◻ Egyszerűsített nézet', 'Kevesebb dekoráció és vizuális zaj'],
    ];
    const list = panel.querySelector('.settings-list');
    for (const [key, label, description] of rows) {
      const row = el('label', 'setting-switch');
      const copy = el('span', 'setting-switch__copy');
      copy.append(el('strong', null, label), el('small', null, description));
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(this.settings[key]);
      input.setAttribute('aria-label', label);
      input.addEventListener('change', () => this.toggleSetting(key, input.checked));
      row.append(copy, input, el('span', 'setting-switch__visual'));
      list.appendChild(row);
    }
    panel.querySelector('#replay-guide-btn').addEventListener('click', () => {
      setOnboardingCompleted(false);
      this.showOnboarding(true);
    }, { once: true });
    panel.querySelector('#delete-save-btn')?.addEventListener('click', () => {
      clearSavedMatch();
      this.ui.showToast('A mentett játék törölve');
      this.showSettings(returnAction);
    }, { once: true });
    panel.querySelector('#settings-back-btn').addEventListener('click', returnAction, { once: true });
    this._showPanel(panel, returnAction);
  }

  showPauseMenu() {
    if (!this.game || this.game.isOver) return;
    this.saveCurrentGame();
    const panel = el('div', 'pause-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">A játék szünetel</p>
      <h1>Szünet</h1>
      <p>${this.mode === 'penalties' ? 'Tizenegyes mód' : 'Klasszikus mód'} · ${this.game.round}. ${this.mode === 'penalties' ? 'párbaj' : 'kör'}</p>
      <div class="pause-actions">
        <button class="btn" id="resume-btn">▶ Játék folytatása</button>
        <button class="btn btn--ghost" id="restart-btn">↻ Újrakezdés</button>
        <button class="btn btn--ghost" id="pause-rules-btn">📖 Szabályok</button>
        <button class="btn btn--ghost" id="pause-settings-btn">⚙ Beállítások</button>
        <button class="btn btn--ghost" id="home-btn">⌂ Vissza a főmenübe</button>
      </div>
    `;
    const resume = () => this._hidePanel();
    panel.querySelector('#resume-btn').addEventListener('click', resume, { once: true });
    panel.querySelector('#restart-btn').addEventListener('click', () => this.start(this.mode, this.difficulty), { once: true });
    panel.querySelector('#pause-rules-btn').addEventListener('click', () => this.showRules(() => this.showPauseMenu()), { once: true });
    panel.querySelector('#pause-settings-btn').addEventListener('click', () => this.showSettings(() => this.showPauseMenu()), { once: true });
    panel.querySelector('#home-btn').addEventListener('click', () => this.showTitleScreen({ offerOnboarding: false }), { once: true });
    this._showPanel(panel, resume);
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
    const panel = el('div', 'penalty-intro');
    panel.innerHTML = `
      <p class="eyebrow">Penalties mód</p>
      <h1>11 lap. 5 rendes párbaj.</h1>
      <p>Döntetlennél hirtelen halál. A felhasznált lapok külön pakliba kerülnek.</p>
      <button class="btn" id="kickoff-btn">Kezdődhet</button>
    `;
    panel.querySelector('#kickoff-btn').addEventListener('click', () => this._beginMatch(), { once: true });
    this._showPanel(panel, () => this.showTitleScreen({ offerOnboarding: false }));
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
    this.busy = true;
    this.ui.setInteractionBusy(false);
    clearSavedMatch();
    const result = this.runtime.result();
    const won = result.winner === HUMAN;
    this.ui.say(getLine(won ? 'gameOverWin' : result.winner === AI ? 'gameOverLose' : 'gameOverTie'));
    const panel = el('div', `result-panel ${won ? 'result-panel--win' : 'result-panel--loss'}`);

    if (this.mode === 'penalties') {
      const best = result.bestCategories.length
        ? result.bestCategories.map(key => `${ATTRIBUTE_BY_KEY[key].icon} ${ATTRIBUTE_BY_KEY[key].label}`).join(', ')
        : 'Nem volt megnyert kategória';
      panel.innerHTML = `
        <p class="result-kicker">${result.stage === 'hirtelen halál' ? '⚠ Hirtelen halál' : '⏱ Rendes játékidő'}</p>
        <h1>${won ? 'GYŐZELEM' : 'VERESÉG'}</h1>
        <div class="final-score">JÁTÉKOS ${result.human}–${result.ai} GÉP</div>
        <dl class="result-stats">
          <div><dt>Felhasznált párbajok</dt><dd>${result.duels}</dd></div>
          <div><dt>Eldőlt</dt><dd>${result.stage}</dd></div>
          <div><dt>Legeredményesebb kategória</dt><dd>${best}${result.bestCategoryWins ? ` (${result.bestCategoryWins} gól)` : ''}</dd></div>
        </dl>
        <div class="result-actions"><button class="btn" id="rematch-btn">Visszavágó</button><button class="btn btn--ghost" id="menu-btn">Vissza a főmenübe</button></div>
      `;
    } else {
      const heading = result.winner === HUMAN ? 'GYŐZELEM' : result.winner === AI ? 'VERESÉG' : 'DÖNTETLEN';
      panel.innerHTML = `
        <h1>${heading}</h1>
        <div class="final-score">JÁTÉKOS ${result.human}–${result.ai} GÉP</div>
        ${result.undecided ? `<p>${result.undecided} lap a döntetlenpakliban maradt.</p>` : ''}
        <div class="result-actions"><button class="btn" id="rematch-btn">Visszavágó</button><button class="btn btn--ghost" id="menu-btn">Vissza a főmenübe</button></div>
      `;
    }

    panel.querySelector('#rematch-btn').addEventListener('click', () => this.start(this.mode, this.difficulty), { once: true });
    panel.querySelector('#menu-btn').addEventListener('click', () => this.showTitleScreen({ offerOnboarding: false }), { once: true });
    this._showPanel(panel, () => this.showTitleScreen({ offerOnboarding: false }));
  }
}

const { players, source, meta } = await loadPlayers();
new Session(players, source, meta);
