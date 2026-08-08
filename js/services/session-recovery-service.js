/**
 * Beta Stabilization 1.2 – induláskori session- és launch-helyreállítás.
 *
 * A szolgáltatás nem töröl érvényes tornát vagy mérkőzésmentést. Kizárólag
 * félbemaradt staging tranzakciókat, érvénytelen currentMatch hivatkozásokat és
 * már nem használható egyszeri lineup staginget rendez.
 */

import { APP_STORAGE_KEYS } from '../app/configuration.js';
import { storageService } from './storage-service.js';
import {
  quickMatchStorageService,
  QUICK_MATCH_INFLIGHT_STORAGE_KEY,
  QUICK_MATCH_LAUNCH_STORAGE_KEY,
} from './quick-match-storage-service.js';
import {
  tournamentStorageService,
  TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY,
  TOURNAMENT_STORAGE_KEY,
} from './tournament-storage-service.js';
import { tournamentMatchById } from '../tournament/tournament-domain.js';

export const SESSION_RECOVERY_LINEUP_STORAGE_KEY = 'fociskartyak.tournament-lineup.v1';

export const SESSION_RECOVERY_ISSUE = Object.freeze({
  INVALID_QUICK_LAUNCH: 'invalid-quick-launch',
  INTERRUPTED_LAUNCH_HANDOFF: 'interrupted-launch-handoff',
  ORPHAN_TOURNAMENT_PENDING: 'orphan-tournament-pending',
  INVALID_TOURNAMENT_PENDING: 'invalid-tournament-pending',
  INVALID_CURRENT_MATCH: 'invalid-current-match',
  STALE_LINEUP: 'stale-lineup',
  STORAGE_FAILURE: 'storage-failure',
});

const recoveryText = value => String(value ?? '').trim();
const recoveryRecord = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const recoveryFreeze = report => Object.freeze({
  ok: report.issues.length === 0 || !report.blocked,
  blocked: Boolean(report.blocked),
  changed: report.actions.length > 0,
  actions: Object.freeze(report.actions.slice()),
  issues: Object.freeze(report.issues.slice()),
});

export function createSessionRecoveryService({
  storage = storageService,
  quickStorage = quickMatchStorageService,
  tournamentStorage = tournamentStorageService,
  matchById = tournamentMatchById,
  now = () => new Date(),
} = {}) {
  const removeSafely = (key, report, action) => {
    if (storage?.remove?.(key)) {
      if (action) report.actions.push(action);
      return true;
    }
    report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
    report.blocked = true;
    return false;
  };

  const clearTemporaryLineup = (report, action = 'stale-lineup-cleared') => (
    removeSafely(SESSION_RECOVERY_LINEUP_STORAGE_KEY, report, action)
  );

  const repairInvalidCurrentMatch = (active, report) => {
    if (!active?.currentMatchId) return active;
    const current = matchById?.(active, active.currentMatchId) ?? null;
    if (current) return active;

    const repaired = {
      ...active,
      currentMatchId: null,
      currentMatchMode: null,
      currentLineupIds: [],
      updatedAt: now().toISOString(),
    };
    if (!tournamentStorage?.save?.(repaired)) {
      report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
      report.blocked = true;
      return active;
    }
    report.issues.push(SESSION_RECOVERY_ISSUE.INVALID_CURRENT_MATCH);
    report.actions.push('invalid-current-match-cleared');
    return repaired;
  };

  const reconcileInflightLaunch = report => {
    let launch = quickStorage?.peekLaunch?.() ?? null;
    const inflight = quickStorage?.peekInflightLaunch?.() ?? null;
    if (!inflight) return launch;

    const rawInflight = recoveryRecord(storage?.readJson?.(QUICK_MATCH_INFLIGHT_STORAGE_KEY, null));
    const hasSavedBaseline = Boolean(
      rawInflight && Object.prototype.hasOwnProperty.call(rawInflight, 'baselineSavedAt'),
    );
    const savedMatch = recoveryRecord(storage?.readJson?.(APP_STORAGE_KEYS.savedMatch, null));
    const currentSavedAt = recoveryText(savedMatch?.savedAt) || null;
    const baselineSavedAt = recoveryText(inflight.baselineSavedAt) || null;
    const sessionCreatedNewSnapshot = hasSavedBaseline && currentSavedAt !== baselineSavedAt;

    if (sessionCreatedNewSnapshot || launch) {
      if (quickStorage?.clearInflightLaunch?.() === false) {
        report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
        report.blocked = true;
      } else {
        report.actions.push(sessionCreatedNewSnapshot ? 'completed-launch-handoff-cleared' : 'duplicate-launch-handoff-cleared');
      }
      return launch;
    }

    report.issues.push(SESSION_RECOVERY_ISSUE.INTERRUPTED_LAUNCH_HANDOFF);
    if (quickStorage?.restoreInflightLaunch?.() === false) {
      report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
      report.blocked = true;
      return null;
    }
    report.actions.push('interrupted-launch-restored');
    return quickStorage?.peekLaunch?.() ?? inflight;
  };

  const reconcile = (players = []) => {
    const report = { actions: [], issues: [], blocked: false };
    const rawPending = storage?.readJson?.(TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY, null) ?? null;
    let pending = tournamentStorage?.readPendingLaunch?.() ?? null;
    let launch = reconcileInflightLaunch(report);
    const setup = quickStorage?.readSetup?.(players) ?? null;

    if (rawPending && !pending) {
      report.issues.push(SESSION_RECOVERY_ISSUE.INVALID_TOURNAMENT_PENDING);
      if (tournamentStorage?.rollbackPendingLaunch?.() === false) {
        report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
        report.blocked = true;
      } else {
        report.actions.push('invalid-tournament-pending-cleared');
      }
      pending = null;
    }

    // Launch marker setup nélkül nem indítható biztonságosan. Ilyenkor az aktív
    // torna előző konzisztens állapota marad az igazságforrás.
    if (launch && !setup) {
      report.issues.push(SESSION_RECOVERY_ISSUE.INVALID_QUICK_LAUNCH);
      if (quickStorage?.clearLaunch?.() === false) {
        report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
        report.blocked = true;
      } else {
        report.actions.push('invalid-quick-launch-cleared');
      }
      quickStorage?.clearInflightLaunch?.();
      if (pending) {
        if (tournamentStorage?.rollbackPendingLaunch?.() === false) {
          report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
          report.blocked = true;
        } else {
          report.actions.push('tournament-launch-rolled-back');
        }
      }
      clearTemporaryLineup(report);
      launch = null;
      pending = null;
    }

    // Ha az app a torna next-state kiírása után, de a Quick Match staging előtt
    // zárult be, nincs launch marker: visszaállunk a korábbi Torna Centerre.
    if (pending && !launch) {
      report.issues.push(SESSION_RECOVERY_ISSUE.ORPHAN_TOURNAMENT_PENDING);
      if (tournamentStorage?.rollbackPendingLaunch?.() === false) {
        report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
        report.blocked = true;
      } else {
        report.actions.push('orphan-tournament-launch-rolled-back');
        clearTemporaryLineup(report);
      }
      pending = null;
    }

    // Ha mindkét staging fél megvan, az eredeti tranzakció determinisztikusan
    // befejezhető. A Quick Match marker továbbra is megmarad a Session indulásáig.
    if (pending && launch && setup) {
      if (tournamentStorage?.commitPendingLaunch?.() === false) {
        report.issues.push(SESSION_RECOVERY_ISSUE.STORAGE_FAILURE);
        report.blocked = true;
      } else {
        report.actions.push('tournament-launch-committed');
        pending = null;
      }
    }

    let active = tournamentStorage?.read?.() ?? null;
    const rawTournament = storage?.readJson?.(TOURNAMENT_STORAGE_KEY, null) ?? null;
    if (rawTournament && !active) {
      // Nem töröljük automatikusan: a Torna UI biztonságosan új torna indítását
      // kínálhatja, miközben a hibás nyers adat diagnosztikai célra megmarad.
      report.issues.push(SESSION_RECOVERY_ISSUE.INVALID_CURRENT_MATCH);
    }
    if (active) active = repairInvalidCurrentMatch(active, report);

    const stagedLineup = recoveryRecord(storage?.readJson?.(SESSION_RECOVERY_LINEUP_STORAGE_KEY, null));
    if (stagedLineup) {
      const expectedTournamentId = recoveryText(active?.id || pending?.next?.id);
      const expectedMatchId = recoveryText(active?.currentMatchId || pending?.next?.currentMatchId);
      const lineupTournamentId = recoveryText(stagedLineup.tournamentId);
      const lineupMatchId = recoveryText(stagedLineup.matchId);
      const matchesActiveLaunch = Boolean(
        expectedTournamentId
        && expectedMatchId
        && lineupTournamentId === expectedTournamentId
        && lineupMatchId === expectedMatchId,
      );
      if (!matchesActiveLaunch) {
        report.issues.push(SESSION_RECOVERY_ISSUE.STALE_LINEUP);
        clearTemporaryLineup(report);
      }
    }

    // Sérült JSON esetén readJson nullt ad. Ha nyers szöveg mégis létezik,
    // eltávolítjuk kizárólag az egyszer használatos launch/lineup staginget.
    const rawLaunch = storage?.readString?.(QUICK_MATCH_LAUNCH_STORAGE_KEY, null);
    if (rawLaunch != null && !quickStorage?.peekLaunch?.()) {
      report.issues.push(SESSION_RECOVERY_ISSUE.INVALID_QUICK_LAUNCH);
      removeSafely(QUICK_MATCH_LAUNCH_STORAGE_KEY, report, 'malformed-quick-launch-cleared');
    }
    const rawInflightValue = storage?.readString?.(QUICK_MATCH_INFLIGHT_STORAGE_KEY, null);
    if (rawInflightValue != null && !quickStorage?.peekInflightLaunch?.()) {
      report.issues.push(SESSION_RECOVERY_ISSUE.INTERRUPTED_LAUNCH_HANDOFF);
      removeSafely(QUICK_MATCH_INFLIGHT_STORAGE_KEY, report, 'malformed-launch-handoff-cleared');
    }
    const rawLineup = storage?.readString?.(SESSION_RECOVERY_LINEUP_STORAGE_KEY, null);
    if (rawLineup != null && !recoveryRecord(storage?.readJson?.(SESSION_RECOVERY_LINEUP_STORAGE_KEY, null))) {
      report.issues.push(SESSION_RECOVERY_ISSUE.STALE_LINEUP);
      clearTemporaryLineup(report, 'malformed-lineup-cleared');
    }

    return recoveryFreeze(report);
  };

  return Object.freeze({ reconcile });
}

export const sessionRecoveryService = createSessionRecoveryService();
export const reconcileSessionRecovery = (...args) => sessionRecoveryService.reconcile(...args);
