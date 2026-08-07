import assert from 'node:assert/strict';
import fs from 'node:fs';

import { AI, HUMAN, PHASE } from '../js/engine.js';
import { GAME_MODE, GameRuntime, GameRuntimeError } from '../js/game/game-runtime.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../js/game/game-runtime.js', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const menuSource = fs.readFileSync(new URL('../js/app/menu-controller.js', import.meta.url), 'utf8');
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
assert.equal(
  runtime.game.chooser,
  firstResult.winner === 'tie' ? HUMAN : firstResult.winner,
  'Klasszikus módban a kör győztese marad a kategóriaválasztó.',
);

let secondResult;
if (runtime.game.chooser === AI) {
  const aiChoice = runtime.chooseAiAttribute();
  assert.ok(runtime.availableAttributeKeys || aiChoice.attribute);
  assert.equal(runtime.game.phase, PHASE.CHOOSE_CARD);
  const humanResponse = runtime.game.availableCards(HUMAN, runtime.game.attribute)[0];
  secondResult = runtime.playHumanCard(humanResponse.id);
} else {
  const secondAttribute = runtime.availableAttributeKeys()[0];
  runtime.selectHumanAttribute(secondAttribute);
  const secondChooserCard = runtime.game.availableCards(HUMAN, secondAttribute)[0];
  runtime.commitHumanChooserCard(secondChooserCard.id);
  secondResult = runtime.playAiCard();
}
assert.equal(secondResult.round, 2);
assert.equal(runtime.game.phase, PHASE.REVEAL);

const saved = JSON.parse(JSON.stringify(runtime.toSavePayload({ roundsViewed: 2 })));
const compactCard = card => card?.id ? { id: card.id } : card;
const compactCards = cards => Array.isArray(cards) ? cards.map(compactCard) : cards;
const compactSides = sides => ({
  ...sides,
  [HUMAN]: compactCards(sides?.[HUMAN]),
  [AI]: compactCards(sides?.[AI]),
});
const compactResult = result => result ? {
  ...result,
  humanCard: compactCard(result.humanCard),
  aiCard: compactCard(result.aiCard),
} : result;
saved.game = {
  ...saved.game,
  players: compactCards(saved.game.players),
  deck: compactCards(saved.game.deck),
  hands: compactSides(saved.game.hands),
  won: compactSides(saved.game.won),
  pot: compactCards(saved.game.pot),
  played: {
    ...saved.game.played,
    [HUMAN]: compactCard(saved.game.played?.[HUMAN]),
    [AI]: compactCard(saved.game.played?.[AI]),
  },
  lastResult: compactResult(saved.game.lastResult),
  log: saved.game.log.map(compactResult),
};
const restored = new GameRuntime({ players, rng: () => 0.731, aiFactory: deterministicAiFactory });
restored.restore(saved, (target, snapshot) => Object.assign(target, snapshot));
assert.equal(restored.mode, GAME_MODE.CLASSIC);
assert.equal(restored.game.round, runtime.game.round);
const assertFullCards = (cards, label) => assert.ok(
  cards.filter(Boolean).every(card => typeof card.name === 'string' && card.name.length > 0),
  `${label}: a kompakt kártyahivatkozásoknak az aktív adatbázisból teljes kártyákká kell visszaépülniük`,
);
assertFullCards(restored.game.players, 'players');
assertFullCards(restored.game.deck, 'deck');
assertFullCards(restored.game.hands[HUMAN], 'hands.human');
assertFullCards(restored.game.hands[AI], 'hands.ai');
assertFullCards(restored.game.won[HUMAN], 'won.human');
assertFullCards(restored.game.won[AI], 'won.ai');
assertFullCards(restored.game.pot, 'pot');
assertFullCards([restored.game.played[HUMAN], restored.game.played[AI]], 'played');
assertFullCards([restored.game.lastResult?.humanCard, restored.game.lastResult?.aiCard], 'lastResult');
assertFullCards(
  restored.game.log.flatMap(result => [result.humanCard, result.aiCard]),
  'log',
);
assert.deepEqual(restored.toSavePayload({ roundsViewed: 2 }).uxStats, { roundsViewed: 2 });

const missingCardSave = JSON.parse(JSON.stringify(saved));
missingCardSave.game.players[0].id = 'removed-player-card';
const incompatible = new GameRuntime({ players, rng: () => 0, aiFactory: deterministicAiFactory });
assert.throws(
  () => incompatible.restore(missingCardSave, (target, snapshot) => Object.assign(target, snapshot)),
  error => error instanceof GameRuntimeError && error.code === 'SAVE_CARD_MISSING',
  'a jelenlegi adatbázisból hiányzó kártyát tartalmazó mentés külön hibát kap',
);
assert.equal(incompatible.game, null);

const penalty = new GameRuntime({ players, rng: () => 0, aiFactory: deterministicAiFactory });
state = penalty.start(GAME_MODE.PENALTIES, 'easy');
assert.equal(state.mode, GAME_MODE.PENALTIES);
assert.equal(state.chooser, HUMAN);
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
  assert.equal(penalty.game.chooser, AI, 'Büntetőpárbajban a felek felváltva választanak.');
}

const aiStartingPenalty = new GameRuntime({ players, rng: () => 0.999, aiFactory: deterministicAiFactory });
state = aiStartingPenalty.start(GAME_MODE.PENALTIES, 'easy');
assert.equal(state.chooser, AI, 'Büntetőpárbajban a gép is kezdhet véletlenszerűen.');

const transactional = new GameRuntime({ players, rng: () => 0, aiFactory: deterministicAiFactory });
transactional.start(GAME_MODE.CLASSIC, 'medium');
const transactionalAttribute = transactional.availableAttributeKeys()[0];
transactional.selectHumanAttribute(transactionalAttribute);
const originalRuntimeState = {
  mode: transactional.mode,
  difficulty: transactional.difficulty,
  game: transactional.game,
  ai: transactional.ai,
  pendingAttribute: transactional.pendingAttribute,
  awaitingChooserCard: transactional.awaitingChooserCard,
};
transactional.aiFactory = () => { throw new Error('ai initialization failed'); };

assert.throws(
  () => transactional.start(GAME_MODE.PENALTIES, 'easy'),
  /ai initialization failed/,
  'egy sikertelen új játék nem írhatja felül a futó állapotot',
);
assert.equal(transactional.mode, originalRuntimeState.mode);
assert.equal(transactional.difficulty, originalRuntimeState.difficulty);
assert.equal(transactional.game, originalRuntimeState.game);
assert.equal(transactional.ai, originalRuntimeState.ai);
assert.equal(transactional.pendingAttribute, originalRuntimeState.pendingAttribute);
assert.equal(transactional.awaitingChooserCard, originalRuntimeState.awaitingChooserCard);

assert.throws(
  () => transactional.restore(saved, (target, snapshot) => Object.assign(target, snapshot)),
  /ai initialization failed/,
  'egy sikertelen visszaállítás nem írhatja felül a futó állapotot',
);
assert.equal(transactional.mode, originalRuntimeState.mode);
assert.equal(transactional.difficulty, originalRuntimeState.difficulty);
assert.equal(transactional.game, originalRuntimeState.game);
assert.equal(transactional.ai, originalRuntimeState.ai);
assert.equal(transactional.pendingAttribute, originalRuntimeState.pendingAttribute);
assert.equal(transactional.awaitingChooserCard, originalRuntimeState.awaitingChooserCard);

transactional.aiFactory = deterministicAiFactory;
const checkpoint = transactional.checkpoint();
transactional.start(GAME_MODE.PENALTIES, 'easy');
assert.notEqual(transactional.game, checkpoint.game);
transactional.rollback(checkpoint);
assert.equal(transactional.mode, checkpoint.mode);
assert.equal(transactional.difficulty, checkpoint.difficulty);
assert.equal(transactional.game, checkpoint.game);
assert.equal(transactional.ai, checkpoint.ai);
assert.equal(transactional.pendingAttribute, checkpoint.pendingAttribute);
assert.equal(transactional.awaitingChooserCard, checkpoint.awaitingChooserCard);

const startFlow = mainSource.match(/start\(mode, difficulty\) \{[\s\S]*?\n  \}\n\n  showPenaltyIntro/)?.[0] ?? '';
assert.match(startFlow, /const checkpoint = this\.runtime\.checkpoint\(\)/);
assert.match(startFlow, /this\.runtime\.start\(mode, resolvedDifficulty\);[\s\S]*?this\.ui\.resetTable\(\);[\s\S]*?this\.saveCurrentGame\(\)/);
assert.match(startFlow, /this\.runtime\.rollback\(checkpoint\)/);
assert.doesNotMatch(
  startFlow,
  /clearSeasonSavedMatch\(\)/,
  'az új játék nem törölheti előre a korábbi mentést; csak a kész új snapshot írhatja felül',
);
assert.ok(
  startFlow.indexOf('this.runtime.start(mode, resolvedDifficulty)') < startFlow.indexOf('this.saveCurrentGame()'),
  'az új snapshot csak a motor és a játéknézet sikeres előkészítése után írható ki',
);
assert.match(
  menuSource,
  /#replace-save-btn'\)\.addEventListener\('click', \(\) => \{\s*actions\.start\(mode, difficulty\);\s*\}, \{ once: true \}\);/,
  'a csere megerősítése nem törölheti a mentést a sikeres indítás előtt',
);

const resumeFlow = mainSource.match(/resumeSavedMatch\(\) \{[\s\S]*?\n  \}\n\n  restoreSavedView/)?.[0] ?? '';
assert.doesNotMatch(
  resumeFlow,
  /clearSeasonSavedMatch\(\)/,
  'a sérült vagy inkompatibilis mentést a visszaállítási hibaág nem törölheti automatikusan',
);
assert.match(resumeFlow, /SAVE_CARD_MISSING[\s\S]*SEASON_SAVE_STATUS\.MISSING_CARD/);
assert.match(mainSource, /launchInProgress/, 'közös indítási zárolás szükséges');
assert.match(mainSource, /setInteractionBusy\(true\)/, 'indítás közben a játéktér interakciói is zároltak');
assert.match(mainSource, /Mérkőzés előkészítése…/, 'az indítás alatt érthető állapotjelzés szükséges');
assert.match(mainSource, /Mentés törlése[\s\S]*Vissza a főmenübe/, 'a hibás mentéshez két egyértelmű felhasználói döntés szükséges');
assert.match(mainSource, /suppressPersistence/, 'a részleges UI-indítás nem írhat korai snapshotot');

runtime.reset();
assert.equal(runtime.game, null);
assert.throws(() => runtime.playHumanCard('missing'), error => (
  error instanceof GameRuntimeError && error.code === 'NO_ACTIVE_GAME'
));

console.log('✓ DOM-mentes GameRuntime: Klasszikus, Büntetőpárbaj, AI-lépések, checkpoint-rollback, kártyakompatibilitás, mentés és visszaállítás rendben');
