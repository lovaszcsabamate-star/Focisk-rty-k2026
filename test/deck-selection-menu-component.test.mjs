import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DECK_SELECTION_MENU_STYLE_ID,
  createDeckSelectionMenuController,
  installDeckSelectionMenu,
} from '../js/ui/deck-selection-menu-component.js';
import {
  QUICK_MATCH_CATEGORY,
  buildQuickMatchCatalog,
  buildQuickMatchPayload,
  chooseQuickMatchOpponent,
  quickMatchEntriesForCategory,
  validateQuickMatchPairing,
} from '../js/domain/quick-match-domain.js';

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

const players = Array.from({ length: 44 }, (_, index) => {
  const group = Math.floor(index / 11);
  return {
    id: `player-${index + 1}`,
    name: `Játékos ${index + 1}`,
    club: ['Alfa FC', 'Béta FC', 'Gamma FC', 'Delta FC'][group],
    clubName: ['Alfa FC', 'Béta FC', 'Gamma FC', 'Delta FC'][group],
    nation: index % 2 ? 'Serbia' : 'Hungary',
    nationality: index % 2 ? 'Serbia' : 'Hungary',
    competition: group < 2 ? 'Liga A' : 'Liga B',
  };
});
const catalog = buildQuickMatchCatalog(players);
assert.equal(quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.HUNGARIAN).length, 4);
assert.equal(quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.LEAGUE).length, 2);
assert.equal(quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.NATIONAL).length, 2);
const clubs = quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.HUNGARIAN);
const chosenOpponent = chooseQuickMatchOpponent(clubs, clubs[0].id, { rng: () => 0 });
assert.notEqual(chosenOpponent.id, clubs[0].id);
const pairing = validateQuickMatchPairing(players, clubs[0].selection, clubs[1].selection);
assert.equal(pairing.valid, true);
const prepared = buildQuickMatchPayload(
  { players, selection: {} },
  clubs[0].selection,
  clubs[1].selection,
  () => 0,
);
assert.equal(prepared.matchup.enabled, true);
assert.notEqual(prepared.matchup.human.key, prepared.matchup.ai.key);
assert.equal(prepared.payload.players.filter(player => player.meta.quickMatchSide === 'human').length, 11);
assert.equal(prepared.payload.players.filter(player => player.meta.quickMatchSide === 'ai').length, 11);
assert.equal(
  validateQuickMatchPairing(players, clubs[0].selection, clubs[0].selection).code,
  'INVALID_OPPONENT',
);

const componentSource = readSource('../js/ui/deck-selection-menu-component.js');
const selectorCss = readSource('../css/deck-selection-menu.css');
const compatibilitySource = readSource('../js/deck-selection.js');
const quickMatchDomainSource = readSource('../js/domain/quick-match-domain.js');
const quickMatchStorageSource = readSource('../js/services/quick-match-storage-service.js');
const buildSource = readSource('../scripts/build-standalone.mjs');
const buildWithSettingsSource = readSource('../scripts/build-standalone-with-settings.mjs');
const indexSource = readSource('../index.html');
const serviceWorkerSource = readSource('../sw.js');

assert.match(componentSource, /createDeckSelectionMenuController/);
assert.match(componentSource, /MutationObserver|observerFactory/);
assert.match(componentSource, /deck-selection-styles/);
assert.match(componentSource, /selectedCategory/);
assert.match(componentSource, /selectedPlayerTeamId/);
assert.match(componentSource, /selectedOpponentTeamId/);
assert.match(componentSource, /selectionStep/);
assert.match(componentSource, /isOpponentDrawing/);
assert.match(componentSource, /validationError/);
assert.match(componentSource, /Lapozz a csapatok között/);
assert.match(componentSource, /EZZEL A CSAPATTAL JÁTSZOM/);
assert.match(componentSource, /ELLENFELED/);
assert.match(componentSource, /MÁSIK ELLENFELET KÉREK/);
assert.match(componentSource, /MECCS INDÍTÁSA/);
assert.match(componentSource, /Magyar bajnokság/);
assert.match(componentSource, /Válogatott/);
assert.match(componentSource, /pointerdown/);
assert.match(componentSource, /ArrowLeft/);
assert.match(componentSource, /popstate/);
assert.match(componentSource, /quickStorage\.stage/);
assert.match(componentSource, /role', 'dialog/);
assert.match(componentSource, /aria-modal/);
assert.doesNotMatch(componentSource, /team-grid|team-tile/);
assert.match(selectorCss, /\.deck-selector\[open\] > \.deck-selector__body/);
assert.match(selectorCss, /height:\s*100dvh/);
assert.match(selectorCss, /safe-area-inset-bottom/);
assert.match(selectorCss, /\.quick-team-card/);
assert.match(selectorCss, /\.quick-match-duel/);
assert.match(selectorCss, /min-width:\s*48px/);
assert.match(selectorCss, /min-height:\s*56px/);
assert.match(selectorCss, /orientation:\s*landscape/);
assert.match(selectorCss, /prefers-reduced-motion/);
assert.match(quickMatchDomainSource, /buildQuickMatchCatalog/);
assert.match(quickMatchDomainSource, /buildQuickMatchPayload/);
assert.match(quickMatchStorageSource, /quick-match-setup:v1|QUICK_MATCH_SETUP_STORAGE_KEY/);
assert.match(indexSource, /css\/deck-selection-menu\.css/);
assert.match(buildWithSettingsSource, /quick-match-domain\.js/);
assert.match(buildWithSettingsSource, /quick-match-storage-service\.js/);
assert.match(buildWithSettingsSource, /quick-team-card/);
assert.match(serviceWorkerSource, /fociskartyak-2026-v76/);
assert.match(serviceWorkerSource, /\.\/js\/domain\/quick-match-domain\.js/);
assert.match(serviceWorkerSource, /\.\/js\/services\/quick-match-storage-service\.js/);
assert.match(compatibilitySource, /\.\/ui\/deck-selection-menu-component\.js/);
assert.match(compatibilitySource, /buildQuickMatchPayload/);
assert.match(compatibilitySource, /readQuickMatchSetup/);
assert.ok(
  buildSource.indexOf("'js/ui/deck-selection-menu-component.js'")
    < buildSource.indexOf("'js/deck-selection.js'"),
  'a pakliválasztó UI-komponens a kompatibilitási homlokzat előtt szerepel',
);

console.log('✓ Kétlépcsős Gyors meccs csapatválasztó, pontos párosítás, mobilbiztonság és PWA: rendben');
