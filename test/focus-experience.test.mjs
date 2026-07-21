import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../js/focus-experience.js', import.meta.url), 'utf8');

assert.match(source, /new MutationObserver\(scheduleSync\)/);
assert.match(source, /queueMicrotask/);
assert.match(source, /syncQueued/);
assert.match(source, /observer\.observe\(pub, \{ childList: true, subtree: true \}\)/);
assert.doesNotMatch(source, /attributes:\s*true/);
assert.doesNotMatch(source, /attributeFilter:\s*\['class'\]/);
assert.match(source, /observer\.disconnect\(\)/);
assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);

console.log('✓ A fókusznézet DOM-figyelője mikrofeládatban frissít és nem figyeli saját osztálymódosításait.');
