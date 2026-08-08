import assert from 'node:assert/strict';

import { APP_STORAGE_KEYS } from '../js/app/configuration.js';
import {
  SESSION_RECOVERY_ISSUE,
  SESSION_RECOVERY_LINEUP_STORAGE_KEY,
  createSessionRecoveryService,
} from '../js/services/session-recovery-service.js';
import {
  QUICK_MATCH_INFLIGHT_STORAGE_KEY,
  QUICK_MATCH_LAUNCH_STORAGE_KEY,
} from '../js/services/quick-match-storage-service.js';
import {
  TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY,
  TOURNAMENT_STORAGE_KEY,
} from '../js/services/tournament-storage-service.js';

const createMemoryStorage = initial => {
  const values = new Map(Object.entries(initial ?? {}).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : JSON.stringify(value),
  ]));
  return {
    values,
    readString(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; },
    writeString(key, value) { values.set(key, String(value)); return true; },
    readJson(key, fallback = null) {
      if (!values.has(key)) return fallback;
      try { return JSON.parse(values.get(key)); } catch { return fallback; }
    },
    writeJson(key, value) { values.set(key, JSON.stringify(value)); return true; },
    remove(key) { values.delete(key); return true; },
  };
};

const tournament = (overrides = {}) => ({
  id: 't-1',
  humanTeamId: 'club-a',
  participants: [{ id: 'club-a' }, { id: 'club-b' }, { id: 'club-c' }, { id: 'club-d' }],
  rounds: [],
  status: 'active',
  matchMode: 'classic',
  currentMatchId: null,
  currentMatchMode: null,
  currentLineupIds: [],
  lastLineupIds: [],
  playerStats: {},
  ...overrides,
});

const createTournamentStub = ({ active = tournament(), pending = null, saveFails = false } = {}) => {
  let current = active;
  let pendingState = pending;
  const calls = { commit: 0, rollback: 0, save: 0 };
  return {
    calls,
    read: () => current,
    readPendingLaunch: () => pendingState,
    rollbackPendingLaunch: () => { calls.rollback += 1; pendingState = null; return true; },
    commitPendingLaunch: () => {
      calls.commit += 1;
      if (!pendingState) return true;
      current = pendingState.next;
      pendingState = null;
      return true;
    },
    save: value => {
      calls.save += 1;
      if (saveFails) return false;
      current = value;
      return true;
    },
  };
};

const createQuickStub = ({ launch = null, inflight = null, setup = null } = {}) => {
  let currentLaunch = launch;
  let currentInflight = inflight;
  const calls = { clear: 0, clearInflight: 0, restoreInflight: 0 };
  return {
    calls,
    peekLaunch: () => currentLaunch,
    peekInflightLaunch: () => currentInflight,
    readSetup: () => setup,
    clearLaunch: () => { calls.clear += 1; currentLaunch = null; return true; },
    clearInflightLaunch: () => { calls.clearInflight += 1; currentInflight = null; return true; },
    restoreInflightLaunch: () => {
      calls.restoreInflight += 1;
      if (!currentInflight) return false;
      currentLaunch = currentInflight;
      currentInflight = null;
      return true;
    },
  };
};

{
  const previous = tournament();
  const next = tournament({ currentMatchId: 'm-1', currentMatchMode: 'classic', currentLineupIds: ['p1'] });
  const pending = { previous, next };
  const storage = createMemoryStorage({
    [TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY]: { previous, next },
    [SESSION_RECOVERY_LINEUP_STORAGE_KEY]: { tournamentId: 't-1', matchId: 'm-1', humanIds: ['p1'] },
  });
  const tournamentStorage = createTournamentStub({ active: previous, pending });
  const quickStorage = createQuickStub();
  const service = createSessionRecoveryService({ storage, tournamentStorage, quickStorage, matchById: () => null });
  const report = service.reconcile([]);
  assert.equal(tournamentStorage.calls.rollback, 1, 'Launch marker nélküli pending tornát vissza kell görgetni.');
  assert.ok(report.issues.includes(SESSION_RECOVERY_ISSUE.ORPHAN_TOURNAMENT_PENDING));
  assert.equal(storage.readJson(SESSION_RECOVERY_LINEUP_STORAGE_KEY, null), null, 'Az árva lineup staginget törölni kell.');
}

{
  const previous = tournament();
  const next = tournament({ currentMatchId: 'm-2', currentMatchMode: 'classic', currentLineupIds: ['p2'] });
  const pending = { previous, next };
  const storage = createMemoryStorage({ [TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY]: { previous, next } });
  const tournamentStorage = createTournamentStub({ active: previous, pending });
  const launch = { mode: 'classic', difficulty: 'medium', createdAt: '2026-08-08T12:00:00.000Z' };
  const quickStorage = createQuickStub({ launch, setup: { mode: 'classic' } });
  const service = createSessionRecoveryService({ storage, tournamentStorage, quickStorage, matchById: () => ({ id: 'm-2' }) });
  const report = service.reconcile([{ id: 'p2' }]);
  assert.equal(tournamentStorage.calls.commit, 1, 'Érvényes kétoldali stagingnél a torna tranzakciót be kell fejezni.');
  assert.ok(report.actions.includes('tournament-launch-committed'));
  assert.equal(quickStorage.peekLaunch(), launch, 'A Quick Match launch marker Session indulásig megmarad.');
}

{
  const previous = tournament();
  const next = tournament({ currentMatchId: 'm-3', currentMatchMode: 'classic', currentLineupIds: ['p3'] });
  const pending = { previous, next };
  const storage = createMemoryStorage({
    [TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY]: { previous, next },
    [QUICK_MATCH_LAUNCH_STORAGE_KEY]: { mode: 'classic' },
    [SESSION_RECOVERY_LINEUP_STORAGE_KEY]: { tournamentId: 't-1', matchId: 'm-3', humanIds: ['p3'] },
  });
  const tournamentStorage = createTournamentStub({ active: previous, pending });
  const quickStorage = createQuickStub({ launch: { mode: 'classic', difficulty: 'medium' }, setup: null });
  const service = createSessionRecoveryService({ storage, tournamentStorage, quickStorage, matchById: () => null });
  const report = service.reconcile([]);
  assert.equal(quickStorage.calls.clear, 1, 'Setup nélküli launch markert törölni kell.');
  assert.equal(tournamentStorage.calls.rollback, 1, 'Setup nélküli tornaindítást vissza kell görgetni.');
  assert.ok(report.issues.includes(SESSION_RECOVERY_ISSUE.INVALID_QUICK_LAUNCH));
}

{
  const inflight = { mode: 'classic', difficulty: 'medium', createdAt: '2026-08-08T12:10:00.000Z' };
  const storage = createMemoryStorage({ [QUICK_MATCH_INFLIGHT_STORAGE_KEY]: inflight });
  const quickStorage = createQuickStub({ inflight, setup: { mode: 'classic' } });
  const service = createSessionRecoveryService({
    storage,
    tournamentStorage: createTournamentStub(),
    quickStorage,
    matchById: () => null,
  });
  const report = service.reconcile([]);
  assert.equal(quickStorage.calls.restoreInflight, 1, 'Process-kill után az el nem mentett launch handoffot vissza kell állítani.');
  assert.deepEqual(quickStorage.peekLaunch(), inflight);
  assert.ok(report.issues.includes(SESSION_RECOVERY_ISSUE.INTERRUPTED_LAUNCH_HANDOFF));
  assert.ok(report.actions.includes('interrupted-launch-restored'));
}

{
  const baseline = '2026-08-08T11:55:00.000Z';
  const inflight = {
    mode: 'classic',
    difficulty: 'medium',
    createdAt: '2026-08-08T12:10:00.000Z',
    baselineSavedAt: baseline,
  };
  const storage = createMemoryStorage({
    [QUICK_MATCH_INFLIGHT_STORAGE_KEY]: inflight,
    [APP_STORAGE_KEYS.savedMatch]: { savedAt: baseline, mode: 'classic' },
  });
  const quickStorage = createQuickStub({ inflight, setup: { mode: 'classic' } });
  const service = createSessionRecoveryService({
    storage,
    tournamentStorage: createTournamentStub(),
    quickStorage,
    matchById: () => null,
  });
  const report = service.reconcile([]);
  assert.equal(quickStorage.calls.restoreInflight, 1, 'A staging előtti, változatlan régi snapshot nem számíthat sikeres új Sessionnek.');
  assert.equal(quickStorage.calls.clearInflight, 0);
  assert.ok(report.actions.includes('interrupted-launch-restored'));
}

{
  const baseline = '2026-08-08T11:55:00.000Z';
  const inflight = {
    mode: 'classic',
    difficulty: 'medium',
    createdAt: '2026-08-08T12:10:00.000Z',
    baselineSavedAt: baseline,
  };
  const storage = createMemoryStorage({
    [QUICK_MATCH_INFLIGHT_STORAGE_KEY]: inflight,
    [APP_STORAGE_KEYS.savedMatch]: { savedAt: '2026-08-08T12:10:01.000Z', mode: 'classic' },
  });
  const quickStorage = createQuickStub({ inflight, setup: { mode: 'classic' } });
  const service = createSessionRecoveryService({
    storage,
    tournamentStorage: createTournamentStub(),
    quickStorage,
    matchById: () => null,
  });
  const report = service.reconcile([]);
  assert.equal(quickStorage.calls.clearInflight, 1, 'Új Session snapshot után a handoff marker lezárható.');
  assert.equal(quickStorage.calls.restoreInflight, 0);
  assert.ok(report.actions.includes('completed-launch-handoff-cleared'));
  assert.ok(!report.issues.includes(SESSION_RECOVERY_ISSUE.INTERRUPTED_LAUNCH_HANDOFF));
}

{
  const active = tournament({ currentMatchId: 'deleted-match', currentMatchMode: 'classic', currentLineupIds: ['p1'] });
  const storage = createMemoryStorage({ [TOURNAMENT_STORAGE_KEY]: active });
  const tournamentStorage = createTournamentStub({ active });
  const quickStorage = createQuickStub();
  const service = createSessionRecoveryService({
    storage,
    tournamentStorage,
    quickStorage,
    matchById: () => null,
    now: () => new Date('2026-08-08T12:30:00.000Z'),
  });
  const report = service.reconcile([]);
  assert.equal(tournamentStorage.calls.save, 1);
  assert.ok(report.issues.includes(SESSION_RECOVERY_ISSUE.INVALID_CURRENT_MATCH));
  assert.equal(tournamentStorage.read().currentMatchId, null);
  assert.deepEqual(tournamentStorage.read().currentLineupIds, []);
}

{
  const active = tournament({ currentMatchId: 'm-valid', currentMatchMode: 'classic' });
  const storage = createMemoryStorage({
    [TOURNAMENT_STORAGE_KEY]: active,
    [SESSION_RECOVERY_LINEUP_STORAGE_KEY]: { tournamentId: 'other-tournament', matchId: 'old-match', humanIds: ['p1'] },
  });
  const service = createSessionRecoveryService({
    storage,
    tournamentStorage: createTournamentStub({ active }),
    quickStorage: createQuickStub(),
    matchById: () => ({ id: 'm-valid' }),
  });
  const report = service.reconcile([]);
  assert.ok(report.issues.includes(SESSION_RECOVERY_ISSUE.STALE_LINEUP));
  assert.equal(storage.readJson(SESSION_RECOVERY_LINEUP_STORAGE_KEY, null), null);
}

console.log('✓ Session recovery: pending launch, process-kill handoff, snapshot baseline, hibás launch, currentMatch és stale lineup regresszió zöld.');
