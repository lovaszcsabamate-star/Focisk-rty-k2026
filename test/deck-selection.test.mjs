import assert from 'node:assert/strict';

import {
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalNationKey,
  describeDeckSelection,
  resolveDeckSelection,
  validateDeckSelection,
} from '../js/deck-selection.js';

const makePlayers = (count, { club, nation, offset = 0 }) => Array.from({ length: count }, (_, index) => ({
  id: `player-${offset + index}`,
  name: `Játékos ${offset + index}`,
  club,
  nation,
  stats: { goals: 0 },
}));

const players = [
  ...makePlayers(14, { club: 'Piros FC', nation: 'Hungary' }),
  ...makePlayers(12, { club: 'Kék SC', nation: 'Serbian', offset: 100 }),
  ...makePlayers(10, { club: 'Zöld SE', nation: 'Romania', offset: 200 }),
];

assert.equal(canonicalNationKey('Magyarország'), 'hungary');
assert.equal(canonicalNationKey('Szerb'), 'serbia');
assert.equal(canonicalNationKey('Román'), 'romania');
assert.equal(canonicalNationKey('HUN'), 'hungary');
assert.equal(canonicalNationKey('SRB'), 'serbia');
assert.equal(canonicalNationKey('ROU'), 'romania');

const options = buildDeckSelectionOptions(players);
assert.deepEqual(options.clubs.map(item => item.label), ['Kék SC', 'Piros FC']);
assert.deepEqual(options.nations.map(item => item.key), ['hungary', 'serbia', 'romania']);
assert.equal(options.nationMinimum, 8);

const clubDeck = resolveDeckSelection(players, { kind: 'club', value: 'piros fc' });
assert.equal(clubDeck.length, 14);
assert.equal(clubDeck.every(player => player.club === 'Piros FC'), true);

const nationDeck = resolveDeckSelection(players, { kind: 'nation', value: 'Szerbia' });
assert.equal(nationDeck.length, 12);
assert.equal(nationDeck.every(player => canonicalNationKey(player.nation) === 'serbia'), true);

const romanian = validateDeckSelection(players, { kind: 'nation', value: 'Román' });
assert.equal(romanian.valid, true);
assert.equal(romanian.players.length, 10);
const unavailable = validateDeckSelection(players, { kind: 'nation', value: 'Horvát' });
assert.equal(unavailable.valid, false);
assert.equal(unavailable.selection.kind, 'random');
assert.equal(unavailable.players.length, players.length);

const payload = applyDeckSelectionToPayload({ season: '2025/26', players }, { kind: 'club', value: 'Kék SC' });
assert.equal(payload.players.length, 12);
assert.equal(payload.deckSelection.kind, 'club');
assert.match(payload.deckSelection.label, /Kék SC/);
const nationPayload = applyDeckSelectionToPayload({ season: '2025/26', players }, { kind: 'nation', value: 'Romania' });
assert.equal(nationPayload.players.length, 10);
assert.equal(nationPayload.deckSelection.minimumCards, 8);
assert.match(describeDeckSelection({ kind: 'nation', value: 'serbia' }, players), /Szerb/);

console.log('✓ Pakliválasztási szűrés: klub/föderáció 11, ligaválogatott 8 lapos jogosultság: sikeres');
