/** DOM-mentes játékmenet-vezérlő a Klasszikus és Büntetőpárbaj módhoz. */

import { OpponentAI, DIFFICULTY } from '../ai.js';
import { AI, HUMAN, PHASE } from '../engine.js';
import { GAME_MODE, createGameModeFactory } from './game-mode-factory.js';

export { GAME_MODE } from './game-mode-factory.js';
const isRuntimeDifficulty = value => Object.prototype.hasOwnProperty.call(DIFFICULTY, value);
const defaultDifficulty = () => (isRuntimeDifficulty('medium') ? 'medium' : Object.keys(DIFFICULTY)[0]);
const cloneSaveValue = value => (value == null ? value : structuredClone(value));

export class GameRuntimeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GameRuntimeError';
    this.code = code;
  }
}

export class GameRuntime {
  constructor({
    players,
    rng = Math.random,
    aiFactory = (difficulty, deck) => new OpponentAI(difficulty, deck),
    gameFactory = null,
    modeFactory = null,
  } = {}) {
    if (!Array.isArray(players)) throw new TypeError('A GameRuntime players mezője tömb kell legyen.');
    this.players = players;
    this.rng = rng;
    this.aiFactory = aiFactory;
    this.modeFactory = modeFactory ?? createGameModeFactory({ gameFactory });
    if (typeof this.modeFactory?.normalize !== 'function'
      || typeof this.modeFactory?.create !== 'function'
      || typeof this.modeFactory?.aiDeck !== 'function') {
      throw new TypeError('A GameRuntime modeFactory mezője nem érvényes játékmód-factory.');
    }
    this.reset();
  }

  reset() {
    this.mode = null;
    this.difficulty = null;
    this.game = null;
    this.ai = null;
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    return this.state();
  }

  state() {
    return Object.freeze({
      mode: this.mode,
      difficulty: this.difficulty,
      game: this.game,
      pendingAttribute: this.pendingAttribute,
      awaitingChooserCard: this.awaitingChooserCard,
      started: Boolean(this.game),
      isOver: Boolean(this.game?.isOver),
      phase: this.game?.phase ?? null,
      chooser: this.game?.chooser ?? null,
      round: this.game?.round ?? null,
      attribute: this.game?.attribute ?? this.pendingAttribute,
    });
  }

  _resolveDifficulty(difficulty) {
    return isRuntimeDifficulty(difficulty) ? difficulty : defaultDifficulty();
  }

  _createGame(mode) {
    return this.modeFactory.create(mode, { players: this.players, rng: this.rng });
  }

  _prepareAi() {
    this._requireGame();
    const aiDeck = this.modeFactory.aiDeck(this.mode, this.game);
    this.ai = this.aiFactory(this.difficulty, aiDeck);
  }

  _requireGame() {
    if (!this.game) throw new GameRuntimeError('NO_ACTIVE_GAME', 'Nincs aktív mérkőzés.');
    return this.game;
  }

  _requirePhase(phase) {
    const game = this._requireGame();
    if (game.phase !== phase) {
      throw new GameRuntimeError('INVALID_PHASE', `A művelet nem hajtható végre ebben a fázisban: ${game.phase}`);
    }
    return game;
  }

  start(mode = GAME_MODE.CLASSIC, difficulty = defaultDifficulty()) {
    this.mode = this.modeFactory.normalize(mode);
    this.difficulty = this._resolveDifficulty(difficulty);
    this.game = this._createGame(this.mode);
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    this._prepareAi();
    return this.state();
  }

  restore(saved, hydrate) {
    if (!saved || typeof saved !== 'object') {
      throw new GameRuntimeError('INVALID_SAVE', 'A mentett játék adatai hiányoznak.');
    }
    if (typeof hydrate !== 'function') {
      throw new TypeError('A mentett játék visszaállításához hydrate függvény szükséges.');
    }

    this.mode = this.modeFactory.normalize(saved.mode);
    this.difficulty = this._resolveDifficulty(saved.difficulty);
    const emptyGame = this._createGame(this.mode);
    this.game = hydrate(emptyGame, saved.game);
    if (!this.game || typeof this.game !== 'object') {
      throw new GameRuntimeError('INVALID_SAVE', 'A mentett játékmotor nem állítható vissza.');
    }
    this.pendingAttribute = typeof saved.pendingAttribute === 'string'
      ? saved.pendingAttribute
      : null;
    this.awaitingChooserCard = Boolean(saved.awaitingChooserCard);
    this._prepareAi();
    return this.state();
  }

  availableAttributeKeys() {
    return this._requireGame().availableAttributeKeys();
  }

  selectHumanAttribute(attributeKey) {
    const game = this._requirePhase(PHASE.CHOOSE_ATTRIBUTE);
    if (game.chooser !== HUMAN) {
      throw new GameRuntimeError('NOT_HUMAN_TURN', 'Most a gép választ kategóriát.');
    }
    if (!game.availableAttributeKeys().includes(attributeKey)) {
      throw new GameRuntimeError('ATTRIBUTE_UNAVAILABLE', `A kategória most nem játszható: ${attributeKey}`);
    }
    this.pendingAttribute = attributeKey;
    this.awaitingChooserCard = true;
    return this.state();
  }

  commitHumanChooserCard(cardId) {
    const game = this._requirePhase(PHASE.CHOOSE_ATTRIBUTE);
    if (game.chooser !== HUMAN || !this.awaitingChooserCard || !this.pendingAttribute) {
      throw new GameRuntimeError('NO_PENDING_HUMAN_CHOICE', 'Nincs befejezetlen játékosi kategóriaválasztás.');
    }
    game.chooseAttribute(this.pendingAttribute, cardId);
    this.awaitingChooserCard = false;
    return this.state();
  }

  chooseAiAttribute() {
    const game = this._requirePhase(PHASE.CHOOSE_ATTRIBUTE);
    if (game.chooser !== AI) {
      throw new GameRuntimeError('NOT_AI_TURN', 'Most a játékos választ kategóriát.');
    }
    const choice = this.ai.chooseAttribute(game.hands[AI], game.availableAttributeKeys());
    game.chooseAttribute(choice.attribute, choice.cardId);
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    return Object.freeze({ ...choice, state: this.state() });
  }

  playHumanCard(cardId) {
    const game = this._requirePhase(PHASE.CHOOSE_CARD);
    if (game.chooser === HUMAN) {
      throw new GameRuntimeError('HUMAN_ALREADY_PLAYED', 'A játékos kategóriaválasztóként már kijátszotta a lapját.');
    }
    return game.playCard(HUMAN, cardId);
  }

  playAiCard() {
    const game = this._requirePhase(PHASE.CHOOSE_CARD);
    if (game.chooser === AI) {
      throw new GameRuntimeError('AI_ALREADY_PLAYED', 'A gép kategóriaválasztóként már kijátszotta a lapját.');
    }
    const aiCardId = this.ai.chooseCard(game.hands[AI], game.attribute);
    return game.playCard(AI, aiCardId);
  }

  clearPendingChoice() {
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    return this.state();
  }

  advance() {
    const game = this._requireGame();
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    if (this.mode === GAME_MODE.PENALTIES) {
      return Object.freeze({ ...game.nextDuel(), state: this.state() });
    }
    game.nextRound();
    return Object.freeze({ reshuffled: false, state: this.state() });
  }

  result() {
    return this._requireGame().result();
  }

  toSavePayload(uxStats = null) {
    const game = this._requireGame();
    return {
      game,
      mode: this.mode,
      difficulty: this.difficulty,
      pendingAttribute: this.pendingAttribute,
      awaitingChooserCard: this.awaitingChooserCard,
      uxStats: cloneSaveValue(uxStats),
    };
  }
}
