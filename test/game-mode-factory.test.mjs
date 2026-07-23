import assert from 'node:assert/strict';
import fs from 'node:fs';

import { AI, Game, HUMAN } from '../js/engine.js';
import { PenaltyGame } from '../js/penalties.js';
import {
  GAME_MODE,
  GAME_MODE_DEFINITIONS,
  GameModeFactoryError,
  createGameModeFactory,
} from '../js/game/game-mode-factory.js';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const readJson = relative => JSON.parse(read(relative));
const players = readJson('../data/databases/hungary-nb1-2025-26/players.normalized.json').players;

assert.equal(players.length, 440);
assert.deepEqual(Object.keys(GAME_MODE_DEFINITIONS), [GAME_MODE.CLASSIC, GAME_MODE.PENALTIES]);

const factory = createGameModeFactory();
assert.deepEqual(factory.modes, [GAME_MODE.CLASSIC, GAME_MODE.PENALTIES]);
assert.equal(factory.isSupported(GAME_MODE.CLASSIC), true);
assert.equal(factory.isSupported(GAME_MODE.PENALTIES), true);
assert.equal(factory.isSupported('unknown'), false);
assert.equal(factory.normalize('unknown'), GAME_MODE.CLASSIC);
assert.equal(factory.definition(GAME_MODE.CLASSIC).id, GAME_MODE.CLASSIC);
assert.throws(() => factory.definition('unknown'), error => (
  error instanceof GameModeFactoryError && error.code === 'UNKNOWN_MODE'
));

const classic = factory.create(GAME_MODE.CLASSIC, { players, rng: () => 0 });
assert.ok(classic instanceof Game);
assert.equal(classic.mode, GAME_MODE.CLASSIC);
assert.equal(factory.aiDeck(GAME_MODE.CLASSIC, classic), classic.players);

const penalties = factory.create(GAME_MODE.PENALTIES, { players, rng: () => 0 });
assert.ok(penalties instanceof PenaltyGame);
assert.equal(penalties.mode, GAME_MODE.PENALTIES);
const penaltyAiDeck = factory.aiDeck(GAME_MODE.PENALTIES, penalties);
assert.equal(penaltyAiDeck.length, 22);
assert.deepEqual(
  penaltyAiDeck.map(card => card.id),
  [...penalties.teams[HUMAN], ...penalties.teams[AI]].map(card => card.id),
);

let compatibilityArguments = null;
const compatibilityGame = { mode: GAME_MODE.CLASSIC, players: [] };
const compatibilityFactory = createGameModeFactory({
  gameFactory: argumentsValue => {
    compatibilityArguments = argumentsValue;
    return compatibilityGame;
  },
});
assert.equal(
  compatibilityFactory.create(GAME_MODE.CLASSIC, { players, rng: () => 0 }),
  compatibilityGame,
);
assert.equal(compatibilityArguments.mode, GAME_MODE.CLASSIC);
assert.equal(compatibilityArguments.players, players);
assert.equal(typeof compatibilityArguments.rng, 'function');

assert.throws(() => createGameModeFactory({ gameFactory: true }), TypeError);
assert.throws(() => factory.create(GAME_MODE.CLASSIC, { players: null }), TypeError);
assert.throws(() => factory.aiDeck(GAME_MODE.CLASSIC, null), error => (
  error instanceof GameModeFactoryError && error.code === 'INVALID_GAME'
));
assert.throws(() => createGameModeFactory({
  definitions: { broken: { id: 'broken', create: () => ({}) } },
}), TypeError);

const source = read('../js/game/game-mode-factory.js');
const runtimeSource = read('../js/game/game-runtime.js');
const buildSource = read('../scripts/build-standalone.mjs');
const serviceWorkerSource = read('../sw.js');

assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|HTMLElement|querySelector|innerHTML/);
assert.match(runtimeSource, /from ['"]\.\/game-mode-factory\.js['"]/);
assert.doesNotMatch(runtimeSource, /import\s+\{[^}]*\bGame\b[^}]*\}\s+from ['"]\.\.\/engine\.js['"]/s);
assert.doesNotMatch(runtimeSource, /from ['"]\.\.\/penalties\.js['"]/);
assert.match(runtimeSource, /export\s+\{\s*GAME_MODE\s*\}\s+from ['"]\.\/game-mode-factory\.js['"]/);
assert.ok(
  buildSource.indexOf("'js/game/game-mode-factory.js'") < buildSource.indexOf("'js/game/game-runtime.js'"),
  'a játékmód-factory a runtime előtt kerül a standalone bundle-be',
);
assert.match(serviceWorkerSource, /\.\/js\/game\/game-mode-factory\.js/);

console.log('✓ A Klasszikus és Büntetőpárbaj motor külön, DOM-mentes játékmód-factoryból készül');
