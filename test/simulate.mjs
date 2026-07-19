/**
 * Headless soak test: plays full games AI-vs-AI and asserts the invariants
 * that are painful to check by hand in the browser.
 *
 *   node test/simulate.mjs [gameCount]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Game, PHASE, HUMAN, AI } from '../js/engine.js';
import { OpponentAI } from '../js/ai.js';
import { MOCK_PLAYERS, normaliseCard, validatePlayers } from '../js/data/players.js';

const GAMES = Number(process.argv[2] ?? 2000);

// Prefer the real deck when the pipeline has produced one, so the soak test
// exercises whatever is actually shipping.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.resolve(HERE, '../data/players.json');

let PLAYERS = MOCK_PLAYERS;
let DECK_SOURCE = 'mock (fictional)';
if (fs.existsSync(REAL)) {
  const payload = JSON.parse(fs.readFileSync(REAL, 'utf8'));
  const cards = Array.isArray(payload) ? payload : payload.players;
  if (Array.isArray(cards) && cards.length >= 10) {
    PLAYERS = cards.map(normaliseCard);
    DECK_SOURCE = `data/players.json (${payload.season ?? 'real'})`;
  }
}
console.log(`Deck source: ${DECK_SOURCE}`);

let failures = 0;
const MAX_REPORTED = 10;
const fail = msg => {
  failures++;
  if (failures <= MAX_REPORTED) console.error('  ✗ ' + msg);
  else if (failures === MAX_REPORTED + 1) console.error('  … further failures suppressed');
};

// ── Static checks on the mock database ──────────────────────────────────────

const POOL_SIZE = PLAYERS.length;
const DECK_SIZE = Math.min(52, POOL_SIZE - (POOL_SIZE % 2));

console.log('Card pool:');
if (POOL_SIZE < 52) fail(`expected at least 52 players, got ${POOL_SIZE}`);
else console.log(`  ✓ ${POOL_SIZE} available players; ${DECK_SIZE} drawn per classic match`);

const ids = new Set(PLAYERS.map(p => p.id));
if (ids.size !== PLAYERS.length) fail('duplicate player ids');
else console.log('  ✓ ids unique');

const dataProblems = validatePlayers(PLAYERS);
if (dataProblems.length) fail(`invalid required player data: ${dataProblems.slice(0, 10).join('; ')}`);
else console.log('  ✓ required stats valid; optional unknowns remain explicit');

// ── Full-game simulation ────────────────────────────────────────────────────

const bots = {
  [HUMAN]: new OpponentAI('regular', PLAYERS),
  [AI]:    new OpponentAI('shark', PLAYERS),
};
const roundCounts = [];
const wins = { [HUMAN]: 0, [AI]: 0, tie: 0 };

for (let g = 0; g < GAMES; g++) {
  const game = new Game({ players: PLAYERS });
  if (game.players.length !== DECK_SIZE) {
    fail(`game ${g}: drew ${game.players.length}, expected ${DECK_SIZE}`);
    continue;
  }
  let guard = 0;

  while (!game.isOver) {
    if (++guard > 200) { fail(`game ${g} did not terminate`); break; }

    if (game.phase !== PHASE.CHOOSE_ATTRIBUTE) {
      fail(`game ${g} in unexpected phase ${game.phase}`);
      break;
    }

    // Invariants are checked at the top of the round, where every card sits in
    // exactly one pile. (During REVEAL, `played[]` deliberately still points at
    // cards already moved into the won/pot piles so the UI can show them.)
    const piles = [...game.deck, ...game.hands[HUMAN], ...game.hands[AI],
                   ...game.won[HUMAN], ...game.won[AI], ...game.pot];
    if (piles.length !== DECK_SIZE) {
      fail(`game ${g} round ${game.round}: ${piles.length} cards accounted for, expected ${DECK_SIZE}`);
      break;
    }
    if (new Set(piles.map(c => c.id)).size !== DECK_SIZE) {
      fail(`game ${g} round ${game.round}: duplicate card in play`);
      break;
    }
    if (game.hands[HUMAN].length === 0 || game.hands[AI].length === 0) {
      fail(`game ${g} round ${game.round}: a hand was empty at round start`);
      break;
    }

    // Chooser names the attribute and commits a card.
    const chooser = game.chooser;
    const responder = chooser === HUMAN ? AI : HUMAN;
    const { attribute, cardId } = bots[chooser].chooseAttribute(game.hands[chooser], game.availableAttributeKeys());
    game.chooseAttribute(attribute, cardId);

    // Responder answers.
    game.playCard(responder, bots[responder].chooseCard(game.hands[responder], attribute));

    // A resolved round must always name a winner or a tie.
    if (!['human', 'ai', 'tie'].includes(game.lastResult.winner)) {
      fail(`game ${g} round ${game.round}: bad winner ${game.lastResult.winner}`);
      break;
    }

    game.nextRound();
  }

  roundCounts.push(game.round);
  wins[game.result().winner]++;
}

// ── Report ──────────────────────────────────────────────────────────────────

const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length);

console.log(`\nSimulated ${GAMES} games:`);
console.log(`  ✓ all terminated, cards conserved, no duplicates`);
console.log(`  rounds per game: min ${Math.min(...roundCounts)}, max ${Math.max(...roundCounts)}, avg ${avg(roundCounts).toFixed(1)}`);
console.log(`  'regular' bot won ${(wins[HUMAN] / GAMES * 100).toFixed(1)}% · ` +
            `'shark' bot won ${(wins[AI] / GAMES * 100).toFixed(1)}% · ` +
            `drawn ${(wins.tie / GAMES * 100).toFixed(1)}%`);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
