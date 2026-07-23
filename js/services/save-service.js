/**
 * Verziózott mérkőzésmentés, részletes állapotvalidáció és biztonságos hidratálás.
 * A v2 mentési boríték változatlan marad, de csak ellenőrzött mezők kerülhetnek vissza a motorba.
 */

import { APP_STORAGE_KEYS, SAVED_MATCH_VERSION } from '../app/configuration.js';
import { ATTRIBUTE_BY_KEY } from '../data/players.js';
import { AI, HUMAN, PHASE } from '../engine.js';
import { storageService } from './storage-service.js';

export const SUPPORTED_SAVE_VERSIONS = Object.freeze([SAVED_MATCH_VERSION]);

const SAVE_SERVICE_MODES = Object.freeze(['classic', 'penalties']);
const SAVE_SERVICE_PHASES = Object.freeze(Object.values(PHASE));
const SAVE_SERVICE_SIDES = Object.freeze([HUMAN, AI]);
const SAVE_SERVICE_ATTEMPTS = Object.freeze(['win', 'loss', 'tie']);
const SAVE_SERVICE_CLASSIC_KEYS = Object.freeze([
  'mode', 'players', 'poolSize', 'deck', 'hands', 'won', 'pot', 'round', 'chooser',
  'phase', 'attribute', 'played', 'lastResult', 'log',
]);
const SAVE_SERVICE_PENALTY_KEYS = Object.freeze([
  'mode', 'sharedPool', 'poolSize', 'teams', 'hands', 'used', 'scores', 'attempts',
  'chooser', 'phase', 'attribute', 'played', 'duel', 'cycle', 'suddenDeath',
  'lastResult', 'log', 'categoryWins', 'finishStage', 'finishReason',
]);

const saveServiceIsRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const saveServiceOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const saveServiceKnownAttribute = value => typeof value === 'string' && saveServiceOwn(ATTRIBUTE_BY_KEY, value);
const saveServiceSerializableClone = value => JSON.parse(JSON.stringify(value));
const saveServicePositiveInteger = value => Number.isInteger(value) && value >= 1;
const saveServiceNonNegativeInteger = value => Number.isInteger(value) && value >= 0;

const saveServiceError = (errors, path, message) => errors.push(`${path}: ${message}`);
const saveServiceWarning = (warnings, path, message) => warnings.push(`${path}: ${message}`);

const saveServiceValidationResult = (value, errors, warnings = []) => Object.freeze({
  ok: errors.length === 0,
  value: errors.length === 0 ? value : null,
  errors: Object.freeze(errors.slice()),
  warnings: Object.freeze(warnings.slice()),
});

const saveServiceValidateCardArray = (value, path, errors) => {
  if (!Array.isArray(value)) {
    saveServiceError(errors, path, 'kártyatömb szükséges');
    return [];
  }
  const ids = [];
  const seen = new Set();
  value.forEach((card, index) => {
    const cardPath = `${path}[${index}]`;
    if (!saveServiceIsRecord(card)) {
      saveServiceError(errors, cardPath, 'kártyaobjektum szükséges');
      return;
    }
    if (typeof card.id !== 'string' || card.id.trim() === '') {
      saveServiceError(errors, `${cardPath}.id`, 'nem üres szöveg szükséges');
      return;
    }
    if (seen.has(card.id)) saveServiceError(errors, `${cardPath}.id`, `duplikált azonosító: ${card.id}`);
    seen.add(card.id);
    ids.push(card.id);
  });
  return ids;
};

const saveServiceValidateSideRecord = (value, path, errors, validator) => {
  if (!saveServiceIsRecord(value)) {
    saveServiceError(errors, path, 'oldalankénti objektum szükséges');
    return { [HUMAN]: [], [AI]: [] };
  }
  return Object.fromEntries(SAVE_SERVICE_SIDES.map(side => [
    side,
    validator(value[side], `${path}.${side}`, errors),
  ]));
};

const saveServiceValidatePlayed = (value, path, errors) => {
  if (!saveServiceIsRecord(value)) {
    saveServiceError(errors, path, 'oldalankénti kijátszott kártya objektum szükséges');
    return { [HUMAN]: null, [AI]: null };
  }
  const result = { [HUMAN]: null, [AI]: null };
  for (const side of SAVE_SERVICE_SIDES) {
    const card = value[side];
    if (card == null) continue;
    const [id] = saveServiceValidateCardArray([card], `${path}.${side}`, errors);
    result[side] = id ?? null;
  }
  if (result[HUMAN] && result[HUMAN] === result[AI]) {
    saveServiceError(errors, path, 'ugyanaz a kártya nem lehet mindkét oldalon kijátszva');
  }
  return result;
};

const saveServiceRequireSubset = (ids, allowed, path, errors) => {
  ids.forEach(id => {
    if (!allowed.has(id)) saveServiceError(errors, path, `ismeretlen kártyaazonosító: ${id}`);
  });
};

const saveServiceRequireDisjoint = (groups, path, errors) => {
  const owner = new Map();
  for (const [name, ids] of groups) {
    for (const id of ids) {
      if (owner.has(id)) saveServiceError(errors, path, `${id} egyszerre szerepel itt: ${owner.get(id)} és ${name}`);
      else owner.set(id, name);
    }
  }
  return owner;
};

const saveServiceValidateCommonGame = (mode, game, errors) => {
  if (!saveServiceIsRecord(game)) {
    saveServiceError(errors, 'game', 'játékállapot-objektum szükséges');
    return;
  }
  if (game.mode !== mode) saveServiceError(errors, 'game.mode', `a várt mód: ${mode}`);
  if (!SAVE_SERVICE_PHASES.includes(game.phase)) saveServiceError(errors, 'game.phase', 'ismeretlen játékfázis');
  if (!SAVE_SERVICE_SIDES.includes(game.chooser)) saveServiceError(errors, 'game.chooser', 'érvénytelen választó oldal');
  if (game.attribute != null && !saveServiceKnownAttribute(game.attribute)) {
    saveServiceError(errors, 'game.attribute', 'ismeretlen kategória');
  }
  if (!Array.isArray(game.log)) saveServiceError(errors, 'game.log', 'naplótömb szükséges');
  if (game.lastResult != null && !saveServiceIsRecord(game.lastResult)) {
    saveServiceError(errors, 'game.lastResult', 'objektum vagy null szükséges');
  }
  if (!saveServiceNonNegativeInteger(game.poolSize)) saveServiceError(errors, 'game.poolSize', 'nem negatív egész szám szükséges');
};

const saveServiceValidatePhaseCards = (game, played, errors, { gameOverHasPlayed = false } = {}) => {
  const humanPlayed = Boolean(played[HUMAN]);
  const aiPlayed = Boolean(played[AI]);
  if (game.phase === PHASE.CHOOSE_ATTRIBUTE && (humanPlayed || aiPlayed || game.attribute != null)) {
    saveServiceError(errors, 'game.phase', 'kategóriaválasztáskor még nem lehet kijátszott lap vagy aktív kategória');
  }
  if (game.phase === PHASE.CHOOSE_CARD) {
    if (!saveServiceKnownAttribute(game.attribute)) saveServiceError(errors, 'game.attribute', 'kártyaválasztáskor aktív kategória szükséges');
    if (game.chooser === HUMAN && (!humanPlayed || aiPlayed)) {
      saveServiceError(errors, 'game.played', 'az emberi választó lapjának kell egyedül kijátszva lennie');
    }
    if (game.chooser === AI && (!aiPlayed || humanPlayed)) {
      saveServiceError(errors, 'game.played', 'a gépi választó lapjának kell egyedül kijátszva lennie');
    }
  }
  if (game.phase === PHASE.REVEAL && (!humanPlayed || !aiPlayed || !saveServiceKnownAttribute(game.attribute))) {
    saveServiceError(errors, 'game.played', 'felfedéskor két kijátszott lap és aktív kategória szükséges');
  }
  if (game.phase === PHASE.GAME_OVER) {
    if (gameOverHasPlayed && (!humanPlayed || !aiPlayed || !saveServiceKnownAttribute(game.attribute))) {
      saveServiceError(errors, 'game.played', 'a lezárt Büntetőpárbajhoz két kijátszott lap szükséges');
    }
    if (!gameOverHasPlayed && (humanPlayed || aiPlayed || game.attribute != null)) {
      saveServiceError(errors, 'game.played', 'a lezárt Klasszikus mérkőzésben nem maradhat aktív kijátszás');
    }
  }
};

const saveServiceValidateRoundRelation = (round, logLength, phase, path, errors) => {
  if (!saveServicePositiveInteger(round)) {
    saveServiceError(errors, path, 'pozitív egész szám szükséges');
    return;
  }
  const expected = [PHASE.CHOOSE_ATTRIBUTE, PHASE.CHOOSE_CARD].includes(phase) ? logLength + 1 : logLength;
  if (round !== expected) saveServiceError(errors, path, `a fázis és a napló alapján ${expected} szükséges`);
};

const saveServiceSanitizeGame = (game, allowedKeys, warnings) => {
  const allowed = new Set(allowedKeys);
  Object.keys(game).forEach(key => {
    if (key !== 'rng' && !allowed.has(key)) saveServiceWarning(warnings, `game.${key}`, 'ismeretlen mező kihagyva');
  });
  return Object.fromEntries(allowedKeys
    .filter(key => saveServiceOwn(game, key))
    .map(key => [key, saveServiceSerializableClone(game[key])]));
};

const saveServiceValidateClassicGame = (game, errors, warnings) => {
  saveServiceValidateCommonGame('classic', game, errors);
  if (!saveServiceIsRecord(game)) return null;

  const playerIds = saveServiceValidateCardArray(game.players, 'game.players', errors);
  if (playerIds.length < 10) saveServiceError(errors, 'game.players', 'a Klasszikus módhoz legalább 10 kártya szükséges');
  const playerSet = new Set(playerIds);
  if (game.poolSize < playerIds.length) saveServiceError(errors, 'game.poolSize', 'nem lehet kisebb a játékban lévő kártyák számánál');

  const deckIds = saveServiceValidateCardArray(game.deck, 'game.deck', errors);
  const handIds = saveServiceValidateSideRecord(game.hands, 'game.hands', errors, saveServiceValidateCardArray);
  const wonIds = saveServiceValidateSideRecord(game.won, 'game.won', errors, saveServiceValidateCardArray);
  const potIds = saveServiceValidateCardArray(game.pot, 'game.pot', errors);
  const played = saveServiceValidatePlayed(game.played, 'game.played', errors);
  const playedIds = SAVE_SERVICE_SIDES.map(side => played[side]).filter(Boolean);

  const zones = [
    ['deck', deckIds], ['hands.human', handIds[HUMAN]], ['hands.ai', handIds[AI]],
    ['won.human', wonIds[HUMAN]], ['won.ai', wonIds[AI]], ['pot', potIds],
  ];
  const zoneOwners = saveServiceRequireDisjoint(zones, 'game', errors);
  zones.forEach(([name, ids]) => saveServiceRequireSubset(ids, playerSet, `game.${name}`, errors));
  saveServiceRequireSubset(playedIds, playerSet, 'game.played', errors);

  if (game.phase === PHASE.CHOOSE_CARD) {
    playedIds.forEach(id => {
      if (zoneOwners.has(id)) saveServiceError(errors, 'game.played', `${id} kijátszva és más aktív zónában is szerepel`);
    });
    if (zoneOwners.size + playedIds.length !== playerSet.size) {
      saveServiceError(errors, 'game', 'a kártyazónák nem fedik le pontosan a teljes klasszikus paklit');
    }
  } else if (zoneOwners.size !== playerSet.size) {
    saveServiceError(errors, 'game', 'a kártyazónák nem fedik le pontosan a teljes klasszikus paklit');
  }

  saveServiceValidatePhaseCards(game, played, errors);
  saveServiceValidateRoundRelation(game.round, Array.isArray(game.log) ? game.log.length : 0, game.phase, 'game.round', errors);
  return saveServiceSanitizeGame(game, SAVE_SERVICE_CLASSIC_KEYS, warnings);
};

const saveServiceValidateAttemptArray = (value, path, errors) => {
  if (!Array.isArray(value)) {
    saveServiceError(errors, path, 'kísérlettömb szükséges');
    return [];
  }
  value.forEach((attempt, index) => {
    if (!SAVE_SERVICE_ATTEMPTS.includes(attempt)) saveServiceError(errors, `${path}[${index}]`, 'érvénytelen kísérleteredmény');
  });
  return value;
};

const saveServiceValidatePenaltyGame = (game, errors, warnings) => {
  saveServiceValidateCommonGame('penalties', game, errors);
  if (!saveServiceIsRecord(game)) return null;

  if (typeof game.sharedPool !== 'boolean') saveServiceError(errors, 'game.sharedPool', 'logikai érték szükséges');
  if (typeof game.suddenDeath !== 'boolean') saveServiceError(errors, 'game.suddenDeath', 'logikai érték szükséges');
  if (!saveServicePositiveInteger(game.cycle)) saveServiceError(errors, 'game.cycle', 'pozitív egész szám szükséges');
  for (const key of ['finishStage', 'finishReason']) {
    if (game[key] != null && typeof game[key] !== 'string') saveServiceError(errors, `game.${key}`, 'szöveg vagy null szükséges');
  }

  const teamIds = saveServiceValidateSideRecord(game.teams, 'game.teams', errors, saveServiceValidateCardArray);
  SAVE_SERVICE_SIDES.forEach(side => {
    if (teamIds[side].length !== 11) saveServiceError(errors, `game.teams.${side}`, 'pontosan 11 kártya szükséges');
  });
  saveServiceRequireDisjoint([
    ['teams.human', teamIds[HUMAN]], ['teams.ai', teamIds[AI]],
  ], 'game.teams', errors);
  if (game.poolSize < 11) saveServiceError(errors, 'game.poolSize', 'legalább 11 szükséges');

  const handIds = saveServiceValidateSideRecord(game.hands, 'game.hands', errors, saveServiceValidateCardArray);
  const usedIds = saveServiceValidateSideRecord(game.used, 'game.used', errors, saveServiceValidateCardArray);
  const played = saveServiceValidatePlayed(game.played, 'game.played', errors);
  const attemptValues = saveServiceValidateSideRecord(game.attempts, 'game.attempts', errors, saveServiceValidateAttemptArray);

  for (const side of SAVE_SERVICE_SIDES) {
    const teamSet = new Set(teamIds[side]);
    saveServiceRequireSubset(handIds[side], teamSet, `game.hands.${side}`, errors);
    saveServiceRequireSubset(usedIds[side], teamSet, `game.used.${side}`, errors);
    if (played[side]) saveServiceRequireSubset([played[side]], teamSet, `game.played.${side}`, errors);
    saveServiceRequireDisjoint([
      [`hands.${side}`, handIds[side]], [`used.${side}`, usedIds[side]],
    ], `game.${side}`, errors);
    if (attemptValues[side].length !== usedIds[side].length) {
      saveServiceError(errors, `game.attempts.${side}`, 'a kísérletek és a felhasznált lapok száma eltér');
    }
    const activePlayed = game.phase === PHASE.CHOOSE_CARD && played[side] ? 1 : 0;
    if (handIds[side].length + usedIds[side].length + activePlayed !== teamIds[side].length) {
      saveServiceError(errors, `game.${side}`, 'a kéz, a felhasznált és az aktív lapok nem fedik le a csapatot');
    }
    if (game.phase === PHASE.CHOOSE_CARD && played[side]
      && (handIds[side].includes(played[side]) || usedIds[side].includes(played[side]))) {
      saveServiceError(errors, `game.played.${side}`, 'az aktív lap más zónában is szerepel');
    }
    if ([PHASE.REVEAL, PHASE.GAME_OVER].includes(game.phase) && played[side]
      && !usedIds[side].includes(played[side])) {
      saveServiceError(errors, `game.played.${side}`, 'a lezárt párbaj lapjának a felhasznált lapok között kell lennie');
    }
  }

  if (!saveServiceIsRecord(game.scores)) saveServiceError(errors, 'game.scores', 'eredményobjektum szükséges');
  const scoreValues = SAVE_SERVICE_SIDES.map(side => game.scores?.[side]);
  scoreValues.forEach((score, index) => {
    if (!saveServiceNonNegativeInteger(score)) saveServiceError(errors, `game.scores.${SAVE_SERVICE_SIDES[index]}`, 'nem negatív egész szám szükséges');
  });
  if (scoreValues.every(saveServiceNonNegativeInteger)
    && Array.isArray(game.log)
    && scoreValues.reduce((sum, score) => sum + score, 0) > game.log.length) {
    saveServiceError(errors, 'game.scores', 'több gól szerepel, mint lezárt párbaj');
  }

  if (!saveServiceIsRecord(game.categoryWins)) saveServiceError(errors, 'game.categoryWins', 'kategóriaeredmény-objektum szükséges');
  else Object.entries(game.categoryWins).forEach(([key, count]) => {
    if (!saveServiceKnownAttribute(key)) saveServiceError(errors, `game.categoryWins.${key}`, 'ismeretlen kategória');
    if (!saveServiceNonNegativeInteger(count)) saveServiceError(errors, `game.categoryWins.${key}`, 'nem negatív egész szám szükséges');
  });

  saveServiceValidatePhaseCards(game, played, errors, { gameOverHasPlayed: true });
  saveServiceValidateRoundRelation(game.duel, Array.isArray(game.log) ? game.log.length : 0, game.phase, 'game.duel', errors);
  return saveServiceSanitizeGame(game, SAVE_SERVICE_PENALTY_KEYS, warnings);
};

export class SaveValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'SaveValidationError';
    this.code = 'INVALID_SAVE';
    this.errors = Object.freeze(errors.slice());
  }
}

export function validateSavedGameState(mode, game) {
  const errors = [];
  const warnings = [];
  if (!SAVE_SERVICE_MODES.includes(mode)) saveServiceError(errors, 'mode', 'ismeretlen játékmód');
  let value = null;
  if (mode === 'classic') value = saveServiceValidateClassicGame(game, errors, warnings);
  else if (mode === 'penalties') value = saveServiceValidatePenaltyGame(game, errors, warnings);
  return saveServiceValidationResult(value, errors, warnings);
}

export function validateSavedMatch(snapshot) {
  const errors = [];
  const warnings = [];
  if (!saveServiceIsRecord(snapshot)) {
    saveServiceError(errors, 'save', 'mentési objektum szükséges');
    return saveServiceValidationResult(null, errors, warnings);
  }
  if (!SUPPORTED_SAVE_VERSIONS.includes(snapshot.version)) {
    saveServiceError(errors, 'version', `nem támogatott mentési verzió: ${snapshot.version ?? 'hiányzik'}`);
  }
  if (!SAVE_SERVICE_MODES.includes(snapshot.mode)) saveServiceError(errors, 'mode', 'ismeretlen játékmód');
  if (typeof snapshot.difficulty !== 'string' || snapshot.difficulty.trim() === '') {
    saveServiceError(errors, 'difficulty', 'nem üres szöveg szükséges');
  }
  if (typeof snapshot.awaitingChooserCard !== 'boolean') {
    saveServiceError(errors, 'awaitingChooserCard', 'logikai érték szükséges');
  }
  if (snapshot.pendingAttribute != null && !saveServiceKnownAttribute(snapshot.pendingAttribute)) {
    saveServiceError(errors, 'pendingAttribute', 'ismeretlen kategória');
  }
  if (snapshot.savedAt != null && (typeof snapshot.savedAt !== 'string' || Number.isNaN(Date.parse(snapshot.savedAt)))) {
    saveServiceWarning(warnings, 'savedAt', 'érvénytelen időbélyeg; a felületen általános mentési felirat jelenik meg');
  }
  if (snapshot.uxStats != null && !saveServiceIsRecord(snapshot.uxStats)) {
    saveServiceError(errors, 'uxStats', 'objektum vagy null szükséges');
  }

  const gameValidation = validateSavedGameState(snapshot.mode, snapshot.game);
  errors.push(...gameValidation.errors);
  warnings.push(...gameValidation.warnings);
  if (snapshot.awaitingChooserCard === true) {
    if (snapshot.pendingAttribute == null) saveServiceError(errors, 'pendingAttribute', 'a félbehagyott emberi választáshoz kategória szükséges');
    if (snapshot.game?.phase !== PHASE.CHOOSE_ATTRIBUTE || snapshot.game?.chooser !== HUMAN) {
      saveServiceError(errors, 'awaitingChooserCard', 'csak emberi kategóriaválasztási fázisban lehet aktív');
    }
  } else if (snapshot.game?.phase === PHASE.CHOOSE_ATTRIBUTE && snapshot.pendingAttribute != null) {
    saveServiceError(errors, 'pendingAttribute', 'befejezetlen választás nélkül kategória nem maradhat függőben');
  }

  const value = errors.length ? null : {
    version: SAVED_MATCH_VERSION,
    savedAt: typeof snapshot.savedAt === 'string' && !Number.isNaN(Date.parse(snapshot.savedAt)) ? snapshot.savedAt : null,
    mode: snapshot.mode,
    difficulty: snapshot.difficulty,
    pendingAttribute: snapshot.pendingAttribute ?? null,
    awaitingChooserCard: snapshot.awaitingChooserCard,
    uxStats: snapshot.uxStats == null ? null : saveServiceSerializableClone(snapshot.uxStats),
    game: gameValidation.value,
  };
  return saveServiceValidationResult(value, errors, warnings);
}

export function createSavedMatchSnapshot(payload, now = () => new Date()) {
  if (!saveServiceIsRecord(payload) || !saveServiceIsRecord(payload.game)) {
    throw new SaveValidationError('A mentéshez hiányzik a játékmenet állapota.', ['game: hiányzik']);
  }
  if (payload.game.isOver || payload.game.phase === PHASE.GAME_OVER) return null;
  let game;
  try {
    game = saveServiceSerializableClone(payload.game);
  } catch (error) {
    throw new SaveValidationError(`A játékállapot nem alakítható menthető JSON-ná: ${error.message}`);
  }
  const date = now();
  const candidate = {
    version: SAVED_MATCH_VERSION,
    savedAt: date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString(),
    mode: payload.mode,
    difficulty: payload.difficulty,
    pendingAttribute: payload.pendingAttribute ?? null,
    awaitingChooserCard: Boolean(payload.awaitingChooserCard),
    uxStats: payload.uxStats ?? null,
    game,
  };
  const validation = validateSavedMatch(candidate);
  if (!validation.ok) throw new SaveValidationError('A játékállapot nem felel meg a v2 mentéssémának.', validation.errors);
  return validation.value;
}

export function hydrateGame(instance, savedState) {
  if (!saveServiceIsRecord(instance)) throw new SaveValidationError('A játékmotor-példány hiányzik.');
  const mode = instance.mode ?? savedState?.mode;
  const validation = validateSavedGameState(mode, savedState);
  if (!validation.ok) throw new SaveValidationError('A mentett játékmotor állapota sérült.', validation.errors);
  const allowedKeys = mode === 'penalties' ? SAVE_SERVICE_PENALTY_KEYS : SAVE_SERVICE_CLASSIC_KEYS;
  for (const key of allowedKeys) {
    if (saveServiceOwn(validation.value, key)) instance[key] = saveServiceSerializableClone(validation.value[key]);
  }
  instance.rng = Math.random;
  return instance;
}

export function createSaveService({ storage = storageService, now = () => new Date() } = {}) {
  const inspect = () => {
    const raw = storage?.readJson?.(APP_STORAGE_KEYS.savedMatch, null) ?? null;
    return raw == null
      ? saveServiceValidationResult(null, [], [])
      : validateSavedMatch(raw);
  };
  const read = () => {
    const validation = inspect();
    return validation.ok ? validation.value : null;
  };
  const write = payload => {
    try {
      const snapshot = createSavedMatchSnapshot(payload, now);
      if (!snapshot) return false;
      return Boolean(storage?.writeJson?.(APP_STORAGE_KEYS.savedMatch, snapshot));
    } catch (error) {
      console.warn('[save] A játékállás nem menthető:', error);
      return false;
    }
  };
  const clear = () => Boolean(storage?.remove?.(APP_STORAGE_KEYS.savedMatch));
  return Object.freeze({ inspect, read, write, clear });
}

export const saveService = createSaveService();
export const inspectSavedMatch = () => saveService.inspect();
export const readSavedMatch = () => saveService.read();
export const writeSavedMatch = payload => saveService.write(payload);
export const clearSavedMatch = () => saveService.clear();
