/**
 * Opponent AI. Deliberately simple and readable — a percentile model plus a
 * sacrifice heuristic. Easy to swap for something smarter later.
 */

import { ATTRIBUTES } from './data/players.js';
import { HUMAN, AI } from './engine.js';

/**
 * Sorted values per attribute across the deck in play, so a raw stat can be
 * converted into "how good is this, really" on a common 0..1 scale.
 *
 * Built from the actual deck rather than a hardcoded one: real player data has
 * completely different ranges from the mock (a real season's minutes and
 * market values are nothing like the invented ones), and a stale distribution
 * would make the AI misjudge every card.
 */
export function buildDistribution(deck) {
  return Object.fromEntries(
    ATTRIBUTES.map(attr => [attr.key, deck.map(p => p.stats[attr.key]).sort((a, b) => a - b)])
  );
}

/**
 * Strength of a card on one attribute: 0 = worst in deck, 1 = best in deck.
 * Handles the lower-is-better attributes by flipping the scale.
 */
export function strength(card, attributeKey, distribution) {
  const attr = ATTRIBUTES.find(a => a.key === attributeKey);
  const values = distribution[attributeKey];
  const value = card.stats[attributeKey];

  // Fraction of the deck this card beats, counting ties as half.
  let below = 0, equal = 0;
  for (const v of values) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  const percentile = (below + equal / 2) / values.length;
  return attr.higherWins ? percentile : 1 - percentile;
}

export const DIFFICULTY = {
  pub:     { noise: 0.35, sacrificeBelow: 0.30, label: 'Had a few' },
  regular: { noise: 0.15, sacrificeBelow: 0.40, label: 'Regular' },
  shark:   { noise: 0.02, sacrificeBelow: 0.45, label: 'Card shark' },
};

export class OpponentAI {
  /**
   * @param {string}   difficulty
   * @param {object[]} deck  the full deck in play — the AI judges cards by
   *                         percentile within it.
   */
  constructor(difficulty = 'regular', deck) {
    if (!Array.isArray(deck) || deck.length === 0) {
      throw new Error('OpponentAI needs the deck it is playing with.');
    }
    this.settings = DIFFICULTY[difficulty] ?? DIFFICULTY.regular;
    this.distribution = buildDistribution(deck);
  }

  /** Percentile strength of a card on an attribute, within this deck. */
  strength(card, attributeKey) {
    return strength(card, attributeKey, this.distribution);
  }

  /** Small random wobble so the AI is beatable and not perfectly predictable. */
  _jitter() {
    return (Math.random() - 0.5) * 2 * this.settings.noise;
  }

  /**
   * AI is the chooser: find its single strongest (card, attribute) pairing.
   * @returns {{attribute: string, cardId: string}}
   */
  chooseAttribute(hand) {
    let best = null;

    for (const card of hand) {
      for (const attr of ATTRIBUTES) {
        const score = this.strength(card, attr.key) + this._jitter();
        if (!best || score > best.score) {
          best = { score, attribute: attr.key, cardId: card.id };
        }
      }
    }
    return { attribute: best.attribute, cardId: best.cardId };
  }

  /**
   * AI is responding to a chosen attribute.
   *
   * If its best card on this attribute is still weak, the round is probably
   * lost — so it throws away its least useful card instead of burning a good
   * one. "Least useful" = lowest peak strength across all attributes.
   */
  chooseCard(hand, attributeKey) {
    const ranked = hand
      .map(card => ({ card, score: this.strength(card, attributeKey) + this._jitter() }))
      .sort((a, b) => b.score - a.score);

    const bestHere = ranked[0];
    if (bestHere.score >= this.settings.sacrificeBelow) {
      return bestHere.card.id;
    }

    // Lost cause — dump the card with the lowest ceiling.
    const potential = card => Math.max(...ATTRIBUTES.map(a => this.strength(card, a.key)));
    return hand.slice().sort((a, b) => potential(a) - potential(b))[0].id;
  }

  /** Flavour: what the AI "thinks" it's doing, for the banter feed. */
  reasoning(hand, attributeKey) {
    const best = Math.max(...hand.map(c => this.strength(c, attributeKey)));
    if (best > 0.85) return 'confident';
    if (best > 0.5)  return 'neutral';
    return 'bluffing';
  }
}

export { HUMAN, AI };
