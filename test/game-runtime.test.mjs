import assert from 'node:assert/strict';
import fs from 'node:fs';

import { AI, HUMAN, PHASE } from '../js/engine.js';
import { GAME_MODE, GameRuntime, GameRuntimeError } from '../js/game/game-runtime.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../js/game/game-runtime.js', import.meta.url), 'utf8');
const normalized = readJson('../data/databases/hungary-nb1-2025-26/players.normalized.json');
const players = normalized.players;

assert.equal(players.length, 440);
assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|HTMLElement|querySelector|innerHTML|\.render[A-Z]|from ['"]\.\.\/ui\.js/);

const deterministicAiFactory = () => ({
  chooseAttribute(hand, keys) {
    const attribute = keys[0];
    const card = hand.find(candidate => candidate.stats?.[attribute] != null || candidate[attribute] != null)
      ?? hand[0];
    return { attribute, cardId: card.id };
  },
  chooseCard(hand, attribute) {
    return (hand.find(card => card.stats?.[attribute] != null || card[attribute] != null) ?? hand[0]).id;
  },
});

const runtime = new GameRuntime({ players, rng: () => 0, aiFactory: deterministicAiFactory });
let state = runtime.start(GAME_MODE.CLASSIC, 'medium');
assert.equal(state.mode, GAME_MODE.CLASSIC);
assert.equal(state.chooser, HUMAN);
assert.equal(state.phase, PHASE.CHOOSE_ATTRIBUTE);
assert.equal(runtime.game.mode, 'classic');

const humanAttribute = runtime.availableAttributeKeys()[0];
runtime.selectHumanAttribute(humanAttribute);
assert.equal(runtime.pendingAttribute, humanAttribute);
assert.equal(runtime.awaitingChooserCard, true);
const humanChooserCard = runtime.game.availableCards(HUMAN, humanAttribute)[0];
runtime.commitHumanChooserCard(humanChooserCard.id);
assert.equal(runtime.game.phase, PHASE.CHOOSE_CARD);
assert.equal(runtime.awaitingChooserCard, false);
const firstResult = runtime.playAiCard();
assert.equal(firstResult.round, 1);
assert.equal(runtime.game.phase, PHASE.REVEAL);

runtime.advance();
assert.equal(runtime.game.round, 2);
assert.equal(runtime.game.chooser, AI);
const aiChoice = runtime.chooseAiAttribute();
assert.ok(runtime.availableAttributeKeys || aiChoice.attribute);
assert.equal(runtime.game.phase, PHASE.CHOOSE_CARD);
const humanResponse = runtime.game.availableCards(HUMAN, runtime.game.attribute)[0];
const secondResult = runtime.playHumanCard(humanResponse.id);
assert.equal(secondResult.round, 2);
assert.equal(runtime.game.phase, PHASE.REVEAL);

const saved = JSON.parse(JSON.stringify(runtime.toSavePayload({ roundsViewed: 2 })));
const restored = new GameRuntime({ players, rng: () => 0, aiFactory: deterministicAiFactory });
restored.restore(saved, (target, snapshot) => Object.assign(target, snapshot));
assert.equal(restored.mode, GAME_MODE.CLASSIC);
assert.equal(restored.game.round, runtime.game.round);
assert.deepEqual(restored.toSavePayload({ roundsViewed: 2 }).uxStats, { roundsViewed: 2 });

const penalty = new GameRuntime({ players, rng: () => 0, aiFactory: deterministicAiFactory });
state = penalty.start(GAME_MODE.PENALTIES, 'easy');
assert.equal(state.mode, GAME_MODE.PENALTIES);
assert.equal(penalty.game.teams[HUMAN].length, 11);
assert.equal(penalty.game.teams[AI].length, 11);
const penaltyAttribute = penalty.availableAttributeKeys()[0];
penalty.selectHumanAttribute(penaltyAttribute);
penalty.commitHumanChooserCard(penalty.game.availableCards(HUMAN, penaltyAttribute)[0].id);
const penaltyResult = penalty.playAiCard();
assert.equal(penaltyResult.round, 1);
if (!penalty.game.isOver) {
  const advanced = penalty.advance();
  assert.equal(typeof advanced.reshuffled, 'boolean');
}

runtime.reset();
assert.equal(runtime.game, null);
assert.throws(() => runtime.playHumanCard('missing'), error => (
  error instanceof GameRuntimeError && error.code === 'NO_ACTIVE_GAME'
));

console.log('✓ DOM-mentes GameRuntime: Klasszikus, Büntetőpárbaj, AI-lépések, mentés és visszaállítás rendben');
