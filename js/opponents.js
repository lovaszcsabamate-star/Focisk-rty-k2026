/** Character ladder and visible pub opponents. Loaded after matchday.js. */

import { APP_STORAGE_KEYS } from './app/configuration.js';
import { readStoredString, writeStoredString } from './services/storage-service.js';
import { DIFFICULTY } from './ai.js';
import { UI, el } from './ui.js';

const STORAGE_KEY = APP_STORAGE_KEYS.selectedOpponent;

export const OPPONENTS = [
  {
    id: 'whiskey-joe', name: '„Whiskey” Joe', level: 1, overall: 75, row: 0, col: 2,
    title: 'A bizonytalan kezdő', noise: 0.58, sacrificeBelow: 0.16,
  },
  {
    id: 'bogdan', name: 'Bogdan', level: 2, overall: 81, row: 2, col: 1,
    title: 'A lassú túlélő', noise: 0.46, sacrificeBelow: 0.22,
  },
  {
    id: 'g-biggins', name: 'G. Biggins', level: 3, overall: 82, row: 1, col: 1,
    title: 'A nehézsúlyú törzsvendég', noise: 0.38, sacrificeBelow: 0.27,
  },
  {
    id: 'lizzy', name: 'Lizzy', level: 4, overall: 86, row: 2, col: 0,
    title: 'A kiszámíthatatlan játékos', noise: 0.29, sacrificeBelow: 0.32,
  },
  {
    id: 'd-raven', name: 'D. Raven', level: 5, overall: 87, row: 0, col: 0,
    title: 'A hidegvérű kihívó', noise: 0.22, sacrificeBelow: 0.36,
  },
  {
    id: 'el-loco', name: 'El Loco', level: 6, overall: 88, row: 1, col: 0,
    title: 'Az agresszív szerencsejátékos', noise: 0.16, sacrificeBelow: 0.40,
  },
  {
    id: 'v-koval', name: 'V. Koval', level: 7, overall: 90, row: 1, col: 2,
    title: 'A könyörtelen végrehajtó', noise: 0.10, sacrificeBelow: 0.43,
  },
  {
    id: 'h-li', name: 'H. Li', level: 8, overall: 93, row: 0, col: 1,
    title: 'A számító stratéga', noise: 0.045, sacrificeBelow: 0.47,
  },
  {
    id: 'project-9', name: 'Project 9', level: 9, overall: 94, row: 2, col: 2,
    title: 'A gépi végső ellenfél', noise: 0.012, sacrificeBelow: 0.50,
  },
];

for (const opponent of OPPONENTS) {
  DIFFICULTY[opponent.id] = {
    noise: opponent.noise,
    sacrificeBelow: opponent.sacrificeBelow,
    label: `${opponent.level}. szint · ${opponent.name}`,
  };
}

const byId = new Map(OPPONENTS.map(opponent => [opponent.id, opponent]));

function loadSelectedOpponent() {
  const stored = readStoredString(STORAGE_KEY);
  return stored && byId.has(stored) ? stored : 'd-raven';
}

let selectedOpponentId = loadSelectedOpponent();
let activeMatchOpponentId = null;
let lastQuickOpponentId = null;

export function getSelectedOpponent() {
  return byId.get(selectedOpponentId) ?? OPPONENTS[4];
}

export function getActiveOpponent() {
  return byId.get(activeMatchOpponentId) ?? getSelectedOpponent();
}

export function isOpponentId(id) {
  return byId.has(id);
}

function publishActiveOpponent() {
  globalThis.__FOCISKARTYAK_OPPONENT__ = getActiveOpponent();
}

function updateMenuOpponentSummary(root = globalThis.document, opponent = getSelectedOpponent()) {
  const value = root?.querySelector?.('.current-match-summary__opponent-value');
  if (value) value.textContent = `${opponent.name} · ${opponent.level}. szint · OVR ${opponent.overall}`;
}

function saveSelectedOpponent(id) {
  if (!byId.has(id)) return getSelectedOpponent();
  selectedOpponentId = id;
  writeStoredString(STORAGE_KEY, id);
  if (!activeMatchOpponentId) publishActiveOpponent();
  updateMenuOpponentSummary(globalThis.document, getSelectedOpponent());
  return getSelectedOpponent();
}

export function selectOpponentById(id) {
  return saveSelectedOpponent(id);
}

export function activateMatchOpponent(id) {
  if (!byId.has(id)) return null;
  activeMatchOpponentId = id;
  publishActiveOpponent();
  return getActiveOpponent();
}

export function clearMatchOpponent() {
  activeMatchOpponentId = null;
  publishActiveOpponent();
  return getSelectedOpponent();
}

export function pickRandomOpponent({ rng = Math.random, excludeId = lastQuickOpponentId } = {}) {
  const candidates = OPPONENTS.length > 1
    ? OPPONENTS.filter(opponent => opponent.id !== excludeId)
    : OPPONENTS.slice();
  const random = typeof rng === 'function' ? rng() : Math.random();
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random * candidates.length)));
  const opponent = candidates[index] ?? OPPONENTS[0];
  lastQuickOpponentId = opponent?.id ?? null;
  return opponent;
}

function applySprite(node, opponent) {
  node.classList.add('opponent-sprite');
  node.style.setProperty('--opponent-x', `${opponent.col * 50}%`);
  node.style.setProperty('--opponent-y', `${opponent.row * 50}%`);
}

function buildOpponentCard(opponent) {
  const label = el('label', 'opponent-card');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'difficulty';
  input.value = opponent.id;
  input.checked = opponent.id === selectedOpponentId;
  input.setAttribute('aria-label', `${opponent.level}. szint, ${opponent.name}, OVR ${opponent.overall}`);

  const art = el('span', 'opponent-card__art');
  applySprite(art, opponent);
  art.appendChild(el('span', 'opponent-card__level', `LVL ${opponent.level}`));

  const body = el('span', 'opponent-card__body');
  body.append(
    el('b', 'opponent-card__name', opponent.name),
    el('span', 'opponent-card__rating', `OVR ${opponent.overall}`),
    el('small', 'opponent-card__title', opponent.title),
  );

  input.addEventListener('change', () => {
    if (input.checked) saveSelectedOpponent(opponent.id);
  });
  label.append(input, art, body);
  return label;
}

function enhanceTitleMenu(panel) {
  if (!panel?.classList?.contains('menu-panel') || panel.dataset.opponentsReady === 'true') return;
  panel.dataset.opponentsReady = 'true';

  const intro = panel.querySelector('h1 + p');
  if (intro) intro.textContent = 'Válassz ellenfelet és játékmódot. Minél magasabb a szint és az OVR, annál pontosabban játszik a gép.';

  const oldDifficulty = panel.querySelector('.difficulty');
  if (!oldDifficulty) return;

  const picker = el('section', 'opponent-picker');
  picker.setAttribute('aria-label', 'Ellenfél kiválasztása');
  picker.appendChild(el('h2', 'opponent-picker__title', 'Válassz ellenfelet'));

  const grid = el('div', 'opponent-picker__grid');
  grid.append(...OPPONENTS.map(buildOpponentCard));
  picker.appendChild(grid);
  oldDifficulty.replaceWith(picker);
  updateMenuOpponentSummary(panel, getSelectedOpponent());

  panel.querySelector('#start-btn')?.addEventListener('click', () => {
    const checked = panel.querySelector('input[name=difficulty]:checked');
    if (checked) saveSelectedOpponent(checked.value);
  }, { capture: true });
  panel.querySelector('#penalties-btn')?.addEventListener('click', () => {
    const checked = panel.querySelector('input[name=difficulty]:checked');
    if (checked) saveSelectedOpponent(checked.value);
  }, { capture: true });
}

function ensureOpponentProfile(ui) {
  const zone = ui.dom.opponentHand?.closest('#opponent-zone');
  if (!zone) return;

  const opponent = getActiveOpponent();
  let profile = zone.querySelector('#opponent-profile');
  if (!profile) {
    profile = el('div', 'opponent-profile');
    profile.id = 'opponent-profile';
    zone.prepend(profile);
  }

  profile.replaceChildren();
  const portrait = el('div', 'opponent-profile__portrait');
  applySprite(portrait, opponent);
  const text = el('div', 'opponent-profile__text');
  text.append(
    el('strong', 'opponent-profile__name', opponent.name),
    el('span', 'opponent-profile__level', `${opponent.level}. SZINT · OVR ${opponent.overall}`),
  );
  profile.append(portrait, text);
  profile.title = opponent.title;
}

function decorateScoreboard(board) {
  const opponent = getActiveOpponent();
  const away = board?.querySelector('.match-team--away');
  const name = away?.querySelector('.match-team__name');
  const crest = away?.querySelector('.match-team__crest');
  const competition = board?.querySelector('.match-scoreboard__competition');

  if (name) name.textContent = opponent.name.toUpperCase();
  if (crest) {
    crest.textContent = '';
    applySprite(crest, opponent);
    crest.classList.add('match-team__crest--opponent');
    crest.title = `${opponent.level}. szint · OVR ${opponent.overall}`;
  }
  if (competition) competition.textContent = `${opponent.level}. SZINT · OVR ${opponent.overall} · NB I KÁRTYAMECCS`;
  return board;
}

function decorateResultPanel(panel) {
  if (!panel?.classList?.contains('result-panel') || panel.querySelector('.result-opponent')) return;
  const opponent = getActiveOpponent();
  const summary = el('div', 'result-opponent');
  const portrait = el('div', 'result-opponent__portrait');
  applySprite(portrait, opponent);
  const text = el('div', 'result-opponent__text');
  text.append(
    el('span', null, 'ELLENFÉL'),
    el('strong', null, opponent.name),
    el('small', null, `${opponent.level}. szint · OVR ${opponent.overall}`),
  );
  summary.append(portrait, text);
  panel.prepend(summary);
}

publishActiveOpponent();
globalThis.__FOCISKARTYAK_SELECT_OPPONENT__ = selectOpponentById;

const previousShowOverlay = UI.prototype.showOverlay;
UI.prototype.showOverlay = function showOpponentOverlay(node) {
  enhanceTitleMenu(node);
  decorateResultPanel(node);
  return previousShowOverlay.call(this, node);
};

const previousRenderHands = UI.prototype.renderHands;
UI.prototype.renderHands = function renderHandsWithOpponent(...args) {
  ensureOpponentProfile(this);
  return previousRenderHands.apply(this, args);
};

const previousMatchScoreboard = UI.prototype._renderMatchScoreboard;
if (typeof previousMatchScoreboard === 'function') {
  UI.prototype._renderMatchScoreboard = function renderOpponentScoreboard(...args) {
    return decorateScoreboard(previousMatchScoreboard.apply(this, args));
  };
}
