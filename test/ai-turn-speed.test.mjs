import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const mobileExperience = read('../js/mobile-experience.js');
const ai = read('../js/ai.js');
const serviceWorker = read('../sw.js');

assert.match(mobileExperience, /chooseAttribute:\s*90/);
assert.match(mobileExperience, /chooseCard:\s*110/);
assert.match(mobileExperience, /delay === 550/);
assert.match(mobileExperience, /delay === 500/);
assert.match(mobileExperience, /__FOCISKARTYAK_FAST_AI_TIMER__/);
assert.match(mobileExperience, /__FOCISKARTYAK_AI_RECOVERY__/);
assert.match(mobileExperience, /window\.location\.reload\(\)/);

assert.match(ai, /const lowerBound/);
assert.match(ai, /const upperBound/);
assert.match(ai, /strengthCache = new WeakMap/);
assert.doesNotMatch(ai, /for \(const other of values\)/);

assert.match(serviceWorker, /const PWA_CACHE = 'fociskartyak-2026-v41';/);

console.log('✓ A gépi választás gyorsított, beragadás ellen védett, és a PWA-cache naprakész');
