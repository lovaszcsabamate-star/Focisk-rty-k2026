/**
 * Wiring: drives the game loop, sequences the AI's "thinking" pauses, and
 * feeds the banter panel.
 */

import { Game, PHASE, HUMAN, AI } from './engine.js';
import { OpponentAI, DIFFICULTY } from './ai.js';
import { UI, el } from './ui.js';
import { getLine, getIdleChatter } from './banter.js';
import { ATTRIBUTE_BY_KEY, loadPlayers } from './data/players.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

class Session {
  /**
   * @param {object[]} deck    cards to play with
   * @param {string}   source  'real' | 'mock' — shown on the title screen so
   *                           it's never ambiguous which data you're looking at
   * @param {object}   meta    pipeline metadata (season, build date), if any
   */
  constructor(deck, source, meta) {
    this.deck = deck;
    this.source = source;
    this.meta = meta;
    this.ui = new UI({
      onAttribute: key => this.humanChoseAttribute(key),
      onCard: card => this.humanPlayedCard(card),
    });
    this.busy = false;          // guards against double-clicks mid-animation
    this.showTitleScreen();
  }

  // ── Screens ──────────────────────────────────────────────────────────────

  showTitleScreen() {
    const panel = el('div');
    panel.innerHTML = `
      <h1>Super Mega Fotbal 2026</h1>
      <p>Thursday night. Back table. Barry reckons he's unbeatable.</p>
      <div class="rules">
        <b>How it goes:</b> 52 players, one shared deck, five in your hand.<br>
        Each round someone names an attribute — the winner of the last round
        picks the next one. Both play a card blind; best value takes
        <b>both cards</b> as points.<br>
        <b>Red and yellow cards are won by having fewer.</b><br>
        A dead heat leaves the cards on the table — the next winner scoops the lot.
      </div>
      <div class="difficulty">
        ${Object.entries(DIFFICULTY).map(([key, d], i) => `
          <label>
            <input type="radio" name="difficulty" value="${key}" ${i === 1 ? 'checked' : ''}>
            <span>${d.label}</span>
          </label>`).join('')}
      </div>
      <button class="btn" id="start-btn">Deal them out</button>
      <div class="deck-source">${this._deckLabel()}</div>
    `;
    panel.querySelector('#start-btn').addEventListener('click', () => {
      const difficulty = panel.querySelector('input[name=difficulty]:checked').value;
      this.start(difficulty);
    });
    this.ui.showOverlay(panel);
  }

  /**
   * Never let the player wonder whether they're looking at real numbers.
   * Real data says which season it is; the mock says plainly that it's made up.
   */
  _deckLabel() {
    if (this.source === 'real') {
      const season = this.meta?.season ? ` · ${this.meta.season}` : '';
      const built = this.meta?.generatedAt ? ` · built ${this.meta.generatedAt.slice(0, 10)}` : '';
      return `Real player data${season}${built}`;
    }
    return `Fictional demo deck — run <code>node pipeline/build.mjs</code> for real players`;
  }

  showGameOver() {
    const { human, ai, winner, undecided } = this.game.result();

    const heading = winner === HUMAN ? 'You win' : winner === AI ? 'Barry wins' : 'Honours even';
    const event = winner === HUMAN ? 'gameOverWin' : winner === AI ? 'gameOverLose' : 'gameOverTie';
    this.ui.say(getLine(event));

    const panel = el('div');
    panel.innerHTML = `
      <h1>${heading}</h1>
      <p>Final tally — <b>You ${human}</b> · <b>Barry ${ai}</b>
         ${undecided ? `<br><small>${undecided} card(s) left unclaimed in the pot.</small>` : ''}</p>
      <button class="btn" id="again-btn">Another round</button>
    `;
    panel.querySelector('#again-btn').addEventListener('click', () => {
      this.ui.dom.feed.replaceChildren();
      this.start(this.difficulty);
    });
    this.ui.showOverlay(panel);
  }

  // ── Game loop ────────────────────────────────────────────────────────────

  start(difficulty) {
    this.difficulty = difficulty;
    this.game = new Game({ players: this.deck });
    this.ai = new OpponentAI(difficulty, this.deck);
    this.ui.hideOverlay();
    this.ui.say(getLine('gameStart'));
    this.beginRound();
  }

  beginRound() {
    const game = this.game;
    this.ui.closeInspector();   // never leave a stale card open across rounds
    this.ui.renderScores(game);
    this.ui.dom.duel.replaceChildren();
    this.ui.dom.verdict.textContent = '';

    if (game.chooser === HUMAN) {
      // Not playable yet — but the hand stays inspectable, because reading the
      // stats is exactly how you decide which attribute to call.
      this.ui.renderHands(game, { selectable: false });
      this.ui.showAttributePicker(game);
    } else {
      this.aiChoosesAttribute();
    }
  }

  /** Human named the attribute — they must now also commit a card. */
  humanChoseAttribute(attributeKey) {
    if (this.busy) return;
    this.pendingAttribute = attributeKey;
    this.ui.hideAttributePicker();

    this.ui.say(getLine('youChooseAttribute', { attributeKey }));

    // The human is the chooser, so they pick their card first and the AI
    // responds — but the AI must not see the card, so it picks from hand only.
    // The attribute isn't committed to the game state until the card is chosen,
    // so it's passed to the view purely to drive the highlight.
    this.ui.setPrompt('Now pick your card —', ATTRIBUTE_BY_KEY[attributeKey].label);
    this.ui.renderHands(this.game, { selectable: true, inspectAttribute: attributeKey });
    this.awaitingChooserCard = true;
  }

  async aiChoosesAttribute() {
    this.busy = true;
    this.ui.renderHands(this.game, { selectable: false });
    this.ui.setPrompt('Barry is thinking…');
    await wait(800);

    const { attribute, cardId } = this.ai.chooseAttribute(this.game.hands[AI]);
    this.game.chooseAttribute(attribute, cardId);

    const label = ATTRIBUTE_BY_KEY[attribute].label;
    this.ui.say(getLine('aiChooseAttribute', { attr: label, attributeKey: attribute }));
    this.ui.setPrompt('Barry calls', label);

    this.ui.showDuel(this.game, { opponentHidden: true });
    this.ui.renderHands(this.game, { selectable: true });
    this.busy = false;
    this.awaitingChooserCard = false;
  }

  async humanPlayedCard(card) {
    if (this.busy) return;
    this.busy = true;

    let result;
    if (this.awaitingChooserCard) {
      // Human chose the attribute and is committing first; AI responds blind.
      this.game.chooseAttribute(this.pendingAttribute, card.id);
      this.awaitingChooserCard = false;

      this.ui.showDuel(this.game, { opponentHidden: true });
      this.ui.renderHands(this.game, { selectable: false });
      this.ui.setPrompt('Barry is picking…');
      await wait(750);

      const aiCardId = this.ai.chooseCard(this.game.hands[AI], this.game.attribute);
      result = this.game.playCard(AI, aiCardId);
    } else {
      // AI chose the attribute and already committed; human responds.
      result = this.game.playCard(HUMAN, card.id);
      this.ui.renderHands(this.game, { selectable: false });
      await wait(350);
    }

    await this.revealAndScore(result);
  }

  async revealAndScore(result) {
    this.ui.showDuel(this.game, { result });
    this.ui.setPrompt('');
    await wait(450);

    this.ui.showVerdict(result, this.game);
    this.ui.renderScores(this.game);
    this.sayResultBanter(result);

    await wait(1500);
    this.busy = false;
    this.showContinue();
  }

  sayResultBanter(result) {
    const attr = ATTRIBUTE_BY_KEY[result.attribute];
    const context = {
      card: result.humanCard.name,
      stat: attr.label,
      attributeKey: result.attribute,
    };

    if (result.winner === 'tie') {
      this.ui.say(getLine('tie', context));
      return;
    }

    const mine = result.humanCard.stats[result.attribute];
    const theirs = result.aiCard.stats[result.attribute];
    const spread = Math.abs(mine - theirs) / Math.max(Math.abs(mine), Math.abs(theirs), 1);

    if (result.winner === HUMAN) {
      this.ui.say(getLine(spread > 0.55 ? 'youWinBig' : 'youWin', context));
    } else {
      this.ui.say(getLine(spread < 0.06 ? 'youLoseClose' : 'youLose', context));
    }

    if (result.potScooped > 0) this.ui.say(getLine('potScooped', context));
  }

  showContinue() {
    const btn = el('button', 'btn', 'Next round');
    btn.addEventListener('click', () => {
      this.ui.dom.picker.replaceChildren();
      this.game.nextRound();
      this.ui.say(getIdleChatter());

      if (this.game.phase === PHASE.GAME_OVER) this.showGameOver();
      else this.beginRound();
    });
    this.ui.dom.picker.replaceChildren(btn);
  }
}

// Load the deck before anything renders: the AI's percentile model is built
// from the deck in play, so it must exist before a Session starts.
const { players, source, meta } = await loadPlayers();
new Session(players, source, meta);
