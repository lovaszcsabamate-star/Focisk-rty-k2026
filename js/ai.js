/** Lightweight opponent AI with safe handling for optional statistics. */

import { ATTRIBUTES, ATTRIBUTE_BY_KEY, attributeValue, hasAttributeData } from './data/players.js';
import { HUMAN, AI } from './engine.js';

export function buildDistribution(deck) {
  return Object.fromEntries(ATTRIBUTES.map(attribute => [
    attribute.key,
    deck
      .map(card => attributeValue(card, attribute.key))
      .filter(value => value != null)
      .sort((a, b) => a - b),
  ]));
}

export function strength(card, attributeKey, distribution) {
  const attribute = ATTRIBUTE_BY_KEY[attributeKey];
  const values = distribution[attributeKey] ?? [];
  const value = attributeValue(card, attributeKey);
  if (!attribute || value == null || values.length === 0) return Number.NEGATIVE_INFINITY;

  let below = 0;
  let equal = 0;
  for (const other of values) {
    if (other < value) below += 1;
    else if (other === value) equal += 1;
  }
  const percentile = (below + equal / 2) / values.length;
  return attribute.higherWins ? percentile : 1 - percentile;
}

export const DIFFICULTY = {
  pub: { noise: 0.35, sacrificeBelow: 0.30, label: 'Kicsit spicces' },
  regular: { noise: 0.15, sacrificeBelow: 0.40, label: 'Törzsvendég' },
  shark: { noise: 0.02, sacrificeBelow: 0.45, label: 'Kocsmai cápa' },
};

export class OpponentAI {
  constructor(difficulty = 'regular', deck) {
    if (!Array.isArray(deck) || deck.length === 0) throw new Error('A gépnek szüksége van a játékoskeretre.');
    this.settings = DIFFICULTY[difficulty] ?? DIFFICULTY.regular;
    this.distribution = buildDistribution(deck);
  }

  strength(card, attributeKey) { return strength(card, attributeKey, this.distribution); }
  _jitter() { return (Math.random() - 0.5) * 2 * this.settings.noise; }

  chooseAttribute(hand, allowedKeys = ATTRIBUTES.map(attribute => attribute.key)) {
    let best = null;
    for (const card of hand) {
      for (const key of allowedKeys) {
        if (!hasAttributeData(card, key)) continue;
        const score = this.strength(card, key) + this._jitter();
        if (!best || score > best.score) best = { score, attribute: key, cardId: card.id };
      }
    }
    if (!best) throw new Error('A gép nem talált összehasonlítható kártyát.');
    return { attribute: best.attribute, cardId: best.cardId };
  }

  chooseCard(hand, attributeKey) {
    const eligible = hand.filter(card => hasAttributeData(card, attributeKey));
    if (eligible.length === 0) throw new Error('A gépnek nincs adatot tartalmazó kártyája ehhez a kategóriához.');

    const ranked = eligible
      .map(card => ({ card, score: this.strength(card, attributeKey) + this._jitter() }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0].score >= this.settings.sacrificeBelow) return ranked[0].card.id;

    const potential = card => {
      const scores = ATTRIBUTES
        .filter(attribute => hasAttributeData(card, attribute.key))
        .map(attribute => this.strength(card, attribute.key));
      return scores.length ? Math.max(...scores) : Number.NEGATIVE_INFINITY;
    };
    return eligible.slice().sort((a, b) => potential(a) - potential(b))[0].id;
  }
}

export { HUMAN, AI };
