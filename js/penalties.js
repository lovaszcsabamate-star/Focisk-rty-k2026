/** Penalties mode state machine. It never mutates or re-draws a team mid-match. */

import { ATTRIBUTES, hasAttributeData } from './data/players.js';
import { AI, HUMAN, PHASE, compare, shuffle } from './engine.js';

export const PENALTY_TEAM_SIZE = 11;
export const REGULAR_DUELS = 5;

export class PenaltyGame {
  constructor({ players, rng = Math.random } = {}) {
    if (!Array.isArray(players) || players.length < PENALTY_TEAM_SIZE) {
      throw new Error(`A Penalties módhoz legalább ${PENALTY_TEAM_SIZE} játékos kell.`);
    }

    this.mode = 'penalties';
    this.rng = rng;
    const pool = shuffle(players, rng);
    const humanTeam = pool.slice(0, PENALTY_TEAM_SIZE);
    const aiTeam = players.length >= PENALTY_TEAM_SIZE * 2
      ? pool.slice(PENALTY_TEAM_SIZE, PENALTY_TEAM_SIZE * 2)
      : shuffle(players, rng).slice(0, PENALTY_TEAM_SIZE);

    this.teams = { [HUMAN]: humanTeam, [AI]: aiTeam };
    this.hands = { [HUMAN]: shuffle(humanTeam, rng), [AI]: shuffle(aiTeam, rng) };
    this.used = { [HUMAN]: [], [AI]: [] };
    this.scores = { [HUMAN]: 0, [AI]: 0 };
    this.attempts = { [HUMAN]: [], [AI]: [] };
    this.chooser = rng() < 0.5 ? HUMAN : AI;
    this.phase = PHASE.CHOOSE_ATTRIBUTE;
    this.attribute = null;
    this.played = { [HUMAN]: null, [AI]: null };
    this.duel = 1;
    this.cycle = 1;
    this.suddenDeath = false;
    this.lastResult = null;
    this.log = [];
    this.categoryWins = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.key, 0]));
    this.finishStage = null;
    this.finishReason = null;
  }

  get round() { return this.duel; }
  get isOver() { return this.phase === PHASE.GAME_OVER; }
  get regularPlayed() { return Math.min(this.log.length, REGULAR_DUELS); }
  get regularRemaining() { return Math.max(0, REGULAR_DUELS - this.regularPlayed); }

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
    if (index === -1) throw new Error(`A kártya nincs a tizenegyben: ${cardId}`);
    if (!hasAttributeData(hand[index], this.attribute)) throw new Error('Ehhez a kártyához nincs adat a kiválasztott kategóriában.');
    this.played[side] = hand.splice(index, 1)[0];
  }

  _resolve() {
    const winner = compare(this.attribute, this.played[HUMAN], this.played[AI]);
    if (winner !== 'tie') this.scores[winner] += 1;
    if (winner === HUMAN) this.categoryWins[this.attribute] += 1;

    const humanMark = winner === HUMAN ? 'win' : winner === AI ? 'loss' : 'tie';
    const aiMark = winner === AI ? 'win' : winner === HUMAN ? 'loss' : 'tie';
    this.attempts[HUMAN].push(humanMark);
    this.attempts[AI].push(aiMark);
    this.used[HUMAN].push(this.played[HUMAN]);
    this.used[AI].push(this.played[AI]);

    const wasSuddenDeath = this.suddenDeath;
    const remaining = Math.max(0, REGULAR_DUELS - this.duel);
    const lead = Math.abs(this.scores[HUMAN] - this.scores[AI]);
    let enteredSuddenDeath = false;

    if (!wasSuddenDeath && this.duel < REGULAR_DUELS && lead > remaining) {
      this._finish('rendes játékidő', 'behozhatatlan előny');
    } else if (!wasSuddenDeath && this.duel === REGULAR_DUELS) {
      if (this.scores[HUMAN] !== this.scores[AI]) this._finish('rendes játékidő', 'öt párbaj');
      else {
        this.suddenDeath = true;
        enteredSuddenDeath = true;
      }
    } else if (wasSuddenDeath && winner !== 'tie') {
      this._finish('hirtelen halál', 'első eldőlt hirtelen halál-párbaj');
    }

    if (!this.isOver) this.chooser = winner === 'tie' ? this.chooser : winner;
    this.lastResult = {
      round: this.duel,
      attribute: this.attribute,
      humanCard: this.played[HUMAN],
      aiCard: this.played[AI],
      winner,
      potScooped: 0,
      enteredSuddenDeath,
      suddenDeath: wasSuddenDeath,
      cycle: this.cycle,
    };
    this.log.push(this.lastResult);
    if (!this.isOver) this.phase = PHASE.REVEAL;
    return this.lastResult;
  }

  _finish(stage, reason) {
    this.finishStage = stage;
    this.finishReason = reason;
    this.phase = PHASE.GAME_OVER;
  }

  nextDuel() {
    if (this.phase !== PHASE.REVEAL) throw new Error(`Nem indítható új párbaj ebben a fázisban: ${this.phase}`);
    this.played = { [HUMAN]: null, [AI]: null };
    this.attribute = null;
    let reshuffled = false;

    if (this.hands[HUMAN].length === 0 || this.hands[AI].length === 0) {
      this.hands = {
        [HUMAN]: shuffle(this.teams[HUMAN], this.rng),
        [AI]: shuffle(this.teams[AI], this.rng),
      };
      this.used = { [HUMAN]: [], [AI]: [] };
      this.attempts = { [HUMAN]: [], [AI]: [] };
      this.cycle += 1;
      reshuffled = true;
    }

    this.duel += 1;
    this.phase = PHASE.CHOOSE_ATTRIBUTE;
    return { reshuffled, cycle: this.cycle };
  }

  result() {
    const human = this.scores[HUMAN];
    const ai = this.scores[AI];
    const bestCount = Math.max(0, ...Object.values(this.categoryWins));
    const bestCategories = bestCount === 0
      ? []
      : Object.entries(this.categoryWins).filter(([, count]) => count === bestCount).map(([key]) => key);
    return {
      human,
      ai,
      winner: human > ai ? HUMAN : AI,
      duels: this.log.length,
      stage: this.finishStage,
      reason: this.finishReason,
      bestCategories,
      bestCategoryWins: bestCount,
    };
  }
}
