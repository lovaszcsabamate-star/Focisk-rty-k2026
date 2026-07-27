import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DECK_SELECTION_MENU_STYLE_ID,
  createDeckSelectionMenuController,
  installDeckSelectionMenu,
} from '../js/ui/deck-selection-menu-component.js';

const readSource = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const createFakeDocument = ({ readyState = 'loading' } = {}) => {
  const listeners = new Map();
  const appended = [];
  const documentRef = {
    readyState,
    body: { nodeName: 'BODY' },
    head: {
      appendChild(node) {
        appended.push(node);
        return node;
      },
    },
    createElement(tagName) {
      return {
        tagName: String(tagName).toUpperCase(),
        id: '',
        className: '',
        textContent: '',
      };
    },
    querySelector(selector) {
      if (selector === `#${DECK_SELECTION_MENU_STYLE_ID}`) {
        return appended.find(node => node.id === DECK_SELECTION_MENU_STYLE_ID) ?? null;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  return { documentRef, listeners, appended };
};

assert.equal(DECK_SELECTION_MENU_STYLE_ID, 'deck-selection-styles');

const delayed = createFakeDocument();
let delayedObserveCount = 0;
let delayedDisconnectCount = 0;
let delayedObservedTarget = null;
const delayedController = createDeckSelectionMenuController({
  documentRef: delayed.documentRef,
  observerFactory: () => ({
    observe(target) {
      delayedObserveCount += 1;
      delayedObservedTarget = target;
    },
    disconnect() {
      delayedDisconnectCount += 1;
    },
  }),
});

assert.equal(Object.isFrozen(delayedController), true);
const delayedCleanup = delayedController.mount([], { kind: 'random', value: '' });
assert.equal(typeof delayedCleanup, 'function');
assert.equal(delayed.appended.length, 1);
assert.equal(delayed.appended[0].id, DECK_SELECTION_MENU_STYLE_ID);
assert.match(delayed.appended[0].textContent, /\.deck-selector/);
assert.equal(delayedObserveCount, 0);
assert.equal(typeof delayed.listeners.get('DOMContentLoaded'), 'function');

delayed.listeners.get('DOMContentLoaded')();
assert.equal(delayedObserveCount, 1);
assert.equal(delayedObservedTarget, delayed.documentRef.body);
delayedCleanup();
assert.equal(delayedDisconnectCount, 1);
assert.equal(delayed.listeners.has('DOMContentLoaded'), false);
delayedCleanup();
assert.equal(delayedDisconnectCount, 1);

const immediate = createFakeDocument({ readyState: 'complete' });
let immediateObserveCount = 0;
let immediateDisconnectCount = 0;
const immediateController = createDeckSelectionMenuController({
  documentRef: immediate.documentRef,
  observerFactory: () => ({
    observe() { immediateObserveCount += 1; },
    disconnect() { immediateDisconnectCount += 1; },
  }),
});
const immediateCleanup = immediateController.mount({ players: [] }, null);
assert.equal(immediateObserveCount, 1);
assert.equal(immediate.listeners.size, 0);
immediateCleanup();
assert.equal(immediateDisconnectCount, 1);

const noDocumentController = createDeckSelectionMenuController({ documentRef: null });
const noDocumentCleanup = noDocumentController.mount([], null);
assert.equal(typeof noDocumentCleanup, 'function');
noDocumentCleanup();

const defaultCleanup = installDeckSelectionMenu([], null);
assert.equal(typeof defaultCleanup, 'function');
defaultCleanup();

const componentSource = readSource('../js/ui/deck-selection-menu-component.js');
const selectorCss = readSource('../css/deck-selection-menu.css');
const compatibilitySource = readSource('../js/deck-selection.js');
const buildSource = readSource('../scripts/build-standalone.mjs');
const buildWithSettingsSource = readSource('../scripts/build-standalone-with-settings.mjs');
const indexSource = readSource('../index.html');
const serviceWorkerSource = readSource('../sw.js');

assert.match(componentSource, /createDeckSelectionMenuController/);
assert.match(componentSource, /MutationObserver|observerFactory/);
assert.match(componentSource, /deck-selection-styles/);
assert.match(componentSource, /Pakli alkalmazása/);
assert.match(componentSource, /A pakli cseréje törli a jelenlegi mentett mérkőzést/);
assert.match(componentSource, /deckSelectionStorageService/);
assert.match(componentSource, /Válaszd ki a csapatodat/);
assert.match(componentSource, /A gép egy másik klubot választ ellenfélnek/);
assert.match(componentSource, /Magyar bajnokság/);
assert.match(componentSource, /team-tile__colours/);
assert.match(componentSource, /Ezzel a csapattal játszom/);
assert.match(componentSource, /role', 'dialog/);
assert.match(componentSource, /aria-modal/);
assert.match(selectorCss, /\.deck-selector\[open\] > \.deck-selector__body/);
assert.match(selectorCss, /position:\s*fixed/);
assert.match(selectorCss, /grid-template-columns:\s*repeat\(3/);
assert.match(selectorCss, /@media \(max-width: 700px\)/);
assert.match(selectorCss, /prefers-reduced-motion/);
assert.match(indexSource, /css\/deck-selection-menu\.css/);
assert.match(buildWithSettingsSource, /TEAM_SELECTOR_CSS_LINK/);
assert.match(buildWithSettingsSource, /teamSelectorCss/);
assert.match(serviceWorkerSource, /fociskartyak-2026-v74/);
assert.match(serviceWorkerSource, /\.\/css\/deck-selection-menu\.css/);
assert.match(compatibilitySource, /\.\/ui\/deck-selection-menu-component\.js/);
assert.match(compatibilitySource, /installDeckSelectionMenu/);
assert.doesNotMatch(
  compatibilitySource,
  /\bdocument\b|\bMutationObserver\b|deck-selection-styles|Pakli alkalmazása|location\.reload|confirm\(/,
);
assert.ok(
  buildSource.indexOf("'js/ui/deck-selection-menu-component.js'")
    < buildSource.indexOf("'js/deck-selection.js'"),
  'a pakliválasztó UI-komponens a kompatibilitási homlokzat előtt szerepel',
);
assert.match(serviceWorkerSource, /\.\/js\/ui\/deck-selection-menu-component\.js/);

console.log('✓ Teljes képernyős Gyors meccs csapatválasztó, reszponzív stílus, PWA és kompatibilis homlokzat: rendben');
