/** Browser session controller for Classic and Büntetőpárbaj modes. */

import { Game, PHASE, HUMAN, AI, GAME_DECK_SIZE } from './engine.js';
import { PenaltyGame } from './penalties.js';
import { OpponentAI, DIFFICULTY } from './ai.js';
import { UI, el } from './ui.js';
import { getLine, getIdleChatter } from './banter.js';
import { ATTRIBUTE_BY_KEY, attributeValue, loadPlayers } from './data/players.js';
import {
  aiDelay,
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

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const validDifficulty = value => Object.prototype.hasOwnProperty.call(DIFFICULTY, value);
const selectedOpponentDifficulty = () => {
  const id = globalThis.__FOCISKARTYAK_OPPONENT__?.id;
  return validDifficulty(id) ? id : (validDifficulty('d-raven') ? 'd-raven' : Object.keys(DIFFICULTY)[0]);
};

const serialisableGameState = game => JSON.parse(JSON.stringify(game));

export function restoreGameState(game, snapshot) {
  if (!game || !snapshot) return game;
  const rng = game.rng;
  for (const key of Object.keys(game)) {
    if (key !== 'rng') delete game[key];
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (key !== 'rng') game[key] = value;
  }
  game.rng = rng ?? Math.random;
  return game;
}

export class Session {
  constructor(deck, source, meta) {
    this.deck = deck;
    this.source = source;
    this.meta = meta;
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
    this.game = null;
    this.overlayReturn = null;
    this.exitTapAt = 0;
    this.sessionVersion = 0;
    this.turnVersion = 0;
    this.flowVersion = 0;
    this.transaction = null;
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    applyExperienceSettings(this.settings);
    this.installLifecycleHandlers();
    this.showTitleScreen({ offerOnboarding: true });
  }

  _token(game = this.game) {
    return {
      session: this.sessionVersion,
      turn: this.turnVersion,
      flow: this.flowVersion,
      game,
    };
  }

  _tokenIsCurrent(token, allowedPhases = null, requireInteractive = true) {
    if (!token || token.game !== this.game) return false;
    if (token.session !== this.sessionVersion || token.turn !== this.turnVersion || token.flow !== this.flowVersion) return false;
    if (allowedPhases && !allowedPhases.includes(this.game?.phase)) return false;
    if (requireInteractive && (!this.ui.dom.overlay.hidden || document.querySelector('#inspector'))) return false;
    return true;
  }

  async delay(milliseconds, token, { phases = null, requireInteractive = true } = {}) {
    const duration = this.settings.animations ? milliseconds : Math.min(milliseconds, 90);
    await sleep(duration);
    return this._tokenIsCurrent(token, phases, requireInteractive);
  }

  _invalidateFlow({ newSession = false, newTurn = false, rollback = false } = {}) {
    if (rollback) this._rollbackTransaction({ render: false });
    if (newSession) {
      this.sessionVersion += 1;
      this.turnVersion = 0;
    } else if (newTurn) {
      this.turnVersion += 1;
    }
    this.flowVersion += 1;
  }

  _beginTransaction(label) {
    if (!this.game) return null;
    this.transaction = {
      label,
      game: this.game,
      gameState: serialisableGameState(this.game),
      pendingAttribute: this.pendingAttribute,
      awaitingChooserCard: this.awaitingChooserCard,
    };
    return this.transaction;
  }

  _commitTransaction() {
    this.transaction = null;
  }

  _rollbackTransaction({ render = true } = {}) {
    const transaction = this.transaction;
    this.transaction = null;
    if (!transaction || transaction.game !== this.game) return false;
    restoreGameState(this.game, transaction.gameState);
    this.pendingAttribute = transaction.pendingAttribute;
    this.awaitingChooserCard = transaction.awaitingChooserCard;
    this.busy = false;
    this.ui.setInteractionBusy(false);
    if (render && this.ui.dom.overlay.hidden) this.restoreSavedView({ allowAiResume: false });
    return true;
  }

  _cancelPendingActivity({ rollback = true } = {}) {
    document.dispatchEvent(new CustomEvent('fociskartyak:interaction-invalidated', { detail: { source: 'session' } }));
    this._invalidateFlow({ rollback });
    this.busy = false;
    this.ui.setInteractionBusy(false);
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
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveCurrentGame();
    });
    document.addEventListener('fociskartyak:interaction-invalidated', event => {
      if (event.detail?.source === 'session') return;
      if (this.busy) this._cancelPendingActivity({ rollback: true });
      else this._invalidateFlow();
    });
    window.addEventListener('pagehide', () => this.saveCurrentGame());
    window.addEventListener('error', event => {
      console.error('[ui] Nem kezelt hiba:', event.error ?? event.message);
      this._cancelPendingActivity({ rollback: true });
      this.ui.showToast('Váratlan hiba történt. A stabil játékállást megőriztük.', 'error', 3200);
      this.saveCurrentGame();
    });
    window.addEventListener('unhandledrejection', event => {
      console.error('[ui] Nem kezelt aszinkron hiba:', event.reason);
      this._cancelPendingActivity({ rollback: true });
      this.ui.showToast('Egy művelet nem fejeződött be. Próbáld újra.', 'error', 3200);
      this.saveCurrentGame();
    });

    try {
      history.replaceState({ fociskartyak: 'base' }, document.title);
      history.pushState({ fociskartyak: 'guard' }, document.title);
      this._popStateHandler = () => {
        history.pushState({ fociskartyak: 'guard' }, document.title);
        this.handleBackAction();
      };
      window.addEventListener('popstate', this._popStateHandler);
    } catch {
      // History integration is optional in restricted embedded browsers.
    }
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

    const now = Date.now();
    if (now - this.exitTapAt < 1600) {
      window.removeEventListener('popstate', this._popStateHandler);
      history.go(-2);
      return;
    }
    this.exitTapAt = now;
    this.ui.showToast('A kilépéshez nyomd meg újra a Vissza gombot');
  }

  _showPanel(panel, returnAction = null) {
    this._cancelPendingActivity({ rollback: true });
    this.overlayReturn = returnAction;
    this.ui.showOverlay(panel);
    requestAnimationFrame(() => panel.querySelector('button, input, summary')?.focus({ preventScroll: true }));
  }

  _hidePanel() {
    this.overlayReturn = null;
    this.ui.hideOverlay();
  }

  showTitleScreen({ offerOnboarding = false } = {}) {
    this._cancelPendingActivity({ rollback: true });
    if (this.game && !this.game.isOver) this.saveCurrentGame();
    this._invalidateFlow({ newSession: true });
    this.game = null;
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
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
          <small>${saved.mode === 'penalties' ? 'Büntetőpárbaj' : 'Klasszikus mód'} · ${this._savedTimeLabel(saved.savedAt)}</small>
        </button>
      ` : ''}

      <h2 class="menu-section-title">Új játék</h2>
      <div class="primary-mode-actions">
        <button class="btn mode-start" id="start-btn"><span>🃏 Klasszikus mód</span><small>52 lapos kártyameccs</small></button>
        <button class="btn mode-start" id="penalties-btn" aria-label="Büntetőpárbaj indítása"><span>⚽ Büntetőpárbaj</span><small>11 lap, öt rendes párbaj</small></button>
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
    if (offerOnboarding && !onboardingWasCompleted()) setTimeout(() => this.showOnboarding(false), 0);
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
      </div>`;
    panel.querySelector('#replace-save-btn').addEventListener('click', () => {
      clearSavedMatch();
      this.start(mode, difficulty);
    }, { once: true });
    panel.querySelector('#keep-save-btn').addEventListener('click', () => this.showTitleScreen({ offerOnboarding: false }), { once: true });
    this._showPanel(panel, () => this.showTitleScreen({ offerOnboarding: false }));
  }

  showOnboarding(forced = false) {
    const slides = [
      ['🎮', 'Válassz játékmódot', 'A Klasszikus mód hosszabb kártyameccs, a Büntetőpárbaj gyors, 11 lapos összecsapás.'],
      ['🃏', 'Nézd meg a saját lapjaidat', 'A kéz oldalra húzható. Koppints egy kártyára, a nagyítóval pedig megnyithatod a részleteit.'],
      ['📊', 'Válassz kategóriát', 'A gomb az adatmodell iránya alapján jelzi, hogy a több, kevesebb, korábbi vagy későbbi érték számít jobbnak.'],
      ['🏆', 'A két mód eltérően kezeli a döntetlent', 'Klasszikus módban a lapok a döntetlenpakliba kerülnek. Büntetőpárbajban nincs gól, és mindkét lap a használt lapok közé kerül.'],
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
      </div>`;
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
        <p><b>${Math.min(GAME_DECK_SIZE, this.deck.length)} véletlenszerű lap</b> kerül játékba. A győztes viszi a két lapot és a döntetlenpaklit.</p>
      </section>
      <section class="rule-card" data-rules="penalties">
        <h2>⚽ Büntetőpárbaj</h2>
        <p>Mindkét fél 11 lapot kap. Öt rendes párbaj következik; döntetlennél nincs gól, mindkét lap a használt lapok közé kerül, egyenlő állásnál pedig hirtelen halál jön.</p>
      </section>
      <section class="rule-card">
        <h2>📊 Kategóriák</h2>
        <p>A kategóriagomb az adatmodell iránya alapján jelzi, hogy a több, kevesebb, korábbi vagy későbbi érték a jobb.</p>
      </section>
      <button class="btn" id="rules-back-btn">Vissza</button>`;
    panel.querySelector('#rules-back-btn').addEventListener('click', returnAction, { once: true });
    this._showPanel(panel, returnAction);
  }

  showSettings(returnAction) {
    const panel = el('div', 'settings-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">Személyre szabás</p><h1>Beállítások</h1>
      <div class="settings-list"></div>
      <div class="settings-actions">
        <button class="btn btn--ghost" id="replay-guide-btn">Útmutató újraindítása</button>
        ${readSavedMatch() ? '<button class="btn btn--danger" id="delete-save-btn">Mentett játék törlése</button>' : ''}
        <button class="btn" id="settings-back-btn">Kész</button>
      </div>`;
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
    this._cancelPendingActivity({ rollback: true });
    this.saveCurrentGame();
    const panel = el('div', 'pause-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">A játék szünetel</p><h1>Szünet</h1>
      <p>${this.mode === 'penalties' ? 'Büntetőpárbaj' : 'Klasszikus mód'} · ${this.game.round}. ${this.mode === 'penalties' ? 'párbaj' : 'kör'}</p>
      <div class="pause-actions">
        <button class="btn" id="resume-btn">▶ Játék folytatása</button>
        <button class="btn btn--ghost" id="restart-btn">↻ Újrakezdés</button>
        <button class="btn btn--ghost" id="pause-rules-btn">📖 Szabályok</button>
        <button class="btn btn--ghost" id="pause-settings-btn">⚙ Beállítások</button>
        <button class="btn btn--ghost" id="home-btn">⌂ Vissza a főmenübe</button>
      </div>`;
    const resume = () => {
      this._hidePanel();
      this.restoreSavedView();
    };
    panel.querySelector('#resume-btn').addEventListener('click', resume, { once: true });
    panel.querySelector('#restart-btn').addEventListener('click', () => this.start(this.mode, this.difficulty), { once: true });
    panel.querySelector('#pause-rules-btn').addEventListener('click', () => this.showRules(() => this.showPauseMenu()), { once: true });
    panel.querySelector('#pause-settings-btn').addEventListener('click', () => this.showSettings(() => this.showPauseMenu()), { once: true });
    panel.querySelector('#home-btn').addEventListener('click', () => this.showTitleScreen({ offerOnboarding: false }), { once: true });
    this._showPanel(panel, resume);
  }

  start(mode, difficulty) {
    this._cancelPendingActivity({ rollback: true });
    this._invalidateFlow({ newSession: true });
    clearSavedMatch();
    this.mode = mode;
    this.difficulty = validDifficulty(difficulty) ? difficulty : selectedOpponentDifficulty();
    globalThis.__FOCISKARTYAK_SELECT_OPPONENT__?.(this.difficulty);
    this.busy = false;
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    this.ui.resetTable();
    this.ui.setMode(mode);
    this.game = mode === 'penalties' ? new PenaltyGame({ players: this.deck }) : new Game({ players: this.deck });
    this.prepareAI();
    if (mode === 'penalties') this.showPenaltyIntro();
    else this._beginMatch();
  }

  prepareAI() {
    const aiDeck = this.mode === 'penalties'
      ? [...this.game.teams[HUMAN], ...this.game.teams[AI]]
      : this.game.players;
    this.ai = new OpponentAI(this.difficulty, aiDeck);
  }

  showPenaltyIntro() {
    const panel = el('div', 'penalty-intro');
    panel.innerHTML = `
      <p class="eyebrow">Büntetőpárbaj</p>
      <h1>11 lap. 5 rendes párbaj.</h1>
      <p>Döntetlennél nincs gól, és mindkét lap a használt lapok közé kerül. Egyenlő állásnál hirtelen halál következik.</p>
      <button class="btn" id="kickoff-btn">Kezdődhet</button>`;
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
    this._invalidateFlow({ newTurn: true });
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
      this.ui.setPrompt('Kategóriát választ');
      this.saveCurrentGame();
    } else {
      this.aiChoosesAttribute();
    }
  }

  humanChoseAttribute(attributeKey) {
    if (this.busy || !this.game || this.game.phase !== PHASE.CHOOSE_ATTRIBUTE
      || !this.game.availableAttributeKeys().includes(attributeKey)) return;
    this.pendingAttribute = attributeKey;
    this.ui.hideAttributePicker();
    this.ui.say(getLine('youChooseAttribute', { attributeKey }));
    this.ui.setPrompt('Kártyát választ', ATTRIBUTE_BY_KEY[attributeKey].label);
    this.ui.renderHands(this.game, { selectable: true, inspectAttribute: attributeKey });
    this.awaitingChooserCard = true;
    this.ui.renderScores(this.game);
    this.saveCurrentGame();
  }

  _showAiRetry(message, action) {
    this.busy = false;
    this.ui.setInteractionBusy(false);
    this.ui.setPrompt(message);
    const button = el('button', 'btn next-round-button', 'Gépi választás újrapróbálása');
    button.type = 'button';
    button.addEventListener('click', action, { once: true });
    this.ui.dom.picker.replaceChildren(button);
  }

  async aiChoosesAttribute() {
    const game = this.game;
    const token = this._token(game);
    this.busy = true;
    this.ui.setInteractionBusy(true);
    this.ui.renderHands(game, { selectable: false });
    this.ui.setPrompt('A gép választ');
    this.ui.renderScores(game);

    try {
      const valid = await this.delay(aiDelay('chooseAttribute', 550), token, { phases: [PHASE.CHOOSE_ATTRIBUTE] });
      if (!valid) return;
      this._beginTransaction('ai-attribute');
      const choice = this.ai.chooseAttribute(game.hands[AI], game.availableAttributeKeys());
      game.chooseAttribute(choice.attribute, choice.cardId);
      this._commitTransaction();
      const label = ATTRIBUTE_BY_KEY[choice.attribute].label;
      this.ui.say(getLine('aiChooseAttribute', { attr: label, attributeKey: choice.attribute }));
      this.ui.setPrompt('Kártyát választ', label);
      this.ui.showDuel(game, { opponentHidden: true });
      this.ui.renderHands(game, { selectable: true });
      this.awaitingChooserCard = false;
      this.busy = false;
      this.ui.setInteractionBusy(false);
      this.ui.renderScores(game);
      this.saveCurrentGame();
    } catch (error) {
      console.error('[ai] A gép nem tudott kategóriát választani:', error);
      this._rollbackTransaction({ render: false });
      if (this.game === game) {
        this.ui.renderHands(game, { selectable: false });
        this._showAiRetry('A gép választása megszakadt', () => this.aiChoosesAttribute());
        this.ui.showToast('A gépi választás sikertelen volt. Az állapot visszaállt.', 'error');
        this.saveCurrentGame();
      }
    }
  }

  async humanPlayedCard(card) {
    if (this.busy || !this.game || ![PHASE.CHOOSE_ATTRIBUTE, PHASE.CHOOSE_CARD].includes(this.game.phase)) return;
    const game = this.game;
    const token = this._token(game);
    this.busy = true;
    this.ui.setInteractionBusy(true);
    this._beginTransaction('human-card');
    let result;

    try {
      if (this.awaitingChooserCard) {
        game.chooseAttribute(this.pendingAttribute, card.id);
        this.awaitingChooserCard = false;
        this.ui.showDuel(game, { opponentHidden: true });
        this.ui.renderHands(game, { selectable: false });
        this.ui.setPrompt('A gép választ');
        this.ui.renderScores(game);
        const valid = await this.delay(aiDelay('chooseCard', 500), token, { phases: [PHASE.CHOOSE_CARD] });
        if (!valid) {
          this._rollbackTransaction({ render: false });
          return;
        }
        const aiCardId = this.ai.chooseCard(game.hands[AI], game.attribute);
        result = game.playCard(AI, aiCardId);
      } else {
        result = game.playCard(HUMAN, card.id);
        this.ui.renderHands(game, { selectable: false });
        const valid = await this.delay(250, token, { phases: [PHASE.REVEAL, PHASE.GAME_OVER] });
        if (!valid) {
          this._rollbackTransaction({ render: false });
          return;
        }
      }
      this._commitTransaction();
      await this.revealAndScore(result, token);
    } catch (error) {
      console.error('[round] A kör nem fejezhető be:', error);
      this._rollbackTransaction({ render: false });
      if (this.game === game) {
        this.busy = false;
        this.ui.setInteractionBusy(false);
        this.restoreSavedView({ allowAiResume: false });
        this.ui.showToast('A kört nem sikerült lezárni. A kártya visszakerült, próbáld újra.', 'error');
        this.saveCurrentGame();
      }
    }
  }

  async revealAndScore(result, token = this._token(this.game)) {
    if (!this._tokenIsCurrent(token, [PHASE.REVEAL, PHASE.GAME_OVER], false)) return;
    this.ui.showDuel(this.game, { result });
    this.ui.setPrompt('Eredmény');
    this.ui.renderScores(this.game);
    if (!await this.delay(320, token, { phases: [PHASE.REVEAL, PHASE.GAME_OVER], requireInteractive: false })) return;
    this.ui.showVerdict(result, this.game);
    this.ui.renderScores(this.game);
    this.sayResultBanter(result);
    this.saveCurrentGame({ force: true });

    if (result.enteredSuddenDeath) {
      this.ui.dom.suddenDeath.hidden = false;
      this.ui.dom.suddenDeath.textContent = '⚠ HIRTELEN HALÁL ⚠';
      this.ui.playSound('sudden');
      if (!await this.delay(1200, token, { phases: [PHASE.REVEAL, PHASE.GAME_OVER], requireInteractive: false })) return;
      this.ui.dom.suddenDeath.hidden = true;
    } else if (!await this.delay(650, token, { phases: [PHASE.REVEAL, PHASE.GAME_OVER], requireInteractive: false })) {
      return;
    }

    if (!this._tokenIsCurrent(token, [PHASE.REVEAL, PHASE.GAME_OVER], false)) return;
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
      if (this.mode === 'penalties') {
        const { reshuffled } = this.game.nextDuel();
        if (reshuffled) this.ui.say(getLine('reshuffle'));
      } else {
        this.game.nextRound();
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

  saveCurrentGame({ force = false } = {}) {
    if (!this.game || this.game.isOver || this.transaction || (!force && this.busy)) return false;
    return writeSavedMatch({
      game: this.game,
      mode: this.mode,
      difficulty: this.difficulty,
      pendingAttribute: this.pendingAttribute,
      awaitingChooserCard: this.awaitingChooserCard,
      uxStats: this.ui.uxStats,
    });
  }

  resumeSavedMatch() {
    const saved = readSavedMatch();
    if (!saved) {
      this.ui.showToast('Nincs folytatható mentett játék', 'error');
      this.showTitleScreen({ offerOnboarding: false });
      return;
    }

    try {
      this._cancelPendingActivity({ rollback: true });
      this._invalidateFlow({ newSession: true });
      this.mode = saved.mode;
      this.difficulty = validDifficulty(saved.difficulty) ? saved.difficulty : selectedOpponentDifficulty();
      globalThis.__FOCISKARTYAK_SELECT_OPPONENT__?.(this.difficulty);
      this.pendingAttribute = saved.pendingAttribute;
      this.awaitingChooserCard = Boolean(saved.awaitingChooserCard);
      this.game = saved.mode === 'penalties'
        ? hydrateGame(new PenaltyGame({ players: this.deck }), saved.game)
        : hydrateGame(new Game({ players: this.deck }), saved.game);
      this.ui.resetTable();
      this.ui.setMode(this.mode);
      if (saved.uxStats) this.ui.uxStats = saved.uxStats;
      this.prepareAI();
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

  restoreSavedView({ allowAiResume = true } = {}) {
    const game = this.game;
    if (!game) return;
    this.ui.renderScores(game);

    if (game.phase === PHASE.CHOOSE_ATTRIBUTE) {
      if (this.awaitingChooserCard && this.pendingAttribute && game.chooser === HUMAN) {
        this.ui.setPrompt('Kártyát választ', ATTRIBUTE_BY_KEY[this.pendingAttribute]?.label);
        this.ui.renderHands(game, { selectable: true, inspectAttribute: this.pendingAttribute });
      } else if (game.chooser === HUMAN) {
        this.ui.renderHands(game, { selectable: false });
        this.ui.showAttributePicker(game);
        this.ui.setPrompt('Kategóriát választ');
      } else if (allowAiResume) {
        this.aiChoosesAttribute();
      } else {
        this._showAiRetry('A gép választása megszakadt', () => this.aiChoosesAttribute());
      }
      return;
    }

    if (game.phase === PHASE.CHOOSE_CARD) {
      this.ui.showDuel(game, { opponentHidden: true });
      if (game.chooser === AI) {
        this.ui.setPrompt('Kártyát választ', ATTRIBUTE_BY_KEY[game.attribute]?.label);
        this.ui.renderHands(game, { selectable: true });
        this.awaitingChooserCard = false;
      } else {
        this.ui.renderHands(game, { selectable: false });
        this.ui.setPrompt('A gép választ');
        if (allowAiResume) this.finishRestoredAiMove();
        else this._showAiRetry('A gép választása megszakadt', () => this.finishRestoredAiMove());
      }
      return;
    }

    if (game.phase === PHASE.REVEAL && game.lastResult) {
      this.ui.setPrompt('Eredmény');
      this.ui.renderHands(game, { selectable: false });
      this.ui.showDuel(game, { result: game.lastResult });
      this.ui.showVerdict(game.lastResult, game);
      this.showContinue();
      return;
    }

    if (game.phase === PHASE.GAME_OVER) this.showGameOver();
  }

  async finishRestoredAiMove() {
    const game = this.game;
    const token = this._token(game);
    this.busy = true;
    this.ui.setInteractionBusy(true);
    this._beginTransaction('restored-ai-card');
    try {
      if (!await this.delay(350, token, { phases: [PHASE.CHOOSE_CARD] })) {
        this._rollbackTransaction({ render: false });
        return;
      }
      const aiCardId = this.ai.chooseCard(game.hands[AI], game.attribute);
      const result = game.playCard(AI, aiCardId);
      this._commitTransaction();
      await this.revealAndScore(result, token);
    } catch (error) {
      console.error('[save] A félbemaradt gépi kör nem fejezhető be:', error);
      this._rollbackTransaction({ render: false });
      if (this.game === game) {
        this._showAiRetry('A gép választása megszakadt', () => this.finishRestoredAiMove());
        this.ui.showToast('A gépi választás sikertelen volt. Az állapot visszaállt.', 'error');
        this.saveCurrentGame();
      }
    }
  }

  showGameOver() {
    this._cancelPendingActivity({ rollback: false });
    this.busy = true;
    this.ui.setInteractionBusy(false);
    this.ui.setPrompt('Mérkőzés vége');
    this.ui.renderScores(this.game);
    clearSavedMatch();
    const result = this.game.result();
    const won = result.winner === HUMAN;
    this.ui.say(getLine(won ? 'gameOverWin' : result.winner === AI ? 'gameOverLose' : 'gameOverTie'));
    const panel = el('div', `result-panel ${won ? 'result-panel--win' : result.winner === AI ? 'result-panel--loss' : 'result-panel--tie'}`);

    if (this.mode === 'penalties') {
      const best = result.bestCategories.length
        ? result.bestCategories.map(key => `${ATTRIBUTE_BY_KEY[key].icon} ${ATTRIBUTE_BY_KEY[key].label}`).join(', ')
        : 'Nem volt megnyert kategória';
      panel.innerHTML = `
        <p class="result-kicker">${result.stage === 'hirtelen halál' ? '⚠ Hirtelen halál' : '⏱ Rendes játékidő'}</p>
        <h1>${won ? 'GYŐZELEM' : 'VERESÉG'}</h1>
        <div class="final-score">JÁTÉKOS ${result.human}–${result.ai} GÉP</div>
        <dl class="result-stats">
          <div><dt>Összes párbaj</dt><dd>${result.duels}</dd></div>
          <div><dt>Felhasznált ciklusok</dt><dd>${result.cycles}</dd></div>
          <div><dt>Eldőlt</dt><dd>${result.stage}</dd></div>
          <div><dt>Legeredményesebb kategória</dt><dd>${best}${result.bestCategoryWins ? ` (${result.bestCategoryWins} gól)` : ''}</dd></div>
        </dl>
        <div class="result-actions"><button class="btn" id="rematch-btn">Visszavágó</button><button class="btn btn--ghost" id="menu-btn">Vissza a főmenübe</button></div>`;
    } else {
      const heading = result.winner === HUMAN ? 'GYŐZELEM' : result.winner === AI ? 'VERESÉG' : 'DÖNTETLEN';
      panel.innerHTML = `
        <h1>${heading}</h1>
        <div class="final-score">JÁTÉKOS ${result.human}–${result.ai} GÉP</div>
        ${result.undecided ? `<p>${result.undecided} lap a döntetlenpakliban maradt.</p>` : ''}
        <div class="result-actions"><button class="btn" id="rematch-btn">Visszavágó</button><button class="btn btn--ghost" id="menu-btn">Vissza a főmenübe</button></div>`;
    }

    panel.querySelector('#rematch-btn').addEventListener('click', () => this.start(this.mode, this.difficulty), { once: true });
    panel.querySelector('#menu-btn').addEventListener('click', () => this.showTitleScreen({ offerOnboarding: false }), { once: true });
    this._showPanel(panel, () => this.showTitleScreen({ offerOnboarding: false }));
  }
}

if (typeof document !== 'undefined' && !globalThis.__FOCISKARTYAK_TEST__) {
  const { players, source, meta } = await loadPlayers();
  new Session(players, source, meta);
}
