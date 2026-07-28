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
  LEGACY_PLAYER_NAME_CHANGED_EVENT,
  MAX_PLAYER_NAME_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
  PLAYER_PROFILE_CHANGED_EVENT,
  PLAYER_PROFILE_SAVED_STORAGE_KEY,
  PlayerProfileError,
  deletePlayerProfile,
  hasPlayerProfile,
  hasSavedPlayerName,
  loadPlayerName,
  loadPlayerProfile,
  localizeInterfaceTextValue,
  normalizePlayerName,
  savePlayerName,
  savePlayerProfile,
} = await import('../js/player-profile.js');

assert.equal(normalizePlayerName('  Csabi   Kapitány  '), 'Csabi Kapitány');
assert.equal(normalizePlayerName(''), '');
assert.equal(normalizePlayerName('x'.repeat(40)).length, MAX_PLAYER_NAME_LENGTH);
assert.equal(loadPlayerName(), DEFAULT_PLAYER_NAME);
assert.equal(loadPlayerProfile(), null);
assert.equal(hasPlayerProfile(), false);
assert.equal(hasSavedPlayerName(), false);

assert.throws(
  () => savePlayerProfile({ playerName: '   ' }),
  error => error instanceof PlayerProfileError
    && error.code === 'PLAYER_NAME_REQUIRED'
    && error.message === 'A játékosnév megadása kötelező.',
);

assert.deepEqual(savePlayerProfile({ playerName: '  Csabi  ' }), {
  playerName: 'Csabi',
  isProfileSaved: true,
});
assert.equal(memory.get(PLAYER_NAME_STORAGE_KEY), 'Csabi');
assert.equal(memory.get(PLAYER_PROFILE_SAVED_STORAGE_KEY), 'true');
assert.equal(loadPlayerName(), 'Csabi');
assert.equal(hasPlayerProfile(), true);
assert.deepEqual(loadPlayerProfile(), { playerName: 'Csabi', isProfileSaved: true });

assert.deepEqual(savePlayerProfile({ playerName: '  Csabi Kapitány  ' }), {
  playerName: 'Csabi Kapitány',
  isProfileSaved: true,
});
assert.equal(memory.get(PLAYER_NAME_STORAGE_KEY), 'Csabi Kapitány');
assert.equal(memory.size, 2, 'A profilfrissítés nem hozhat létre második profil-adatforrást.');

assert.equal(deletePlayerProfile(), true);
assert.equal(memory.has(PLAYER_NAME_STORAGE_KEY), false);
assert.equal(memory.has(PLAYER_PROFILE_SAVED_STORAGE_KEY), false);
assert.equal(loadPlayerName(), DEFAULT_PLAYER_NAME);
assert.equal(hasPlayerProfile(), false);

assert.equal(savePlayerName('  Régi API  '), 'Régi API');
assert.equal(hasSavedPlayerName(), true);
assert.equal(savePlayerName('   '), DEFAULT_PLAYER_NAME);
assert.equal(hasPlayerProfile(), false);

memory.set(PLAYER_NAME_STORAGE_KEY, 'Korábbi játékos');
memory.delete(PLAYER_PROFILE_SAVED_STORAGE_KEY);
assert.equal(hasPlayerProfile(), true, 'A korábbi névkulcsot automatikusan mentett profilként kell felismerni.');
assert.equal(memory.get(PLAYER_PROFILE_SAVED_STORAGE_KEY), 'true');
assert.deepEqual(loadPlayerProfile(), { playerName: 'Korábbi játékos', isProfileSaved: true });

assert.equal(localizeInterfaceTextValue('⚽ Penalties mód'), '⚽ Büntetőpárbaj');
assert.equal(localizeInterfaceTextValue('Tizenegyes mód · mentett játék'), 'Büntetőpárbaj · mentett játék');
assert.equal(
  localizeInterfaceTextValue('A Klasszikus mód hosszabb kártyameccs, a Penalties gyors tizenegyespárbaj.'),
  'A Klasszikus mód hosszabb kártyameccs, a Büntetőpárbaj gyorsabb, 11 lapos játékmód.',
);

assert.equal(PLAYER_PROFILE_CHANGED_EVENT, 'fociskartyak:player-profile-changed');
assert.equal(LEGACY_PLAYER_NAME_CHANGED_EVENT, 'fociskartyak:player-name-changed');
assert.match(source, /isProfileSaved:\s*true/);
assert.match(source, /createPlayerProfileEditor/);
assert.match(source, /root\.matches\?\.\('\.mobile-home'\)/);
assert.match(source, /root\.matches\?\.\('\.settings-panel'\)/);
assert.match(source, /Játékosprofil sikeresen elmentve\./);
assert.match(source, /A profil módosításai elmentve\./);
assert.match(source, /A játékosprofil törölve\./);
assert.match(source, /A meccseredmények és statisztikák megmaradnak\./);
assert.doesNotMatch(source, /\b(?:window\.|globalThis\.)?confirm\s*\(/);
assert.match(source, /A játékosnév megadása kötelező\./);
assert.doesNotMatch(source, /function injectEditors|injectEditors\(\)/);
assert.match(source, /scorePair\s*=\s*value\s*=>\s*String\(value \?\? ''\)\.match/);
assert.match(source, /UI\.prototype\.renderScores\s*=\s*function renderScoresWithSavedPlayerName/);
assert.match(source, /PROFILE_BASE_METHODS\.renderScores\.apply\(this, args\)/);
assert.match(source, /UI\.prototype\.showOverlay\s*=\s*function showOverlayWithSavedPlayerName/);
assert.match(source, /personalizeGameLabels\(this\.dom\.overlayBody \?\? document\)/);
assert.match(source, /setNodeText\(finalScore, `\$\{upper\} \$\{score\[1\]\}–\$\{score\[2\]\} GÉP`\)/);

console.log('✓ A játékosprofil explicit mentett állapota, migrációja, szerkesztése és törlése rendben');
