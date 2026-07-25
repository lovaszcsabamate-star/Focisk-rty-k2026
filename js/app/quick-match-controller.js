/** Gyors meccs csapatválasztó, párosítási és újrajátszási vezérlő. */

import { ATTRIBUTES } from '../data/players.js';
import {
  DEFAULT_QUICK_MATCH_DECK_SIZE,
  MIN_QUICK_MATCH_TEAM_SIZE,
  QUICK_MATCH_CATEGORIES,
  QUICK_MATCH_CATEGORY,
  buildQuickMatchDecks,
  buildQuickMatchTeams,
  chooseQuickMatchOpponent,
  createQuickMatchConfig,
  normaliseQuickMatchState,
  quickMatchTeamsForCategory,
  resolveQuickMatchTeam,
} from '../domain/quick-match-domain.js';
import { APP_STORAGE_KEYS } from './configuration.js';
import { loadPlayerName } from '../player-profile.js';
import { storageService } from '../services/storage-service.js';
import { el } from '../ui.js';

export class QuickMatchControllerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QuickMatchControllerError';
    this.code = code;
  }
}

const QUICK_MATCH_EMPTY_CATEGORY_MESSAGE = 'Ebben a kategóriában jelenleg nincs elegendő csapat egy mérkőzés elindításához.';
const quickMatchRequiredActions = Object.freeze(['showTitleScreen', 'startQuickMatch']);

const quickMatchAssertMethod = (target, method, code) => {
  if (typeof target?.[method] !== 'function') {
    throw new QuickMatchControllerError(code, `A Gyors meccs vezérlőből hiányzik a(z) ${method} művelet.`);
  }
};

const quickMatchTeamCountLabel = team => `${team?.playerIds?.length ?? 0} kártya`;

export function createQuickMatchController({
  ui,
  players,
  database = null,
  actions,
  storage = storageService,
  rng = Math.random,
  elementFactory = el,
  minimumTeamSize = MIN_QUICK_MATCH_TEAM_SIZE,
  defaultDeckSize = DEFAULT_QUICK_MATCH_DECK_SIZE,
} = {}) {
  quickMatchAssertMethod(ui, 'showOverlay', 'INVALID_UI');
  quickMatchAssertMethod(ui, 'showToast', 'INVALID_UI');
  quickMatchRequiredActions.forEach(method => quickMatchAssertMethod(actions, method, 'INVALID_ACTIONS'));
  if (!Array.isArray(players)) throw new TypeError('A Gyors meccs játékoslistája tömb kell legyen.');
  if (typeof elementFactory !== 'function') throw new TypeError('A Gyors meccs elemgyártó függvénye kötelező.');

  const competitionName = database?.competition || database?.name || 'Magyar bajnokság';
  const catalog = buildQuickMatchTeams(players, {
    competitionId: database?.id || 'hungary-nb1-2025-26',
    competitionName: 'Magyar bajnokság',
    minimum: minimumTeamSize,
  });

  let quickState = normaliseQuickMatchState(
    storage?.readJson?.(APP_STORAGE_KEYS.quickMatchState, null),
    catalog,
  );

  const persist = () => {
    storage?.writeJson?.(APP_STORAGE_KEYS.quickMatchState, quickState);
    return quickState;
  };

  const currentTeams = () => quickMatchTeamsForCategory(catalog, quickState.category);
  const selectedTeam = () => resolveQuickMatchTeam(catalog, quickState.selectedTeamId);
  const opponentTeam = () => resolveQuickMatchTeam(catalog, quickState.opponentTeamId);

  const teamCategoryLabel = team => {
    if (!team) return '';
    if (team.teamCategory === QUICK_MATCH_CATEGORY.NATIONAL) return team.competitionName;
    return team.competitionName || competitionName;
  };

  const makeFallbackBadge = (team, className = '') => {
    const badge = elementFactory('span', `${className} quick-match-badge-fallback`.trim());
    badge.textContent = team?.shortName || 'FK';
    badge.setAttribute('role', 'img');
    badge.setAttribute('aria-label', `${team?.name ?? 'Csapat'} helyettesítő emblémája`);
    return badge;
  };

  const makeTeamMark = (team, className = '') => {
    if (team?.type === 'national' && team.flag) {
      const flag = elementFactory('span', `${className} quick-match-team-flag`.trim(), team.flag);
      flag.setAttribute('role', 'img');
      flag.setAttribute('aria-label', `${team.name} zászlaja`);
      return flag;
    }

    const wrapper = elementFactory('span', `${className} quick-match-team-logo`.trim());
    if (!team?.logoPath) {
      wrapper.appendChild(makeFallbackBadge(team));
      return wrapper;
    }

    const image = document.createElement('img');
    image.src = team.logoPath;
    image.alt = `${team.name} jogtiszta projektlogója`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => wrapper.replaceChildren(makeFallbackBadge(team)), { once: true });
    wrapper.appendChild(image);
    return wrapper;
  };

  const makeTeamTile = team => {
    const button = elementFactory('button', 'quick-match-team-tile');
    button.type = 'button';
    button.dataset.teamId = team.id;
    button.style.setProperty('--team-primary', team.primaryColor || '#234a38');
    button.style.setProperty('--team-secondary', team.secondaryColor || '#d7b65b');
    const selected = quickState.selectedTeamId === team.id;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `A(z) ${team.name} kiválasztása, ${team.playerIds.length} elérhető kártya`);
    button.append(
      makeTeamMark(team, 'quick-match-team-tile__mark'),
      elementFactory('strong', 'quick-match-team-tile__name', team.name),
      elementFactory('span', 'quick-match-team-tile__count', quickMatchTeamCountLabel(team)),
      elementFactory('small', 'quick-match-team-tile__competition', teamCategoryLabel(team)),
    );
    if (selected) button.appendChild(elementFactory('span', 'quick-match-team-tile__selected', '✓ Kiválasztva'));
    button.addEventListener('click', () => selectOwnTeam(team.id));
    return button;
  };

  const makeTeamPreview = (team, side) => {
    const preview = elementFactory('section', `quick-match-preview quick-match-preview--${side}${team ? '' : ' is-empty'}`);
    preview.style.setProperty('--team-primary', team?.primaryColor || '#252525');
    preview.style.setProperty('--team-secondary', team?.secondaryColor || '#858585');
    if (!team) {
      preview.append(
        elementFactory('span', 'quick-match-preview__question', '?'),
        elementFactory('strong', 'quick-match-preview__name', side === 'opponent' ? 'Ellenfél sorsolása' : 'Válassz csapatot'),
        elementFactory('small', 'quick-match-preview__meta', side === 'opponent' ? 'A saját csapat kiválasztása után' : 'A listából választható'),
      );
      return preview;
    }
    preview.append(
      makeTeamMark(team, 'quick-match-preview__mark'),
      elementFactory('strong', 'quick-match-preview__name', team.name),
      elementFactory('span', 'quick-match-preview__count', quickMatchTeamCountLabel(team)),
      elementFactory('small', 'quick-match-preview__meta', teamCategoryLabel(team)),
    );
    return preview;
  };

  const hasPlayablePairing = () => {
    const own = selectedTeam();
    const opponent = opponentTeam();
    return Boolean(
      own
      && opponent
      && own.id !== opponent.id
      && own.playerIds.length >= minimumTeamSize
      && opponent.playerIds.length >= minimumTeamSize,
    );
  };

  const randomizeOpponent = () => {
    const own = selectedTeam();
    const opponent = chooseQuickMatchOpponent(own, currentTeams(), {
      lastOpponentIds: quickState.lastOpponentIds,
      rng,
      minimum: minimumTeamSize,
    });
    quickState = {
      ...quickState,
      opponentTeamId: opponent?.id ?? null,
      lastOpponentIds: opponent
        ? [...quickState.lastOpponentIds.filter(id => id !== opponent.id), opponent.id].slice(-4)
        : quickState.lastOpponentIds,
    };
    persist();
    return opponent;
  };

  const selectOwnTeam = teamId => {
    const team = resolveQuickMatchTeam(catalog, teamId);
    if (!team || team.teamCategory !== quickState.category) return null;
    quickState = { ...quickState, selectedTeamId: team.id, opponentTeamId: null };
    persist();
    randomizeOpponent();
    return showSelection();
  };

  const setCategory = category => {
    if (!QUICK_MATCH_CATEGORIES.some(item => item.id === category)) return;
    quickState = {
      category,
      selectedTeamId: null,
      opponentTeamId: null,
      lastOpponentIds: quickState.lastOpponentIds,
    };
    persist();
    showSelection();
  };

  const startCurrentPairing = () => {
    const own = selectedTeam();
    const opponent = opponentTeam();
    if (!hasPlayablePairing()) {
      ui.showToast(QUICK_MATCH_EMPTY_CATEGORY_MESSAGE, 'error', 3600);
      showSelection();
      return null;
    }

    try {
      const decks = buildQuickMatchDecks(own, opponent, players, {
        deckSize: defaultDeckSize,
        minimum: minimumTeamSize,
        rng,
      });
      const config = createQuickMatchConfig({
        playerTeam: own,
        opponentTeam: opponent,
        deckSize: decks.matchDeckSize,
        enabledComparisonCategories: ATTRIBUTES.map(attribute => attribute.key),
      });
      const context = Object.freeze({
        playerName: loadPlayerName(),
        playerTeam: own,
        opponentTeam: opponent,
        matchDeckSize: decks.matchDeckSize,
        categoryLabel: teamCategoryLabel(own),
        modeLabel: 'Gyors meccs',
      });
      actions.startQuickMatch({ config, decks, context });
      return context;
    } catch (error) {
      console.error('[quick-match] A mérkőzés nem indítható:', error);
      ui.showToast(error.message || 'A Gyors meccs nem indítható.', 'error', 4200);
      showSelection();
      return null;
    }
  };

  const showPairing = () => {
    const own = selectedTeam();
    const opponent = opponentTeam();
    if (!hasPlayablePairing()) return showSelection();

    const panel = elementFactory('div', 'quick-match-pairing');
    panel.innerHTML = `
      <p class="eyebrow">Gyors meccs</p>
      <h1>Mérkőzés előtti párosítás</h1>
      <div class="quick-match-pairing__stage" aria-label="${own.name} a(z) ${opponent.name} ellen">
        <section class="quick-match-pairing__team quick-match-pairing__team--home"></section>
        <div class="quick-match-pairing__versus" aria-hidden="true">VS</div>
        <section class="quick-match-pairing__team quick-match-pairing__team--away"></section>
      </div>
      <dl class="quick-match-pairing__facts">
        <div><dt>Kategória</dt><dd>${teamCategoryLabel(own)}</dd></div>
        <div><dt>Felhasznált lapok</dt><dd>${Math.min(own.playerIds.length, opponent.playerIds.length, defaultDeckSize)}–${Math.min(own.playerIds.length, opponent.playerIds.length, defaultDeckSize)}</dd></div>
        <div><dt>Játékmód</dt><dd>Gyors meccs · Klasszikus szabályok</dd></div>
      </dl>
      <div class="quick-match-actions">
        <button class="btn btn--ghost" id="quick-pairing-back" type="button">Vissza</button>
        <button class="btn btn--ghost" id="quick-pairing-reroll" type="button">Másik ellenfél</button>
        <button class="btn" id="quick-pairing-start" type="button">MECCS INDÍTÁSA</button>
      </div>
    `;

    const renderPairingTeam = (node, team, label) => {
      node.style.setProperty('--team-primary', team.primaryColor || '#234a38');
      node.style.setProperty('--team-secondary', team.secondaryColor || '#d7b65b');
      node.append(
        elementFactory('span', 'quick-match-pairing__side-label', label),
        makeTeamMark(team, 'quick-match-pairing__mark'),
        elementFactory('strong', 'quick-match-pairing__name', team.name),
        elementFactory('small', 'quick-match-pairing__category', teamCategoryLabel(team)),
      );
    };
    renderPairingTeam(panel.querySelector('.quick-match-pairing__team--home'), own, `${loadPlayerName()} csapata`);
    renderPairingTeam(panel.querySelector('.quick-match-pairing__team--away'), opponent, 'Gép csapata');

    panel.querySelector('#quick-pairing-back').addEventListener('click', () => showSelection(), { once: true });
    panel.querySelector('#quick-pairing-reroll').addEventListener('click', () => {
      randomizeOpponent();
      showPairing();
    }, { once: true });
    panel.querySelector('#quick-pairing-start').addEventListener('click', startCurrentPairing, { once: true });
    ui.showOverlay(panel);
    return panel;
  };

  const showSelection = () => {
    quickState = normaliseQuickMatchState(quickState, catalog);
    persist();
    const teams = currentTeams();
    const own = selectedTeam();
    const opponent = opponentTeam();
    const categoryReady = teams.length >= 2;

    const panel = elementFactory('div', 'quick-match-selector mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">Főmenü → Gyors meccs</p>
      <h1>Válassz csapatot</h1>
      <p class="quick-match-selector__intro">Klubbal vagy legalább ${minimumTeamSize} elérhető játékossal rendelkező válogatottal játszhatsz.</p>
      <div class="quick-match-category-tabs" role="tablist" aria-label="Csapattípus kiválasztása"></div>
      <div class="quick-match-versus-layout">
        <section class="quick-match-side quick-match-side--player" aria-labelledby="quick-own-title">
          <div class="quick-match-side__heading">
            <div><span class="quick-match-side__kicker">Saját csapat</span><h2 id="quick-own-title">${loadPlayerName()}</h2></div>
          </div>
          <div class="quick-match-selected-preview"></div>
          <div class="quick-match-team-grid" role="list" aria-label="Választható csapatok"></div>
        </section>
        <div class="quick-match-versus-divider" aria-hidden="true">VS</div>
        <section class="quick-match-side quick-match-side--opponent" aria-labelledby="quick-opponent-title">
          <div class="quick-match-side__heading"><div><span class="quick-match-side__kicker">Gép csapata</span><h2 id="quick-opponent-title">Automatikus sorsolás</h2></div></div>
          <div class="quick-match-opponent-preview"></div>
          <button class="btn btn--ghost" id="quick-reroll-btn" type="button">Másik ellenfél</button>
        </section>
      </div>
      <p class="quick-match-error" role="status" aria-live="polite"></p>
      <div class="quick-match-actions quick-match-selector__actions">
        <button class="btn btn--ghost" id="quick-back-btn" type="button">Vissza</button>
        <button class="btn" id="quick-start-btn" type="button">Meccs indítása</button>
      </div>
    `;

    const tabs = panel.querySelector('.quick-match-category-tabs');
    for (const category of QUICK_MATCH_CATEGORIES) {
      const categoryTeams = quickMatchTeamsForCategory(catalog, category.id);
      const tab = elementFactory('button', `quick-match-category-tab${category.id === quickState.category ? ' is-active' : ''}`);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(category.id === quickState.category));
      tab.disabled = category.id === QUICK_MATCH_CATEGORY.LEAGUE && categoryTeams.length === 0;
      tab.append(
        elementFactory('strong', null, category.label),
        elementFactory('small', null, category.id === QUICK_MATCH_CATEGORY.LEAGUE && categoryTeams.length === 0
          ? 'Hamarosan'
          : `${categoryTeams.length} csapat`),
      );
      tab.addEventListener('click', () => setCategory(category.id));
      tabs.appendChild(tab);
    }

    panel.querySelector('.quick-match-selected-preview').appendChild(makeTeamPreview(own, 'player'));
    panel.querySelector('.quick-match-opponent-preview').appendChild(makeTeamPreview(opponent, 'opponent'));
    const grid = panel.querySelector('.quick-match-team-grid');
    grid.replaceChildren(...teams.map(makeTeamTile));

    const error = panel.querySelector('.quick-match-error');
    if (!categoryReady) error.textContent = QUICK_MATCH_EMPTY_CATEGORY_MESSAGE;
    else if (own && !opponent) error.textContent = 'A kiválasztott csapathoz jelenleg nem sorsolható érvényes ellenfél.';

    const reroll = panel.querySelector('#quick-reroll-btn');
    reroll.disabled = !own || teams.length < 2;
    reroll.addEventListener('click', () => {
      randomizeOpponent();
      showSelection();
    });

    const start = panel.querySelector('#quick-start-btn');
    start.disabled = !hasPlayablePairing();
    start.addEventListener('click', () => showPairing(), { once: true });
    panel.querySelector('#quick-back-btn').addEventListener('click', () => actions.showTitleScreen({ offerOnboarding: false }), { once: true });

    ui.showOverlay(panel);
    globalThis.requestAnimationFrame?.(() => panel.querySelector('.quick-match-category-tab.is-active')?.focus?.({ preventScroll: true }));
    return panel;
  };

  const rematch = () => startCurrentPairing();

  const selectAnotherOpponent = () => {
    if (!selectedTeam()) return showSelection();
    randomizeOpponent();
    return showPairing();
  };

  const chooseAnotherTeam = () => {
    quickState = { ...quickState, selectedTeamId: null, opponentTeamId: null };
    persist();
    return showSelection();
  };

  return Object.freeze({
    catalog,
    get state() { return Object.freeze({ ...quickState, lastOpponentIds: Object.freeze([...quickState.lastOpponentIds]) }); },
    showSelection,
    showPairing,
    rematch,
    selectAnotherOpponent,
    chooseAnotherTeam,
    randomizeOpponent,
    selectedTeam,
    opponentTeam,
    startCurrentPairing,
  });
}
