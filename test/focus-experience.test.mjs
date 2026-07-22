import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(ui, /setPhaseState\(phase\)/);
assert.match(ui, /is-card-selection/);
assert.match(ui, /is-battle-active/);
assert.match(ui, /is-battle-transition/);
assert.match(ui, /_inspectorKeys/);
assert.match(ui, /event\.key === 'Escape'/);
assert.match(ui, /event\.key === 'Tab'/);
assert.match(main, /actionToken/);
assert.match(main, /beginBattleTransition/);
assert.match(ui, /beginBattleTransition\(cardId\)/);
assert.doesNotMatch(index, /focus-experience\.js/);
assert.equal(fs.existsSync(new URL('../js/focus-experience.js', import.meta.url)), false);

console.log('✓ A fókusz- és fázisállapot közvetlen UI-vezérléssel, dupla eseménykezelő nélkül működik');
