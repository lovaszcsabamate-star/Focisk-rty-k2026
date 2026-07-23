import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SESSION_EXIT_CONFIRMATION_MS,
  SESSION_LIFECYCLE_MESSAGES,
  createSessionLifecycleService,
} from '../js/app/session-lifecycle-service.js';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

const windowRef = new FakeEventTarget();
const documentRef = new FakeEventTarget();
documentRef.title = 'Fociskártyák 2026';
documentRef.visibilityState = 'visible';

const historyCalls = [];
const historyRef = {
  replaceState: (...args) => historyCalls.push(['replaceState', ...args]),
  pushState: (...args) => historyCalls.push(['pushState', ...args]),
  go: (...args) => historyCalls.push(['go', ...args]),
};
const logCalls = [];
const logger = { error: (...args) => logCalls.push(args) };
let currentTime = 10_000;
let saveCount = 0;
let backCount = 0;
const toasts = [];

const lifecycle = createSessionLifecycleService({
  windowRef,
  documentRef,
  historyRef,
  logger,
  now: () => currentTime,
});

assert.equal(lifecycle.isInstalled(), false);
assert.equal(lifecycle.install({
  onSave: () => { saveCount += 1; return true; },
  onBackAction: () => { backCount += 1; },
  onToast: (...args) => toasts.push(args),
}), true);
assert.equal(lifecycle.install({
  onSave: () => {}, onBackAction: () => {}, onToast: () => {},
}), false, 'az install idempotens');
assert.equal(lifecycle.isInstalled(), true);
assert.equal(lifecycle.hasHistoryGuard(), true);
assert.equal(windowRef.listenerCount('pagehide'), 1);
assert.equal(windowRef.listenerCount('error'), 1);
assert.equal(windowRef.listenerCount('unhandledrejection'), 1);
assert.equal(windowRef.listenerCount('popstate'), 1);
assert.equal(documentRef.listenerCount('visibilitychange'), 1);
assert.deepEqual(historyCalls.slice(0, 2).map(call => call[0]), ['replaceState', 'pushState']);

documentRef.dispatch('visibilitychange');
assert.equal(saveCount, 0, 'látható dokumentumnál nem ment');
documentRef.visibilityState = 'hidden';
documentRef.dispatch('visibilitychange');
assert.equal(saveCount, 1, 'háttérbe kerüléskor ment');
windowRef.dispatch('pagehide');
assert.equal(saveCount, 2, 'pagehide eseménynél ment');

const runtimeError = new Error('runtime');
windowRef.dispatch('error', { error: runtimeError, message: 'runtime' });
assert.equal(saveCount, 3);
assert.deepEqual(toasts.at(-1), [SESSION_LIFECYCLE_MESSAGES.runtimeError, 'error', 3200]);
assert.equal(logCalls.at(-1)[1], runtimeError);

const rejection = new Error('async');
windowRef.dispatch('unhandledrejection', { reason: rejection });
assert.equal(saveCount, 4);
assert.deepEqual(toasts.at(-1), [SESSION_LIFECYCLE_MESSAGES.asyncError, 'error', 3200]);
assert.equal(logCalls.at(-1)[1], rejection);

windowRef.dispatch('popstate');
assert.equal(backCount, 1);
assert.equal(historyCalls.at(-1)[0], 'pushState', 'visszaeseménynél újra felépül a history guard');

assert.equal(lifecycle.requestExit(), false);
assert.deepEqual(toasts.at(-1), [SESSION_LIFECYCLE_MESSAGES.exitConfirmation, 'info', undefined]);
currentTime += SESSION_EXIT_CONFIRMATION_MS - 1;
assert.equal(lifecycle.requestExit(), true);
assert.deepEqual(historyCalls.at(-1), ['go', -2]);
assert.equal(windowRef.listenerCount('popstate'), 0, 'megerősített kilépés előtt lekerül a guard');
assert.equal(lifecycle.hasHistoryGuard(), false);

assert.equal(lifecycle.dispose(), true);
assert.equal(lifecycle.dispose(), false, 'a dispose idempotens');
assert.equal(lifecycle.isInstalled(), false);
assert.equal(windowRef.listenerCount('pagehide'), 0);
assert.equal(windowRef.listenerCount('error'), 0);
assert.equal(windowRef.listenerCount('unhandledrejection'), 0);
assert.equal(documentRef.listenerCount('visibilitychange'), 0);

const restrictedWindow = new FakeEventTarget();
const restrictedDocument = new FakeEventTarget();
restrictedDocument.title = 'Beágyazott játék';
restrictedDocument.visibilityState = 'visible';
const restrictedLifecycle = createSessionLifecycleService({
  windowRef: restrictedWindow,
  documentRef: restrictedDocument,
  historyRef: {
    replaceState: () => { throw new Error('blocked'); },
    pushState: () => { throw new Error('blocked'); },
    go: () => { throw new Error('blocked'); },
  },
});
assert.equal(restrictedLifecycle.install({
  onSave: () => true,
  onBackAction: () => {},
  onToast: () => {},
}), true);
assert.equal(restrictedLifecycle.hasHistoryGuard(), false, 'korlátozott böngészőben a history integráció opcionális');
assert.equal(restrictedWindow.listenerCount('popstate'), 0);
assert.equal(restrictedLifecycle.dispose(), true);

const failingWindow = new FakeEventTarget();
const failingDocument = new FakeEventTarget();
failingDocument.title = 'Mentési hiba';
failingDocument.visibilityState = 'hidden';
const failingLogs = [];
const failingLifecycle = createSessionLifecycleService({
  windowRef: failingWindow,
  documentRef: failingDocument,
  historyRef: null,
  logger: { error: (...args) => failingLogs.push(args) },
});
failingLifecycle.install({
  onSave: () => { throw new Error('save failed'); },
  onBackAction: () => {},
  onToast: () => {},
});
assert.doesNotThrow(() => failingDocument.dispatch('visibilitychange'));
assert.match(String(failingLogs.at(-1)?.[0]), /automatikus mentés/);
failingLifecycle.dispose();

const main = read('../js/main.js');
const build = read('../scripts/build-standalone.mjs');
const serviceWorker = read('../sw.js');

assert.match(main, /app\/session-lifecycle-service\.js/);
assert.match(main, /createSessionLifecycleService\(\)/);
assert.match(main, /this\.lifecycle\.install\(/);
assert.match(main, /this\.lifecycle\.requestExit\(\)/);
assert.doesNotMatch(main, /this\.exitTapAt/);
assert.doesNotMatch(main, /this\._popStateHandler/);
assert.doesNotMatch(main, /window\.addEventListener\('pagehide'/);
assert.doesNotMatch(main, /window\.addEventListener\('error'/);
assert.doesNotMatch(main, /window\.addEventListener\('unhandledrejection'/);
assert.ok(
  build.indexOf("'js/app/session-lifecycle-service.js'") < build.indexOf("'js/main.js'"),
  'a lifecycle service a Session előtt kerül a standalone bundle-be',
);
assert.match(serviceWorker, /\.\/js\/app\/session-lifecycle-service\.js/);

console.log('✓ A Session böngésző-életciklusa külön, idempotens és tesztelhető szolgáltatásban működik');
