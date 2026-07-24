import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  MIN_FILTERED_DECK_SIZE,
  RANDOM_DECK_SELECTION,
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalClubKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
} from '../js/domain/deck-selection-domain.js';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
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

assert.equal(MIN_FILTERED_DECK_SIZE, 11);
assert.deepEqual(RANDOM_DECK_SELECTION, { kind: 'random', value: '' });
assert.equal(canonicalClubKey('  Kék–SC  '), 'kek sc');
assert.equal(canonicalClubKey('Piros FC'), canonicalClubKey('piros-fc'));
assert.equal(canonicalNationKey('Magyarország'), 'hungary');
assert.equal(canonicalNationKey('HUN'), 'hungary');
assert.equal(canonicalNationKey('Szerbia'), 'serbia');
assert.equal(canonicalNationKey('ROU'), 'romania');
assert.equal(canonicalNationKey('Bosznia-Hercegovina'), 'bosnia-herzegovina');
assert.equal(canonicalNationKey('CRO'), 'croatia');
assert.equal(canonicalNationKey('SLO'), 'slovenia');
assert.equal(canonicalNationKey('Ír'), 'ireland');
assert.deepEqual(nationPresentation('serbia'), { key: 'serbia', flag: '🇷🇸', label: 'Szerb' });
assert.deepEqual(nationPresentation('BEL'), { key: 'belgium', flag: '🇧🇪', label: 'Belga' });
assert.deepEqual(nationPresentation('GRC'), { key: 'greece', flag: '🇬🇷', label: 'Görög' });
assert.deepEqual(nationPresentation('Atlantisz'), { key: 'atlantisz', flag: '🌍', label: 'Atlantisz' });

const normalizedDatabase = JSON.parse(read('../data/databases/hungary-nb1-2025-26/players.normalized.json'));
const databaseNationCodes = [...new Set(
  normalizedDatabase.players
    .map(player => player.nationalityCode || player.nation || player.nationality)
    .flatMap(value => String(value ?? '').split('/'))
    .map(value => value.trim())
    .filter(Boolean),
)].sort();
const missingFlagCodes = databaseNationCodes.filter(code => nationPresentation(code).flag === '🌍');
assert.deepEqual(
  missingFlagCodes,
  [],
  `Hiányzó ország- vagy zászló-hozzárendelések: ${missingFlagCodes.join(', ')}`,
);
assert.equal(
  normalizedDatabase.players.every(player => String(
    player.nationalityCode || player.nation || player.nationality || '',
  ).trim()),
  true,
  'Minden normalizált játékosrekordhoz tartoznia kell nemzetiségnek.',
);

const options = buildDeckSelectionOptions(players);
assert.equal(options.minimum, 11);
assert.equal(options.total, 36);
assert.deepEqual(options.clubs.map(item => item.label), ['Kék SC', 'Piros FC']);
assert.deepEqual(options.nations.map(item => item.key), ['hungary', 'serbia']);
assert.equal(options.nations.some(item => item.key === 'romania'), false);
assert.equal(buildDeckSelectionOptions(players, 10).clubs.length, 3);

assert.deepEqual(normaliseDeckSelection(null), RANDOM_DECK_SELECTION);
assert.deepEqual(normaliseDeckSelection({ kind: 'unknown', value: 'x' }), RANDOM_DECK_SELECTION);
assert.deepEqual(normaliseDeckSelection({ kind: 'club', value: ' Piros FC ' }), { kind: 'club', value: 'Piros FC' });
assert.equal(selectionEquals({ kind: 'club', value: 'Kék SC' }, { kind: 'club', value: 'kek-sc' }), true);
assert.equal(selectionEquals({ kind: 'nation', value: 'Szerb' }, { kind: 'nation', value: 'SRB' }), true);
assert.equal(selectionEquals({ kind: 'club', value: 'Piros FC' }, { kind: 'nation', value: 'Hungary' }), false);

const clubDeck = resolveDeckSelection(players, { kind: 'club', value: 'piros fc' });
assert.equal(clubDeck.length, 14);
assert.equal(clubDeck.every(player => player.club === 'Piros FC'), true);
const nationDeck = resolveDeckSelection(players, { kind: 'nation', value: 'Szerbia' });
assert.equal(nationDeck.length, 12);
assert.equal(nationDeck.every(player => canonicalNationKey(player.nation) === 'serbia'), true);
const randomDeck = resolveDeckSelection(players, RANDOM_DECK_SELECTION);
assert.deepEqual(randomDeck, players);
assert.notEqual(randomDeck, players);

const unavailable = validateDeckSelection(players, { kind: 'nation', value: 'Román' });
assert.equal(unavailable.valid, false);
assert.deepEqual(unavailable.selection, RANDOM_DECK_SELECTION);
assert.equal(unavailable.players.length, players.length);
const available = validateDeckSelection(players, { kind: 'club', value: 'Kék SC' });
assert.equal(available.valid, true);
assert.equal(available.players.length, 12);

assert.match(describeDeckSelection({ kind: 'nation', value: 'serbia' }, players), /🇷🇸 Szerb · 12 kártya/);
assert.match(describeDeckSelection({ kind: 'club', value: 'Piros FC' }, players), /Piros FC · 14 kártya/);
assert.match(describeDeckSelection(RANDOM_DECK_SELECTION, players), /36 lapos adatbázis/);

const payload = applyDeckSelectionToPayload({ season: '2025/26', players }, { kind: 'club', value: 'Kék SC' });
assert.equal(payload.players.length, 12);
assert.equal(payload.deckSelection.kind, 'club');
assert.equal(payload.deckSelection.availableCards, 12);
assert.equal(payload.deckSelection.minimumCards, 11);
assert.deepEqual(payload.selection.deckSelection, payload.deckSelection);
assert.equal(applyDeckSelectionToPayload(players, { kind: 'nation', value: 'Hungary' }).length, 14);

const domainSource = read('../js/domain/deck-selection-domain.js');
const compatibilitySource = read('../js/deck-selection.js');
const buildSource = read('../scripts/build-standalone.mjs');
const serviceWorkerSource = read('../sw.js');

assert.doesNotMatch(domainSource, /\bdocument\b|\bwindow\b|MutationObserver|localStorage|storage-service/);
assert.match(compatibilitySource, /\.\/domain\/deck-selection-domain\.js/);
assert.match(compatibilitySource, /export\s+\{[\s\S]*applyDeckSelectionToPayload[\s\S]*\};/);
assert.doesNotMatch(compatibilitySource, /const NATION_ALIASES|const NATION_PRESENTATION|function canonicalNationKey|function resolveDeckSelection/);
assert.ok(
  buildSource.indexOf("'js/domain/deck-selection-domain.js'") < buildSource.indexOf("'js/deck-selection.js'"),
  'a pakliválasztási domainmodul a kompatibilitási/UI-modul előtt kerül a standalone bundle-be',
);
assert.match(serviceWorkerSource, /\.\/js\/domain\/deck-selection-domain\.js/);

console.log('✓ DOM-mentes pakliválasztási domainlogika és kompatibilis régi importútvonal: rendben');
