import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const mobileExperience = read('../js/mobile-experience.js');
const main = read('../js/main.js');
const ai = read('../js/ai.js');
const serviceWorker = read('../sw.js');

assert.match(mobileExperience, /chooseAttribute:\s*90/);
assert.match(mobileExperience, /chooseCard:\s*110/);
assert.match(mobileExperience, /delay === 550/);
assert.match(mobileExperience, /delay === 500/);
assert.match(main, /adjustedTurnDelay\(milliseconds/);
assert.doesNotMatch(mobileExperience, /globalThis\.setTimeout\s*=/);
assert.doesNotMatch(mobileExperience, /window\.location\.reload\(\)/);

assert.match(ai, /const lowerBound/);
assert.match(ai, /const upperBound/);
assert.match(ai, /strengthCache = new WeakMap/);
assert.doesNotMatch(ai, /for \(const other of values\)/);

assert.match(serviceWorker, /const PWA_CACHE = 'fociskartyak-2026-v43';/);
assert.match(serviceWorker, /async function networkFirst/);
assert.match(serviceWorker, /freshCodeOrData/);

console.log('✓ A gépi választás célzottan gyorsított, globális időzítő-felülírás nélkül működik');
