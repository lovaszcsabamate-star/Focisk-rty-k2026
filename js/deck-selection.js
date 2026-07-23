/** Deck filtering and menu controls shared by both game modes. */

import {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  deckSelectionStorageService,
  readDeckSelection,
  saveDeckSelection,
} from './services/deck-selection-storage-service.js';
import {
  MIN_FILTERED_DECK_SIZE,
  RANDOM_DECK_SELECTION,
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalClubKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
} from './domain/deck-selection-domain.js';

export {
  MIN_FILTERED_DECK_SIZE,
  RANDOM_DECK_SELECTION,
  applyDeckSelectionToPayload,
  buildDeckSelectionOptions,
  canonicalClubKey,
  canonicalNationKey,
  describeDeckSelection,
  nationPresentation,
  normaliseDeckSelection,
  resolveDeckSelection,
  selectionEquals,
  validateDeckSelection,
};

export {
  DECK_SELECTION_STORAGE_KEY,
  SAVED_MATCH_STORAGE_KEY,
  readDeckSelection,
  saveDeckSelection,
};

const STYLE_ID = 'deck-selection-styles';

function ensureStyles() {
  if (document.querySelector(`#${STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .deck-selector { margin: 12px 0 14px; border: 1px solid rgba(232,195,122,.34); border-radius: 16px; background: rgba(0,0,0,.22); overflow: hidden; }
    .deck-selector > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 12px 14px; cursor: pointer; font-weight: 800; color: var(--cream, #f2e6d0); list-style: none; }
    .deck-selector > summary::-webkit-details-marker { display: none; }
    .deck-selector > summary::after { content: '▾'; color: var(--brass-light, #e8c37a); transition: transform .16s ease; }
    .deck-selector[open] > summary::after { transform: rotate(180deg); }
    .deck-selector__current { display: block; margin-top: 3px; color: var(--muted, #a08d72); font-size: 11px; font-weight: 600; }
    .deck-selector__body { display: grid; gap: 12px; padding: 0 14px 14px; border-top: 1px solid rgba(232,195,122,.16); }
    .deck-selector__lead { margin: 12px 0 0; color: var(--muted, #a08d72); font-size: 12px; line-height: 1.45; }
    .deck-selector__kinds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .deck-kind { min-height: 54px; padding: 9px 8px; border: 1px solid rgba(232,195,122,.28); border-radius: 12px; background: rgba(255,255,255,.045); color: var(--cream, #f2e6d0); cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; }
    .deck-kind.is-active { border-color: var(--brass, #c9a227); background: rgba(201,162,39,.2); box-shadow: 0 0 0 2px rgba(201,162,39,.12); }
    .deck-selector__choice { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: end; }
    .deck-selector__choice label { display: grid; gap: 5px; color: var(--muted, #a08d72); font-size: 11px; font-weight: 700; }
    .deck-selector select { width: 100%; min-height: 46px; padding: 9px 11px; border: 1px solid rgba(232,195,122,.34); border-radius: 11px; background: #21150e; color: var(--cream, #f2e6d0); font: inherit; }
    .deck-selector__apply { min-height: 46px; white-space: nowrap; }
    .deck-selector__note { margin: 0; color: var(--muted, #a08d72); font-size: 10.5px; line-height: 1.4; }
    @media (max-width: 620px) {
      .deck-selector__kinds { grid-template-columns: 1fr; }
      .deck-kind { min-height: 46px; text-align: left; }
      .deck-selector__choice { grid-template-columns: 1fr; }
      .deck-selector__apply { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

const makeOption = (value, label) => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
};

function insertDeckSelector(panel, players, activeSelection) {
  if (panel.querySelector('.deck-selector')) return;
  const options = buildDeckSelectionOptions(players);
  const details = document.createElement('details');
  details.className = 'deck-selector';

  const summary = document.createElement('summary');
  const summaryCopy = document.createElement('span');
  summaryCopy.textContent = '🗂 Pakli kiválasztása';
  const current = document.createElement('small');
  current.className = 'deck-selector__current';
  current.textContent = describeDeckSelection(activeSelection, players);
  summaryCopy.appendChild(current);
  summary.appendChild(summaryCopy);

  const body = document.createElement('div');
  body.className = 'deck-selector__body';
  const lead = document.createElement('p');
  lead.className = 'deck-selector__lead';
  lead.textContent = `Válassz teljesen véletlen paklit, egy NB I-es klubot vagy olyan nemzetiséget, amelyből legalább ${MIN_FILTERED_DECK_SIZE} használható kártya van.`;

  const kinds = document.createElement('div');
  kinds.className = 'deck-selector__kinds';
  const kindDefinitions = [
    ['random', '🎲 Véletlen kártyák'],
    ['club', '🛡️ Csapat választása'],
    ['nation', '🌍 Nemzetiség'],
  ];
  const kindButtons = kindDefinitions.map(([kind, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'deck-kind';
    button.dataset.kind = kind;
    button.textContent = label;
    kinds.appendChild(button);
    return button;
  });

  const choice = document.createElement('div');
  choice.className = 'deck-selector__choice';
  const field = document.createElement('label');
  const fieldLabel = document.createElement('span');
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Pakli részletes kiválasztása');
  field.append(fieldLabel, select);
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'btn deck-selector__apply';
  apply.textContent = 'Pakli alkalmazása';
  choice.append(field, apply);

  const note = document.createElement('p');
  note.className = 'deck-selector__note';
  note.textContent = 'A választás mindkét játékmódra érvényes. 11–21 lapos paklinál a Büntetőpárbaj a rendelkezésre álló keretből tükrözött lapokat is használ.';

  let draft = normaliseDeckSelection(activeSelection);

  const render = () => {
    kindButtons.forEach(button => button.classList.toggle('is-active', button.dataset.kind === draft.kind));
    select.replaceChildren();
    if (draft.kind === 'random') {
      fieldLabel.textContent = 'Aktív adatbázis';
      select.appendChild(makeOption('', `${options.total} használható kártya`));
      select.disabled = true;
      return;
    }

    const entries = draft.kind === 'club' ? options.clubs : options.nations;
    fieldLabel.textContent = draft.kind === 'club' ? 'NB I-es klub' : 'Nemzetiség';
    select.disabled = entries.length === 0;
    for (const entry of entries) {
      const icon = draft.kind === 'nation' ? `${entry.flag} ` : '';
      select.appendChild(makeOption(entry.key, `${icon}${entry.label} — ${entry.count} kártya`));
    }

    const preferred = draft.kind === 'club'
      ? entries.find(entry => canonicalClubKey(entry.label) === canonicalClubKey(draft.value))
      : entries.find(entry => entry.key === canonicalNationKey(draft.value));
    select.value = preferred?.key ?? entries[0]?.key ?? '';
    if (!select.value && entries.length) select.selectedIndex = 0;
  };

  for (const button of kindButtons) {
    button.addEventListener('click', () => {
      draft = { kind: button.dataset.kind, value: '' };
      render();
    });
  }

  apply.addEventListener('click', () => {
    let next = { ...RANDOM_DECK_SELECTION };
    if (draft.kind === 'club') {
      const entry = options.clubs.find(item => item.key === select.value);
      if (entry) next = { kind: 'club', value: entry.label };
    } else if (draft.kind === 'nation') {
      const entry = options.nations.find(item => item.key === select.value);
      if (entry) next = { kind: 'nation', value: entry.key };
    }

    if (selectionEquals(next, activeSelection)) {
      details.open = false;
      return;
    }

    const hasSavedMatch = deckSelectionStorageService.hasSavedMatch();
    if (hasSavedMatch && !window.confirm('A pakli cseréje törli a jelenlegi mentett mérkőzést. Folytatod?')) return;

    deckSelectionStorageService.replace(next);
    window.location.reload();
  });

  body.append(lead, kinds, choice, note);
  details.append(summary, body);
  panel.querySelector('.primary-mode-actions')?.before(details);
  render();
}

export function installDeckSelectionMenu(payload, activeSelection) {
  if (typeof document === 'undefined') return () => {};
  const players = Array.isArray(payload) ? payload : payload?.players;
  const pool = Array.isArray(players) ? players : [];
  const selection = validateDeckSelection(pool, activeSelection).selection;
  ensureStyles();

  const enhance = () => {
    document.querySelectorAll('.menu-panel.mobile-home').forEach(panel => insertDeckSelector(panel, pool, selection));
    document.querySelectorAll('.rules-panel').forEach(panel => {
      if (panel.querySelector('.deck-selection-rule')) return;
      const rule = document.createElement('section');
      rule.className = 'rule-card deck-selection-rule';
      const title = document.createElement('h2');
      title.textContent = '🗂 Pakliválasztás';
      const text = document.createElement('p');
      text.textContent = `Mindkét játékmód indítható véletlen, klub- vagy nemzetiségalapú paklival. Csak legalább ${MIN_FILTERED_DECK_SIZE} használható kártyát tartalmazó csoport választható.`;
      rule.append(title, text);
      panel.querySelector('#rules-back-btn')?.before(rule);
    });
  };

  const observer = new MutationObserver(enhance);
  const start = () => {
    enhance();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  return () => observer.disconnect();
}
