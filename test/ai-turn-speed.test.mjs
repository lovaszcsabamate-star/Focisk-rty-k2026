import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const mobileExperience = read('../js/mobile-experience.js');
const main = read('../js/main.js');
const ai = read('../js/ai.js');
const serviceWorker = read('../sw.js');

assert.match(mobileExperience, /chooseAttribute:\s*90/);
assert.match(mobileExperience, /chooseCard:\s*110/);
assert.match(mobileExperience, /export function aiDelay/);
assert.doesNotMatch(mobileExperience, /globalThis\.setTimeout\s*=/);
assert.match(main, /aiDelay\('chooseAttribute', 550\)/);
assert.match(main, /aiDelay\('chooseCard', 500\)/);
assert.match(main, /_rollbackTransaction/);
assert.match(main, /Gépi választás újrapróbálása/);

assert.match(ai, /const lowerBound/);
assert.match(ai, /const upperBound/);
assert.match(ai, /strengthCache = new WeakMap/);
assert.doesNotMatch(ai, /for \(const other of values\)/);

assert.match(serviceWorker, /const CACHE_PREFIX = 'fociskartyak-2026-';/);
assert.match(serviceWorker, /const PWA_CACHE = `\$\{CACHE_PREFIX\}v43`;/);
assert.match(serviceWorker, /async function networkFirst/);
assert.match(serviceWorker, /freshCodeOrData/);
assert.match(serviceWorker, /event\?\.waitUntil\?\./);

console.log('✓ A gépi választás célzottan gyorsított, tranzakcióbiztos, és a PWA-cache friss kódot részesít előnyben');
