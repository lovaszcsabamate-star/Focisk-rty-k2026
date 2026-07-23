/** DOM-mentes factory a támogatott játékmotorok példányosításához. */

import { AI, Game, HUMAN } from '../engine.js';
import { PenaltyGame } from '../penalties.js';

export const GAME_MODE = Object.freeze({
  CLASSIC: 'classic',
  PENALTIES: 'penalties',
});

const gameModeDefaultDefinitions = Object.freeze({
  [GAME_MODE.CLASSIC]: Object.freeze({
    id: GAME_MODE.CLASSIC,
    create: ({ players, rng }) => new Game({ players, rng }),
    aiDeck: game => game.players,
  }),
  [GAME_MODE.PENALTIES]: Object.freeze({
    id: GAME_MODE.PENALTIES,
    create: ({ players, rng }) => new PenaltyGame({ players, rng }),
    aiDeck: game => [...game.teams[HUMAN], ...game.teams[AI]],
  }),
});

export const GAME_MODE_DEFINITIONS = gameModeDefaultDefinitions;

export class GameModeFactoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GameModeFactoryError';
    this.code = code;
  }
}

const gameModeRequireDefinition = (definitions, mode) => {
  const definition = definitions[mode];
  if (!definition) {
    throw new GameModeFactoryError('UNKNOWN_MODE', `Ismeretlen játékmód: ${mode}`);
  }
  return definition;
};

const gameModeValidateDefinitions = definitions => {
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) {
    throw new TypeError('A játékmód-factory definitions mezője objektum kell legyen.');
  }
  for (const [mode, definition] of Object.entries(definitions)) {
    if (!definition || definition.id !== mode || typeof definition.create !== 'function'
      || typeof definition.aiDeck !== 'function') {
      throw new TypeError(`Érvénytelen játékmód-definíció: ${mode}`);
    }
  }
};

export function createGameModeFactory({
  definitions = GAME_MODE_DEFINITIONS,
  gameFactory = null,
  fallbackMode = GAME_MODE.CLASSIC,
} = {}) {
  gameModeValidateDefinitions(definitions);
  if (gameFactory != null && typeof gameFactory !== 'function') {
    throw new TypeError('A kompatibilitási gameFactory csak függvény lehet.');
  }
  if (!definitions[fallbackMode]) {
    throw new GameModeFactoryError('INVALID_FALLBACK', `A tartalék játékmód nincs regisztrálva: ${fallbackMode}`);
  }

  const configuredDefinitions = Object.freeze({ ...definitions });
  const modes = Object.freeze(Object.keys(configuredDefinitions));
  const isSupported = mode => typeof mode === 'string'
    && Object.prototype.hasOwnProperty.call(configuredDefinitions, mode);
  const normalize = mode => (isSupported(mode) ? mode : fallbackMode);
  const definition = mode => gameModeRequireDefinition(configuredDefinitions, mode);

  const create = (mode, { players, rng = Math.random } = {}) => {
    if (!Array.isArray(players)) {
      throw new TypeError('A játékmód létrehozásához players tömb szükséges.');
    }
    const resolvedMode = normalize(mode);
    const game = gameFactory
      ? gameFactory({ mode: resolvedMode, players, rng })
      : definition(resolvedMode).create({ players, rng });
    if (!game || typeof game !== 'object') {
      throw new GameModeFactoryError('INVALID_GAME', `A játékmód nem hozott létre érvényes motort: ${resolvedMode}`);
    }
    return game;
  };

  const aiDeck = (mode, game) => {
    if (!game || typeof game !== 'object') {
      throw new GameModeFactoryError('INVALID_GAME', 'Az AI-pakli feloldásához érvényes játékmotor szükséges.');
    }
    const deck = definition(normalize(mode)).aiDeck(game);
    if (!Array.isArray(deck)) {
      throw new GameModeFactoryError('INVALID_AI_DECK', `A játékmód AI-paklija nem tömb: ${normalize(mode)}`);
    }
    return deck;
  };

  return Object.freeze({
    modes,
    fallbackMode,
    definitions: configuredDefinitions,
    isSupported,
    normalize,
    definition,
    create,
    aiDeck,
  });
}

export const gameModeFactory = createGameModeFactory();
