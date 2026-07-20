import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

const {
  DEFAULT_PLAYER_NAME,
  MAX_PLAYER_NAME_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
  hasSavedPlayerName,
  loadPlayerName,
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

console.log('✓ A játékosnév tisztítása, mentése és alapértéke rendben');
