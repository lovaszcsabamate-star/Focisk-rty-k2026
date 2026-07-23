import assert from 'node:assert/strict';
import fs from 'node:fs';

import { APP_STORAGE_KEYS, SAVED_MATCH_VERSION } from '../js/app/configuration.js';
import { Game, HUMAN, PHASE } from '../js/engine.js';
import { PenaltyGame } from '../js/penalties.js';
import {
  SUPPORTED_SAVE_VERSIONS,
  SaveValidationError,
  createSaveService,
  createSavedMatchSnapshot,
  hydrateGame,
  validateSavedGameState,
  validateSavedMatch,
} from '../js/services/save-service.js';
import { createStorageService } from '../js/services/storage-service.js';

const payload = JSON.parse(fs.readFileSync(
  new URL('../data/databases/hungary-nb1-2025-26/players.normalized.json', import.meta.url),
  'utf8',
));
const players = payload.players;
const rng = () => 0.271828;
const clone = value => JSON.parse(JSON.stringify(value));

const memory = new Map();
const memoryStorage = createStorageService({
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
});
const service = createSaveService({
  storage: memoryStorage,
  now: () => new Date('2026-07-23T12:34:56.000Z'),
});

assert.deepEqual(SUPPORTED_SAVE_VERSIONS, [SAVED_MATCH_VERSION]);

const classic = new Game({ players, rng });
const classicPayload = {
  game: classic,
  mode: 'classic',
  difficulty: 'regular',
  pendingAttribute: null,
  awaitingChooserCard: false,
  uxStats: { rounds: 0, wins: 0 },
};
assert.equal(service.write(classicPayload), true);
assert.ok(memory.has(APP_STORAGE_KEYS.savedMatch));
const classicSaved = service.read();
assert.equal(classicSaved.version, 2);
assert.equal(classicSaved.savedAt, '2026-07-23T12:34:56.000Z');
assert.equal(classicSaved.mode, 'classic');
assert.equal(classicSaved.game.phase, PHASE.CHOOSE_ATTRIBUTE);
assert.equal(classicSaved.game.players.length, classic.players.length);

const restoredClassic = hydrateGame(new Game({ players, rng }), classicSaved.game);
assert.deepEqual(restoredClassic.hands, classicSaved.game.hands);
assert.deepEqual(restoredClassic.deck, classicSaved.game.deck);
assert.deepEqual(restoredClassic.won, classicSaved.game.won);
assert.equal(restoredClassic.rng, Math.random);

const category = classic.availableAttributeKeys()[0];
const chooserCard = classic.availableCards(classic.chooser, category)[0];
classic.chooseAttribute(category, chooserCard.id);
const midRoundSnapshot = createSavedMatchSnapshot({
  ...classicPayload,
  game: classic,
  pendingAttribute: classic.chooser === HUMAN ? category : null,
});
assert.equal(validateSavedMatch(midRoundSnapshot).ok, true);
assert.equal(midRoundSnapshot.game.phase, PHASE.CHOOSE_CARD);

const awaitingGame = new Game({ players, rng });
awaitingGame.chooser = HUMAN;
const awaitingAttribute = awaitingGame.availableAttributeKeys()[0];
const awaitingSnapshot = createSavedMatchSnapshot({
  ...classicPayload,
  game: awaitingGame,
  pendingAttribute: awaitingAttribute,
  awaitingChooserCard: true,
});
assert.equal(validateSavedMatch(awaitingSnapshot).ok, true);

const invalidAwaiting = clone(awaitingSnapshot);
invalidAwaiting.pendingAttribute = null;
assert.equal(validateSavedMatch(invalidAwaiting).ok, false);
assert.match(validateSavedMatch(invalidAwaiting).errors.join('\n'), /pendingAttribute/);

const duplicateCard = clone(classicSaved);
duplicateCard.game.deck.push(duplicateCard.game.hands.human[0]);
assert.equal(validateSavedMatch(duplicateCard).ok, false);
assert.match(validateSavedMatch(duplicateCard).errors.join('\n'), /egyszerre szerepel|duplikált/);

const invalidPhase = clone(classicSaved);
invalidPhase.game.phase = 'unknown-phase';
assert.equal(validateSavedMatch(invalidPhase).ok, false);
assert.equal(createSaveService({ storage: createStorageService({
  getItem: () => JSON.stringify(invalidPhase),
  setItem: () => {},
  removeItem: () => {},
}) }).read(), null);

const unsupported = clone(classicSaved);
unsupported.version = 99;
assert.equal(validateSavedMatch(unsupported).ok, false);
assert.match(validateSavedMatch(unsupported).errors.join('\n'), /nem támogatott mentési verzió/);

const extraField = clone(classicSaved.game);
extraField.injectedState = { shouldNotHydrate: true };
const extraValidation = validateSavedGameState('classic', extraField);
assert.equal(extraValidation.ok, true);
assert.match(extraValidation.warnings.join('\n'), /injectedState/);
const extraTarget = hydrateGame(new Game({ players, rng }), extraField);
assert.equal('injectedState' in extraTarget, false);
assert.equal('rng' in extraValidation.value, false);

const missingZoneCard = clone(classicSaved.game);
missingZoneCard.deck.pop();
assert.throws(
  () => hydrateGame(new Game({ players, rng }), missingZoneCard),
  error => error instanceof SaveValidationError && error.code === 'INVALID_SAVE',
);

const penalties = new PenaltyGame({ players, rng });
const penaltySnapshot = createSavedMatchSnapshot({
  game: penalties,
  mode: 'penalties',
  difficulty: 'd-raven',
  pendingAttribute: null,
  awaitingChooserCard: false,
  uxStats: { rounds: 0 },
});
const penaltyValidation = validateSavedMatch(penaltySnapshot);
assert.equal(penaltyValidation.ok, true, penaltyValidation.errors.join('\n'));
assert.equal(penaltyValidation.value.game.teams.human.length, 11);
assert.equal(penaltyValidation.value.game.teams.ai.length, 11);
const restoredPenalty = hydrateGame(new PenaltyGame({ players, rng }), penaltySnapshot.game);
assert.deepEqual(restoredPenalty.teams, penaltySnapshot.game.teams);
assert.deepEqual(restoredPenalty.hands, penaltySnapshot.game.hands);
assert.deepEqual(restoredPenalty.scores, penaltySnapshot.game.scores);

const brokenPenalty = clone(penaltySnapshot);
brokenPenalty.game.scores.human = -1;
assert.equal(validateSavedMatch(brokenPenalty).ok, false);
assert.match(validateSavedMatch(brokenPenalty).errors.join('\n'), /scores\.human/);

const gameOver = new Game({ players, rng });
gameOver.phase = PHASE.GAME_OVER;
assert.equal(createSavedMatchSnapshot({ ...classicPayload, game: gameOver }), null);

memory.set(APP_STORAGE_KEYS.savedMatch, '{not-json');
assert.equal(service.read(), null);
assert.equal(service.clear(), true);
assert.equal(memory.has(APP_STORAGE_KEYS.savedMatch), false);

const mobileSource = fs.readFileSync(new URL('../js/mobile-experience.js', import.meta.url), 'utf8');
const buildSource = fs.readFileSync(new URL('../scripts/build-standalone.mjs', import.meta.url), 'utf8');
const serviceWorker = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert.match(mobileSource, /from '\.\/services\/save-service\.js'/);
assert.match(mobileSource, /export \{ clearSavedMatch, hydrateGame, readSavedMatch, writeSavedMatch \}/);
assert.doesNotMatch(mobileSource, /for \(const \[key, value\] of Object\.entries\(savedState\)\)/);
assert.ok(
  buildSource.indexOf("'js/services/save-service.js'") > buildSource.indexOf("'js/ai.js'"),
  'A save-service csak a játékos-, motor- és AI-modulok után futhat.',
);
assert.ok(
  buildSource.indexOf("'js/services/save-service.js'") < buildSource.indexOf("'js/game/game-runtime.js'"),
  'A save-service-nek a runtime és a mobil fogyasztók előtt kell futnia.',
);
assert.match(serviceWorker, /js\/services\/save-service\.js/);

console.log('✓ Verziózott mentésséma, validált hidratálás és v2 kompatibilitás: rendben');
