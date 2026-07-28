/** Kétlépcsős, egykártyás Gyors meccs csapatválasztó böngészői komponense. */

import {
  QUICK_MATCH_CATEGORY,
  QUICK_MATCH_SELECTION_STEP,
  buildQuickMatchCatalog,
  chooseQuickMatchOpponent,
  quickMatchEntriesForCategory,
  quickMatchEntryFromId,
  quickMatchEntryFromSelection,
} from '../domain/quick-match-domain.js';
import { describeDeckSelection } from '../domain/deck-selection-domain.js';
import { deckSelectionStorageService } from '../services/deck-selection-storage-service.js';
import { quickMatchStorageService } from '../services/quick-match-storage-service.js';

export const DECK_SELECTION_MENU_STYLE_ID = 'deck-selection-styles';
const DECK_SELECTION_MENU_CONFIRM_MESSAGE = 'A csapatváltás törli a jelenlegi mentett mérkőzést. Folytatod?';
const DECK_SELECTION_MENU_EMPTY_MESSAGE = 'Ebben a kategóriában jelenleg nincs elegendő játékoskártyával rendelkező csapat.';
const DECK_SELECTION_MENU_SINGLE_MESSAGE = 'Ehhez a kategóriához legalább két használható csapat szükséges.';
const DECK_SELECTION_MENU_DRAW_DELAYS = Object.freeze([70, 85, 105, 130, 165, 210, 280]);

const DECK_SELECTION_MENU_CATEGORIES = Object.freeze([
  Object.freeze({ id: QUICK_MATCH_CATEGORY.HUNGARIAN, label: 'Magyar bajnokság', icon: '🇭🇺' }),
  Object.freeze({ id: QUICK_MATCH_CATEGORY.LEAGUE, label: 'Liga', icon: '🏆' }),
  Object.freeze({ id: QUICK_MATCH_CATEGORY.NATIONAL, label: 'Válogatott', icon: '🌍' }),
]);

const DECK_SELECTION_MENU_CLUB_PRESENTATION = Object.freeze({
  dvsc: Object.freeze({ short: 'DV', primary: '#c8192e', secondary: '#ffffff' }),
  dvtk: Object.freeze({ short: 'DI', primary: '#d71920', secondary: '#ffffff' }),
  'eto fc': Object.freeze({ short: 'ETO', primary: '#159447', secondary: '#ffffff' }),
  'ferencvarosi tc': Object.freeze({ short: 'FTC', primary: '#16854a', secondary: '#ffffff' }),
  'kisvarda master good': Object.freeze({ short: 'KIS', primary: '#d8222a', secondary: '#ffffff' }),
  'kolorcity kazincbarcika sc': Object.freeze({ short: 'KB', primary: '#2468a9', secondary: '#f2cf2f' }),
  'mtk budapest': Object.freeze({ short: 'MTK', primary: '#246eb9', secondary: '#ffffff' }),
  'nyiregyhaza spartacus fc': Object.freeze({ short: 'NY', primary: '#c61f30', secondary: '#254f9a' }),
  'paksi fc': Object.freeze({ short: 'PFC', primary: '#23864a', secondary: '#ffffff' }),
  'puskas akademia fc': Object.freeze({ short: 'PA', primary: '#1f66ad', secondary: '#f0c640' }),
  'ujpest fc': Object.freeze({ short: 'UTE', primary: '#6d3a93', secondary: '#ffffff' }),
  'zte fc': Object.freeze({ short: 'ZTE', primary: '#185ea9', secondary: '#ffffff' }),
});

const deckSelectionMenuDefaultObserverFactory = callback => {
  const Observer = globalThis.MutationObserver;
  if (typeof Observer === 'function') return new Observer(callback);
  return Object.freeze({ observe() {}, disconnect() {} });
};
const deckSelectionMenuDefaultConfirm = message => (
  typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : true
);
const deckSelectionMenuDefaultReload = () => globalThis.location?.reload?.();
const deckSelectionMenuDefaultSchedule = callback => globalThis.setTimeout?.(callback, 0);
const deckSelectionMenuDefaultWait = duration => new Promise(resolve => globalThis.setTimeout?.(resolve, duration));
const deckSelectionMenuStyles = `.deck-selector{}`;

const deckSelectionMenuEnsureStyles = documentRef => {
  if (documentRef.querySelector?.(`#${DECK_SELECTION_MENU_STYLE_ID}`)) return;
  const style = documentRef.createElement('style');
  style.id = DECK_SELECTION_MENU_STYLE_ID;
  style.textContent = deckSelectionMenuStyles;
  documentRef.head?.appendChild(style);
};

const deckSelectionMenuText = value => String(value ?? '').trim();
const deckSelectionMenuClubInitials = label => deckSelectionMenuText(label)
  .split(/\s+/u)
  .filter(Boolean)
  .map(part => part[0])
  .join('')
  .slice(0, 3)
  .toLocaleUpperCase('hu-HU') || 'FC';
const deckSelectionMenuClubKey = value => deckSelectionMenuText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const deckSelectionMenuClubPresentation = label => DECK_SELECTION_MENU_CLUB_PRESENTATION[deckSelectionMenuClubKey(label)] ?? {
  short: deckSelectionMenuClubInitials(label), primary: '#6d4d2f', secondary: '#d5b45d',
};
const deckSelectionMenuCategoryDefinition = category => (
  DECK_SELECTION_MENU_CATEGORIES.find(entry => entry.id === category)
  ?? DECK_SELECTION_MENU_CATEGORIES[0]
);
const deckSelectionMenuCryptoRandom = () => {
  const cryptoRef = globalThis.crypto;
  if (typeof cryptoRef?.getRandomValues === 'function') {
    const values = new Uint32Array(1);
    cryptoRef.getRandomValues(values);
    return values[0] / 4294967296;
  }
  return Math.random();
};
const deckSelectionMenuReducedMotion = () => (
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
);

const deckSelectionMenuApplyPalette = (node, entry) => {
  if (!entry) return { short: 'FC', primary: '#6d4d2f', secondary: '#d5b45d' };
  if (entry.kind === 'club') {
    const presentation = deckSelectionMenuClubPresentation(entry.label);
    node.style?.setProperty?.('--team-primary', presentation.primary);
    node.style?.setProperty?.('--team-secondary', presentation.secondary);
    return presentation;
  }
  if (entry.kind === 'nation') {
    node.style?.setProperty?.('--team-primary', '#315b95');
    node.style?.setProperty?.('--team-secondary', '#f2e6d0');
    return { short: entry.flag || '🌍', primary: '#315b95', secondary: '#f2e6d0' };
  }
  node.style?.setProperty?.('--team-primary', '#8b642f');
  node.style?.setProperty?.('--team-secondary', '#e8c37a');
  return { short: 'LIGA', primary: '#8b642f', secondary: '#e8c37a' };
};

const deckSelectionMenuCreateTeamMark = (documentRef, entry, className = '') => {
  const mark = documentRef.createElement('span');
  mark.className = `quick-team-mark${entry?.kind === 'nation' ? ' quick-team-mark--flag' : ''}${className ? ` ${className}` : ''}`;
  mark.setAttribute?.('aria-hidden', 'true');
  const presentation = deckSelectionMenuApplyPalette(mark, entry);
  mark.textContent = entry?.kind === 'nation' ? (entry.flag || '🌍') : presentation.short;
  return mark;
};

const deckSelectionMenuButton = (documentRef, className, text, ariaLabel = text) => {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.setAttribute?.('aria-label', ariaLabel);
  return button;
};

const deckSelectionMenuRenderLargeCard = (documentRef, card, entry) => {
  card.replaceChildren();
  if (!entry) {
    card.classList.add('is-empty');
    const empty = documentRef.createElement('div');
    empty.className = 'quick-team-card__empty';
    empty.innerHTML = '<span aria-hidden="true">⚠️</span><strong>Nincs választható csapat</strong><small>Válassz másik kategóriát.</small>';
    card.appendChild(empty);
    return;
  }
  card.classList.remove('is-empty');
  deckSelectionMenuApplyPalette(card, entry);
  const glow = documentRef.createElement('span');
  glow.className = 'quick-team-card__glow';
  glow.setAttribute?.('aria-hidden', 'true');
  const mark = deckSelectionMenuCreateTeamMark(documentRef, entry, 'quick-team-card__mark');
  const name = documentRef.createElement('h2');
  name.className = 'quick-team-card__name';
  name.textContent = entry.label;
  const category = documentRef.createElement('p');
  category.className = 'quick-team-card__category';
  category.textContent = entry.subtitle;
  const count = documentRef.createElement('p');
  count.className = 'quick-team-card__count';
  count.textContent = `${entry.count} játékoskártya`;
  const status = documentRef.createElement('span');
  status.className = `quick-team-card__status${entry.usable ? ' is-ready' : ' is-unavailable'}`;
  status.textContent = entry.usable ? '✓ Játékra kész' : `Legalább ${entry.minimum} kártya szükséges`;
  const colours = documentRef.createElement('span');
  colours.className = 'quick-team-card__colours';
  colours.setAttribute?.('aria-hidden', 'true');
  card.append(glow, mark, name, category, count, status, colours);
};

const deckSelectionMenuRenderDuelSide = (documentRef, side, entry, caption) => {
  side.replaceChildren();
  if (!entry) return;
  deckSelectionMenuApplyPalette(side, entry);
  side.appendChild(deckSelectionMenuCreateTeamMark(documentRef, entry, 'quick-match-duel__mark'));
  const copy = documentRef.createElement('span');
  copy.className = 'quick-match-duel__copy';
  const role = documentRef.createElement('span');
  role.className = 'quick-match-duel__role';
  role.textContent = caption;
  const name = documentRef.createElement('strong');
  name.textContent = entry.label;
  const detail = documentRef.createElement('small');
  detail.textContent = `${entry.subtitle} · ${entry.count} kártya`;
  copy.append(role, name, detail);
  side.appendChild(copy);
};

const deckSelectionMenuInsertSelector = ({
  documentRef,
  panel,
  players,
  activeSelection,
  deckStorage,
  quickStorage,
  confirmReplace,
  reload,
  schedule,
  wait,
}) => {
  if (panel.querySelector('.deck-selector')) return;
  const catalog = buildQuickMatchCatalog(players);
  const savedSetup = quickStorage.readSetup(players);
  const initialEntry = savedSetup
    ? quickMatchEntryFromId(catalog, savedSetup.playerTeamId)
    : quickMatchEntryFromSelection(catalog, activeSelection);
  const fallbackCategory = initialEntry
    ? deckSelectionMenuCategoryDefinition(
      initialEntry.kind === 'league' ? QUICK_MATCH_CATEGORY.LEAGUE
        : initialEntry.kind === 'nation' ? QUICK_MATCH_CATEGORY.NATIONAL
          : QUICK_MATCH_CATEGORY.HUNGARIAN,
    ).id
    : QUICK_MATCH_CATEGORY.HUNGARIAN;
  const fallbackEntries = quickMatchEntriesForCategory(catalog, fallbackCategory);

  const state = {
    selectedCategory: fallbackCategory,
    selectedPlayerTeamId: initialEntry?.id ?? fallbackEntries[0]?.id ?? null,
    selectedOpponentTeamId: savedSetup?.opponentTeamId ?? null,
    selectionStep: QUICK_MATCH_SELECTION_STEP.PLAYER_TEAM,
    isOpponentDrawing: false,
    validationError: '',
  };
  let pendingMode = savedSetup?.mode ?? 'classic';
  let pendingDifficulty = savedSetup?.difficulty ?? 'medium';
  let carouselIndex = Math.max(0, fallbackEntries.findIndex(entry => entry.id === state.selectedPlayerTeamId));
  let pointerStartX = null;
  let drawToken = 0;
  const recentOpponentIds = [];

  const details = documentRef.createElement('details');
  details.className = 'deck-selector';
  details.open = false;
  const summary = documentRef.createElement('summary');
  summary.setAttribute?.('aria-label', 'Gyors meccs csapatválasztó megnyitása');
  const summaryMark = documentRef.createElement('span');
  summaryMark.className = 'deck-selector__summary-mark';
  const activeEntry = initialEntry ?? fallbackEntries[0] ?? null;
  if (activeEntry) summaryMark.appendChild(deckSelectionMenuCreateTeamMark(documentRef, activeEntry));
  else summaryMark.textContent = '⚡';
  const summaryCopy = documentRef.createElement('span');
  summaryCopy.className = 'deck-selector__launch-copy';
  const summaryTitle = documentRef.createElement('span');
  summaryTitle.className = 'deck-selector__launch-title';
  summaryTitle.textContent = '⚡ Gyors meccs';
  const current = documentRef.createElement('small');
  current.className = 'deck-selector__current';
  current.textContent = activeEntry
    ? `${activeEntry.label} · ${activeEntry.count} kártya`
    : describeDeckSelection(activeSelection, players);
  summaryCopy.append(summaryTitle, current);
  summary.append(summaryMark, summaryCopy);

  const body = documentRef.createElement('div');
  body.className = 'deck-selector__body';
  body.setAttribute?.('role', 'dialog');
  body.setAttribute?.('aria-modal', 'true');
  body.setAttribute?.('aria-labelledby', 'deck-selector-title');
  body.tabIndex = -1;

  const header = documentRef.createElement('header');
  header.className = 'deck-selector__header';
  const back = deckSelectionMenuButton(documentRef, 'deck-selector__back', '← CSAPAT MÓDOSÍTÁSA');
  const headingCopy = documentRef.createElement('div');
  headingCopy.className = 'deck-selector__heading-copy';
  const eyebrow = documentRef.createElement('p');
  eyebrow.className = 'deck-selector__eyebrow';
  const heading = documentRef.createElement('h1');
  heading.id = 'deck-selector-title';
  const lead = documentRef.createElement('p');
  lead.className = 'deck-selector__lead';
  headingCopy.append(eyebrow, heading, lead);
  const close = deckSelectionMenuButton(documentRef, 'deck-selector__close', '×', 'Csapatválasztó bezárása');
  header.append(back, headingCopy, close);

  const main = documentRef.createElement('div');
  main.className = 'deck-selector__main';
  const playerScreen = documentRef.createElement('section');
  playerScreen.className = 'quick-match-step quick-match-step--player';
  const carousel = documentRef.createElement('div');
  carousel.className = 'quick-carousel';
  carousel.setAttribute?.('role', 'group');
  carousel.setAttribute?.('aria-roledescription', 'lapozható csapatválasztó');
  const previous = deckSelectionMenuButton(documentRef, 'quick-carousel__arrow quick-carousel__arrow--previous', '‹', 'Előző csapat');
  const cardStage = documentRef.createElement('div');
  cardStage.className = 'quick-carousel__stage';
  const teamCard = documentRef.createElement('article');
  teamCard.className = 'quick-team-card';
  teamCard.setAttribute?.('role', 'option');
  teamCard.setAttribute?.('aria-live', 'polite');
  teamCard.tabIndex = 0;
  cardStage.appendChild(teamCard);
  const next = deckSelectionMenuButton(documentRef, 'quick-carousel__arrow quick-carousel__arrow--next', '›', 'Következő csapat');
  carousel.append(previous, cardStage, next);
  const position = documentRef.createElement('div');
  position.className = 'quick-carousel__position';
  position.setAttribute?.('aria-live', 'polite');
  const dots = documentRef.createElement('div');
  dots.className = 'quick-carousel__dots';
  dots.setAttribute?.('aria-hidden', 'true');
  position.appendChild(dots);
  playerScreen.append(carousel, position);

  const opponentScreen = documentRef.createElement('section');
  opponentScreen.className = 'quick-match-step quick-match-step--opponent';
  const drawStatus = documentRef.createElement('p');
  drawStatus.className = 'quick-match-draw-status';
  drawStatus.setAttribute?.('role', 'status');
  drawStatus.setAttribute?.('aria-live', 'polite');
  const duel = documentRef.createElement('div');
  duel.className = 'quick-match-duel';
  const humanSide = documentRef.createElement('article');
  humanSide.className = 'quick-match-duel__side quick-match-duel__side--human';
  const vs = documentRef.createElement('div');
  vs.className = 'quick-match-duel__vs';
  vs.textContent = 'VS';
  const aiSide = documentRef.createElement('article');
  aiSide.className = 'quick-match-duel__side quick-match-duel__side--ai';
  duel.append(humanSide, vs, aiSide);
  opponentScreen.append(drawStatus, duel);
  main.append(playerScreen, opponentScreen);

  const footer = documentRef.createElement('footer');
  footer.className = 'deck-selector__footer';
  const playerControls = documentRef.createElement('div');
  playerControls.className = 'quick-player-controls';
  const categories = documentRef.createElement('div');
  categories.className = 'quick-category-segments';
  categories.setAttribute?.('role', 'tablist');
  categories.setAttribute?.('aria-label', 'Csapatkategória');
  const categoryButtons = DECK_SELECTION_MENU_CATEGORIES.map(definition => {
    const button = deckSelectionMenuButton(
      documentRef,
      'quick-category-segment',
      `${definition.icon} ${definition.label}`,
      `${definition.label} kategória`,
    );
    button.dataset.category = definition.id;
    button.setAttribute?.('role', 'tab');
    categories.appendChild(button);
    return button;
  });
  const playerActions = documentRef.createElement('div');
  playerActions.className = 'quick-player-actions';
  const randomTeam = deckSelectionMenuButton(documentRef, 'btn btn--ghost quick-random-team', '🎲 Véletlen csapat');
  const confirmTeam = deckSelectionMenuButton(documentRef, 'btn deck-selector__primary', 'EZZEL A CSAPATTAL JÁTSZOM');
  playerActions.append(randomTeam, confirmTeam);
  playerControls.append(categories, playerActions);

  const opponentControls = documentRef.createElement('div');
  opponentControls.className = 'quick-opponent-controls';
  const anotherOpponent = deckSelectionMenuButton(documentRef, 'btn btn--ghost quick-another-opponent', '🎲 MÁSIK ELLENFELET KÉREK');
  const startMatch = deckSelectionMenuButton(documentRef, 'btn deck-selector__primary', 'MECCS INDÍTÁSA');
  opponentControls.append(anotherOpponent, startMatch);
  const error = documentRef.createElement('p');
  error.className = 'deck-selector__error';
  error.setAttribute?.('role', 'alert');
  error.setAttribute?.('aria-live', 'assertive');
  footer.append(playerControls, opponentControls, error);

  body.append(header, main, footer);
  details.append(summary, body);

  const entries = () => quickMatchEntriesForCategory(catalog, state.selectedCategory);
  const playerEntry = () => quickMatchEntryFromId(catalog, state.selectedPlayerTeamId);
  const opponentEntry = () => quickMatchEntryFromId(catalog, state.selectedOpponentTeamId);
  const categoryIndex = () => Math.max(0, entries().findIndex(entry => entry.id === state.selectedPlayerTeamId));
  const selectedDifficulty = () => {
    const checked = panel.querySelector?.('input[name=difficulty]:checked')?.value;
    return deckSelectionMenuText(checked) || pendingDifficulty || 'medium';
  };
  const setTeamAt = (index, direction = 0) => {
    const available = entries();
    if (!available.length) {
      carouselIndex = 0;
      state.selectedPlayerTeamId = null;
      state.selectedOpponentTeamId = null;
      state.validationError = DECK_SELECTION_MENU_EMPTY_MESSAGE;
      render();
      return;
    }
    carouselIndex = (index + available.length) % available.length;
    state.selectedPlayerTeamId = available[carouselIndex].id;
    state.selectedOpponentTeamId = null;
    state.validationError = '';
    cardStage.dataset.direction = direction < 0 ? 'previous' : direction > 0 ? 'next' : 'reset';
    cardStage.classList.remove('is-changing');
    void cardStage.offsetWidth;
    cardStage.classList.add('is-changing');
    render();
  };
  const stepTeam = delta => setTeamAt(categoryIndex() + delta, delta);

  const renderPlayer = () => {
    const available = entries();
    carouselIndex = categoryIndex();
    const selected = playerEntry();
    deckSelectionMenuRenderLargeCard(documentRef, teamCard, selected);
    teamCard.setAttribute?.('aria-selected', String(Boolean(selected)));
    teamCard.setAttribute?.('aria-label', selected
      ? `${selected.label}, ${selected.subtitle}, ${selected.count} játékoskártya`
      : 'Nincs választható csapat');
    previous.disabled = available.length <= 1;
    next.disabled = available.length <= 1;
    randomTeam.disabled = available.length === 0;
    confirmTeam.disabled = !selected?.usable;
    dots.replaceChildren(...available.slice(0, 12).map((entry, index) => {
      const dot = documentRef.createElement('span');
      dot.className = `quick-carousel__dot${entry.id === selected?.id ? ' is-active' : ''}`;
      dot.dataset.index = String(index);
      return dot;
    }));
    const numericPosition = documentRef.createElement('span');
    numericPosition.className = 'quick-carousel__counter';
    numericPosition.textContent = available.length ? `${carouselIndex + 1} / ${available.length}` : '0 / 0';
    position.querySelector?.('.quick-carousel__counter')?.remove?.();
    position.appendChild(numericPosition);
  };

  const renderOpponent = () => {
    const own = playerEntry();
    const opponent = opponentEntry();
    deckSelectionMenuRenderDuelSide(documentRef, humanSide, own, 'SAJÁT CSAPAT');
    deckSelectionMenuRenderDuelSide(documentRef, aiSide, opponent, 'GÉP');
    aiSide.classList.toggle('is-drawing', state.isOpponentDrawing);
    drawStatus.textContent = state.isOpponentDrawing
      ? 'Ellenfél sorsolása…'
      : opponent
        ? 'A gép kiválasztotta az ellenfeledet.'
        : 'Az ellenfél még nincs kisorsolva.';
    anotherOpponent.disabled = state.isOpponentDrawing || !opponent;
    startMatch.disabled = state.isOpponentDrawing || !own || !opponent;
  };

  const render = () => {
    const onOpponent = state.selectionStep === QUICK_MATCH_SELECTION_STEP.OPPONENT;
    body.dataset.step = state.selectionStep;
    playerScreen.hidden = onOpponent;
    opponentScreen.hidden = !onOpponent;
    playerControls.hidden = onOpponent;
    opponentControls.hidden = !onOpponent;
    back.hidden = !onOpponent;
    close.hidden = onOpponent;
    eyebrow.textContent = onOpponent ? 'Gyors meccs · 2/2' : 'GYORS MECCS';
    heading.textContent = onOpponent ? 'ELLENFELED' : 'Válaszd ki a csapatodat';
    lead.textContent = onOpponent
      ? 'A gép kiválasztotta az ellenfeledet.'
      : 'Lapozz a csapatok között, majd válaszd ki, melyikkel szeretnél játszani.';
    categoryButtons.forEach(button => {
      const active = button.dataset.category === state.selectedCategory;
      button.classList.toggle('is-active', active);
      button.setAttribute?.('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    error.textContent = state.validationError;
    error.hidden = !state.validationError;
    renderPlayer();
    renderOpponent();
  };

  const stopDrawing = () => {
    drawToken += 1;
    state.isOpponentDrawing = false;
  };

  const drawOpponent = async () => {
    const own = playerEntry();
    const available = entries();
    const candidates = available.filter(entry => entry.usable && entry.id !== own?.id);
    if (!own) {
      state.validationError = DECK_SELECTION_MENU_EMPTY_MESSAGE;
      render();
      return false;
    }
    if (!candidates.length) {
      state.validationError = DECK_SELECTION_MENU_SINGLE_MESSAGE;
      state.selectedOpponentTeamId = null;
      state.isOpponentDrawing = false;
      render();
      return false;
    }
    const token = ++drawToken;
    state.validationError = '';
    state.isOpponentDrawing = true;
    render();
    if (!deckSelectionMenuReducedMotion()) {
      for (let index = 0; index < DECK_SELECTION_MENU_DRAW_DELAYS.length; index += 1) {
        if (token !== drawToken) return false;
        const candidate = candidates[Math.floor(deckSelectionMenuCryptoRandom() * candidates.length)] ?? candidates[0];
        state.selectedOpponentTeamId = candidate.id;
        renderOpponent();
        await wait(DECK_SELECTION_MENU_DRAW_DELAYS[index]);
      }
    }
    if (token !== drawToken) return false;
    const chosen = chooseQuickMatchOpponent(available, own.id, {
      rng: deckSelectionMenuCryptoRandom,
      avoidTeamIds: recentOpponentIds,
    });
    state.selectedOpponentTeamId = chosen?.id ?? null;
    state.isOpponentDrawing = false;
    if (chosen) {
      recentOpponentIds.push(chosen.id);
      if (recentOpponentIds.length > 4) recentOpponentIds.shift();
    }
    render();
    return Boolean(chosen);
  };

  const showPlayerStep = () => {
    stopDrawing();
    state.selectionStep = QUICK_MATCH_SELECTION_STEP.PLAYER_TEAM;
    state.validationError = '';
    render();
    schedule(() => teamCard.focus?.({ preventScroll: true }));
  };

  const closeSelector = () => {
    stopDrawing();
    details.open = false;
    state.selectionStep = QUICK_MATCH_SELECTION_STEP.PLAYER_TEAM;
    state.validationError = '';
    summary.focus?.({ preventScroll: true });
  };

  const handleSelectorBack = event => {
    if (!details.open) return false;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    if (state.selectionStep === QUICK_MATCH_SELECTION_STEP.OPPONENT) showPlayerStep();
    else closeSelector();
    return true;
  };

  const openSelector = (mode = 'classic', difficulty = selectedDifficulty()) => {
    pendingMode = mode === 'penalties' ? 'penalties' : 'classic';
    pendingDifficulty = deckSelectionMenuText(difficulty) || 'medium';
    state.selectionStep = QUICK_MATCH_SELECTION_STEP.PLAYER_TEAM;
    state.validationError = '';
    details.open = true;
    render();
    schedule(() => (playerEntry() ? teamCard : close).focus?.({ preventScroll: true }));
  };

  previous.addEventListener('click', () => stepTeam(-1));
  next.addEventListener('click', () => stepTeam(1));
  cardStage.addEventListener('pointerdown', event => {
    pointerStartX = Number(event.clientX);
    cardStage.setPointerCapture?.(event.pointerId);
  });
  cardStage.addEventListener('pointerup', event => {
    if (!Number.isFinite(pointerStartX)) return;
    const distance = Number(event.clientX) - pointerStartX;
    pointerStartX = null;
    if (Math.abs(distance) < 42) return;
    stepTeam(distance > 0 ? -1 : 1);
  });
  cardStage.addEventListener('pointercancel', () => { pointerStartX = null; });
  dots.addEventListener('click', event => {
    const index = Number(event.target?.dataset?.index);
    if (Number.isInteger(index)) setTeamAt(index, index < categoryIndex() ? -1 : 1);
  });

  categoryButtons.forEach(button => button.addEventListener('click', () => {
    state.selectedCategory = button.dataset.category;
    const available = entries();
    carouselIndex = 0;
    state.selectedPlayerTeamId = available[0]?.id ?? null;
    state.selectedOpponentTeamId = null;
    state.validationError = available.length ? '' : DECK_SELECTION_MENU_EMPTY_MESSAGE;
    body.classList.remove('is-category-changing');
    void body.offsetWidth;
    body.classList.add('is-category-changing');
    render();
  }));

  randomTeam.addEventListener('click', () => {
    const available = entries();
    if (!available.length) return;
    let index = Math.floor(deckSelectionMenuCryptoRandom() * available.length);
    if (available.length > 1 && available[index]?.id === state.selectedPlayerTeamId) index = (index + 1) % available.length;
    setTeamAt(index, index < categoryIndex() ? -1 : 1);
  });

  confirmTeam.addEventListener('click', async () => {
    if (!playerEntry()) {
      state.validationError = DECK_SELECTION_MENU_EMPTY_MESSAGE;
      render();
      return;
    }
    if (entries().filter(entry => entry.usable).length < 2) {
      state.validationError = DECK_SELECTION_MENU_SINGLE_MESSAGE;
      render();
      return;
    }
    state.selectionStep = QUICK_MATCH_SELECTION_STEP.OPPONENT;
    state.selectedOpponentTeamId = null;
    state.validationError = '';
    render();
    await drawOpponent();
  });

  anotherOpponent.addEventListener('click', () => { void drawOpponent(); });
  back.addEventListener('click', showPlayerStep);
  close.addEventListener('click', closeSelector);

  startMatch.addEventListener('click', () => {
    const own = playerEntry();
    const opponent = opponentEntry();
    if (!own || !opponent || own.id === opponent.id) {
      state.validationError = DECK_SELECTION_MENU_SINGLE_MESSAGE;
      render();
      return;
    }
    if (deckStorage.hasSavedMatch() && !confirmReplace(DECK_SELECTION_MENU_CONFIRM_MESSAGE)) return;
    const staged = quickStorage.stage({
      category: state.selectedCategory,
      playerTeamId: own.id,
      opponentTeamId: opponent.id,
      playerSelection: own.selection,
      opponentSelection: opponent.selection,
      mode: pendingMode,
      difficulty: pendingDifficulty,
      createdAt: new Date().toISOString(),
    });
    if (!staged) {
      state.validationError = 'A mérkőzés beállításait nem sikerült elmenteni. Próbáld újra.';
      render();
      return;
    }
    reload();
  });

  body.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      handleSelectorBack(event);
      return;
    }
    if (state.selectionStep !== QUICK_MATCH_SELECTION_STEP.PLAYER_TEAM) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepTeam(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepTeam(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setTeamAt(0, -1);
    } else if (event.key === 'End') {
      event.preventDefault();
      setTeamAt(entries().length - 1, 1);
    }
  });

  const hardwareBack = event => handleSelectorBack(event);
  globalThis.window?.addEventListener?.('popstate', hardwareBack, true);
  documentRef.addEventListener?.('backbutton', hardwareBack, true);

  details.addEventListener('toggle', () => {
    if (!details.open) {
      stopDrawing();
      return;
    }
    state.selectionStep = QUICK_MATCH_SELECTION_STEP.PLAYER_TEAM;
    state.validationError = '';
    render();
    schedule(() => body.focus?.({ preventScroll: true }));
  });

  const attachModeButton = (selector, mode) => {
    const button = panel.querySelector?.(selector);
    if (!button || button.dataset.quickMatchBound === 'true') return;
    button.dataset.quickMatchBound = 'true';
    button.addEventListener('click', event => {
      if (globalThis.__FOCISKARTYAK_QUICK_MATCH_BYPASS__ === true) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openSelector(mode, selectedDifficulty());
    }, true);
  };
  attachModeButton('#start-btn', 'classic');
  attachModeButton('#penalties-btn', 'penalties');

  panel.querySelector('.primary-mode-actions')?.before(details);
  render();

  if (panel.dataset.quickMatchLaunchScheduled !== 'true') {
    const launch = quickStorage.peekLaunch();
    if (launch) {
      panel.dataset.quickMatchLaunchScheduled = 'true';
      schedule(() => {
        const request = quickStorage.consumeLaunch();
        if (!request) return;
        const difficultyInput = panel.querySelector?.(`input[name=difficulty][value="${request.difficulty}"]`);
        if (difficultyInput) difficultyInput.checked = true;
        const modeButton = panel.querySelector?.(request.mode === 'penalties' ? '#penalties-btn' : '#start-btn');
        globalThis.__FOCISKARTYAK_QUICK_MATCH_BYPASS__ = true;
        try { modeButton?.click?.(); } finally { globalThis.__FOCISKARTYAK_QUICK_MATCH_BYPASS__ = false; }
      });
    }
  }

  return () => {
    stopDrawing();
    globalThis.window?.removeEventListener?.('popstate', hardwareBack, true);
    documentRef.removeEventListener?.('backbutton', hardwareBack, true);
  };
};

const deckSelectionMenuInsertRule = (documentRef, panel) => {
  if (panel.querySelector('.deck-selection-rule')) return;
  const rule = documentRef.createElement('section');
  rule.className = 'rule-card deck-selection-rule';
  const title = documentRef.createElement('h2');
  title.textContent = '⚡ Gyors meccs csapatválasztás';
  const text = documentRef.createElement('p');
  text.textContent = 'Válassz saját csapatot, nézd meg a gép kisorsolt ellenfelét, majd indítsd a Klasszikus vagy a Büntetőpárbaj mérkőzést. A két paklit a központi adatmodell külön szűri.';
  rule.append(title, text);
  panel.querySelector('#rules-back-btn')?.before(rule);
};

export function createDeckSelectionMenuController({
  documentRef = globalThis.document ?? null,
  observerFactory = deckSelectionMenuDefaultObserverFactory,
  deckStorage = deckSelectionStorageService,
  quickStorage = quickMatchStorageService,
  confirmReplace = deckSelectionMenuDefaultConfirm,
  reload = deckSelectionMenuDefaultReload,
  schedule = deckSelectionMenuDefaultSchedule,
  wait = deckSelectionMenuDefaultWait,
} = {}) {
  const mount = (payload, activeSelection) => {
    if (!documentRef) return () => {};
    const players = Array.isArray(payload) ? payload : payload?.players;
    const pool = Array.isArray(players) ? players : [];
    deckSelectionMenuEnsureStyles(documentRef);
    const cleanupCallbacks = new Set();

    const enhance = () => {
      const menuPanels = documentRef.querySelectorAll?.('.menu-panel.mobile-home') ?? [];
      menuPanels.forEach(panel => {
        const cleanup = deckSelectionMenuInsertSelector({
          documentRef,
          panel,
          players: pool,
          activeSelection,
          deckStorage,
          quickStorage,
          confirmReplace,
          reload,
          schedule,
          wait,
        });
        if (typeof cleanup === 'function') cleanupCallbacks.add(cleanup);
      });
      const rulePanels = documentRef.querySelectorAll?.('.rules-panel') ?? [];
      rulePanels.forEach(panel => deckSelectionMenuInsertRule(documentRef, panel));
    };

    let observer = null;
    let started = false;
    let disposed = false;
    const start = () => {
      if (started || disposed) return;
      started = true;
      enhance();
      observer = observerFactory(enhance);
      observer?.observe?.(documentRef.body, { childList: true, subtree: true });
    };

    if (documentRef.readyState === 'loading') {
      documentRef.addEventListener?.('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }

    return () => {
      if (disposed) return;
      disposed = true;
      documentRef.removeEventListener?.('DOMContentLoaded', start);
      observer?.disconnect?.();
      cleanupCallbacks.forEach(cleanup => cleanup());
      cleanupCallbacks.clear();
    };
  };

  return Object.freeze({ mount });
}

const deckSelectionMenuDefaultController = createDeckSelectionMenuController();
export function installDeckSelectionMenu(payload, activeSelection) {
  return deckSelectionMenuDefaultController.mount(payload, activeSelection);
}
