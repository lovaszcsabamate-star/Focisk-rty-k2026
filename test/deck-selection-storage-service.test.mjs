import assert from 'node:assert/strict';
import fs from 'node:fs';

import { APP_STORAGE_KEYS } from '../js/app/configuration.js';
import { RANDOM_DECK_SELECTION } from '../js/domain/deck-selection-domain.js';
import {
  DECK_SELECTION_STORAGE_KEY,
  DECK_SELECTION_STORAGE_KEYS,
  SAVED_MATCH_STORAGE_KEY,
  DeckSelectionStorageError,
  createDeckSelectionStorageService,
} from '../js/services/deck-selection-storage-service.js';
import {
  QUICK_MATCH_LAUNCH_STORAGE_KEY,
  QUICK_MATCH_SETUP_STORAGE_KEY,
  createQuickMatchStorageService,
} from '../js/services/quick-match-storage-service.js';
import {
  TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY,
  TOURNAMENT_STORAGE_KEY,
  createTournamentStorageService,
} from '../js/services/tournament-storage-service.js';
import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  createTournament,
  tournamentNextHumanMatch,
} from '../js/tournament/tournament-domain.js';

const readSource = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const makePlayers = (count, { club = 'Kék SC', nation = 'Serbia' } = {}) => Array.from(
  { length: count },
  (_, index) => ({ id: `player-${index}`, name: `Játékos ${index}`, club, nation }),
);

const createMemoryAdapter = initial => {
  const values = new Map(Object.entries(initial ?? {}));
  const calls = [];
  return {
    values,
    calls,
    failNextWriteKey: null,
    readJson(key, fallback = null) {
      calls.push(['readJson', key]);
      if (!values.has(key)) return fallback;
      try { return JSON.parse(values.get(key)); } catch { return fallback; }
    },
    readString(key, fallback = null) {
      calls.push(['readString', key]);
      return values.has(key) ? String(values.get(key)) : fallback;
    },
    writeString(key, value) {
      calls.push(['writeString', key, value]);
      values.set(key, String(value));
      return true;
    },
    writeJson(key, value) {
      calls.push(['writeJson', key, value]);
      if (this.failNextWriteKey === key) {
        this.failNextWriteKey = null;
        return false;
      }
      values.set(key, JSON.stringify(value));
      return true;
    },
    remove(key) {
      calls.push(['remove', key]);
      values.delete(key);
      return true;
    },
  };
};

assert.equal(DECK_SELECTION_STORAGE_KEY, APP_STORAGE_KEYS.deckSelection);
assert.equal(SAVED_MATCH_STORAGE_KEY, APP_STORAGE_KEYS.savedMatch);
assert.deepEqual(DECK_SELECTION_STORAGE_KEYS, {
  selection: APP_STORAGE_KEYS.deckSelection,
  savedMatch: APP_STORAGE_KEYS.savedMatch,
});

const players = makePlayers(12);
const adapter = createMemoryAdapter({
  [DECK_SELECTION_STORAGE_KEY]: JSON.stringify({ kind: 'club', value: 'Kék SC' }),
});
const service = createDeckSelectionStorageService({ storage: adapter });

assert.deepEqual(service.keys, DECK_SELECTION_STORAGE_KEYS);
assert.deepEqual(service.read(players), { kind: 'club', value: 'Kék SC' });
adapter.values.set(DECK_SELECTION_STORAGE_KEY, JSON.stringify({ kind: 'club', value: 'Hiányzó FC' }));
assert.deepEqual(service.read(players), RANDOM_DECK_SELECTION);
adapter.values.set(DECK_SELECTION_STORAGE_KEY, '{hibás json');
assert.deepEqual(service.read(players), RANDOM_DECK_SELECTION);

assert.equal(service.save({ kind: 'club', value: '  Kék SC  ' }), true);
assert.deepEqual(JSON.parse(adapter.values.get(DECK_SELECTION_STORAGE_KEY)), { kind: 'club', value: 'Kék SC' });
assert.equal(service.save({ kind: 'unknown', value: 'x' }), true);
assert.deepEqual(JSON.parse(adapter.values.get(DECK_SELECTION_STORAGE_KEY)), RANDOM_DECK_SELECTION);

assert.equal(service.hasSavedMatch(), false);
adapter.values.set(SAVED_MATCH_STORAGE_KEY, '{"mode":"classic"}');
assert.equal(service.hasSavedMatch(), true);
assert.equal(service.clearSavedMatch(), true);
assert.equal(service.hasSavedMatch(), false);

adapter.values.set(SAVED_MATCH_STORAGE_KEY, '{"mode":"penalties"}');
adapter.calls.length = 0;
const replaced = service.replace({ kind: 'nation', value: ' SRB ' });
assert.deepEqual(replaced, { selection: { kind: 'nation', value: 'SRB' }, saved: true });
assert.deepEqual(adapter.calls.slice(-2).map(call => call.slice(0, 2)), [
  ['remove', SAVED_MATCH_STORAGE_KEY],
  ['writeJson', DECK_SELECTION_STORAGE_KEY],
]);
assert.equal(adapter.values.has(SAVED_MATCH_STORAGE_KEY), false);

adapter.values.set(SAVED_MATCH_STORAGE_KEY, 'megmarad');
service.replace({ kind: 'random', value: 'figyelmen kívül' }, { clearSavedMatch: false });
assert.equal(adapter.values.get(SAVED_MATCH_STORAGE_KEY), 'megmarad');
assert.deepEqual(JSON.parse(adapter.values.get(DECK_SELECTION_STORAGE_KEY)), RANDOM_DECK_SELECTION);

const customAdapter = createMemoryAdapter();
const custom = createDeckSelectionStorageService({
  storage: customAdapter,
  keys: { selection: 'custom-selection', savedMatch: 'custom-match' },
});
custom.save({ kind: 'club', value: 'Piros FC' });
assert.deepEqual(JSON.parse(customAdapter.values.get('custom-selection')), { kind: 'club', value: 'Piros FC' });

assert.throws(
  () => createDeckSelectionStorageService({ storage: {} }),
  error => error instanceof DeckSelectionStorageError && error.code === 'INVALID_STORAGE_ADAPTER',
);
assert.throws(
  () => createDeckSelectionStorageService({ storage: customAdapter, keys: { selection: '', savedMatch: 'x' } }),
  error => error instanceof DeckSelectionStorageError && error.code === 'INVALID_STORAGE_KEYS',
);

const quickSetup = {
  playerSelection: { kind: 'club', value: 'Kék SC' },
  opponentSelection: { kind: 'club', value: 'Piros FC' },
  playerTeamId: 'kek-sc',
  opponentTeamId: 'piros-fc',
  mode: 'classic',
  difficulty: 'medium',
  createdAt: '2026-08-06T12:00:00.000Z',
};
const previousQuickValues = {
  [SAVED_MATCH_STORAGE_KEY]: '{"version":2,"mode":"penalties"}',
  [DECK_SELECTION_STORAGE_KEY]: JSON.stringify({ kind: 'nation', value: 'HUN' }),
  [QUICK_MATCH_SETUP_STORAGE_KEY]: JSON.stringify({ previous: 'setup' }),
  [QUICK_MATCH_LAUNCH_STORAGE_KEY]: JSON.stringify({ previous: 'launch' }),
};
const quickAdapter = createMemoryAdapter(previousQuickValues);
const quickService = createQuickMatchStorageService({
  storage: quickAdapter,
  commitTournamentLaunch: () => true,
  rollbackTournamentLaunch: () => true,
});
assert.equal(quickService.stage(quickSetup), true);
assert.equal(
  quickAdapter.values.get(SAVED_MATCH_STORAGE_KEY),
  previousQuickValues[SAVED_MATCH_STORAGE_KEY],
  'a Gyors meccs staging nem törölheti vagy írhatja felül a korábbi mérkőzésmentést',
);
assert.deepEqual(JSON.parse(quickAdapter.values.get(DECK_SELECTION_STORAGE_KEY)), { kind: 'club', value: 'Kék SC' });
assert.equal(JSON.parse(quickAdapter.values.get(QUICK_MATCH_SETUP_STORAGE_KEY)).mode, 'classic');
assert.equal(JSON.parse(quickAdapter.values.get(QUICK_MATCH_LAUNCH_STORAGE_KEY)).difficulty, 'medium');

const failingQuickAdapter = createMemoryAdapter(previousQuickValues);
failingQuickAdapter.failNextWriteKey = QUICK_MATCH_LAUNCH_STORAGE_KEY;
let quickRollbackCalls = 0;
const failingQuickService = createQuickMatchStorageService({
  storage: failingQuickAdapter,
  commitTournamentLaunch: () => true,
  rollbackTournamentLaunch: () => { quickRollbackCalls += 1; return true; },
});
assert.equal(failingQuickService.stage(quickSetup), false);
for (const [key, value] of Object.entries(previousQuickValues)) {
  assert.equal(
    failingQuickAdapter.values.get(key),
    value,
    `${key}: sikertelen staging után az eredeti tárolt értéknek kell megmaradnia`,
  );
}
assert.equal(quickRollbackCalls, 1);
assert.equal(
  failingQuickAdapter.calls.some(call => call[0] === 'remove' && call[1] === SAVED_MATCH_STORAGE_KEY),
  false,
  'a staging sem sikeres, sem sikertelen úton nem törölheti a mérkőzésmentést',
);

const tournamentTeams = Array.from({ length: 4 }, (_, index) => ({
  id: `club:test-${index + 1}`,
  kind: 'club',
  label: `Tesztcsapat ${index + 1}`,
  count: 11,
  selection: { kind: 'club', value: `Tesztcsapat ${index + 1}` },
}));
const tournamentAdapter = createMemoryAdapter(previousQuickValues);
const tournamentService = createTournamentStorageService({ storage: tournamentAdapter });
const activeTournament = createTournament({
  name: 'Tranzakciós torna',
  category: TOURNAMENT_CATEGORY.HUNGARIAN,
  format: TOURNAMENT_FORMAT.LEAGUE,
  participants: tournamentTeams,
  humanTeamId: tournamentTeams[0].id,
  rng: () => 0.25,
});
assert.equal(tournamentService.save(activeTournament), true);
const tournamentMatch = tournamentNextHumanMatch(activeTournament);
const stagedTournament = {
  ...activeTournament,
  currentMatchId: tournamentMatch.id,
  currentMatchMode: 'classic',
  currentLineupIds: ['p1', 'p2', 'p3', 'p4'],
  lastLineupIds: ['p1', 'p2', 'p3', 'p4'],
};
assert.equal(tournamentService.save(stagedTournament), true);
assert.equal(tournamentService.read().currentMatchId ?? null, null, 'a fő tornaállapot staging előtt nem módosulhat');
assert.equal(tournamentService.readPendingLaunch()?.next.currentMatchId, tournamentMatch.id);

const tournamentQuickService = createQuickMatchStorageService({
  storage: tournamentAdapter,
  commitTournamentLaunch: () => tournamentService.commitPendingLaunch(),
  rollbackTournamentLaunch: () => tournamentService.rollbackPendingLaunch(),
});
assert.equal(tournamentQuickService.stage(quickSetup), true);
assert.equal(tournamentService.read().currentMatchId, tournamentMatch.id);
assert.equal(tournamentAdapter.values.has(TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY), false);

assert.equal(tournamentService.save(activeTournament), true);
assert.equal(tournamentService.save(stagedTournament), true);
tournamentAdapter.failNextWriteKey = TOURNAMENT_STORAGE_KEY;
const quickBeforeFailedTournamentCommit = new Map([
  [DECK_SELECTION_STORAGE_KEY, tournamentAdapter.readString(DECK_SELECTION_STORAGE_KEY, null)],
  [QUICK_MATCH_SETUP_STORAGE_KEY, tournamentAdapter.readString(QUICK_MATCH_SETUP_STORAGE_KEY, null)],
  [QUICK_MATCH_LAUNCH_STORAGE_KEY, tournamentAdapter.readString(QUICK_MATCH_LAUNCH_STORAGE_KEY, null)],
]);
assert.equal(tournamentQuickService.stage(quickSetup), false);
assert.equal(tournamentService.read().currentMatchId ?? null, null, 'sikertelen torna-commit után az aktív állapot maradjon érintetlen');
assert.equal(tournamentAdapter.values.has(TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY), false);
for (const [key, value] of quickBeforeFailedTournamentCommit.entries()) {
  assert.equal(tournamentAdapter.readString(key, null), value, `${key}: a Gyors meccs staging is gördüljön vissza`);
}

const serviceSource = readSource('../js/services/deck-selection-storage-service.js');
const quickServiceSource = readSource('../js/services/quick-match-storage-service.js');
const tournamentServiceSource = readSource('../js/services/tournament-storage-service.js');
const compatibilitySource = readSource('../js/deck-selection.js');
const tournamentModeSource = readSource('../js/tournament-mode.js');
const buildSource = readSource('../scripts/build-standalone.mjs');
const serviceWorkerSource = readSource('../sw.js');

assert.doesNotMatch(serviceSource, /\bdocument\b|\bwindow\b|MutationObserver|location\.reload|confirm\(/);
assert.doesNotMatch(
  serviceSource,
  /export const (?:hasSavedMatch|clearSavedMatch|replaceDeckSelection)\b/,
  'a mérkőzésmentési metódusok nem hozhatnak létre standalone top-level névütközést',
);
assert.doesNotMatch(
  quickServiceSource.match(/const stage = setup => \{[\s\S]*?\n  \};/)?.[0] ?? '',
  /storage\.remove\(APP_STORAGE_KEYS\.savedMatch\)/,
  'a Gyors meccs staging nem végezhet korai mentéstörlést',
);
assert.match(quickServiceSource, /checkpoint[\s\S]*rollbackStage/);
assert.match(quickServiceSource, /commitTournamentLaunch\(\)[\s\S]*rollbackStage\(\)/);
assert.match(tournamentServiceSource, /TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY/);
assert.match(tournamentServiceSource, /startsNewMatch[\s\S]*previous:\s*active[\s\S]*next:\s*normalised/);
assert.ok(
  tournamentModeSource.indexOf('tournamentStorageService.save(next)')
    < tournamentModeSource.indexOf('stageQuickMatch({'),
  'a régi hívási sorrendet a tárolási tranzakciónak kell biztonságossá tennie',
);
assert.match(compatibilitySource, /\.\/services\/deck-selection-storage-service\.js/);
assert.doesNotMatch(compatibilitySource, /\.\/app\/configuration\.js|\.\/services\/storage-service\.js/);
assert.doesNotMatch(compatibilitySource, /readStoredJson|readStoredString|writeStoredJson|removeStoredValue/);
assert.match(compatibilitySource, /export\s+\{[\s\S]*DECK_SELECTION_STORAGE_KEY[\s\S]*readDeckSelection[\s\S]*\};/);
assert.ok(
  buildSource.indexOf("'js/domain/deck-selection-domain.js'")
    < buildSource.indexOf("'js/services/deck-selection-storage-service.js'"),
  'a domainmodul a pakliválasztási tárolási szolgáltatás előtt szerepel',
);
assert.ok(
  buildSource.indexOf("'js/services/deck-selection-storage-service.js'")
    < buildSource.indexOf("'js/deck-selection.js'"),
  'a tárolási szolgáltatás a kompatibilitási/UI-modul előtt szerepel',
);
assert.match(serviceWorkerSource, /\.\/js\/services\/deck-selection-storage-service\.js/);
assert.match(serviceWorkerSource, /\.\/js\/services\/quick-match-storage-service\.js/);
assert.match(serviceWorkerSource, /\.\/js\/services\/tournament-storage-service\.js/);

console.log('✓ Pakli-, Gyors meccs- és Torna-indítás: kompatibilis, tranzakciós és mentéskímélő staging rendben');
