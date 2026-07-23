/** Böngésző-életciklus és vissza-navigáció a Session UI-logikájától leválasztva. */

export const SESSION_EXIT_CONFIRMATION_MS = 1600;

export const SESSION_LIFECYCLE_MESSAGES = Object.freeze({
  runtimeError: 'Váratlan hiba történt. A játékállást megőriztük.',
  asyncError: 'Egy művelet nem fejeződött be. Próbáld újra.',
  exitConfirmation: 'A kilépéshez nyomd meg újra a Vissza gombot',
});

const sessionLifecycleDefaultWindow = () => globalThis.window;
const sessionLifecycleDefaultDocument = () => globalThis.document;
const sessionLifecycleDefaultHistory = () => globalThis.history;
const sessionLifecycleDefaultLogger = () => globalThis.console;
const sessionLifecycleDefaultNow = () => Date.now();

const sessionLifecycleRequireFunction = (value, name) => {
  if (typeof value !== 'function') throw new TypeError(`A lifecycle szolgáltatáshoz ${name} függvény szükséges.`);
};

export function createSessionLifecycleService({
  windowRef = sessionLifecycleDefaultWindow(),
  documentRef = sessionLifecycleDefaultDocument(),
  historyRef = sessionLifecycleDefaultHistory(),
  logger = sessionLifecycleDefaultLogger(),
  now = sessionLifecycleDefaultNow,
  exitConfirmationMs = SESSION_EXIT_CONFIRMATION_MS,
} = {}) {
  if (!windowRef?.addEventListener || !windowRef?.removeEventListener) {
    throw new TypeError('A lifecycle szolgáltatáshoz böngésző window eseménycél szükséges.');
  }
  if (!documentRef?.addEventListener || !documentRef?.removeEventListener) {
    throw new TypeError('A lifecycle szolgáltatáshoz document eseménycél szükséges.');
  }
  sessionLifecycleRequireFunction(now, 'now');
  if (!Number.isFinite(exitConfirmationMs) || exitConfirmationMs <= 0) {
    throw new TypeError('A kilépési megerősítés időablaka nem érvényes.');
  }

  let installed = false;
  let historyGuardInstalled = false;
  let lastExitRequestAt = null;
  let handlers = null;
  let callbacks = null;

  const logError = (...args) => logger?.error?.(...args);

  const saveSafely = () => {
    try {
      return Boolean(callbacks?.onSave?.());
    } catch (error) {
      logError('[lifecycle] Az automatikus mentés nem sikerült:', error);
      return false;
    }
  };

  const toastSafely = (message, tone = 'info', duration) => {
    try {
      if (duration == null) callbacks?.onToast?.(message, tone);
      else callbacks?.onToast?.(message, tone, duration);
    } catch (error) {
      logError('[lifecycle] Az értesítés megjelenítése nem sikerült:', error);
    }
  };

  const pushHistoryGuard = () => {
    if (!historyGuardInstalled) return false;
    try {
      historyRef.pushState({ fociskartyak: 'guard' }, documentRef.title);
      return true;
    } catch {
      historyGuardInstalled = false;
      return false;
    }
  };

  const installHistoryGuard = () => {
    if (!historyRef?.replaceState || !historyRef?.pushState || !historyRef?.go) return false;
    try {
      historyRef.replaceState({ fociskartyak: 'base' }, documentRef.title);
      historyRef.pushState({ fociskartyak: 'guard' }, documentRef.title);
      windowRef.addEventListener('popstate', handlers.popstate);
      historyGuardInstalled = true;
      return true;
    } catch {
      historyGuardInstalled = false;
      return false;
    }
  };

  const install = ({ onSave, onToast, onBackAction } = {}) => {
    if (installed) return false;
    sessionLifecycleRequireFunction(onSave, 'onSave');
    sessionLifecycleRequireFunction(onToast, 'onToast');
    sessionLifecycleRequireFunction(onBackAction, 'onBackAction');
    callbacks = { onSave, onToast, onBackAction };

    handlers = {
      visibilitychange: () => {
        if (documentRef.visibilityState === 'hidden') saveSafely();
      },
      pagehide: () => saveSafely(),
      error: event => {
        logError('[ui] Nem kezelt hiba:', event?.error ?? event?.message);
        toastSafely(SESSION_LIFECYCLE_MESSAGES.runtimeError, 'error', 3200);
        saveSafely();
      },
      unhandledrejection: event => {
        logError('[ui] Nem kezelt aszinkron hiba:', event?.reason);
        toastSafely(SESSION_LIFECYCLE_MESSAGES.asyncError, 'error', 3200);
        saveSafely();
      },
      popstate: () => {
        pushHistoryGuard();
        callbacks?.onBackAction?.();
      },
    };

    documentRef.addEventListener('visibilitychange', handlers.visibilitychange);
    windowRef.addEventListener('pagehide', handlers.pagehide);
    windowRef.addEventListener('error', handlers.error);
    windowRef.addEventListener('unhandledrejection', handlers.unhandledrejection);
    installHistoryGuard();
    installed = true;
    return true;
  };

  const requestExit = () => {
    if (!installed) return false;
    const currentTime = Number(now());
    const confirmed = Number.isFinite(currentTime)
      && lastExitRequestAt != null
      && currentTime - lastExitRequestAt >= 0
      && currentTime - lastExitRequestAt < exitConfirmationMs;

    if (!confirmed) {
      lastExitRequestAt = Number.isFinite(currentTime) ? currentTime : null;
      toastSafely(SESSION_LIFECYCLE_MESSAGES.exitConfirmation, 'info');
      return false;
    }

    lastExitRequestAt = null;
    if (historyGuardInstalled) {
      windowRef.removeEventListener('popstate', handlers.popstate);
      historyGuardInstalled = false;
    }
    try {
      historyRef?.go?.(-2);
    } catch {
      // A tényleges kilépés korlátozott beágyazott böngészőben nem garantálható.
    }
    return true;
  };

  const dispose = () => {
    if (!installed) return false;
    documentRef.removeEventListener('visibilitychange', handlers.visibilitychange);
    windowRef.removeEventListener('pagehide', handlers.pagehide);
    windowRef.removeEventListener('error', handlers.error);
    windowRef.removeEventListener('unhandledrejection', handlers.unhandledrejection);
    if (historyGuardInstalled) windowRef.removeEventListener('popstate', handlers.popstate);

    installed = false;
    historyGuardInstalled = false;
    lastExitRequestAt = null;
    handlers = null;
    callbacks = null;
    return true;
  };

  return Object.freeze({
    install,
    dispose,
    requestExit,
    isInstalled: () => installed,
    hasHistoryGuard: () => historyGuardInstalled,
  });
}
