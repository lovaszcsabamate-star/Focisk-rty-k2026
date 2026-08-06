import assert from 'node:assert/strict';

import { APP_STORAGE_KEYS } from '../js/app/configuration.js';
import {
  QUICK_MATCH_LAUNCH_STORAGE_KEY,
  QuickMatchStorageError,
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

const values = new Map();
let failPendingWrite = false;
const storage = {
  readJson(key, fallback = null) {
    if (!values.has(key)) return fallback;
    try { return JSON.parse(values.get(key)); } catch { return fallback; }
  },
  readString(key, fallback = null) {
    return values.has(key) ? values.get(key) : fallback;
  },
  writeString(key, value) {
    values.set(key, String(value));
    return true;
  },
  writeJson(key, value) {
    if (key === TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY && failPendingWrite) {
      failPendingWrite = false;
      return false;
    }
    values.set(key, JSON.stringify(value));
    return true;
  },
  remove(key) {
    values.delete(key);
    return true;
  },
};

const teams = Array.from({ length: 4 }, (_, index) => ({
  id: `club:${index + 1}`,
  kind: 'club',
  label: `Csapat ${index + 1}`,
  count: 11,
  selection: { kind: 'club', value: `Csapat ${index + 1}` },
}));
const tournamentService = createTournamentStorageService({ storage });
const tournament = createTournament({
  name: 'Függő mentés teszt',
  category: TOURNAMENT_CATEGORY.HUNGARIAN,
  format: TOURNAMENT_FORMAT.LEAGUE,
  participants: teams,
  humanTeamId: teams[0].id,
  rng: () => 0.25,
});
assert.equal(tournamentService.save(tournament), true);
const match = tournamentNextHumanMatch(tournament);
const stagedTournament = {
  ...tournament,
  currentMatchId: match.id,
  currentMatchMode: 'classic',
  currentLineupIds: ['p1', 'p2', 'p3', 'p4'],
  lastLineupIds: ['p1', 'p2', 'p3', 'p4'],
};

failPendingWrite = true;
assert.equal(tournamentService.save(stagedTournament), false);
assert.equal(tournamentService.read().currentMatchId ?? null, null);
assert.equal(values.has(TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY), false);

const oldDeck = JSON.stringify({ kind: 'nation', value: 'HUN' });
const oldSetup = JSON.stringify({ previous: 'setup' });
const oldLaunch = JSON.stringify({ previous: 'launch' });
values.set(APP_STORAGE_KEYS.deckSelection, oldDeck);
values.set(APP_STORAGE_KEYS.quickMatchSetup, oldSetup);
values.set(APP_STORAGE_KEYS.quickMatchLaunch, oldLaunch);

const quickService = createQuickMatchStorageService({
  storage,
  commitTournamentLaunch: () => tournamentService.commitPendingLaunch(),
  rollbackTournamentLaunch: () => tournamentService.rollbackPendingLaunch(),
});
const staged = quickService.stage({
  playerTeamId: teams[0].id,
  opponentTeamId: teams[1].id,
  playerSelection: teams[0].selection,
  opponentSelection: teams[1].selection,
  mode: 'classic',
  difficulty: 'medium',
  createdAt: '2026-08-06T12:00:00.000Z',
});
assert.equal(staged, false, 'a Gyors meccs nem indulhat el, ha a függő tornaállapot nem menthető');
assert.equal(values.get(APP_STORAGE_KEYS.deckSelection), oldDeck);
assert.equal(values.get(APP_STORAGE_KEYS.quickMatchSetup), oldSetup);
assert.equal(values.get(APP_STORAGE_KEYS.quickMatchLaunch), oldLaunch);
assert.equal(values.has(TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY), false);
assert.equal(JSON.parse(values.get(TOURNAMENT_STORAGE_KEY)).currentMatchId ?? null, null);

const rollbackValues = new Map([
  [APP_STORAGE_KEYS.deckSelection, oldDeck],
  [APP_STORAGE_KEYS.quickMatchSetup, oldSetup],
  [APP_STORAGE_KEYS.quickMatchLaunch, oldLaunch],
]);
let failLaunchWrite = true;
let failDeckRollback = true;
const rollbackFailingStorage = {
  readJson(key, fallback = null) {
    if (!rollbackValues.has(key)) return fallback;
    try { return JSON.parse(rollbackValues.get(key)); } catch { return fallback; }
  },
  readString(key, fallback = null) {
    return rollbackValues.has(key) ? rollbackValues.get(key) : fallback;
  },
  writeString(key, value) {
    if (key === APP_STORAGE_KEYS.deckSelection && failDeckRollback) {
      failDeckRollback = false;
      return false;
    }
    rollbackValues.set(key, String(value));
    return true;
  },
  writeJson(key, value) {
    if (key === QUICK_MATCH_LAUNCH_STORAGE_KEY && failLaunchWrite) {
      failLaunchWrite = false;
      return false;
    }
    rollbackValues.set(key, JSON.stringify(value));
    return true;
  },
  remove(key) {
    rollbackValues.delete(key);
    return true;
  },
};
const rollbackFailingService = createQuickMatchStorageService({
  storage: rollbackFailingStorage,
  commitTournamentLaunch: () => true,
  rollbackTournamentLaunch: () => true,
});
assert.throws(
  () => rollbackFailingService.stage({
    playerTeamId: teams[0].id,
    opponentTeamId: teams[1].id,
    playerSelection: teams[0].selection,
    opponentSelection: teams[1].selection,
    mode: 'classic',
    difficulty: 'medium',
    createdAt: '2026-08-06T12:00:00.000Z',
  }),
  error => error instanceof QuickMatchStorageError && error.code === 'STAGING_ROLLBACK_FAILED',
  'a részleges staging-rollback nem maradhat néma',
);
assert.equal(
  rollbackValues.get(APP_STORAGE_KEYS.quickMatchSetup),
  oldSetup,
  'egy rollback-hiba nem szakíthatja meg a többi staging-kulcs helyreállítását',
);
assert.equal(rollbackValues.get(APP_STORAGE_KEYS.quickMatchLaunch), oldLaunch);

console.log('✓ Sikertelen torna-staging és rollback-hiba után sem marad észrevétlen részleges állapot');
