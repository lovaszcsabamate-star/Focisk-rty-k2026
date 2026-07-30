import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DECK_SELECTION_MENU_STYLE_ID,
  createDeckSelectionMenuController,
  installDeckSelectionMenu,
} from '../js/ui/deck-selection-menu-component.js';
import {
  QUICK_MATCH_CATEGORY,
  QUICK_MATCH_NATION_MINIMUM,
  buildQuickMatchCatalog,
  buildQuickMatchPayload,
  chooseQuickMatchOpponent,
  quickMatchEntriesForCategory,
  quickMatchOpponentEntries,
  quickMatchSelectionsCompatible,
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
    querySelectorAll() { return []; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  return { documentRef, listeners, appended };
};

assert.equal(DECK_SELECTION_MENU_STYLE_ID, 'deck-selection-styles');

const delayed = createFakeDocument();
let observeCount = 0;
let disconnectCount = 0;
const delayedController = createDeckSelectionMenuController({
  documentRef: delayed.documentRef,
  observerFactory: () => ({
    observe() { observeCount += 1; },
    disconnect() { disconnectCount += 1; },
  }),
});
const cleanup = delayedController.mount([], { kind: 'random', value: '' });
assert.equal(typeof cleanup, 'function');
assert.equal(delayed.appended[0].id, DECK_SELECTION_MENU_STYLE_ID);
assert.equal(typeof delayed.listeners.get('DOMContentLoaded'), 'function');
delayed.listeners.get('DOMContentLoaded')();
assert.equal(observeCount, 1);
cleanup();
assert.equal(disconnectCount, 1);

const immediate = createFakeDocument({ readyState: 'complete' });
const immediateCleanup = createDeckSelectionMenuController({
  documentRef: immediate.documentRef,
  observerFactory: () => ({ observe() {}, disconnect() {} }),
}).mount({ players: [] }, null);
assert.equal(typeof immediateCleanup, 'function');
immediateCleanup();
assert.equal(typeof installDeckSelectionMenu([], null), 'function');

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
    meta: { clubId: ['alfa-fc', 'beta-fc', 'gamma-fc', 'delta-fc'][group] },
  };
});
const eightRomanianCards = Array.from({ length: 8 }, (_, index) => ({
  id: `romania-${index + 1}`,
  name: `Román játékos ${index + 1}`,
  club: `Román klub ${index + 1}`,
  nation: 'Romania',
  nationality: 'Romania',
}));
const completePool = [...players, ...eightRomanianCards];
const catalog = buildQuickMatchCatalog(completePool);
const clubs = quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.HUNGARIAN);
const nations = quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.NATIONAL);
const federations = quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.FEDERATION);

assert.equal(QUICK_MATCH_NATION_MINIMUM, 8);
assert.equal(clubs.length, 4);
assert.equal(quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.LEAGUE).length, 2);
assert.equal(nations.length, 3);
assert.equal(nations.some(team => team.key === 'romania' && team.count === 8 && team.usable), true);
assert.equal(federations.length, 1);
assert.notEqual(chooseQuickMatchOpponent(clubs, clubs[0].id, { rng: () => 0 }).id, clubs[0].id);
assert.equal(validateQuickMatchPairing(completePool, clubs[0].selection, clubs[1].selection).valid, true);

assert.equal(quickMatchSelectionsCompatible(nations[0].selection, federations[0].selection), false);
assert.equal(validateQuickMatchPairing(completePool, nations[0].selection, federations[0].selection).code, 'INCOMPATIBLE_OPPONENT');
assert.equal(quickMatchOpponentEntries(catalog, nations[0]).every(team => team.kind === 'nation'), true);
assert.equal(quickMatchOpponentEntries(catalog, federations[0]).every(team => team.kind === 'federation'), true);

const prepared = buildQuickMatchPayload(
  { players: completePool, selection: {} },
  nations[0].selection,
  federations[0].selection,
  () => 0,
);
assert.equal(prepared.matchup.enabled, true);
assert.equal(prepared.matchup.human.kind, 'nation');
assert.equal(prepared.matchup.ai.kind, 'nation');
assert.notEqual(prepared.matchup.human.key, prepared.matchup.ai.key);
assert.equal(prepared.payload.players.every(player => player.meta.quickMatchTeamKind === 'nation'), true);
assert.equal(
  validateQuickMatchPairing(completePool, clubs[0].selection, clubs[0].selection).code,
  'INVALID_OPPONENT',
);
assert.equal(
  validateQuickMatchPairing(completePool, clubs[0].selection, federations[0].selection).code,
  'INCOMPATIBLE_OPPONENT',
);

const componentSource = readSource('../js/ui/deck-selection-menu-component.js');
const controlsSource = readSource('../js/quick-match-card-controls.js');
const selectorCss = readSource('../css/deck-selection-menu.css');
const controlsCss = readSource('../css/quick-match-card-controls.css');
const federationCss = readSource('../css/federation-teams.css');
const quickMatchDomainSource = readSource('../js/domain/quick-match-domain.js');
const cardComponentSource = readSource('../js/ui/card-component.js');
const scoreboardSource = readSource('../js/ui/scoreboard-component.js');
const buildWithSettingsSource = readSource('../scripts/build-standalone-with-settings.mjs');
const indexSource = readSource('../index.html');
const serviceWorkerSource = readSource('../sw.js');

for (const marker of [
  /createDeckSelectionMenuController/,
  /selectedCategory/,
  /selectedPlayerTeamId/,
  /selectedOpponentTeamId/,
  /selectionStep/,
  /isOpponentDrawing/,
  /quickMatchOpponentEntries/,
  /EZZEL A CSAPATTAL JÁTSZOM/,
  /MECCS INDÍTÁSA/,
  /pointerdown/,
  /ArrowLeft/,
  /popstate/,
  /aria-modal/,
]) assert.match(componentSource, marker);
assert.doesNotMatch(componentSource, /team-grid|team-tile/);
assert.match(controlsSource, /quick-match-help-toggle/);
assert.match(controlsSource, /quick-random-team__ball/);
assert.match(selectorCss, /height:\s*100dvh/);
assert.match(selectorCss, /safe-area-inset-bottom/);
assert.match(controlsCss, /prefers-reduced-motion/);
assert.match(federationCss, /\.quick-team-mark--federation/);
assert.match(quickMatchDomainSource, /a\.kind === b\.kind/);
assert.doesNotMatch(quickMatchDomainSource, /\['nation', 'federation'\]/);
assert.match(cardComponentSource, /card__club-logo/);
assert.match(cardComponentSource, /ART\.placeholder\('club'\)/);
assert.match(scoreboardSource, /score-team-mark/);
assert.match(scoreboardSource, /quickMatchTeamBadge/);
assert.match(indexSource, /css\/deck-selection-menu\.css/);
assert.match(buildWithSettingsSource, /quick-match-domain\.js/);
assert.match(serviceWorkerSource, /\.\/js\/domain\/quick-match-domain\.js/);

console.log('✓ Gyors meccs: 8 lapos ligaválogatott, azonos csapattípusú ellenfél, logók és mobil/PWA kontrollok: rendben');
