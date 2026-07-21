import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../js/focus-experience.js', import.meta.url), 'utf8');

assert.match(source, /new MutationObserver\(scheduleSync\)/);
assert.match(source, /queueMicrotask/);
assert.match(source, /syncQueued/);
assert.match(source, /observer\.observe\(pub, \{ childList: true, subtree: true, attributes: true,/);
assert.match(source, /attributeFilter: \['class', 'hidden', 'aria-disabled'\]/);
assert.match(source, /observer\.observe\(overlay, \{ attributes: true, attributeFilter: \['hidden'\] \}\)/);
assert.match(source, /fociskartyak:interaction-invalidated/);
assert.match(source, /cancelTransition/);
assert.match(source, /observer\.disconnect\(\)/);
assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);

console.log('✓ A fókusznézet mikrofeládatban frissít, és az overlay-, busy- és tiltási változások megszakítják a függő kijátszást.');
