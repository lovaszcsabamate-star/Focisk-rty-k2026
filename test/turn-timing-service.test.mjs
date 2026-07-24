import assert from 'node:assert/strict';
import fs from 'node:fs';

const nativeSetTimeout = globalThis.setTimeout;
const {
  REDUCED_ANIMATION_DELAY_MS,
  TURN_DELAY,
  TURN_DELAY_MS,
  TurnTimingError,
  createTurnTimingService,
} = await import('../js/services/turn-timing-service.js');

assert.equal(globalThis.setTimeout, nativeSetTimeout, 'A timing service importja nem írhatja felül a globális setTimeout függvényt.');
assert.equal(TURN_DELAY_MS[TURN_DELAY.AI_CHOOSE_ATTRIBUTE], 90);
assert.equal(TURN_DELAY_MS[TURN_DELAY.AI_CHOOSE_CARD], 110);
assert.equal(REDUCED_ANIMATION_DELAY_MS, 90);

const recorded = [];
const service = createTurnTimingService({
  timer(callback, milliseconds) {
    recorded.push(milliseconds);
    callback();
    return recorded.length;
  },
});

assert.equal(service.resolve(TURN_DELAY.AI_CHOOSE_ATTRIBUTE), 90);
assert.equal(service.resolve(TURN_DELAY.AI_CHOOSE_CARD), 110);
assert.equal(service.resolve(TURN_DELAY.RESULT_HOLD), 650);
assert.equal(service.resolve(TURN_DELAY.RESULT_HOLD, { animations: false }), 90);
assert.equal(service.resolve(40, { animations: false }), 40);
assert.equal(service.resolve(250), 250);

await service.wait(TURN_DELAY.AI_CHOOSE_ATTRIBUTE);
await service.wait(TURN_DELAY.AI_CHOOSE_CARD);
await service.wait(TURN_DELAY.RESULT_HOLD, { animations: false });
assert.deepEqual(recorded, [90, 110, 90]);

assert.throws(
  () => service.resolve('missing-delay'),
  error => error instanceof TurnTimingError && error.code === 'UNKNOWN_DELAY',
);
assert.throws(
  () => service.resolve(-1),
  error => error instanceof TurnTimingError && error.code === 'INVALID_DELAY',
);
assert.throws(() => createTurnTimingService({ timer: null }), TypeError);
assert.throws(() => createTurnTimingService({ delays: { invalid: Number.NaN } }), TypeError);

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const serviceSource = read('../js/services/turn-timing-service.js');
const roundControllerSource = read('../js/app/round-controller.js');
const mainSource = read('../js/main.js');
const mobileSource = read('../js/mobile-experience.js');
const buildSource = read('../scripts/build-standalone.mjs');
const serviceWorker = read('../sw.js');

assert.doesNotMatch(serviceSource, /document\.|querySelector|textContent/);
assert.doesNotMatch(mobileSource, /globalThis\.setTimeout\s*=/);
assert.doesNotMatch(mobileSource, /__FOCISKARTYAK_FAST_AI_TIMER__/);
assert.match(mainSource, /createTurnTimingService/);
assert.match(mainSource, /wait: delayOrKey => this\.delay\(delayOrKey\)/);
assert.match(roundControllerSource, /turnDelay\.AI_CHOOSE_ATTRIBUTE/);
assert.match(roundControllerSource, /turnDelay\.AI_CHOOSE_CARD/);
assert.match(buildSource, /js\/services\/turn-timing-service\.js/);
assert.match(serviceWorker, /js\/services\/turn-timing-service\.js/);

console.log('✓ Az AI-időzítés explicit, tesztelhető, animációfüggő és nem módosít globális böngészőfüggvényt');
