import assert from 'node:assert/strict';

import { AI, HUMAN, PHASE, compare } from '../js/engine.js';
import { PenaltyGame } from '../js/penalties.js';
import {
  attributeValue, calculateAge, hasAttributeData, normaliseCard, parseBirthDate, validatePlayers,
} from '../js/data/players.js';

const card = (index, overrides = {}) => normaliseCard({
  id: `test-${index}`,
  name: `Tesztjátékos ${index}`,
  club: index % 2 ? 'A FC' : 'B FC',
  birthDate: `2000-01-${String(1 + (index % 27)).padStart(2, '0')}`,
  stats: {
    age: 26,
    appearances: 10,
    starts: 5,
    goals: 0,
    squads: 12,
    overallScore: 50,
    yellowCards: 0,
    redCards: 0,
    secondYellowRedCards: null,
    totalDismissals: 0,
    ...overrides.stats,
  },
  ...overrides,
});

const players = Array.from({ length: 30 }, (_, index) => card(index));
const fixedRng = () => 0.999999;
const newGame = () => {
  const game = new PenaltyGame({ players: players.map(item => structuredClone(item)), rng: fixedRng });
  game.chooser = HUMAN;
  return game;
};

assert.throws(
  () => new PenaltyGame({ players: players.slice(0, 10), rng: fixedRng }),
  /legalább 11 játékos/,
);

// A filtered 11-card pool remains playable by mirroring independent AI copies.
{
  const game = new PenaltyGame({ players: players.slice(0, 11).map(item => structuredClone(item)), rng: fixedRng });
  assert.equal(game.sharedPool, true);
  assert.equal(game.teams[HUMAN].length, 11);
  assert.equal(game.teams[AI].length, 11);
  assert.equal(new Set(game.teams[HUMAN].map(item => item.id)).size, 11);
  assert.equal(new Set(game.teams[AI].map(item => item.id)).size, 11);
  assert.equal(game.teams[AI].every(item => item.meta?.mirrorOf), true);
}

const duel = (game, humanGoals, aiGoals, { advance = true } = {}) => {
  const humanCard = game.hands[HUMAN][0];
  const aiCard = game.hands[AI][0];
  humanCard.stats.goals = humanGoals;
  aiCard.stats.goals = aiGoals;
  game.chooser = HUMAN;
  game.chooseAttribute('goals', humanCard.id);
  const result = game.playCard(AI, aiCard.id);
  if (advance && !game.isOver) game.nextDuel();
  return result;
};

// A full database produces two internally unique, mutually disjoint elevens.
{
  const game = newGame();
  const humanIds = game.teams[HUMAN].map(item => item.id);
  const aiIds = game.teams[AI].map(item => item.id);
  assert.equal(new Set(humanIds).size, 11);
  assert.equal(new Set(aiIds).size, 11);
  assert.equal(humanIds.some(id => aiIds.includes(id)), false);
  assert.equal(game.sharedPool, false);
}

// Exact dates decide between players who are the same whole-year age.
{
  const older = card(101, { birthDate: '2000-01-01' });
  const younger = card(102, { birthDate: '2000-12-31' });
  assert.equal(compare('birthDate', younger, older), HUMAN);
  assert.equal(compare('birthDate', older, younger), AI);
}

// Calendar validation rejects rollover dates instead of silently normalising them.
assert.equal(parseBirthDate('2026-02-29'), null);
assert.equal(parseBirthDate('2024-02-29'), Date.UTC(2024, 1, 29));
assert.equal(calculateAge('2000-12-31'), 25);

// Verified zero is playable; unknown remains unavailable and is not coerced.
{
  const zero = card(103, { stats: { totalDismissals: 0, redCards: 0, yellowCards: 0 } });
  const missing = normaliseCard({ ...card(104), stats: { ...card(104).stats, redCards: null, totalDismissals: null } });
  assert.equal(attributeValue(zero, 'totalDismissals'), 0);
  assert.equal(hasAttributeData(zero, 'totalDismissals'), true);
  assert.equal(attributeValue(missing, 'totalDismissals'), null);
  assert.equal(hasAttributeData(missing, 'totalDismissals'), false);
}

// New disciplinary categories favour the larger number.
assert.equal(compare('yellowCards', card(105, { stats: { yellowCards: 3 } }), card(106, { stats: { yellowCards: 1 } })), HUMAN);
assert.equal(compare('totalDismissals', card(107, { stats: { totalDismissals: 2 } }), card(108, { stats: { totalDismissals: 1 } })), HUMAN);

// MLSZ redCards is already a dismissal total; a detail field must not be added twice.
{
  const normalised = normaliseCard({
    ...card(109),
    stats: { ...card(109).stats, redCards: 2, secondYellowRedCards: 1, totalDismissals: null },
  });
  assert.equal(normalised.stats.totalDismissals, 2);
}

// A full-database card may have only the guaranteed goal total and remain valid.
{
  const partial = normaliseCard({
    id: 'partial', name: 'Részleges Játékos', club: 'Teszt FC', birthDate: null,
    stats: {
      age: null, appearances: null, starts: null, goals: 0, squads: null,
      yellowCards: null, redCards: null, secondYellowRedCards: null,
      totalDismissals: null, overallScore: null,
    },
  });
  assert.deepEqual(validatePlayers([partial]), []);
  assert.equal(hasAttributeData(partial, 'goals'), true);
  assert.equal(hasAttributeData(partial, 'appearances'), false);
}

// 3–0 is unreachable with only two regular duels left, so the match ends early.
{
  const game = newGame();
  duel(game, 2, 1);
  duel(game, 2, 1);
  duel(game, 2, 1, { advance: false });
  assert.equal(game.isOver, true);
  assert.deepEqual(game.scores, { [HUMAN]: 3, [AI]: 0 });
  assert.equal(game.finishReason, 'behozhatatlan előny');
  assert.throws(() => game.playCard(AI, game.teams[AI][4].id));
  assert.deepEqual(game.scores, { [HUMAN]: 3, [AI]: 0 });
}

// Five regular duels can finish 3–2.
{
  const game = newGame();
  for (const [human, ai] of [[2, 1], [1, 2], [2, 1], [1, 2]]) duel(game, human, ai);
  duel(game, 2, 1, { advance: false });
  assert.equal(game.isOver, true);
  assert.deepEqual(game.scores, { [HUMAN]: 3, [AI]: 2 });
  assert.equal(game.finishStage, 'rendes játékidő');
}

// 2–2 plus one tied duel enters sudden death.
{
  const game = newGame();
  for (const [human, ai] of [[2, 1], [1, 2], [2, 1], [1, 2]]) duel(game, human, ai);
  const fifth = duel(game, 1, 1, { advance: false });
  assert.equal(game.isOver, false);
  assert.equal(game.suddenDeath, true);
  assert.equal(fifth.enteredSuddenDeath, true);
  game.nextDuel();
  const tiedOne = duel(game, 3, 3);
  const tiedTwo = duel(game, 4, 4);
  assert.equal(tiedOne.winner, 'tie');
  assert.equal(tiedTwo.winner, 'tie');
  duel(game, 5, 4, { advance: false });
  assert.equal(game.isOver, true);
  assert.equal(game.finishStage, 'hirtelen halál');
}

// If all 11 cards tie, each original team is independently reshuffled.
{
  const game = newGame();
  const originalHuman = new Set(game.teams[HUMAN].map(item => item.id));
  const originalAi = new Set(game.teams[AI].map(item => item.id));
  for (let index = 0; index < 10; index += 1) duel(game, 1, 1);
  duel(game, 1, 1, { advance: false });
  assert.equal(game.hands[HUMAN].length, 0);
  assert.equal(game.phase, PHASE.REVEAL);
  const transition = game.nextDuel();
  assert.equal(transition.reshuffled, true);
  assert.equal(game.cycle, 2);
  assert.equal(game.hands[HUMAN].length, 11);
  assert.equal(game.hands[AI].length, 11);
  assert.deepEqual(new Set(game.hands[HUMAN].map(item => item.id)), originalHuman);
  assert.deepEqual(new Set(game.hands[AI].map(item => item.id)), originalAi);
  assert.equal(game.attempts[HUMAN].length, 0);
}

// A rematch is a fresh state with fresh scores and unused cards.
{
  const first = newGame();
  duel(first, 2, 1);
  const rematch = newGame();
  assert.deepEqual(rematch.scores, { [HUMAN]: 0, [AI]: 0 });
  assert.equal(rematch.log.length, 0);
  assert.equal(rematch.hands[HUMAN].length, 11);
  assert.equal(rematch.used[HUMAN].length, 0);
}

console.log('✓ Célzott szabály- és adatkezelési tesztek: sikeresek');
