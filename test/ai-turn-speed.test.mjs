import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const timingService = read('../js/services/turn-timing-service.js');
const mobileExperience = read('../js/mobile-experience.js');
const main = read('../js/main.js');
const roundController = read('../js/app/round-controller.js');
const ai = read('../js/ai.js');
const serviceWorker = read('../sw.js');

assert.match(timingService, /AI_CHOOSE_ATTRIBUTE/);
assert.match(timingService, /AI_CHOOSE_CARD/);
assert.match(timingService, /ai-choose-attribute[^]*90/);
assert.match(timingService, /ai-choose-card[^]*110/);
assert.match(roundController, /turnDelay\.AI_CHOOSE_ATTRIBUTE/);
assert.match(roundController, /turnDelay\.AI_CHOOSE_CARD/);
assert.match(roundController, /turnDelay\.HUMAN_CARD_REVEAL/);
assert.match(roundController, /turnDelay\.VERDICT_REVEAL/);
assert.match(roundController, /turnDelay\.RESULT_HOLD/);
assert.match(roundController, /turnDelay\.RESTORED_AI_MOVE/);
assert.match(roundController, /round-retry-button/);
assert.match(roundController, /Gépi kör újrapróbálása/);
assert.doesNotMatch(roundController, /await wait\((?:250|320|350|650)\)/);
assert.match(main, /createTurnTimingService/);
assert.match(main, /wait: delayOrKey => this\.delay\(delayOrKey\)/);
assert.doesNotMatch(mobileExperience, /globalThis\.setTimeout\s*=/);
assert.doesNotMatch(mobileExperience, /__FOCISKARTYAK_FAST_AI_TIMER__/);
assert.doesNotMatch(mobileExperience, /__FOCISKARTYAK_AI_RECOVERY__/);
assert.doesNotMatch(mobileExperience, /unhandledrejection/);
assert.doesNotMatch(mobileExperience, /window\.location\.reload\(\)/);
assert.match(mobileExperience, /__FOCISKARTYAK_CONNECTIVITY_BADGE__/);

assert.match(ai, /const lowerBound/);
assert.match(ai, /const upperBound/);
assert.match(ai, /strengthCache = new WeakMap/);
assert.doesNotMatch(ai, /for \(const other of values\)/);

assert.match(serviceWorker, /const PWA_CACHE = 'fociskartyak-2026-v\d+';/);
assert.match(serviceWorker, /async function networkFirst/);
assert.match(serviceWorker, /freshCodeOrData/);

console.log('✓ A gépi választás explicit timing service-t és körszintű, újrapróbálható hibakezelést használ');
