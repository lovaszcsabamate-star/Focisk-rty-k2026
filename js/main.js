/** Browser session controller for Classic and Penalties modes. */

import { Game, PHASE, HUMAN, AI, GAME_DECK_SIZE } from './engine.js';
import { PenaltyGame } from './penalties.js';
import { OpponentAI, DIFFICULTY } from './ai.js';
import { UI, el } from './ui.js';
import { getLine, getIdleChatter } from './banter.js';
import { ATTRIBUTE_BY_KEY, attributeValue, loadPlayers } from './data/players.js';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const loadSetting = (key, fallback) => {
  try {
    const value = localStorage.getItem(`fociskartyak:${key}`);
    return value == null ? fallback : value === 'true';
  } catch { return fallback; }
};

class Session {
  constructor(deck, source, meta) {
    this.deck = deck;
    this.source = source;
    this.meta = meta;
    this.settings = {
      sounds: loadSetting('sounds', true),
      commentary: loadSetting('commentary', true),
    };
    this.ui = new UI({
      onAttribute: key => this.humanChoseAttribute(key),
      onCard: card => this.humanPlayedCard(card),
      onToggleSounds: () => this.toggleSetting('sounds'),
      onToggleCommentary: () => this.toggleSetting('commentary'),
    }, this.settings);
    this.busy = false;
    this.showTitleScreen();
  }

  toggleSetting(key, forcedValue) {
    this.settings[key] = forcedValue ?? !this.settings[key];
    try { localStorage.setItem(`fociskartyak:${key}`, String(this.settings[key])); } catch { /* optional */ }
    this.ui.setSettings(this.settings);
  }

  showTitleScreen() {
    this.busy = false;
    this.game = null;
    this.ui.setMode('classic');
    this.ui.resetTable();
    const panel = el('div', 'menu-panel');
    panel.innerHTML = `
      <p class="eyebrow">A hátsó asztal bajnoksága</p>
      <h1>Fociskártyák 2026</h1>
      <p>A shady alak már leült. Válassz játékmódot, mielőtt elfogy a söre.</p>

      <div class="mode-picker" role="radiogroup" aria-label="Játékmód">
        <label class="mode-card">
          <input type="radio" name="mode" value="classic" checked>
          <span><b>🃏 Klasszikus mód</b><small>52 lap, körönkénti összehasonlítás, a győztes viszi a lapokat.</small></span>
        </label>
        <label class="mode-card">
          <input type="radio" name="mode" value="penalties">
          <span><b>⚽ Penalties mód</b><small>11–11 lap, 5 rendes párbaj, döntetlennél hirtelen halál.</small></span>
        </label>
      </div>

      <div class="rules" data-rules="classic">
        <b>Klasszikus szabály:</b> ${Math.min(GAME_DECK_SIZE, this.deck.length)} véletlenszerű lap kerül játékba.
        A kör győztese viszi a két lapot és a döntetlenpaklit, majd ő választ új kategóriát.
      </div>
      <div class="rules" data-rules="penalties" hidden>
        <b>Penalties szabály:</b> 11 lap. 5 rendes párbaj. Döntetlennél hirtelen halál.
        Egy párbaj egy gól; azonos értéknél nincs pont.
      </div>

      <div class="difficulty" aria-label="Nehézség">
        ${Object.entries(DIFFICULTY).map(([key, difficulty], index) => `
          <label><input type="radio" name="difficulty" value="${key}" ${index === 1 ? 'checked' : ''}><span>${difficulty.label}</span></label>
        `).join('')}
      </div>

      <div class="menu-toggles">
        <label><input type="checkbox" id="sound-setting" ${this.settings.sounds ? 'checked' : ''}> 🔊 Hangok</label>
        <label><input type="checkbox" id="commentary-setting" ${this.settings.commentary ? 'checked' : ''}> 💬 Kommentárok</label>
      </div>
      <button class="btn" id="start-btn">Játék indítása</button>
      <div class="deck-source">${this._deckLabel()}</div>
    `;

    const updateRules = () => {
      const mode = panel.querySelector('input[name=mode]:checked').value;
      panel.querySelectorAll('[data-rules]').forEach(node => { node.hidden = node.dataset.rules !== mode; });
    };
    panel.querySelectorAll('input[name=mode]').forEach(input => input.addEventListener('change', updateRules));
    panel.querySelector('#sound-setting').addEventListener('change', event => this.toggleSetting('sounds', event.target.checked));
    panel.querySelector('#commentary-setting').addEventListener('change', event => this.toggleSetting('commentary', event.target.checked));
    panel.querySelector('#start-btn').addEventListener('click', () => {
      const mode = panel.querySelector('input[name=mode]:checked').value;
      const difficulty = panel.querySelector('input[name=difficulty]:checked').value;
      this.start(mode, difficulty);
    }, { once: true });
    this.ui.showOverlay(panel);
  }

  _deckLabel() {
    if (this.source !== 'real') return '⚠ Fiktív tartalékpakli – a valós adatfájl nem töltődött be.';
    const exact = this.meta?.selection?.exactBirthDates;
    const dateNote = Number.isFinite(exact) ? ` · ${exact} pontos születési dátum` : '';
    return `✓ ${this.deck.length} valós NB I-kártya · ${this.meta?.season ?? '2025/26'}${dateNote}`;
  }

  start(mode, difficulty) {
    this.mode = mode;
    this.difficulty = difficulty;
    this.busy = false;
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    this.ui.resetTable();
    this.ui.setMode(mode);
    this.game = mode === 'penalties'
      ? new PenaltyGame({ players: this.deck })
      : new Game({ players: this.deck });
    const aiDeck = mode === 'penalties'
      ? [...this.game.teams[HUMAN], ...this.game.teams[AI]]
      : this.game.players;
    this.ai = new OpponentAI(difficulty, aiDeck);

    if (mode === 'penalties') this.showPenaltyIntro();
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
    this.ui.showOverlay(panel);
  }

  _beginMatch() {
    this.ui.hideOverlay();
    this.ui.say(getLine('gameStart'));
    this.beginRound();
  }

  beginRound() {
    const game = this.game;
    this.ui.closeInspector();
    this.ui.renderScores(game);
    this.ui.dom.duel.replaceChildren();
    this.ui.dom.verdict.replaceChildren();
    this.ui.dom.verdict.className = '';

    if (game.chooser === HUMAN) {
      this.ui.renderHands(game, { selectable: false });
      this.ui.showAttributePicker(game);
    } else {
      this.aiChoosesAttribute();
    }
  }

  humanChoseAttribute(attributeKey) {
    if (this.busy || !this.game.availableAttributeKeys().includes(attributeKey)) return;
    this.pendingAttribute = attributeKey;
    this.ui.hideAttributePicker();
    this.ui.say(getLine('youChooseAttribute', { attributeKey }));
    this.ui.setPrompt('Válassz kártyát:', ATTRIBUTE_BY_KEY[attributeKey].label);
    this.ui.renderHands(this.game, { selectable: true, inspectAttribute: attributeKey });
    this.awaitingChooserCard = true;
  }

  async aiChoosesAttribute() {
    const game = this.game;
    this.busy = true;
    this.ui.renderHands(game, { selectable: false });
    this.ui.setPrompt('A gép gondolkodik…');
    await wait(550);
    if (this.game !== game) return;

    const choice = this.ai.chooseAttribute(game.hands[AI], game.availableAttributeKeys());
    game.chooseAttribute(choice.attribute, choice.cardId);
    const label = ATTRIBUTE_BY_KEY[choice.attribute].label;
    this.ui.say(getLine('aiChooseAttribute', { attr: label, attributeKey: choice.attribute }));
    this.ui.setPrompt('A gép választása:', label);
    this.ui.showDuel(game, { opponentHidden: true });
    this.ui.renderHands(game, { selectable: true });
    this.awaitingChooserCard = false;
    this.busy = false;
  }

  async humanPlayedCard(card) {
    if (this.busy || !this.game || this.game.phase === PHASE.GAME_OVER) return;
    this.busy = true;
    let result;

    if (this.awaitingChooserCard) {
      this.game.chooseAttribute(this.pendingAttribute, card.id);
      this.awaitingChooserCard = false;
      this.ui.showDuel(this.game, { opponentHidden: true });
      this.ui.renderHands(this.game, { selectable: false });
      this.ui.setPrompt('A gép kártyát választ…');
      await wait(500);
      const aiCardId = this.ai.chooseCard(this.game.hands[AI], this.game.attribute);
      result = this.game.playCard(AI, aiCardId);
    } else {
      result = this.game.playCard(HUMAN, card.id);
      this.ui.renderHands(this.game, { selectable: false });
      await wait(250);
    }
    await this.revealAndScore(result);
  }

  async revealAndScore(result) {
    this.ui.showDuel(this.game, { result });
    this.ui.setPrompt('');
    await wait(320);
    this.ui.showVerdict(result, this.game);
    this.ui.renderScores(this.game);
    this.sayResultBanter(result);

    if (result.enteredSuddenDeath) {
      this.ui.say(getLine('suddenDeath'));
      await this.ui.showSuddenDeath();
    } else {
      await wait(850);
    }

    if (this.game.isOver) {
      this.showGameOver();
      return;
    }
    this.busy = false;
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
    const button = el('button', 'btn', label);
    button.addEventListener('click', () => {
      if (this.busy) return;
      this.busy = true;
      this.ui.dom.picker.replaceChildren();
      if (this.mode === 'penalties') {
        const { reshuffled } = this.game.nextDuel();
        if (reshuffled) this.ui.say(getLine('reshuffle'));
      } else {
        this.game.nextRound();
        this.ui.say(getIdleChatter());
      }
      this.busy = false;
      if (this.game.isOver) this.showGameOver();
      else this.beginRound();
    }, { once: true });
    this.ui.dom.picker.replaceChildren(button);
  }

  showGameOver() {
    this.busy = true;
    const result = this.game.result();
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
    panel.querySelector('#menu-btn').addEventListener('click', () => this.showTitleScreen(), { once: true });
    this.ui.showOverlay(panel);
  }
}

const { players, source, meta } = await loadPlayers();
new Session(players, source, meta);
