import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../js/playability-visual-upgrade.js', import.meta.url), 'utf8');

assert.match(source, /quick:[\s\S]*cards:\s*20/);
assert.match(source, /normal:[\s\S]*cards:\s*36/);
assert.match(source, /full:[\s\S]*cards:\s*52/);
assert.match(source, /game\.deck\s*=\s*game\.deck\.slice\(-remainingCards\)/);
assert.match(source, /Megnyert lapok:/);
assert.match(source, /A kör győztese választ kategóriát a következő körben/);
assert.match(source, /DAILY_FALLBACK_CATEGORY\s*=\s*'totalDismissals'/);
assert.match(source, /Kártyaalbum/);
assert.match(source, /Most választható/);
assert.match(source, /AUTO_ADVANCE_KEY/);

console.log('✓ Játszhatósági és vizuális fejlesztési csomag forrásellenőrzése rendben');
