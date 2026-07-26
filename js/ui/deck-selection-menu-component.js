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
export const QUICK_MATCH_NATION_MINIMUM = 7;

const DECK_SELECTION_MENU_CONFIRM_MESSAGE = 'A pakli cseréje törli a jelenlegi mentett mérkőzést. Folytatod?';
const DECK_SELECTION_MENU_KIND_DEFINITIONS = Object.freeze([
  Object.freeze(['random', '🎲 Véletlen']),
  Object.freeze(['club', '🛡️ Klubok']),
  Object.freeze(['nation', '🌍 Ligaválogatottak']),
]);

const CLUB_PRESENTATION = Object.freeze({
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

const deckSelectionMenuStyles = `
  .deck-selector { margin: 12px 0 14px; border: 1px solid rgba(232,195,122,.36); border-radius: 18px; background: linear-gradient(160deg, rgba(27,18,12,.96), rgba(8,8,8,.88)); overflow: hidden; box-shadow: 0 16px 44px rgba(0,0,0,.28); }
  .deck-selector > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 58px; padding: 13px 15px; cursor: pointer; font-weight: 900; color: var(--cream, #f2e6d0); list-style: none; }
  .deck-selector > summary::-webkit-details-marker { display: none; }
  .deck-selector > summary::after { content: '▾'; color: var(--brass-light, #e8c37a); transition: transform .16s ease; }
  .deck-selector[open] > summary::after { transform: rotate(180deg); }
  .deck-selector__current { display: block; margin-top: 3px; color: var(--muted, #a08d72); font-size: 11px; font-weight: 650; }
  .deck-selector__body { display: grid; gap: 13px; padding: 0 14px 15px; border-top: 1px solid rgba(232,195,122,.16); }
  .deck-selector__lead { margin: 12px 0 0; color: var(--muted, #b5a28a); font-size: 12px; line-height: 1.5; }
  .deck-selector__kinds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .deck-kind { min-height: 48px; padding: 9px 8px; border: 1px solid rgba(232,195,122,.28); border-radius: 12px; background: rgba(255,255,255,.045); color: var(--cream, #f2e6d0); cursor: pointer; font: inherit; font-size: 12px; font-weight: 850; }
  .deck-kind.is-active { border-color: var(--brass, #c9a227); background: rgba(201,162,39,.2); box-shadow: 0 0 0 2px rgba(201,162,39,.12); }
  .quick-match-versus { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: stretch; gap: 9px; }
  .quick-match-side { display: grid; place-items: center; align-content: center; gap: 7px; min-height: 132px; padding: 11px 9px; border: 1px solid rgba(232,195,122,.22); border-radius: 15px; background: rgba(255,255,255,.045); text-align: center; }
  .quick-match-side strong { color: var(--cream, #f2e6d0); font-size: 13px; line-height: 1.25; }
  .quick-match-side small { color: var(--muted, #a08d72); font-size: 10px; line-height: 1.3; }
  .quick-match-vs { display: grid; place-items: center; color: var(--brass-light, #e8c37a); font-size: 13px; font-weight: 950; letter-spacing: .08em; }
  .team-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; max-height: 330px; overflow: auto; padding: 2px 2px 4px; scrollbar-width: thin; }
  .team-tile { display: grid; place-items: center; align-content: start; gap: 7px; min-height: 126px; padding: 11px 7px 9px; border: 1px solid rgba(232,195,122,.22); border-radius: 15px; background: rgba(255,255,255,.045); color: var(--cream, #f2e6d0); cursor: pointer; font: inherit; text-align: center; transition: transform .14s ease, border-color .14s ease, background .14s ease; }
  .team-tile:hover { transform: translateY(-2px); border-color: rgba(232,195,122,.6); }
  .team-tile.is-selected { border-color: var(--brass, #c9a227); background: rgba(201,162,39,.18); box-shadow: 0 0 0 2px rgba(201,162,39,.12); }
  .team-tile__name { display: -webkit-box; min-height: 31px; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-size: 11px; font-weight: 850; line-height: 1.3; }
  .team-tile__count { color: var(--muted, #a08d72); font-size: 9.5px; }
  .team-mark { --team-primary: #654a2e; --team-secondary: #e8c37a; position: relative; display: grid; place-items: center; width: 62px; height: 62px; border: 3px solid rgba(255,255,255,.78); border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, var(--team-primary) 0 54%, var(--team-secondary) 54% 100%); color: #fff; font-size: 15px; font-weight: 950; letter-spacing: -.04em; text-shadow: 0 1px 3px rgba(0,0,0,.8); box-shadow: 0 7px 18px rgba(0,0,0,.35), inset 0 0 0 2px rgba(0,0,0,.14); }
  .team-mark::after { content: ''; position: absolute; inset: 5px; border: 1px solid rgba(255,255,255,.38); border-radius: inherit; pointer-events: none; }
  .team-mark--flag { background: rgba(255,255,255,.92); color: #111; font-size: 35px; text-shadow: none; }
  .team-mark--random { background: radial-gradient(circle at 35% 30%, #d5b45d, #5c3d20 62%, #1a100a); font-size: 29px; }
  .deck-selector__apply { width: 100%; min-height: 48px; }
  .deck-selector__note { margin: 0; color: var(--muted, #a08d72); font-size: 10.5px; line-height: 1.45; }
  @media (max-width: 620px) {
    .deck-selector__kinds { grid-template-columns: 1fr 1fr 1fr; }
    .deck-kind { min-height: 44px; padding-inline: 4px; font-size: 10.5px; }
    .team-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 370px; }
    .quick-match-side { min-height: 118px; padding-inline: 5px; }
    .quick-match-side strong { font-size: 11px; }
    .quick-match-vs { font-size: 10px; }
  }
`;

const deckSelectionMenuEnsureStyles = documentRef => {
  if (documentRef.querySelector?.(`#${DECK_SELECTION_MENU_STYLE_ID}`)) return;
  const style = documentRef.createElement('style');
  style.id = DECK_SELECTION_MENU_STYLE_ID;
  style.textContent = deckSelectionMenuStyles;
  documentRef.head?.appendChild(style);
};

const clubInitials = label => String(label ?? '')
  .split(/\s+/u)
  .filter(Boolean)
  .map(part => part[0])
  .join('')
  .slice(0, 3)
  .toLocaleUpperCase('hu-HU') || 'FC';

const clubPresentation = label => CLUB_PRESENTATION[canonicalClubKey(label)] ?? {
  short: clubInitials(label),
  primary: '#6d4d2f',
  secondary: '#d5b45d',
};

const createTeamMark = (documentRef, { kind, label, flag = '', random = false }) => {
  const mark = documentRef.createElement('span');
  mark.className = `team-mark${kind === 'nation' ? ' team-mark--flag' : ''}${random ? ' team-mark--random' : ''}`;
  if (random) {
    mark.textContent = '🎲';
    return mark;
  }
  if (kind === 'nation') {
    mark.textContent = flag || '🌍';
    return mark;
  }
  const presentation = clubPresentation(label);
  mark.textContent = presentation.short;
  mark.style?.setProperty?.('--team-primary', presentation.primary);
  mark.style?.setProperty?.('--team-secondary', presentation.secondary);
  return mark;
};

const teamFromSelection = (selection, players) => {
  const checked = validateDeckSelection(
    players,
    selection,
    normaliseDeckSelection(selection).kind === 'nation' ? QUICK_MATCH_NATION_MINIMUM : MIN_FILTERED_DECK_SIZE,
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

const renderMatchSide = (documentRef, side, team, caption) => {
  side.replaceChildren();
  side.appendChild(createTeamMark(documentRef, {
    kind: team.kind,
    label: team.label,
    flag: team.flag,
    random: team.kind === 'random',
  }));
  const name = documentRef.createElement('strong');
  name.textContent = team.label;
  const detail = documentRef.createElement('small');
  detail.textContent = `${caption} · ${team.detail}`;
  side.append(name, detail);
};

const opponentPreview = selection => {
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
  if (selection.kind === 'club') return { kind: 'club', label: 'Másik NB I-es klub', flag: '', detail: 'a gép véletlenszerűen választ' };
  if (selection.kind === 'nation') return { kind: 'nation', label: 'Másik ligaválogatott', flag: '🌍', detail: 'a gép véletlenszerűen választ' };
  return { kind: 'random', label: 'Véletlen ellenfél', flag: '', detail: 'a teljes adatbázisból' };
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
  const rawOptions = buildDeckSelectionOptions(players, QUICK_MATCH_NATION_MINIMUM);
  const options = {
    ...rawOptions,
    clubs: rawOptions.clubs.filter(entry => entry.count >= MIN_FILTERED_DECK_SIZE),
  };
  const details = documentRef.createElement('details');
  details.className = 'deck-selector';
  details.open = true;

  const summary = documentRef.createElement('summary');
  const summaryCopy = documentRef.createElement('span');
  summaryCopy.textContent = '⚡ Gyors meccs – csapatválasztás';
  const current = documentRef.createElement('small');
  current.className = 'deck-selector__current';
  current.textContent = describeDeckSelection(activeSelection, players);
  summaryCopy.appendChild(current);
  summary.appendChild(summaryCopy);

  const body = documentRef.createElement('div');
  body.className = 'deck-selector__body';
  const lead = documentRef.createElement('p');
  lead.className = 'deck-selector__lead';
  lead.textContent = `Válaszd ki a saját klubodat vagy ligaválogatottadat. A gép mindig ugyanabból a kategóriából, de másik csapatot kap. A klubok legalább ${MIN_FILTERED_DECK_SIZE}, a ligaválogatottak legalább ${QUICK_MATCH_NATION_MINIMUM} használható kártyával jelennek meg.`;

  const kinds = documentRef.createElement('div');
  kinds.className = 'deck-selector__kinds';
  const kindButtons = DECK_SELECTION_MENU_KIND_DEFINITIONS.map(([kind, label]) => {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'deck-kind';
    button.dataset.kind = kind;
    button.textContent = label;
    kinds.appendChild(button);
    return button;
  });

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

  const grid = documentRef.createElement('div');
  grid.className = 'team-grid';
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', 'Választható csapatok');

  const apply = documentRef.createElement('button');
  apply.type = 'button';
  apply.className = 'btn deck-selector__apply';
  apply.textContent = 'Csapat kiválasztása';
  apply.setAttribute('aria-label', 'Pakli alkalmazása');

  const note = documentRef.createElement('p');
  note.className = 'deck-selector__note';
  note.textContent = 'A kiválasztott párosítás a Klasszikus és a Büntetőpárbaj módban is működik. A klubjelvények jogtiszta, színezett körlogók; a ligaválogatottaknál országzászló jelenik meg.';

  let draft = normaliseDeckSelection(activeSelection);

  const entriesForDraft = () => {
    if (draft.kind === 'club') return options.clubs;
    if (draft.kind === 'nation') return options.nations;
    return [];
  };

  const setDraftValue = entry => {
    if (draft.kind === 'club') draft = { kind: 'club', value: entry.label };
    else if (draft.kind === 'nation') draft = { kind: 'nation', value: entry.key };
  };

  const renderPreview = () => {
    renderMatchSide(documentRef, humanSide, teamFromSelection(draft, players), 'Saját csapat');
    renderMatchSide(documentRef, aiSide, opponentPreview(draft), 'Gép');
  };

  const renderGrid = () => {
    grid.replaceChildren();
    if (draft.kind === 'random') {
      const tile = documentRef.createElement('button');
      tile.type = 'button';
      tile.className = 'team-tile is-selected';
      tile.setAttribute('role', 'option');
      tile.setAttribute('aria-selected', 'true');
      tile.appendChild(createTeamMark(documentRef, { kind: 'random', label: 'Véletlen', random: true }));
      const label = documentRef.createElement('span');
      label.className = 'team-tile__name';
      label.textContent = 'Teljesen véletlen';
      const count = documentRef.createElement('small');
      count.className = 'team-tile__count';
      count.textContent = `${options.total} használható kártya`;
      tile.append(label, count);
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
      tile.appendChild(createTeamMark(documentRef, {
        kind: draft.kind,
        label: entry.label,
        flag: entry.flag,
      }));
      const label = documentRef.createElement('span');
      label.className = 'team-tile__name';
      label.textContent = draft.kind === 'nation' ? `${entry.label} ligaválogatott` : entry.label;
      const count = documentRef.createElement('small');
      count.className = 'team-tile__count';
      count.textContent = `${entry.count} kártya`;
      tile.append(label, count);
      tile.addEventListener('click', () => {
        setDraftValue(entry);
        render();
      });
      grid.appendChild(tile);
    }
  };

  const render = () => {
    kindButtons.forEach(button => button.classList.toggle('is-active', button.dataset.kind === draft.kind));
    const entries = entriesForDraft();
    if (draft.kind !== 'random') {
      const exists = draft.kind === 'club'
        ? entries.some(entry => canonicalClubKey(entry.label) === canonicalClubKey(draft.value))
        : entries.some(entry => entry.key === canonicalNationKey(draft.value));
      if (!exists && entries[0]) setDraftValue(entries[0]);
    }
    renderPreview();
    renderGrid();
    apply.disabled = draft.kind !== 'random' && entriesForDraft().length === 0;
  };

  for (const button of kindButtons) {
    button.addEventListener('click', () => {
      draft = { kind: button.dataset.kind, value: '' };
      render();
    });
  }

  apply.addEventListener('click', () => {
    const next = normaliseDeckSelection(draft);
    if (selectionEquals(next, activeSelection)) {
      details.open = false;
      return;
    }
    if (storage.hasSavedMatch() && !confirmReplace(DECK_SELECTION_MENU_CONFIRM_MESSAGE)) return;
    storage.replace(next);
    reload();
  });

  body.append(lead, kinds, versus, grid, apply, note);
  details.append(summary, body);
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
  text.textContent = `Választhatsz legalább ${MIN_FILTERED_DECK_SIZE} kártyás NB I-es klubot vagy legalább ${QUICK_MATCH_NATION_MINIMUM} kártyás ligaválogatottat. A gép automatikusan másik csapatot kap, a párosítás pedig a Klasszikus és a Büntetőpárbaj móddal is használható.`;
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
      normalizedActive.kind === 'nation' ? QUICK_MATCH_NATION_MINIMUM : MIN_FILTERED_DECK_SIZE,
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
