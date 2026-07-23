/** DOM- és tárolásfüggetlen pakliválasztási domainlogika. */

export const MIN_FILTERED_DECK_SIZE = 11;

export const RANDOM_DECK_SELECTION = Object.freeze({
  kind: 'random',
  value: '',
});

const DECK_DOMAIN_SELECTION_KINDS = new Set(['random', 'club', 'nation']);

const DECK_DOMAIN_NATION_ALIASES = new Map([
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

const DECK_DOMAIN_NATION_PRESENTATION = Object.freeze({
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

const deckDomainFold = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const deckDomainPlayers = players => (Array.isArray(players) ? players : []);

const deckDomainGroupBy = (players, keyFor, labelFor) => {
  const groups = new Map();
  for (const player of deckDomainPlayers(players)) {
    const key = keyFor(player);
    if (!key) continue;
    const current = groups.get(key) ?? { key, label: labelFor(player), count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()];
};

export const canonicalClubKey = value => deckDomainFold(value);

export function canonicalNationKey(value) {
  const raw = deckDomainFold(value);
  if (!raw) return '';
  return DECK_DOMAIN_NATION_ALIASES.get(raw) ?? raw.replace(/\s+/g, '-');
}

export function nationPresentation(value) {
  const key = canonicalNationKey(value);
  const configured = DECK_DOMAIN_NATION_PRESENTATION[key];
  if (configured) return { key, flag: configured[0], label: configured[1] };
  const fallback = String(value ?? '').trim() || 'Ismeretlen';
  return { key, flag: '🌍', label: fallback };
}

export function buildDeckSelectionOptions(players, minimum = MIN_FILTERED_DECK_SIZE) {
  const pool = deckDomainPlayers(players);
  const clubs = deckDomainGroupBy(
    pool,
    player => canonicalClubKey(player?.club),
    player => String(player?.club ?? '').trim(),
  )
    .filter(item => item.count >= minimum)
    .sort((a, b) => a.label.localeCompare(b.label, 'hu-HU'));

  const nations = deckDomainGroupBy(
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
  const kind = DECK_DOMAIN_SELECTION_KINDS.has(selection.kind) ? selection.kind : 'random';
  if (kind === 'random') return { ...RANDOM_DECK_SELECTION };
  const value = String(selection.value ?? '').trim();
  return value ? { kind, value } : { ...RANDOM_DECK_SELECTION };
}

export function selectionEquals(left, right) {
  const a = normaliseDeckSelection(left);
  const b = normaliseDeckSelection(right);
  if (a.kind !== b.kind) return false;
  if (a.kind === 'club') return canonicalClubKey(a.value) === canonicalClubKey(b.value);
  if (a.kind === 'nation') return canonicalNationKey(a.value) === canonicalNationKey(b.value);
  return true;
}

export function resolveDeckSelection(players, selection) {
  const pool = deckDomainPlayers(players);
  const normalised = normaliseDeckSelection(selection);
  if (normalised.kind === 'club') {
    const key = canonicalClubKey(normalised.value);
    return pool.filter(player => canonicalClubKey(player?.club) === key);
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
    return {
      selection: { ...RANDOM_DECK_SELECTION },
      players: deckDomainPlayers(players).slice(),
      valid: false,
    };
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
