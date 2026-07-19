/**
 * Game rules. Pure logic — no DOM, no rendering, no timers.
 * The UI observes state and calls the transition methods.
 */

import { ATTRIBUTE_BY_KEY } from './data/players.js';

export const HAND_SIZE = 5;
export const HUMAN = 'human';
export const AI = 'ai';

export const PHASE = {
  CHOOSE_ATTRIBUTE: 'choose-attribute', // someone must name the stat
  CHOOSE_CARD:      'choose-card',      // attribute is locked, human must play
  REVEAL:           'reveal',           // both cards face up, result known
  GAME_OVER:        'game-over',
};

/** Fisher–Yates, optionally seeded so a bug can be reproduced. */
export function shuffle(array, rng = Math.random) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Compare two cards on one attribute.
 * @returns {'human'|'ai'|'tie'}
 */
export function compare(attributeKey, humanCard, aiCard) {
  const attr = ATTRIBUTE_BY_KEY[attributeKey];
  if (!attr) throw new Error(`Unknown attribute: ${attributeKey}`);

  const a = humanCard.stats[attributeKey];
  const b = aiCard.stats[attributeKey];
  if (a === b) return 'tie';

  const humanAhead = attr.higherWins ? a > b : a < b;
  return humanAhead ? HUMAN : AI;
}

export class Game {
  /**
   * @param {object}   opts
   * @param {object[]} opts.players  the deck to play with — real or mock.
   *                                 Required: the engine has no built-in deck,
   *                                 so it can never silently fall back to one.
   */
  constructor({ rng = Math.random, players } = {}) {
    if (!Array.isArray(players) || players.length < 2 * HAND_SIZE) {
      throw new Error(`Game needs a deck of at least ${2 * HAND_SIZE} players, got ${players?.length ?? 0}.`);
    }
    this.rng = rng;
    this.deck = shuffle(players, rng);

    this.hands = { [HUMAN]: [], [AI]: [] };
    this.won   = { [HUMAN]: [], [AI]: [] };   // victory-point piles

    /** Cards from tied rounds, scooped by whoever wins next. */
    this.pot = [];

    this.round = 0;
    this.chooser = rng() < 0.5 ? HUMAN : AI;   // who names the attribute
    this.phase = PHASE.CHOOSE_ATTRIBUTE;

    this.attribute = null;
    this.played = { [HUMAN]: null, [AI]: null };
    this.lastResult = null;
    this.log = [];

    this._refillHands();
    this.round = 1;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  get scores() {
    return { [HUMAN]: this.won[HUMAN].length, [AI]: this.won[AI].length };
  }

  get isOver() {
    return this.phase === PHASE.GAME_OVER;
  }

  /** True once neither side can field a card. */
  _handsExhausted() {
    return this.hands[HUMAN].length === 0 || this.hands[AI].length === 0;
  }

  // ── Transitions ───────────────────────────────────────────────────────────

  /**
   * Lock in the attribute for this round. The chooser also commits their own
   * card at this moment, so neither side ever picks while seeing the other's.
   * @param {string} attributeKey
   * @param {string} chooserCardId  card the chooser commits
   */
  chooseAttribute(attributeKey, chooserCardId) {
    if (this.phase !== PHASE.CHOOSE_ATTRIBUTE) {
      throw new Error(`chooseAttribute called during phase ${this.phase}`);
    }
    if (!ATTRIBUTE_BY_KEY[attributeKey]) {
      throw new Error(`Unknown attribute: ${attributeKey}`);
    }

    this.attribute = attributeKey;
    this._commit(this.chooser, chooserCardId);
    this.phase = PHASE.CHOOSE_CARD;
    return this;
  }

  /** The responder plays their card; the round resolves immediately. */
  playCard(side, cardId) {
    if (this.phase !== PHASE.CHOOSE_CARD) {
      throw new Error(`playCard called during phase ${this.phase}`);
    }
    if (side === this.chooser) {
      throw new Error('The chooser already committed a card this round.');
    }

    this._commit(side, cardId);
    return this._resolve();
  }

  /** Move a card from a hand onto the table. */
  _commit(side, cardId) {
    const hand = this.hands[side];
    const index = hand.findIndex(c => c.id === cardId);
    if (index === -1) throw new Error(`Card ${cardId} is not in ${side}'s hand.`);
    this.played[side] = hand.splice(index, 1)[0];
  }

  _resolve() {
    const humanCard = this.played[HUMAN];
    const aiCard = this.played[AI];
    const winner = compare(this.attribute, humanCard, aiCard);

    const stake = [humanCard, aiCard, ...this.pot];

    if (winner === 'tie') {
      // Nobody scores; the cards stay on the table as a pot.
      this.pot = stake;
    } else {
      this.won[winner].push(...stake);
      this.pot = [];
      this.chooser = winner;   // winner names the next attribute
    }

    // NOTE: `played[]` is deliberately NOT cleared here — the cards have moved
    // into the won/pot piles, but the UI still needs to render them face-up
    // during REVEAL. Anything counting cards must therefore ignore `played[]`
    // outside the CHOOSE_CARD phase, or it will double-count. nextRound() clears it.
    this.lastResult = {
      round: this.round,
      attribute: this.attribute,
      humanCard,
      aiCard,
      winner,
      potScooped: winner === 'tie' ? 0 : stake.length - 2,
      potSize: this.pot.length,
    };
    this.log.push(this.lastResult);
    this.phase = PHASE.REVEAL;
    return this.lastResult;
  }

  /** Clear the table, refill hands, and start the next round (or end the game). */
  nextRound() {
    if (this.phase !== PHASE.REVEAL) {
      throw new Error(`nextRound called during phase ${this.phase}`);
    }

    this.played = { [HUMAN]: null, [AI]: null };
    this.attribute = null;
    this._refillHands();

    if (this._handsExhausted()) {
      this.phase = PHASE.GAME_OVER;
      return this;
    }

    this.round += 1;
    this.phase = PHASE.CHOOSE_ATTRIBUTE;
    return this;
  }

  /** Top both hands back up to HAND_SIZE from the shared deck. */
  _refillHands() {
    // Deal alternately so a short deck is split fairly rather than
    // filling one hand completely and starving the other.
    while (this.deck.length > 0 &&
           (this.hands[HUMAN].length < HAND_SIZE || this.hands[AI].length < HAND_SIZE)) {
      for (const side of [HUMAN, AI]) {
        if (this.hands[side].length < HAND_SIZE && this.deck.length > 0) {
          this.hands[side].push(this.deck.pop());
        }
      }
    }
  }

  /** Final standings, valid once the game is over. */
  result() {
    const { [HUMAN]: h, [AI]: a } = this.scores;
    return {
      human: h,
      ai: a,
      winner: h === a ? 'tie' : (h > a ? HUMAN : AI),
      undecided: this.pot.length,
    };
  }
}
