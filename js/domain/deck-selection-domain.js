/** DOM- és tárolásfüggetlen pakliválasztási domainlogika. */

export const MIN_FILTERED_DECK_SIZE = 11;

export const RANDOM_DECK_SELECTION = Object.freeze({
  kind: 'random',
  value: '',
});

const DECK_DOMAIN_SELECTION_KINDS = new Set(['random', 'club', 'nation']);

const DECK_DOMAIN_NATION_ALIASES = new Map([
  ['hungary', 'hungary'], ['hungarian', 'hungary'], ['magyar', 'hungary'], ['magyarorszag', 'hungary'], ['hun', 'hungary'], ['hu', 'hungary'],
  ['serbia', 'serbia'], ['serbian', 'serbia'], ['szerb', 'serbia'], ['szerbia', 'serbia'], ['srb', 'serbia'], ['rs', 'serbia'],
  ['romania', 'romania'], ['romanian', 'romania'], ['roman', 'romania'], ['rou', 'romania'], ['rom', 'romania'], ['ro', 'romania'],
  ['croatia', 'croatia'], ['croatian', 'croatia'], ['horvat', 'croatia'], ['horvatorszag', 'croatia'], ['hrv', 'croatia'], ['cro', 'croatia'], ['hr', 'croatia'],
  ['slovakia', 'slovakia'], ['slovak', 'slovakia'], ['szlovak', 'slovakia'], ['szlovakia', 'slovakia'], ['svk', 'slovakia'], ['sk', 'slovakia'],
  ['slovenia', 'slovenia'], ['slovenian', 'slovenia'], ['szloven', 'slovenia'], ['szlovenia', 'slovenia'], ['svn', 'slovenia'], ['slo', 'slovenia'], ['si', 'slovenia'],
  ['ukraine', 'ukraine'], ['ukrainian', 'ukraine'], ['ukran', 'ukraine'], ['ukrajna', 'ukraine'], ['ukr', 'ukraine'], ['ua', 'ukraine'],
  ['austria', 'austria'], ['austrian', 'austria'], ['osztrak', 'austria'], ['ausztria', 'austria'], ['aut', 'austria'], ['at', 'austria'],
  ['germany', 'germany'], ['german', 'germany'], ['nemet', 'germany'], ['nemetorszag', 'germany'], ['ger', 'germany'], ['deu', 'germany'], ['de', 'germany'],
  ['bosnia and herzegovina', 'bosnia-herzegovina'], ['bosnia herzegovina', 'bosnia-herzegovina'],
  ['bosnian', 'bosnia-herzegovina'], ['bosnyak', 'bosnia-herzegovina'], ['bosnyak hercegovinai', 'bosnia-herzegovina'],
  ['bosznia hercegovina', 'bosnia-herzegovina'], ['bih', 'bosnia-herzegovina'], ['ba', 'bosnia-herzegovina'],
  ['montenegro', 'montenegro'], ['montenegrin', 'montenegro'], ['montenegroi', 'montenegro'], ['mne', 'montenegro'], ['me', 'montenegro'],
  ['north macedonia', 'north-macedonia'], ['macedonia', 'north-macedonia'], ['macedonian', 'north-macedonia'],
  ['eszak macedonia', 'north-macedonia'], ['eszakmacedon', 'north-macedonia'], ['macedon', 'north-macedonia'], ['mkd', 'north-macedonia'], ['mk', 'north-macedonia'],
  ['albania', 'albania'], ['albanian', 'albania'], ['alban', 'albania'], ['alb', 'albania'], ['al', 'albania'],
  ['kosovo', 'kosovo'], ['kosovan', 'kosovo'], ['koszovoi', 'kosovo'], ['kos', 'kosovo'], ['xkx', 'kosovo'], ['xk', 'kosovo'],
  ['czech republic', 'czechia'], ['czechia', 'czechia'], ['czech', 'czechia'], ['cseh', 'czechia'], ['csehorszag', 'czechia'], ['cze', 'czechia'], ['cz', 'czechia'],
  ['poland', 'poland'], ['polish', 'poland'], ['lengyel', 'poland'], ['lengyelorszag', 'poland'], ['pol', 'poland'], ['pl', 'poland'],
  ['netherlands', 'netherlands'], ['dutch', 'netherlands'], ['holland', 'netherlands'], ['hollandia', 'netherlands'], ['ned', 'netherlands'], ['nld', 'netherlands'], ['nl', 'netherlands'],
  ['france', 'france'], ['french', 'france'], ['francia', 'france'], ['franciaorszag', 'france'], ['fra', 'france'], ['fr', 'france'],
  ['spain', 'spain'], ['spanish', 'spain'], ['spanyol', 'spain'], ['spanyolorszag', 'spain'], ['esp', 'spain'], ['es', 'spain'],
  ['italy', 'italy'], ['italian', 'italy'], ['olasz', 'italy'], ['olaszorszag', 'italy'], ['ita', 'italy'], ['it', 'italy'],
  ['portugal', 'portugal'], ['portuguese', 'portugal'], ['por', 'portugal'], ['prt', 'portugal'], ['pt', 'portugal'],
  ['brazil', 'brazil'], ['brazilian', 'brazil'], ['bra', 'brazil'], ['br', 'brazil'],
  ['argentina', 'argentina'], ['argentinian', 'argentina'], ['argentin', 'argentina'], ['arg', 'argentina'], ['ar', 'argentina'],
  ['ghana', 'ghana'], ['ghanaian', 'ghana'], ['ghanai', 'ghana'], ['gha', 'ghana'], ['gh', 'ghana'],
  ['nigeria', 'nigeria'], ['nigerian', 'nigeria'], ['nigeriai', 'nigeria'], ['nga', 'nigeria'], ['ngr', 'nigeria'], ['ng', 'nigeria'],
  ['senegal', 'senegal'], ['senegalese', 'senegal'], ['szenegali', 'senegal'], ['sen', 'senegal'], ['sn', 'senegal'],
  ['georgia', 'georgia'], ['georgian', 'georgia'], ['gruz', 'georgia'], ['gruzia', 'georgia'], ['geo', 'georgia'], ['ge', 'georgia'],
  ['algeria', 'algeria'], ['algerian', 'algeria'], ['algeriai', 'algeria'], ['alg', 'algeria'], ['dz', 'algeria'],
  ['armenia', 'armenia'], ['armenian', 'armenia'], ['ormeny', 'armenia'], ['ormenyorszag', 'armenia'], ['arm', 'armenia'], ['am', 'armenia'],
  ['australia', 'australia'], ['australian', 'australia'], ['ausztral', 'australia'], ['ausztralia', 'australia'], ['aus', 'australia'], ['au', 'australia'],
  ['belgium', 'belgium'], ['belgian', 'belgium'], ['belga', 'belgium'], ['bel', 'belgium'], ['be', 'belgium'],
  ['bulgaria', 'bulgaria'], ['bulgarian', 'bulgaria'], ['bolgar', 'bulgaria'], ['bul', 'bulgaria'], ['bg', 'bulgaria'],
  ['central african republic', 'central-african-republic'], ['central african', 'central-african-republic'],
  ['kozep afrikai', 'central-african-republic'], ['kozep afrikai koztarsasag', 'central-african-republic'], ['caf', 'central-african-republic'], ['cf', 'central-african-republic'],
  ['canada', 'canada'], ['canadian', 'canada'], ['kanadai', 'canada'], ['kanada', 'canada'], ['can', 'canada'], ['ca', 'canada'],
  ['ivory coast', 'ivory-coast'], ['cote divoire', 'ivory-coast'], ['ivorian', 'ivory-coast'], ['elefantcsontparti', 'ivory-coast'], ['civ', 'ivory-coast'], ['ci', 'ivory-coast'],
  ['cameroon', 'cameroon'], ['cameroonian', 'cameroon'], ['kameruni', 'cameroon'], ['kamerun', 'cameroon'], ['cmr', 'cameroon'], ['cm', 'cameroon'],
  ['cape verde', 'cape-verde'], ['cabo verde', 'cape-verde'], ['cape verdean', 'cape-verde'], ['zold foki', 'cape-verde'], ['zold foki szigetek', 'cape-verde'], ['cpv', 'cape-verde'], ['cv', 'cape-verde'],
  ['costa rica', 'costa-rica'], ['costa rican', 'costa-rica'], ['costa rica i', 'costa-rica'], ['crc', 'costa-rica'], ['cr', 'costa-rica'],
  ['cyprus', 'cyprus'], ['cypriot', 'cyprus'], ['ciprusi', 'cyprus'], ['ciprus', 'cyprus'], ['cyp', 'cyprus'], ['cy', 'cyprus'],
  ['denmark', 'denmark'], ['danish', 'denmark'], ['dan', 'denmark'], ['dania', 'denmark'], ['den', 'denmark'], ['dnk', 'denmark'], ['dk', 'denmark'],
  ['england', 'england'], ['english', 'england'], ['angol', 'england'], ['anglia', 'england'], ['eng', 'england'], ['gb eng', 'england'],
  ['finland', 'finland'], ['finnish', 'finland'], ['finn', 'finland'], ['finnorszag', 'finland'], ['fin', 'finland'], ['fi', 'finland'],
  ['gambia', 'gambia'], ['gambian', 'gambia'], ['gambiai', 'gambia'], ['gam', 'gambia'], ['gmb', 'gambia'], ['gm', 'gambia'],
  ['greece', 'greece'], ['greek', 'greece'], ['gorog', 'greece'], ['gorogorszag', 'greece'], ['grc', 'greece'], ['gre', 'greece'], ['gr', 'greece'],
  ['guinea', 'guinea'], ['guinean', 'guinea'], ['guineai', 'guinea'], ['gui', 'guinea'], ['gin', 'guinea'], ['gn', 'guinea'],
  ['haiti', 'haiti'], ['haitian', 'haiti'], ['hai', 'haiti'], ['hti', 'haiti'], ['ht', 'haiti'],
  ['iran', 'iran'], ['iranian', 'iran'], ['irani', 'iran'], ['iri', 'iran'], ['irn', 'iran'], ['ir', 'iran'],
  ['ireland', 'ireland'], ['irish', 'ireland'], ['irorszag', 'ireland'], ['irl', 'ireland'], ['ie', 'ireland'],
  ['israel', 'israel'], ['israeli', 'israel'], ['izraeli', 'israel'], ['izrael', 'israel'], ['isr', 'israel'], ['il', 'israel'],
  ['japan', 'japan'], ['japanese', 'japan'], ['jpn', 'japan'], ['jp', 'japan'],
  ['latvia', 'latvia'], ['latvian', 'latvia'], ['lett', 'latvia'], ['lettorszag', 'latvia'], ['lat', 'latvia'], ['lva', 'latvia'], ['lv', 'latvia'],
  ['lithuania', 'lithuania'], ['lithuanian', 'lithuania'], ['litvan', 'lithuania'], ['litvania', 'lithuania'], ['ltu', 'lithuania'], ['lt', 'lithuania'],
  ['moldova', 'moldova'], ['moldovan', 'moldova'], ['moldovai', 'moldova'], ['mda', 'moldova'], ['md', 'moldova'],
  ['mexico', 'mexico'], ['mexican', 'mexico'], ['mexikoi', 'mexico'], ['mexiko', 'mexico'], ['mex', 'mexico'], ['mx', 'mexico'],
  ['mali', 'mali'], ['malian', 'mali'], ['mli', 'mali'], ['ml', 'mali'],
  ['norway', 'norway'], ['norwegian', 'norway'], ['norveg', 'norway'], ['norvegia', 'norway'], ['nor', 'norway'], ['no', 'norway'],
  ['paraguay', 'paraguay'], ['paraguayan', 'paraguay'], ['paraguayi', 'paraguay'], ['par', 'paraguay'], ['pry', 'paraguay'], ['py', 'paraguay'],
  ['south africa', 'south-africa'], ['south african', 'south-africa'], ['del afrikai', 'south-africa'], ['del afrikai koztarsasag', 'south-africa'], ['rsa', 'south-africa'], ['zaf', 'south-africa'], ['za', 'south-africa'],
  ['russia', 'russia'], ['russian', 'russia'], ['orosz', 'russia'], ['oroszorszag', 'russia'], ['rus', 'russia'], ['ru', 'russia'],
  ['switzerland', 'switzerland'], ['swiss', 'switzerland'], ['svajci', 'switzerland'], ['svajc', 'switzerland'], ['sui', 'switzerland'], ['che', 'switzerland'], ['ch', 'switzerland'],
  ['suriname', 'suriname'], ['surinamese', 'suriname'], ['suriname i', 'suriname'], ['sur', 'suriname'], ['sr', 'suriname'],
  ['sweden', 'sweden'], ['swedish', 'sweden'], ['sved', 'sweden'], ['svedorszag', 'sweden'], ['swe', 'sweden'], ['se', 'sweden'],
  ['togo', 'togo'], ['togolese', 'togo'], ['togoi', 'togo'], ['tog', 'togo'], ['tg', 'togo'],
  ['trinidad and tobago', 'trinidad-tobago'], ['trinidad tobago', 'trinidad-tobago'], ['trinidad es tobago', 'trinidad-tobago'], ['trinidad and tobagonian', 'trinidad-tobago'], ['tri', 'trinidad-tobago'], ['tto', 'trinidad-tobago'], ['tt', 'trinidad-tobago'],
  ['tunisia', 'tunisia'], ['tunisian', 'tunisia'], ['tuneziai', 'tunisia'], ['tunezia', 'tunisia'], ['tun', 'tunisia'], ['tn', 'tunisia'],
  ['united states', 'united-states'], ['united states of america', 'united-states'], ['american', 'united-states'], ['amerikai', 'united-states'], ['usa', 'united-states'], ['us', 'united-states'],
  ['venezuela', 'venezuela'], ['venezuelan', 'venezuela'], ['venezuelai', 'venezuela'], ['ven', 'venezuela'], ['ve', 'venezuela'],
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
  algeria: ['🇩🇿', 'Algériai'],
  armenia: ['🇦🇲', 'Örmény'],
  australia: ['🇦🇺', 'Ausztrál'],
  belgium: ['🇧🇪', 'Belga'],
  bulgaria: ['🇧🇬', 'Bolgár'],
  'central-african-republic': ['🇨🇫', 'Közép-afrikai'],
  canada: ['🇨🇦', 'Kanadai'],
  'ivory-coast': ['🇨🇮', 'Elefántcsontparti'],
  cameroon: ['🇨🇲', 'Kameruni'],
  'cape-verde': ['🇨🇻', 'Zöld-foki'],
  'costa-rica': ['🇨🇷', 'Costa Rica-i'],
  cyprus: ['🇨🇾', 'Ciprusi'],
  denmark: ['🇩🇰', 'Dán'],
  england: ['\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', 'Angol'],
  finland: ['🇫🇮', 'Finn'],
  gambia: ['🇬🇲', 'Gambiai'],
  greece: ['🇬🇷', 'Görög'],
  guinea: ['🇬🇳', 'Guineai'],
  haiti: ['🇭🇹', 'Haiti'],
  iran: ['🇮🇷', 'Iráni'],
  ireland: ['🇮🇪', 'Ír'],
  israel: ['🇮🇱', 'Izraeli'],
  japan: ['🇯🇵', 'Japán'],
  latvia: ['🇱🇻', 'Lett'],
  lithuania: ['🇱🇹', 'Litván'],
  moldova: ['🇲🇩', 'Moldovai'],
  mexico: ['🇲🇽', 'Mexikói'],
  mali: ['🇲🇱', 'Mali'],
  norway: ['🇳🇴', 'Norvég'],
  paraguay: ['🇵🇾', 'Paraguayi'],
  'south-africa': ['🇿🇦', 'Dél-afrikai'],
  russia: ['🇷🇺', 'Orosz'],
  switzerland: ['🇨🇭', 'Svájci'],
  suriname: ['🇸🇷', 'Suriname-i'],
  sweden: ['🇸🇪', 'Svéd'],
  togo: ['🇹🇬', 'Togói'],
  'trinidad-tobago': ['🇹🇹', 'Trinidad és Tobagó-i'],
  tunisia: ['🇹🇳', 'Tunéziai'],
  'united-states': ['🇺🇸', 'Amerikai'],
  venezuela: ['🇻🇪', 'Venezuelai'],
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
  const exact = String(value ?? '').trim().toLocaleLowerCase('hu-HU');
  if (exact === 'ír') return 'ireland';
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
