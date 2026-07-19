import assert from 'node:assert/strict';

import { AI, Game, HUMAN } from '../js/engine.js';
import { PenaltyGame } from '../js/penalties.js';
import { normaliseCard } from '../js/data/players.js';

const card = index => normaliseCard({
  id: `alternating-${index}`,
  name: `Váltó Játékos ${index}`,
  club: index % 2 ? 'Hazai FC' : 'Vendég FC',
  birthDate: `2000-01-${String(1 + (index % 27)).padStart(2, '0')}`,
  stats: {
    age: 26,
    appearances: 10,
    starts: 7,
    goals: 0,
    squads: 12,
    overallScore: 50,
    yellowCards: 0,
    redCards: 0,
    secondYellowRedCards: null,
    totalDismissals: 0,
  },
});

const players = Array.from({ length: 30 }, (_, index) => card(index));
const fixedRng = () => 0.999999;

const play = (game, chooser, chooserGoals, responderGoals) => {
  const responder = chooser === HUMAN ? AI : HUMAN;
  const chooserCard = game.hands[chooser][0];
  const responderCard = game.hands[responder][0];
  chooserCard.stats.goals = chooserGoals;
  responderCard.stats.goals = responderGoals;
  game.chooseAttribute('goals', chooserCard.id);
  return game.playCard(responder, responderCard.id);
};

// Classic mode: the chooser changes every playable round, independent of the result.
{
  const game = new Game({ players: players.map(item => structuredClone(item)), rng: fixedRng });
  game.chooser = HUMAN;

  const first = play(game, HUMAN, 4, 1);
  assert.equal(first.winner, HUMAN);
  assert.equal(game.chooser, HUMAN);
  game.nextRound();
  assert.equal(game.chooser, AI);

  const second = play(game, AI, 2, 2);
  assert.equal(second.winner, 'tie');
  assert.equal(game.chooser, AI);
  game.nextRound();
  assert.equal(game.chooser, HUMAN);
}

// Penalties mode follows the same strict alternation.
{
  const game = new PenaltyGame({ players: players.map(item => structuredClone(item)), rng: fixedRng });
  game.chooser = HUMAN;

  play(game, HUMAN, 3, 1);
  game.nextDuel();
  assert.equal(game.chooser, AI);

  play(game, AI, 1, 1);
  game.nextDuel();
  assert.equal(game.chooser, HUMAN);
}

console.log('✓ A kategóriaválasztás mindkét módban felváltva történik');
