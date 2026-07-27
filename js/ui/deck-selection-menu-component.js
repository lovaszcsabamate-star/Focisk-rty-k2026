/** Gyors meccs csapatválasztó és szabálypanel böngészői komponense. */

import {
  MIN_FILTERED_DECK_SIZE,
  RANDOM_DECK_SELECTION,
  buildDeckSelectionOptions,
  canonicalClubKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  selectionEquals,
  validateDeckSelection,
} from '../domain/deck-selection-domain.js';
import { deckSelectionStorageService } from '../services/deck-selection-storage-service.js';

export const DECK_SELECTION_MENU_STYLE_ID = 'deck-selection-styles';
const DECK_SELECTION_MENU_NATION_MINIMUM = 7;

const DECK_SELECTION_MENU_CONFIRM_MESSAGE = 'A pakli cseréje törli a jelenlegi mentett mérkőzést. Folytatod?';
const DECK_SELECTION_MENU_KIND_DEFINITIONS = Object.freeze([
  Object.freeze({ kind: 'club', label: 'Klubok', icon: '🛡️', category: 'Magyar bajnokság' }),
  Object.freeze({ kind: 'nation', label: 'Válogatottak', icon: '🌍', category: 'Ligaválogatott' }),
  Object.freeze({ kind: 'random', label: 'Véletlen', icon: '🎲', category: 'Véletlen pakli' }),
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

const deckSelectionMenuStyles = `.deck-selector{}`;

const deckSelectionMenuEnsureStyles = documentRef => {
  if (documentRef.querySelector?.(`#${DECK_SELECTION_MENU_STYLE_ID}`)) return;
  const style = documentRef.createElement('style');
  style.id = DECK_SELECTION_MENU_STYLE_ID;
  style.textContent = deckSelectionMenuStyles;
  documentRef.head?.appendChild(style);
};

const deckSelectionMenuClubInitials = label => String(label ?? '')
  .split(/\s+/u)
  .filter(Boolean)
  .map(part => part[0])
  .join('')
  .slice(0, 3)
  .toLocaleUpperCase('hu-HU') || 'FC';

const deckSelectionMenuClubPresentation = label => DECK_SELECTION_MENU_CLUB_PRESENTATION[canonicalClubKey(label)] ?? {
  short: deckSelectionMenuClubInitials(label),
  primary: '#6d4d2f',
  secondary: '#d5b45d',
};

const deckSelectionMenuKindDefinition = kind => (
  DECK_SELECTION_MENU_KIND_DEFINITIONS.find(entry => entry.kind === kind)
  ?? DECK_SELECTION_MENU_KIND_DEFINITIONS.at(-1)
);

const deckSelectionMenuCategoryLabel = kind => deckSelectionMenuKindDefinition(kind).category;

const deckSelectionMenuApplyPalette = (node, kind, label) => {
  if (kind === 'club') {
    const presentation = deckSelectionMenuClubPresentation(label);
    node.style?.setProperty?.('--team-primary', presentation.primary);
    node.style?.setProperty?.('--team-secondary', presentation.secondary);
    return presentation;
  }
  if (kind === 'nation') {
    node.style?.setProperty?.('--team-primary', '#315b95');
    node.style?.setProperty?.('--team-secondary', '#f2e6d0');
    return { short: '', primary: '#315b95', secondary: '#f2e6d0' };
  }
  node.style?.setProperty?.('--team-primary', '#8b642f');
  node.style?.setProperty?.('--team-secondary', '#e8c37a');
  return { short: '', primary: '#8b642f', secondary: '#e8c37a' };
};

const deckSelectionMenuCreateTeamMark = (documentRef, { kind, label, flag = '', random = false }) => {
  const mark = documentRef.createElement('span');
  mark.className = `team-mark${kind === 'nation' ? ' team-mark--flag' : ''}${random ? ' team-mark--random' : ''}`;
  mark.setAttribute?.('aria-hidden', 'true');
  if (random) {
    mark.textContent = '🎲';
    deckSelectionMenuApplyPalette(mark, 'random', label);
    return mark;
  }
  if (kind === 'nation') {
    mark.textContent = flag || '🌍';
    deckSelectionMenuApplyPalette(mark, 'nation', label);
    return mark;
  }
  const presentation = deckSelectionMenuApplyPalette(mark, 'club', label);
  mark.textContent = presentation.short;
  return mark;
};

const deckSelectionMenuTeamFromSelection = (selection, players) => {
  const checked = validateDeckSelection(
    players,
    selection,
    normaliseDeckSelection(selection).kind === 'nation' ? DECK_SELECTION_MENU_NATION_MINIMUM : MIN_FILTERED_DECK_SIZE,
  ).selection;
  if (checked.kind === 'club') {
    return {
      kind: 'club', label: checked.value, flag: '',
      detail: `${describeDeckSelection(checked, players).split('·').at(-1)?.trim() ?? ''}`,
    };
  }
  if (checked.kind === 'nation') {
    const nation = nationPresentation(checked.value);
    return {
      kind: 'nation', label: `${nation.label} ligaválogatott`, flag: nation.flag,
      detail: `${describeDeckSelection(checked, players).split('·').at(-1)?.trim() ?? ''}`,
    };
  }
  return { kind: 'random', label: 'Véletlen kártyák', flag: '', detail: `${players.length} lapos adatbázis` };
};

const deckSelectionMenuRenderMatchSide = (documentRef, side, team, caption) => {
  side.replaceChildren();
  side.appendChild(deckSelectionMenuCreateTeamMark(documentRef, {
    kind: team.kind,
    label: team.label,
    flag: team.flag,
    random: team.kind === 'random',
  }));
  const copy = documentRef.createElement('span');
  copy.className = 'quick-match-side__copy';
  const captionNode = documentRef.createElement('span');
  captionNode.className = 'quick-match-side__caption';
  captionNode.textContent = caption;
  const name = documentRef.createElement('strong');
  name.textContent = team.label;
  const detail = documentRef.createElement('small');
  detail.textContent = team.detail;
  copy.append(captionNode, name, detail);
  side.appendChild(copy);
};

const deckSelectionMenuOpponentPreview = selection => {
  const matchup = globalThis.__FOCISKARTYAK_QUICK_MATCH__;
  const selectionKey = selection.kind === 'club'
    ? canonicalClubKey(selection.value)
    : canonicalNationKey(selection.value);
  if (matchup?.enabled && matchup.ai && matchup.human
    && matchup.category === selection.kind
    && matchup.human.key === selectionKey
    && matchup.ai.key !== selectionKey) {
    if (matchup.ai.kind === 'nation') {
      const nation = nationPresentation(matchup.ai.key);
      return {
        kind: 'nation', label: matchup.ai.label, flag: nation.flag,
        detail: `${matchup.ai.count} kártya`,
      };
    }
    return { kind: 'club', label: matchup.ai.label, flag: '', detail: `${matchup.ai.count} kártya` };
  }
  if (selection.kind === 'club') return { kind: 'club', label: 'A gép klubja', flag: '', detail: 'másik NB I-es klub sorsolása' };
  if (selection.kind === 'nation') return { kind: 'nation', label: 'A gép válogatottja', flag: '🌍', detail: 'másik ligaválogatott sorsolása' };
  return { kind: 'random', label: 'Véletlen ellenfél', flag: '', detail: 'sorsolás a teljes adatbázisból' };
};

const deckSelectionMenuSelectionFromEntry = (kind, entry) => {
  if (kind === 'club') return { kind: 'club', value: entry.label };
  if (kind === 'nation') return { kind: 'nation', value: entry.key };
  return { ...RANDOM_DECK_SELECTION };
};

const deckSelectionMenuInsertSelector = ({
  documentRef,
  panel,
  players,
  activeSelection,
  storage,
  confirmReplace,
  reload,
}) => {
  if (panel.querySelector('.deck-selector')) return;
  const rawOptions = buildDeckSelectionOptions(players, DECK_SELECTION_MENU_NATION_MINIMUM);
  const options = {
    ...rawOptions,
    clubs: rawOptions.clubs.filter(entry => entry.count >= MIN_FILTERED_DECK_SIZE),
  };
  const details = documentRef.createElement('details');
  details.className = 'deck-selector';
  details.open = false;

  const summary = documentRef.createElement('summary');
  summary.setAttribute('aria-label', 'Gyors meccs csapatválasztó megnyitása');
  const summaryMark = documentRef.createElement('span');
  summaryMark.className = 'deck-selector__summary-mark';
  const activeTeam = deckSelectionMenuTeamFromSelection(activeSelection, players);
  summaryMark.appendChild(deckSelectionMenuCreateTeamMark(documentRef, {
    kind: activeTeam.kind,
    label: activeTeam.label,
    flag: activeTeam.flag,
    random: activeTeam.kind === 'random',
  }));
  const summaryCopy = documentRef.createElement('span');
  summaryCopy.className = 'deck-selector__launch-copy';
  const summaryTitle = documentRef.createElement('span');
  summaryTitle.className = 'deck-selector__launch-title';
  summaryTitle.textContent = '⚡ Gyors meccs – csapatválasztás';
  const current = documentRef.createElement('small');
  current.className = 'deck-selector__current';
  current.textContent = describeDeckSelection(activeSelection, players);
  summaryCopy.append(summaryTitle, current);
  summary.append(summaryMark, summaryCopy);

  const body = documentRef.createElement('div');
  body.className = 'deck-selector__body';
  body.setAttribute('role', 'dialog');
  body.setAttribute('aria-modal', 'true');
  body.setAttribute('aria-labelledby', 'deck-selector-title');

  const header = documentRef.createElement('header');
  header.className = 'deck-selector__header';
  const headingCopy = documentRef.createElement('div');
  const eyebrow = documentRef.createElement('p');
  eyebrow.className = 'deck-selector__eyebrow';
  eyebrow.textContent = 'Gyors meccs';
  const heading = documentRef.createElement('h1');
  heading.id = 'deck-selector-title';
  heading.textContent = 'Válaszd ki a csapatodat';
  const lead = documentRef.createElement('p');
  lead.className = 'deck-selector__lead';
  lead.textContent = 'A gép egy másik klubot választ ellenfélnek. A választott csapatod a Klasszikus és a Büntetőpárbaj módban is ténylegesen bekerül a meccsbe.';
  headingCopy.append(eyebrow, heading, lead);
  const close = documentRef.createElement('button');
  close.type = 'button';
  close.className = 'deck-selector__close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Csapatválasztó bezárása');
  header.append(headingCopy, close);

  const kinds = documentRef.createElement('div');
  kinds.className = 'deck-selector__kinds';
  kinds.setAttribute('role', 'tablist');
  kinds.setAttribute('aria-label', 'Csapatválasztási kategória');
  const kindButtons = DECK_SELECTION_MENU_KIND_DEFINITIONS.map(definition => {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'deck-kind';
    button.dataset.kind = definition.kind;
    button.setAttribute('role', 'tab');
    const icon = documentRef.createElement('span');
    icon.className = 'deck-kind__icon';
    icon.textContent = definition.icon;
    icon.setAttribute('aria-hidden', 'true');
    const copy = documentRef.createElement('span');
    copy.className = 'deck-kind__copy';
    const label = documentRef.createElement('strong');
    label.textContent = definition.label;
    const category = documentRef.createElement('small');
    category.textContent = definition.category;
    copy.append(label, category);
    button.append(icon, copy);
    kinds.appendChild(button);
    return button;
  });

  const arena = documentRef.createElement('div');
  arena.className = 'deck-selector__arena';

  const teamsPanel = documentRef.createElement('section');
  teamsPanel.className = 'deck-selector__teams-panel';
  const sectionHead = documentRef.createElement('div');
  sectionHead.className = 'deck-selector__section-head';
  const sectionCopy = documentRef.createElement('div');
  const sectionTitle = documentRef.createElement('h2');
  const sectionDescription = documentRef.createElement('p');
  sectionCopy.append(sectionTitle, sectionDescription);
  const optionCount = documentRef.createElement('span');
  optionCount.className = 'deck-selector__option-count';
  sectionHead.append(sectionCopy, optionCount);

  const grid = documentRef.createElement('div');
  grid.className = 'team-grid';
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', 'Választható csapatok');
  teamsPanel.append(sectionHead, grid);

  const matchPanel = documentRef.createElement('aside');
  matchPanel.className = 'deck-selector__match-panel';
  const matchTitle = documentRef.createElement('p');
  matchTitle.className = 'deck-selector__match-title';
  matchTitle.textContent = 'Meccspárosítás';
  const versus = documentRef.createElement('div');
  versus.className = 'quick-match-versus';
  const humanSide = documentRef.createElement('div');
  humanSide.className = 'quick-match-side quick-match-side--human';
  const vs = documentRef.createElement('div');
  vs.className = 'quick-match-vs';
  vs.textContent = 'VS';
  const aiSide = documentRef.createElement('div');
  aiSide.className = 'quick-match-side quick-match-side--ai';
  versus.append(humanSide, vs, aiSide);
  const opponentNote = documentRef.createElement('p');
  opponentNote.className = 'deck-selector__opponent-note';
  opponentNote.textContent = 'Az ellenfél csak a meccs indításakor kerül kisorsolásra, és nem lehet azonos a saját csapatoddal.';
  matchPanel.append(matchTitle, versus, opponentNote);
  arena.append(teamsPanel, matchPanel);

  const footer = documentRef.createElement('footer');
  footer.className = 'deck-selector__footer';
  const note = documentRef.createElement('p');
  note.className = 'deck-selector__note';
  note.textContent = `Csak legalább ${MIN_FILTERED_DECK_SIZE} használható kártyával rendelkező klubok és legalább ${DECK_SELECTION_MENU_NATION_MINIMUM} kártyás ligaválogatottak jelennek meg. A címerek a játék jogtiszta, generált klubszíneit használják.`;
  const apply = documentRef.createElement('button');
  apply.type = 'button';
  apply.className = 'btn deck-selector__apply';
  apply.setAttribute('aria-label', 'Pakli alkalmazása');
  footer.append(note, apply);

  body.append(header, kinds, arena, footer);
  details.append(summary, body);

  let draft = normaliseDeckSelection(activeSelection);

  const entriesForDraft = () => {
    if (draft.kind === 'club') return options.clubs;
    if (draft.kind === 'nation') return options.nations;
    return [];
  };

  const setDraftValue = entry => {
    draft = deckSelectionMenuSelectionFromEntry(draft.kind, entry);
  };

  const renderPreview = () => {
    deckSelectionMenuRenderMatchSide(
      documentRef,
      humanSide,
      deckSelectionMenuTeamFromSelection(draft, players),
      'Saját csapat',
    );
    deckSelectionMenuRenderMatchSide(
      documentRef,
      aiSide,
      deckSelectionMenuOpponentPreview(draft),
      'Gép',
    );
  };

  const appendTileMeta = (tile, kind, count) => {
    const meta = documentRef.createElement('span');
    meta.className = 'team-tile__meta';
    const category = documentRef.createElement('span');
    category.className = 'team-tile__category';
    category.textContent = deckSelectionMenuCategoryLabel(kind);
    const cardCount = documentRef.createElement('small');
    cardCount.className = 'team-tile__count';
    cardCount.textContent = `${count} kártya`;
    meta.append(category, cardCount);
    tile.appendChild(meta);
  };

  const renderGrid = () => {
    grid.replaceChildren();
    if (draft.kind === 'random') {
      const tile = documentRef.createElement('button');
      tile.type = 'button';
      tile.className = 'team-tile team-tile--random is-selected';
      tile.setAttribute('role', 'option');
      tile.setAttribute('aria-selected', 'true');
      tile.setAttribute('aria-label', `Teljesen véletlen csapat, ${options.total} használható kártya`);
      deckSelectionMenuApplyPalette(tile, 'random', 'Véletlen');
      tile.appendChild(deckSelectionMenuCreateTeamMark(documentRef, { kind: 'random', label: 'Véletlen', random: true }));
      const label = documentRef.createElement('span');
      label.className = 'team-tile__name';
      label.textContent = 'Teljesen véletlen';
      tile.appendChild(label);
      appendTileMeta(tile, 'random', options.total);
      const colours = documentRef.createElement('span');
      colours.className = 'team-tile__colours';
      colours.setAttribute('aria-hidden', 'true');
      tile.appendChild(colours);
      grid.appendChild(tile);
      return;
    }

    const entries = entriesForDraft();
    for (const entry of entries) {
      const tile = documentRef.createElement('button');
      tile.type = 'button';
      tile.className = 'team-tile';
      tile.setAttribute('role', 'option');
      const selected = draft.kind === 'club'
        ? canonicalClubKey(draft.value) === canonicalClubKey(entry.label)
        : canonicalNationKey(draft.value) === entry.key;
      tile.classList.toggle('is-selected', selected);
      tile.setAttribute('aria-selected', String(selected));
      const visibleLabel = draft.kind === 'nation' ? `${entry.label} ligaválogatott` : entry.label;
      tile.setAttribute('aria-label', `${visibleLabel}, ${deckSelectionMenuCategoryLabel(draft.kind)}, ${entry.count} kártya`);
      deckSelectionMenuApplyPalette(tile, draft.kind, entry.label);
      tile.appendChild(deckSelectionMenuCreateTeamMark(documentRef, {
        kind: draft.kind,
        label: entry.label,
        flag: entry.flag,
      }));
      const label = documentRef.createElement('span');
      label.className = 'team-tile__name';
      label.textContent = visibleLabel;
      tile.appendChild(label);
      appendTileMeta(tile, draft.kind, entry.count);
      const colours = documentRef.createElement('span');
      colours.className = 'team-tile__colours';
      colours.setAttribute('aria-hidden', 'true');
      tile.appendChild(colours);
      tile.addEventListener('click', () => {
        setDraftValue(entry);
        render();
      });
      grid.appendChild(tile);
    }
  };

  const renderSectionHeader = () => {
    const definition = deckSelectionMenuKindDefinition(draft.kind);
    const entries = entriesForDraft();
    sectionTitle.textContent = definition.category;
    sectionDescription.textContent = draft.kind === 'club'
      ? 'Válassz egy NB I-es klubot a játékban elérhető kártyák alapján.'
      : draft.kind === 'nation'
        ? 'Legalább hét azonos nemzetiségű NB I-es játékosból álló keretek.'
        : 'A saját és a gépi pakli is a teljes adatbázisból készül.';
    optionCount.textContent = draft.kind === 'random' ? '1 lehetőség' : `${entries.length} csapat`;
  };

  const render = () => {
    kindButtons.forEach(button => {
      const active = button.dataset.kind === draft.kind;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const entries = entriesForDraft();
    if (draft.kind !== 'random') {
      const exists = draft.kind === 'club'
        ? entries.some(entry => canonicalClubKey(entry.label) === canonicalClubKey(draft.value))
        : entries.some(entry => entry.key === canonicalNationKey(draft.value));
      if (!exists && entries[0]) setDraftValue(entries[0]);
    }
    renderSectionHeader();
    renderPreview();
    renderGrid();
    apply.disabled = draft.kind !== 'random' && entriesForDraft().length === 0;
    apply.textContent = draft.kind === 'random' ? 'Véletlen csapattal játszom' : 'Ezzel a csapattal játszom';
  };

  const closeSelector = () => {
    details.open = false;
    summary.focus?.({ preventScroll: true });
  };

  for (const button of kindButtons) {
    button.addEventListener('click', () => {
      draft = button.dataset.kind === 'random'
        ? { ...RANDOM_DECK_SELECTION }
        : { kind: button.dataset.kind, value: '' };
      render();
    });
  }

  close.addEventListener('click', closeSelector);
  body.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeSelector();
  });
  details.addEventListener('toggle', () => {
    if (!details.open) {
      draft = normaliseDeckSelection(activeSelection);
      render();
      return;
    }
    globalThis.requestAnimationFrame?.(() => close.focus?.({ preventScroll: true }));
  });

  apply.addEventListener('click', () => {
    const next = normaliseDeckSelection(draft);
    if (selectionEquals(next, activeSelection)) {
      closeSelector();
      return;
    }
    if (storage.hasSavedMatch() && !confirmReplace(DECK_SELECTION_MENU_CONFIRM_MESSAGE)) return;
    storage.replace(next);
    reload();
  });

  panel.querySelector('.primary-mode-actions')?.before(details);
  render();
};

const deckSelectionMenuInsertRule = (documentRef, panel) => {
  if (panel.querySelector('.deck-selection-rule')) return;
  const rule = documentRef.createElement('section');
  rule.className = 'rule-card deck-selection-rule';
  const title = documentRef.createElement('h2');
  title.textContent = '⚡ Gyors meccs csapatválasztás';
  const text = documentRef.createElement('p');
  text.textContent = `Választhatsz legalább ${MIN_FILTERED_DECK_SIZE} kártyás NB I-es klubot vagy legalább ${DECK_SELECTION_MENU_NATION_MINIMUM} kártyás ligaválogatottat. A gép automatikusan másik csapatot kap, a párosítás pedig a Klasszikus és a Büntetőpárbaj móddal is használható.`;
  rule.append(title, text);
  panel.querySelector('#rules-back-btn')?.before(rule);
};

export function createDeckSelectionMenuController({
  documentRef = globalThis.document ?? null,
  observerFactory = deckSelectionMenuDefaultObserverFactory,
  storage = deckSelectionStorageService,
  confirmReplace = deckSelectionMenuDefaultConfirm,
  reload = deckSelectionMenuDefaultReload,
} = {}) {
  const mount = (payload, activeSelection) => {
    if (!documentRef) return () => {};
    const players = Array.isArray(payload) ? payload : payload?.players;
    const pool = Array.isArray(players) ? players : [];
    const normalizedActive = normaliseDeckSelection(activeSelection);
    const selection = validateDeckSelection(
      pool,
      normalizedActive,
      normalizedActive.kind === 'nation' ? DECK_SELECTION_MENU_NATION_MINIMUM : MIN_FILTERED_DECK_SIZE,
    ).selection;
    deckSelectionMenuEnsureStyles(documentRef);

    const enhance = () => {
      const menuPanels = documentRef.querySelectorAll?.('.menu-panel.mobile-home') ?? [];
      menuPanels.forEach(panel => deckSelectionMenuInsertSelector({
        documentRef,
        panel,
        players: pool,
        activeSelection: selection,
        storage,
        confirmReplace,
        reload,
      }));
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
    };
  };

  return Object.freeze({ mount });
}

const deckSelectionMenuDefaultController = createDeckSelectionMenuController();

export function installDeckSelectionMenu(payload, activeSelection) {
  return deckSelectionMenuDefaultController.mount(payload, activeSelection);
}
