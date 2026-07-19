/** Pure rules for the classic game loop. */

import { ATTRIBUTE_BY_KEY, ATTRIBUTES, attributeValue, hasAttributeData } from './data/players.js';

export const HAND_SIZE = 5;
export const GAME_DECK_SIZE = 52;
export const HUMAN = 'human';
export const AI = 'ai';

export const PHASE = {
  CHOOSE_ATTRIBUTE: 'choose-attribute',
  CHOOSE_CARD: 'choose-card',
  REVEAL: 'reveal',
  GAME_OVER: 'game-over',
};

/** Fisher–Yates, optionally seeded for deterministic tests. */
export function shuffle(array, rng = Math.random) {
  const out = array.slice();
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [out[index], out[other]] = [out[other], out[index]];
  }
  return out;
}

/** Compare two verified values. Later birth date means younger. */
export function compare(attributeKey, humanCard, aiCard) {
  const attribute = ATTRIBUTE_BY_KEY[attributeKey];
  if (!attribute) throw new Error(`Ismeretlen kategória: ${attributeKey}`);

  const humanValue = attributeValue(humanCard, attributeKey);
  const aiValue = attributeValue(aiCard, attributeKey);
  if (humanValue == null || aiValue == null) {
    throw new Error(`A(z) ${attribute.label} kategóriához mindkét kártyán hiteles adat szükséges.`);
  }
  if (humanValue === aiValue) return 'tie';

  const humanAhead = attribute.higherWins ? humanValue > aiValue : humanValue < aiValue;
  return humanAhead ? HUMAN : AI;
}

export class Game {
  constructor({ rng = Math.random, players } = {}) {
    if (!Array.isArray(players) || players.length < 2 * HAND_SIZE) {
      throw new Error(`A klasszikus módhoz legalább ${2 * HAND_SIZE} játékos kell.`);
    }

    this.mode = 'classic';
    this.rng = rng;
    let deckSize = Math.min(GAME_DECK_SIZE, players.length);
    if (deckSize % 2) deckSize -= 1;
    this.players = shuffle(players, rng).slice(0, deckSize);
    this.poolSize = players.length;
    this.deck = this.players.slice();
    this.hands = { [HUMAN]: [], [AI]: [] };
    this.won = { [HUMAN]: [], [AI]: [] };
    this.pot = [];
    this.round = 0;
    this.chooser = rng() < 0.5 ? HUMAN : AI;
    this.phase = PHASE.CHOOSE_ATTRIBUTE;
    this.attribute = null;
    this.played = { [HUMAN]: null, [AI]: null };
    this.lastResult = null;
    this.log = [];
    this._refillHands();
    this.round = 1;
  }

  get scores() {
    return { [HUMAN]: this.won[HUMAN].length, [AI]: this.won[AI].length };
  }

  get isOver() { return this.phase === PHASE.GAME_OVER; }

  availableCards(side, attributeKey = this.attribute) {
    if (!attributeKey) return this.hands[side].slice();
    return this.hands[side].filter(card => hasAttributeData(card, attributeKey));
  }

  availableAttributeKeys() {
    return ATTRIBUTES
      .filter(attribute => [HUMAN, AI].every(side => this.availableCards(side, attribute.key).length > 0))
      .map(attribute => attribute.key);
  }

  chooseAttribute(attributeKey, chooserCardId) {
    if (this.phase !== PHASE.CHOOSE_ATTRIBUTE) throw new Error(`Nem választható kategória ebben a fázisban: ${this.phase}`);
    if (!this.availableAttributeKeys().includes(attributeKey)) throw new Error(`A kategória most nem játszható: ${attributeKey}`);
    this.attribute = attributeKey;
    this._commit(this.chooser, chooserCardId);
    this.phase = PHASE.CHOOSE_CARD;
    return this;
  }

  playCard(side, cardId) {
    if (this.phase !== PHASE.CHOOSE_CARD) throw new Error(`Nem játszható ki kártya ebben a fázisban: ${this.phase}`);
    if (side === this.chooser) throw new Error('A kategóriaválasztó már kijátszotta a kártyáját.');
    this._commit(side, cardId);
    return this._resolve();
  }

  _commit(side, cardId) {
    const hand = this.hands[side];
    const index = hand.findIndex(card => card.id === cardId);
    if (index === -1) throw new Error(`A kártya nincs a kézben: ${cardId}`);
    if (!hasAttributeData(hand[index], this.attribute)) throw new Error('Ehhez a kártyához nincs adat a kiválasztott kategóriában.');
    this.played[side] = hand.splice(index, 1)[0];
  }

  _resolve() {
    const humanCard = this.played[HUMAN];
    const aiCard = this.played[AI];
    const winner = compare(this.attribute, humanCard, aiCard);
    const stake = [humanCard, aiCard, ...this.pot];

    if (winner === 'tie') {
      this.pot = stake;
    } else {
      this.won[winner].push(...stake);
      this.pot = [];
    }

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

  nextRound() {
    if (this.phase !== PHASE.REVEAL) throw new Error(`Nem indítható új kör ebben a fázisban: ${this.phase}`);
    this.played = { [HUMAN]: null, [AI]: null };
    this.attribute = null;
    this._refillHands();
    if (this.hands[HUMAN].length === 0 || this.hands[AI].length === 0) {
      this.phase = PHASE.GAME_OVER;
      return this;
    }
    this.chooser = this.chooser === HUMAN ? AI : HUMAN;
    this.round += 1;
    this.phase = PHASE.CHOOSE_ATTRIBUTE;
    return this;
  }

  _refillHands() {
    while (this.deck.length > 0 && (this.hands[HUMAN].length < HAND_SIZE || this.hands[AI].length < HAND_SIZE)) {
      for (const side of [HUMAN, AI]) {
        if (this.hands[side].length < HAND_SIZE && this.deck.length > 0) this.hands[side].push(this.deck.pop());
      }
    }
  }

  result() {
    const { [HUMAN]: human, [AI]: ai } = this.scores;
    return {
      human, ai,
      winner: human === ai ? 'tie' : (human > ai ? HUMAN : AI),
      undecided: this.pot.length,
    };
  }
}
