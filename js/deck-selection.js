/** Deck filtering and menu controls shared by both game modes. */

export const MIN_FILTERED_DECK_SIZE = 11;
export const DECK_SELECTION_STORAGE_KEY = 'fociskartyak:deck-selection:v1';
export const SAVED_MATCH_STORAGE_KEY = 'fociskartyak:saved-match:v2';

export const RANDOM_DECK_SELECTION = Object.freeze({
  kind: 'random',
  value: '',
});

const NATION_ALIASES = new Map([
  ['hungary', 'hungary'], ['hungarian', 'hungary'], ['magyar', 'hungary'], ['magyarorszag', 'hungary'], ['hun', 'hungary'],
  ['serbia', 'serbia'], ['serbian', 'serbia'], ['szerb', 'serbia'], ['szerbia', 'serbia'], ['srb', 'serbia'],
  ['romania', 'romania'], ['romanian', 'romania'], ['roman', 'romania'], ['romania', 'romania'], ['rou', 'romania'], ['rom', 'romania'],
  ['croatia', 'croatia'], ['croatian', 'croatia'], ['horvat', 'croatia'], ['horvatorszag', 'croatia'], ['hrv', 'croatia'],
  ['slovakia', 'slovakia'], ['slovak', 'slovakia'], ['szlovak', 'slovakia'], ['szlovakia', 'slovakia'], ['svk', 'slovakia'],
  ['slovenia', 'slovenia'], ['slovenian', 'slovenia'], ['szloven', 'slovenia'], ['szlovenia', 'slovenia'], ['svn', 'slovenia'],
  ['ukraine', 'ukraine'], ['ukrainian', 'ukraine'], ['ukran', 'ukraine'], ['ukrajna', 'ukraine'], ['ukr', 'ukraine'],
  ['austria', 'austria'], ['austrian', 'austria'], ['osztrak', 'austria'], ['ausztria', 'austria'], ['aut', 'austria'],
  ['germany', 'germany'], ['german', 'germany'], ['nemet', 'germany'], ['nemetorszag', 'germany'], ['ger', 'germany'], ['deu', 'germany'],
  ['bosnia and herzegovina', 'bosnia-herzegovina'], ['bosnia-herzegovina', 'bosnia-herzegovina'],
  ['bosnian', 'bosnia-herzegovina'], ['bosnyak', 'bosnia-herzegovina'], ['bosznia-hercegovina', 'bosnia-herzegovina'], ['bih', 'bosnia-herzegovina'],
  ['montenegro', 'montenegro'], ['montenegrin', 'montenegro'], ['montenegroi', 'montenegro'], ['mne', 'montenegro'],
  ['north macedonia', 'north-macedonia'], ['macedonia', 'north-macedonia'], ['macedonian', 'north-macedonia'],
  ['eszak-macedonia', 'north-macedonia'], ['macedon', 'north-macedonia'], ['mkd', 'north-macedonia'],
  ['albania', 'albania'], ['albanian', 'albania'], ['alban', 'albania'], ['alb', 'albania'],
  ['kosovo', 'kosovo'], ['kosovan', 'kosovo'], ['koszovoi', 'kosovo'], ['kos', 'kosovo'],
  ['czech republic', 'czechia'], ['czechia', 'czechia'], ['czech', 'czechia'], ['cseh', 'czechia'], ['csehorszag', 'czechia'], ['cze', 'czechia'],
  ['poland', 'poland'], ['polish', 'poland'], ['lengyel', 'poland'], ['lengyelorszag', 'poland'], ['pol', 'poland'],
  ['netherlands', 'netherlands'], ['dutch', 'netherlands'], ['holland', 'netherlands'], ['hollandia', 'netherlands'], ['ned', 'netherlands'],
  ['france', 'france'], ['french', 'france'], ['francia', 'france'], ['franciaorszag', 'france'], ['fra', 'france'],
  ['spain', 'spain'], ['spanish', 'spain'], ['spanyol', 'spain'], ['spanyolorszag', 'spain'], ['esp', 'spain'],
  ['italy', 'italy'], ['italian', 'italy'], ['olasz', 'italy'], ['olaszorszag', 'italy'], ['ita', 'italy'],
  ['portugal', 'portugal'], ['portuguese', 'portugal'], ['portugal', 'portugal'], ['por', 'portugal'],
  ['brazil', 'brazil'], ['brazilian', 'brazil'], ['brazil', 'brazil'], ['bra', 'brazil'],
  ['argentina', 'argentina'], ['argentinian', 'argentina'], ['argentin', 'argentina'], ['arg', 'argentina'],
  ['ghana', 'ghana'], ['ghanaian', 'ghana'], ['ghanai', 'ghana'], ['gha', 'ghana'],
  ['nigeria', 'nigeria'], ['nigerian', 'nigeria'], ['nigeriai', 'nigeria'], ['nga', 'nigeria'],
  ['senegal', 'senegal'], ['senegalese', 'senegal'], ['szenegali', 'senegal'], ['sen', 'senegal'],
  ['georgia', 'georgia'], ['georgian', 'georgia'], ['gruz', 'georgia'], ['gruzia', 'georgia'], ['geo', 'georgia'],
]);

const NATION_PRESENTATION = Object.freeze({
  hungary: ['🇭🇺', 'Magyar'],
  serbia: ['🇷🇸', 'Szerb'],
  romania: ['🇷🇴', 'Román'],
  croatia: ['🇭🇷', 'Horvát'],
  slovakia: ['🇸🇰', 'Szlovák'],
  slovenia: ['🇸🇮', 'Szlovén'],
  ukraine: ['🇺🇦', 'Ukrán'],
  austria: ['🇦🇹', 'Osztrák'],
  germany: ['🇩🇪', 'Német'],
  'bosnia-herzegovina': ['🇧🇦', 'Bosnyák-hercegovinai'],
  montenegro: ['🇲🇪', 'Montenegrói'],
  'north-macedonia': ['🇲🇰', 'Észak-macedón'],
  albania: ['🇦🇱', 'Albán'],
  kosovo: ['🇽🇰', 'Koszovói'],
  czechia: ['🇨🇿', 'Cseh'],
  poland: ['🇵🇱', 'Lengyel'],
  netherlands: ['🇳🇱', 'Holland'],
  france: ['🇫🇷', 'Francia'],
  spain: ['🇪🇸', 'Spanyol'],
  italy: ['🇮🇹', 'Olasz'],
  portugal: ['🇵🇹', 'Portugál'],
  brazil: ['🇧🇷', 'Brazil'],
  argentina: ['🇦🇷', 'Argentin'],
  ghana: ['🇬🇭', 'Ghánai'],
  nigeria: ['🇳🇬', 'Nigériai'],
  senegal: ['🇸🇳', 'Szenegáli'],
  georgia: ['🇬🇪', 'Grúz'],
});

const fold = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const safePlayers = players => (Array.isArray(players) ? players : []);

export function canonicalNationKey(value) {
  const raw = fold(value);
  if (!raw) return '';
  return NATION_ALIASES.get(raw) ?? raw.replace(/\s+/g, '-');
}

export function nationPresentation(value) {
  const key = canonicalNationKey(value);
  const configured = NATION_PRESENTATION[key];
  if (configured) return { key, flag: configured[0], label: configured[1] };
  const fallback = String(value ?? '').trim() || 'Ismeretlen';
  return { key, flag: '🌍', label: fallback };
}

const groupBy = (players, keyFor, labelFor) => {
  const groups = new Map();
  for (const player of safePlayers(players)) {
    const key = keyFor(player);
    if (!key) continue;
    const current = groups.get(key) ?? { key, label: labelFor(player), count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()];
};

export function buildDeckSelectionOptions(players, minimum = MIN_FILTERED_DECK_SIZE) {
  const pool = safePlayers(players);
  const clubs = groupBy(
    pool,
    player => fold(player?.club),
    player => String(player?.club ?? '').trim(),
  )
    .filter(item => item.count >= minimum)
    .sort((a, b) => a.label.localeCompare(b.label, 'hu-HU'));

  const nations = groupBy(
    pool,
    player => canonicalNationKey(player?.nation),
    player => nationPresentation(player?.nation).label,
  )
    .filter(item => item.count >= minimum)
    .map(item => {
      const presentation = nationPresentation(item.key);
      return { ...item, label: presentation.label, flag: presentation.flag };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'hu-HU'));

  return { minimum, total: pool.length, clubs, nations };
}

export function normaliseDeckSelection(selection) {
  if (!selection || typeof selection !== 'object') return { ...RANDOM_DECK_SELECTION };
  const kind = ['random', 'club', 'nation'].includes(selection.kind) ? selection.kind : 'random';
  if (kind === 'random') return { ...RANDOM_DECK_SELECTION };
  const value = String(selection.value ?? '').trim();
  return value ? { kind, value } : { ...RANDOM_DECK_SELECTION };
}

export function selectionEquals(left, right) {
  const a = normaliseDeckSelection(left);
  const b = normaliseDeckSelection(right);
  if (a.kind !== b.kind) return false;
  if (a.kind === 'club') return fold(a.value) === fold(b.value);
  if (a.kind === 'nation') return canonicalNationKey(a.value) === canonicalNationKey(b.value);
  return true;
}

export function resolveDeckSelection(players, selection) {
  const pool = safePlayers(players);
  const normalised = normaliseDeckSelection(selection);
  if (normalised.kind === 'club') {
    const key = fold(normalised.value);
    return pool.filter(player => fold(player?.club) === key);
  }
  if (normalised.kind === 'nation') {
    const key = canonicalNationKey(normalised.value);
    return pool.filter(player => canonicalNationKey(player?.nation) === key);
  }
  return pool.slice();
}

export function validateDeckSelection(players, selection, minimum = MIN_FILTERED_DECK_SIZE) {
  const normalised = normaliseDeckSelection(selection);
  const selectedPlayers = resolveDeckSelection(players, normalised);
  if (normalised.kind !== 'random' && selectedPlayers.length < minimum) {
    return { selection: { ...RANDOM_DECK_SELECTION }, players: safePlayers(players).slice(), valid: false };
  }
  return { selection: normalised, players: selectedPlayers, valid: true };
}

export function describeDeckSelection(selection, players = []) {
  const normalised = normaliseDeckSelection(selection);
  const count = resolveDeckSelection(players, normalised).length;
  if (normalised.kind === 'club') return `Klub: ${normalised.value} · ${count} kártya`;
  if (normalised.kind === 'nation') {
    const nation = nationPresentation(normalised.value);
    return `Nemzetiség: ${nation.flag} ${nation.label} · ${count} kártya`;
  }
  return `Véletlen kártyák · ${count} lapos adatbázis`;
}

export function readDeckSelection(players = []) {
  try {
    const raw = localStorage.getItem(DECK_SELECTION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : RANDOM_DECK_SELECTION;
    return validateDeckSelection(players, parsed).selection;
  } catch {
    return { ...RANDOM_DECK_SELECTION };
  }
}

export function saveDeckSelection(selection) {
  const normalised = normaliseDeckSelection(selection);
  try {
    localStorage.setItem(DECK_SELECTION_STORAGE_KEY, JSON.stringify(normalised));
    return true;
  } catch {
    return false;
  }
}

export function applyDeckSelectionToPayload(payload, selection) {
  const sourcePlayers = Array.isArray(payload) ? payload : payload?.players;
  const checked = validateDeckSelection(sourcePlayers, selection);
  const deckMeta = {
    ...checked.selection,
    label: describeDeckSelection(checked.selection, sourcePlayers),
    availableCards: checked.players.length,
    minimumCards: MIN_FILTERED_DECK_SIZE,
  };

  if (Array.isArray(payload)) return checked.players;
  return {
    ...(payload ?? {}),
    players: checked.players,
    deckSelection: deckMeta,
    selection: {
      ...(payload?.selection ?? {}),
      deckSelection: deckMeta,
    },
  };
}

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
      ? entries.find(entry => fold(entry.label) === fold(draft.value))
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

    let hasSavedMatch = false;
    try { hasSavedMatch = Boolean(localStorage.getItem(SAVED_MATCH_STORAGE_KEY)); } catch { /* optional storage */ }
    if (hasSavedMatch && !window.confirm('A pakli cseréje törli a jelenlegi mentett mérkőzést. Folytatod?')) return;

    try { localStorage.removeItem(SAVED_MATCH_STORAGE_KEY); } catch { /* optional storage */ }
    saveDeckSelection(next);
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
  const pool = safePlayers(players);
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
