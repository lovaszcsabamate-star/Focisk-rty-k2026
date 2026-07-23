/** Explicit, DOM-mentes időzítési szolgáltatás a Session játékmenetéhez. */

export const TURN_DELAY = Object.freeze({
  AI_CHOOSE_ATTRIBUTE: 'ai-choose-attribute',
  AI_CHOOSE_CARD: 'ai-choose-card',
  HUMAN_CARD_REVEAL: 'human-card-reveal',
  VERDICT_REVEAL: 'verdict-reveal',
  RESULT_HOLD: 'result-hold',
  RESTORED_AI_MOVE: 'restored-ai-move',
});

export const TURN_DELAY_MS = Object.freeze({
  [TURN_DELAY.AI_CHOOSE_ATTRIBUTE]: 90,
  [TURN_DELAY.AI_CHOOSE_CARD]: 110,
  [TURN_DELAY.HUMAN_CARD_REVEAL]: 250,
  [TURN_DELAY.VERDICT_REVEAL]: 320,
  [TURN_DELAY.RESULT_HOLD]: 650,
  [TURN_DELAY.RESTORED_AI_MOVE]: 350,
});

export const REDUCED_ANIMATION_DELAY_MS = 90;

const defaultTimer = () => globalThis.setTimeout.bind(globalThis);
const isDelayValue = value => Number.isFinite(value) && value >= 0;

export class TurnTimingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TurnTimingError';
    this.code = code;
  }
}

export function createTurnTimingService({
  timer = defaultTimer(),
  delays = TURN_DELAY_MS,
  reducedAnimationDelay = REDUCED_ANIMATION_DELAY_MS,
} = {}) {
  if (typeof timer !== 'function') throw new TypeError('Az időzítési szolgáltatáshoz timer függvény szükséges.');
  if (!isDelayValue(reducedAnimationDelay)) throw new TypeError('A csökkentett animációs késleltetés nem érvényes.');

  const configuredDelays = Object.freeze({ ...delays });
  for (const [key, value] of Object.entries(configuredDelays)) {
    if (!isDelayValue(value)) throw new TypeError(`Érvénytelen késleltetés: ${key}`);
  }

  const resolve = (delayOrKey, { animations = true } = {}) => {
    let milliseconds;
    if (typeof delayOrKey === 'string') {
      if (!Object.prototype.hasOwnProperty.call(configuredDelays, delayOrKey)) {
        throw new TurnTimingError('UNKNOWN_DELAY', `Ismeretlen játékmenet-késleltetés: ${delayOrKey}`);
      }
      milliseconds = configuredDelays[delayOrKey];
    } else if (isDelayValue(delayOrKey)) {
      milliseconds = delayOrKey;
    } else {
      throw new TurnTimingError('INVALID_DELAY', 'A késleltetés nem érvényes szám vagy ismert kulcs.');
    }

    return animations ? milliseconds : Math.min(milliseconds, reducedAnimationDelay);
  };

  const wait = (delayOrKey, options = {}) => new Promise(resolvePromise => {
    timer(resolvePromise, resolve(delayOrKey, options));
  });

  return Object.freeze({
    delays: configuredDelays,
    reducedAnimationDelay,
    resolve,
    wait,
  });
}

export const turnTimingService = createTurnTimingService();
