import assert from 'node:assert/strict';
import fs from 'node:fs';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

const source = fs.readFileSync(new URL('../js/player-profile.js', import.meta.url), 'utf8');
const {
  DEFAULT_PLAYER_NAME,
  MAX_PLAYER_NAME_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
  hasSavedPlayerName,
  loadPlayerName,
  localizeInterfaceTextValue,
  normalizePlayerName,
  savePlayerName,
} = await import('../js/player-profile.js');

assert.equal(normalizePlayerName('  Csabi   Kapitány  '), 'Csabi Kapitány');
assert.equal(normalizePlayerName(''), '');
assert.equal(normalizePlayerName('x'.repeat(40)).length, MAX_PLAYER_NAME_LENGTH);
assert.equal(loadPlayerName(), DEFAULT_PLAYER_NAME);
assert.equal(hasSavedPlayerName(), false);

assert.equal(savePlayerName('  Csabi  '), 'Csabi');
assert.equal(memory.get(PLAYER_NAME_STORAGE_KEY), 'Csabi');
assert.equal(loadPlayerName(), 'Csabi');
assert.equal(hasSavedPlayerName(), true);

assert.equal(savePlayerName('   '), DEFAULT_PLAYER_NAME);
assert.equal(memory.has(PLAYER_NAME_STORAGE_KEY), false);
assert.equal(loadPlayerName(), DEFAULT_PLAYER_NAME);

assert.equal(localizeInterfaceTextValue('⚽ Büntetőpárbaj'), '⚽ Büntetőpárbaj');
assert.equal(localizeInterfaceTextValue('Klasszikus mód · mentett játék'), 'Klasszikus mód · mentett játék');

assert.doesNotMatch(source, /INTERFACE_TEXT_REPLACEMENTS|Penalties mód|Tizenegyes mód|replaceAll\(source/);
assert.match(source, /scorePair\s*=\s*value\s*=>\s*String\(value \?\? ''\)\.match/);
assert.match(source, /UI\.prototype\.renderScores\s*=\s*function renderScoresWithSavedPlayerName/);
assert.match(source, /PROFILE_BASE_METHODS\.renderScores\.apply\(this, args\)/);
assert.match(source, /UI\.prototype\.showOverlay\s*=\s*function showOverlayWithSavedPlayerName/);
assert.match(source, /personalizeGameLabels\(this\.dom\.overlayBody \?\? document\)/);
assert.match(source, /setNodeText\(finalScore, `\$\{upper\} \$\{score\[1\]\}–\$\{score\[2\]\} GÉP`\)/);

console.log('✓ A mentett játékosnév és a közvetlen magyar felületi szövegek rendben');
