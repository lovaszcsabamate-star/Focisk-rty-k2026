const UNKNOWN_NATIONALITY = 'Nem ismert';

const HOME_NATIONS = Object.freeze({
  'GB-ENG': Object.freeze({
    key: 'england', nationality: 'England', label: 'Angol',
    flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
    asset: 'assets/flags/gb-eng.svg',
  }),
  'GB-SCT': Object.freeze({
    key: 'scotland', nationality: 'Scotland', label: 'Skót',
    flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
    asset: 'assets/flags/gb-sct.svg',
  }),
  'GB-WLS': Object.freeze({
    key: 'wales', nationality: 'Wales', label: 'Walesi',
    flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
    asset: 'assets/flags/gb-wls.svg',
  }),
  'GB-NIR': Object.freeze({
    key: 'northern-ireland', nationality: 'Northern Ireland', label: 'Északír',
    flag: '🏴', asset: 'assets/flags/gb-nir.svg',
  }),
});

const FOOTBALL_CODE_TO_COUNTRY_CODE = Object.freeze({
  ALB: 'AL', ALG: 'DZ', AND: 'AD', ANG: 'AO', ARG: 'AR', ARM: 'AM', AUS: 'AU', AUT: 'AT', AZE: 'AZ',
  BEL: 'BE', BEN: 'BJ', BFA: 'BF', BGR: 'BG', BUL: 'BG', BIH: 'BA', BLR: 'BY', BOL: 'BO', BRA: 'BR',
  CAF: 'CF', CAN: 'CA', CHI: 'CL', CHL: 'CL', CIV: 'CI', CMR: 'CM', COD: 'CD', COL: 'CO', CPV: 'CV', CRC: 'CR',
  CRO: 'HR', CYP: 'CY', CZE: 'CZ', DEN: 'DK', DEU: 'DE', DNK: 'DK', ECU: 'EC', EGY: 'EG', ENG: 'GB-ENG',
  ESP: 'ES', EST: 'EE', FIN: 'FI', FRA: 'FR', GAB: 'GA', GAM: 'GM', GMB: 'GM', GEO: 'GE', GER: 'DE', GHA: 'GH', GIN: 'GN',
  GNB: 'GW', GRC: 'GR', GRE: 'GR', GUI: 'GN', HAI: 'HT', HTI: 'HT', HND: 'HN', HRV: 'HR', HUN: 'HU',
  IRI: 'IR', IRN: 'IR', IRL: 'IE', ISL: 'IS', ISR: 'IL', ITA: 'IT', JAM: 'JM', JPN: 'JP', KAZ: 'KZ', KEN: 'KE',
  KOR: 'KR', KOS: 'XK', KVX: 'XK', LBN: 'LB', LIE: 'LI', LTU: 'LT', LUX: 'LU', LVA: 'LV', MAR: 'MA',
  MDA: 'MD', MEX: 'MX', MKD: 'MK', MLI: 'ML', MLT: 'MT', MNE: 'ME', MOZ: 'MZ', NED: 'NL', NGA: 'NG',
  NGR: 'NG', NIR: 'GB-NIR', NOR: 'NO', NZL: 'NZ', PAN: 'PA', PAR: 'PY', PER: 'PE', POL: 'PL', POR: 'PT',
  PRK: 'KP', ROU: 'RO', ROM: 'RO', RSA: 'ZA', RUS: 'RU', SCO: 'GB-SCT', SEN: 'SN', SRB: 'RS', SUI: 'CH',
  SUR: 'SR', SVK: 'SK', SLO: 'SI', SVN: 'SI', SWE: 'SE', TGO: 'TG', TOG: 'TG', TRI: 'TT', TTO: 'TT',
  TUN: 'TN', TUR: 'TR', UAE: 'AE', UGA: 'UG', UKR: 'UA', URU: 'UY', USA: 'US', UZB: 'UZ', VEN: 'VE',
  WAL: 'GB-WLS', XKS: 'XK', XKX: 'XK', ZAF: 'ZA', ZAM: 'ZM', ZIM: 'ZW',
});

const COUNTRY_CODE_TO_KEY = Object.freeze({
  AD: 'andorra', AE: 'united-arab-emirates', AL: 'albania', AM: 'armenia', AO: 'angola', AR: 'argentina',
  AT: 'austria', AU: 'australia', AZ: 'azerbaijan', BA: 'bosnia-herzegovina', BE: 'belgium', BF: 'burkina-faso',
  BG: 'bulgaria', BJ: 'benin', BO: 'bolivia', BR: 'brazil', BY: 'belarus', CA: 'canada', CD: 'dr-congo',
  CF: 'central-african-republic', CH: 'switzerland', CI: 'ivory-coast', CL: 'chile', CM: 'cameroon', CO: 'colombia',
  CR: 'costa-rica', CV: 'cape-verde', CY: 'cyprus', CZ: 'czechia', DE: 'germany', DK: 'denmark', DZ: 'algeria',
  EC: 'ecuador', EE: 'estonia', EG: 'egypt', ES: 'spain', FI: 'finland', FR: 'france', GA: 'gabon', GE: 'georgia',
  GH: 'ghana', GM: 'gambia', GN: 'guinea', GR: 'greece', GW: 'guinea-bissau', HN: 'honduras', HR: 'croatia',
  HT: 'haiti', HU: 'hungary', IE: 'ireland', IL: 'israel', IR: 'iran', IS: 'iceland', IT: 'italy', JM: 'jamaica',
  JP: 'japan', KE: 'kenya', KG: 'kyrgyzstan', KP: 'north-korea', KR: 'south-korea', KZ: 'kazakhstan', LB: 'lebanon',
  LI: 'liechtenstein', LT: 'lithuania', LU: 'luxembourg', LV: 'latvia', MA: 'morocco', MD: 'moldova', ME: 'montenegro',
  MK: 'north-macedonia', ML: 'mali', MT: 'malta', MX: 'mexico', MZ: 'mozambique', NG: 'nigeria', NL: 'netherlands',
  NO: 'norway', NZ: 'new-zealand', PA: 'panama', PE: 'peru', PL: 'poland', PT: 'portugal', PY: 'paraguay',
  RO: 'romania', RS: 'serbia', RU: 'russia', SE: 'sweden', SI: 'slovenia', SK: 'slovakia', SN: 'senegal',
  SR: 'suriname', TG: 'togo', TN: 'tunisia', TR: 'turkey', TT: 'trinidad-tobago', UA: 'ukraine', UG: 'uganda',
  US: 'united-states', UY: 'uruguay', UZ: 'uzbekistan', VE: 'venezuela', XK: 'kosovo', ZA: 'south-africa',
  ZM: 'zambia', ZW: 'zimbabwe',
});

const COUNTRY_CODE_TO_NATIONALITY_OVERRIDES = Object.freeze({
  BA: 'Bosnia and Herzegovina', CD: 'Democratic Republic of the Congo', CI: 'Côte d’Ivoire', CV: 'Cabo Verde',
  CZ: 'Czechia', GM: 'Gambia', HT: 'Haiti', IE: 'Ireland', KR: 'South Korea', MK: 'North Macedonia',
  TT: 'Trinidad and Tobago', US: 'United States', XK: 'Kosovo',
});

const COUNTRY_CODE_TO_HUNGARIAN_LABEL = Object.freeze({
  HU: 'Magyar', RS: 'Szerb', RO: 'Román', HR: 'Horvát', SK: 'Szlovák', SI: 'Szlovén', UA: 'Ukrán', AT: 'Osztrák',
  DE: 'Német', BA: 'Bosnyák-hercegovinai', ME: 'Montenegrói', MK: 'Észak-macedón', AL: 'Albán', XK: 'Koszovói',
  CZ: 'Cseh', PL: 'Lengyel', NL: 'Holland', FR: 'Francia', ES: 'Spanyol', IT: 'Olasz', PT: 'Portugál', BR: 'Brazil',
  AR: 'Argentin', GH: 'Ghánai', NG: 'Nigériai', SN: 'Szenegáli', GE: 'Grúz', DZ: 'Algériai', AM: 'Örmény',
  AU: 'Ausztrál', BE: 'Belga', BG: 'Bolgár', CF: 'Közép-afrikai', CA: 'Kanadai', CI: 'Elefántcsontparti',
  CM: 'Kameruni', CV: 'Zöld-foki', CR: 'Costa Rica-i', CY: 'Ciprusi', DK: 'Dán', FI: 'Finn', GM: 'Gambiai',
  GR: 'Görög', GN: 'Guineai', HT: 'Haiti', IR: 'Iráni', IE: 'Ír', IL: 'Izraeli', JP: 'Japán', LV: 'Lett',
  LT: 'Litván', MD: 'Moldovai', MX: 'Mexikói', ML: 'Mali', NO: 'Norvég', PY: 'Paraguayi', ZA: 'Dél-afrikai',
  RU: 'Orosz', CH: 'Svájci', SR: 'Suriname-i', SE: 'Svéd', TG: 'Togói', TT: 'Trinidad és Tobagó-i',
  TN: 'Tunéziai', US: 'Amerikai', VE: 'Venezuelai', KR: 'Dél-koreai', CD: 'Kongói DK',
});

const aliasToCountryCode = new Map();
const publicAliases = {};

const foldNationality = value => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’‘`´']/g, '')
  .toLocaleLowerCase('en-US')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const addAliases = (countryCode, aliases) => {
  for (const alias of aliases) {
    const literal = String(alias ?? '').trim();
    const folded = foldNationality(literal);
    if (!folded) continue;
    aliasToCountryCode.set(folded, countryCode);
    publicAliases[literal] = countryCode;
    publicAliases[folded] = countryCode;
  }
};

for (const [footballCode, countryCode] of Object.entries(FOOTBALL_CODE_TO_COUNTRY_CODE)) {
  addAliases(countryCode, [footballCode]);
}
for (const code of Object.keys(COUNTRY_CODE_TO_KEY)) addAliases(code, [code, COUNTRY_CODE_TO_KEY[code]]);
for (const [code, homeNation] of Object.entries(HOME_NATIONS)) {
  addAliases(code, [code, homeNation.key, homeNation.nationality, homeNation.label]);
}

addAliases('HU', ['Hungary', 'Hungarian', 'Magyar', 'Magyarország']);
addAliases('HT', ['Haiti', 'Haitian', 'Haiti-i']);
addAliases('IE', ['Ireland', 'Republic of Ireland', 'Irish', 'Ír', 'Írország']);
addAliases('GB-ENG', ['England', 'English', 'Anglia', 'Angol']);
addAliases('GB-SCT', ['Scotland', 'Scottish', 'Skócia', 'Skót']);
addAliases('GB-WLS', ['Wales', 'Welsh', 'Walesi']);
addAliases('GB-NIR', ['Northern Ireland', 'Northern Irish', 'Észak-Írország', 'Északír']);
addAliases('CI', ['Côte d’Ivoire', "Cote d'Ivoire", 'Cote d Ivoire', 'Ivory Coast', 'Ivorian', 'Elefántcsontpart']);
addAliases('CD', ['DR Congo', 'DRC', 'Democratic Republic of the Congo', 'Congo DR', 'Congolese']);
addAliases('KR', ['South Korea', 'Korea Republic', 'Republic of Korea', 'South Korean']);
addAliases('KP', ['North Korea', 'Korea DPR', "Democratic People's Republic of Korea"]);
addAliases('MK', ['North Macedonia', 'Macedonia', 'Macedonian', 'Észak-Macedónia']);
addAliases('XK', ['Kosovo', 'Kosovan', 'Koszovó', 'Koszovói']);
addAliases('GM', ['Gambia', 'Gambian', 'Gambiai']);
addAliases('NG', ['Nigeria', 'Nigerian', 'Nigériai']);
addAliases('RO', ['Romania', 'Romanian', 'Románia', 'Román']);
addAliases('RS', ['Serbia', 'Serbian', 'Szerbia', 'Szerb']);
addAliases('BA', ['Bosnia and Herzegovina', 'Bosnia-Herzegovina', 'Bosnian', 'Bosznia-Hercegovina']);
addAliases('CV', ['Cape Verde', 'Cabo Verde', 'Cape Verdean', 'Zöld-foki']);
addAliases('TT', ['Trinidad and Tobago', 'Trinidad & Tobago', 'Trinidadian']);
addAliases('US', ['United States', 'United States of America', 'USA', 'American']);
addAliases('NL', ['Netherlands', 'Dutch', 'Holland', 'Hollandia']);
addAliases('CZ', ['Czech Republic', 'Czechia', 'Czech']);
addAliases('SI', ['Slovenia', 'Slovenian', 'Szlovénia', 'Szlovén']);
addAliases('SK', ['Slovakia', 'Slovak', 'Szlovákia', 'Szlovák']);
addAliases('HR', ['Croatia', 'Croatian', 'Horvátország', 'Horvát']);
addAliases('GR', ['Greece', 'Greek', 'Görögország', 'Görög']);
addAliases('DE', ['Germany', 'German', 'Németország', 'Német']);
addAliases('DK', ['Denmark', 'Danish', 'Dánia', 'Dán']);
addAliases('CH', ['Switzerland', 'Swiss', 'Svájc', 'Svájci']);
addAliases('ZA', ['South Africa', 'South African', 'Dél-Afrika', 'Dél-afrikai']);
addAliases('TG', ['Togo', 'Togolese', 'Togói']);
addAliases('BG', ['Bulgaria', 'Bulgarian', 'Bulgária', 'Bolgár']);
addAliases('SR', ['Suriname', 'Surinamese', 'Suriname-i']);
addAliases('IR', ['Iran', 'Iranian', 'Irán', 'Iráni']);

const regionNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

export const nationalityToCountryCode = Object.freeze({ ...publicAliases });

export const countryCodeToNationality = Object.freeze({
  ...Object.fromEntries(Object.keys(COUNTRY_CODE_TO_KEY).map(code => [
    code,
    COUNTRY_CODE_TO_NATIONALITY_OVERRIDES[code] ?? regionNames?.of(code) ?? code,
  ])),
  ...Object.fromEntries(Object.entries(HOME_NATIONS).map(([code, entry]) => [code, entry.nationality])),
});

export const countryCodeToFlagAsset = Object.freeze(Object.fromEntries(
  Object.entries(HOME_NATIONS).map(([code, entry]) => [code, entry.asset]),
));

export const KNOWN_COUNTRY_CODES = Object.freeze(new Set([
  ...Object.keys(COUNTRY_CODE_TO_KEY),
  ...Object.keys(HOME_NATIONS),
]));

export function normaliseCountryCode(value) {
  const raw = String(value ?? '').trim().toLocaleUpperCase('en-US').replace(/_/g, '-');
  if (!raw) return null;
  if (KNOWN_COUNTRY_CODES.has(raw)) return raw;
  if (FOOTBALL_CODE_TO_COUNTRY_CODE[raw]) return FOOTBALL_CODE_TO_COUNTRY_CODE[raw];
  return aliasToCountryCode.get(foldNationality(value)) ?? null;
}

const splitNationalityValues = value => String(value ?? '')
  .split(/\s*\/\s*|\s*;\s*|\s*,\s*/u)
  .map(part => part.trim())
  .filter(Boolean);

export function resolveNationality(value) {
  const parts = splitNationalityValues(value);
  const countryCodes = [...new Set(parts.map(normaliseCountryCode).filter(Boolean))];
  const countryCode = countryCodes[0] ?? normaliseCountryCode(value);
  return Object.freeze({
    input: String(value ?? '').trim(),
    countryCode: countryCode ?? null,
    countryCodes: Object.freeze(countryCodes),
    nationality: countryCode ? countryCodeToNationality[countryCode] ?? String(value ?? '').trim() : null,
    key: countryCode
      ? HOME_NATIONS[countryCode]?.key ?? COUNTRY_CODE_TO_KEY[countryCode] ?? foldNationality(value).replace(/\s+/g, '-')
      : '',
    known: Boolean(countryCode),
  });
}

const PLAYER_NATIONALITY_OVERRIDES = Object.freeze({
  'LENNY JOSEPH': Object.freeze({ nationality: 'Haiti', countryCode: 'HT', nationalTeam: 'Haiti' }),
  'CALLUM O DOWDA': Object.freeze({ nationality: 'Ireland', countryCode: 'IE', nationalTeam: 'Ireland' }),
});

const normalisePlayerName = value => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’‘`´']/g, ' ')
  .toLocaleUpperCase('en-US')
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export function resolvePlayerNationality(player = {}) {
  const override = PLAYER_NATIONALITY_OVERRIDES[normalisePlayerName(player.name ?? player.displayName)];
  if (override) return Object.freeze({ ...override, source: 'verified-player-override', known: true });

  const candidates = [
    ['nationalTeam', player.nationalTeam],
    ['nationalityCode', player.nationalityCode],
    ['nation', player.nation],
    ['nationality', player.nationality],
    ['country', player.country],
    ['countryCode', player.countryCode],
    ['flagCode', player.flagCode],
  ];
  for (const [source, value] of candidates) {
    const resolved = resolveNationality(value);
    if (!resolved.known) continue;
    return Object.freeze({
      nationality: resolved.nationality,
      countryCode: resolved.countryCode,
      nationalTeam: source === 'nationalTeam' ? resolved.nationality : null,
      source,
      known: true,
    });
  }
  return Object.freeze({ nationality: null, countryCode: null, nationalTeam: null, source: null, known: false });
}

export function canonicalNationalityKey(value) {
  return resolveNationality(value).key;
}

export function countryCodeToFlagEmoji(value) {
  const countryCode = normaliseCountryCode(value);
  if (!countryCode) return '🌐';
  if (HOME_NATIONS[countryCode]) return HOME_NATIONS[countryCode].flag;
  if (!/^[A-Z]{2}$/u.test(countryCode)) return '🌐';
  return String.fromCodePoint(...[...countryCode].map(letter => 127397 + letter.charCodeAt(0)));
}

export function nationalityPresentation(value) {
  const resolved = resolveNationality(value);
  if (!resolved.known) {
    const fallback = String(value ?? '').trim() || UNKNOWN_NATIONALITY;
    return Object.freeze({
      key: '', countryCode: null, nationality: null, flag: '🌐', label: fallback, asset: null, known: false,
    });
  }
  const countryCode = resolved.countryCode;
  return Object.freeze({
    key: resolved.key,
    countryCode,
    nationality: resolved.nationality,
    flag: countryCodeToFlagEmoji(countryCode),
    label: HOME_NATIONS[countryCode]?.label ?? COUNTRY_CODE_TO_HUNGARIAN_LABEL[countryCode] ?? resolved.nationality,
    asset: countryCodeToFlagAsset[countryCode] ?? null,
    known: true,
  });
}

const homeNationTerms = Object.freeze([
  ['northern ireland', 'GB-NIR'], ['northern irish', 'GB-NIR'],
  ['republic of ireland', 'IE'], ['ireland', 'IE'], ['irish', 'IE'],
  ['scotland', 'GB-SCT'], ['scottish', 'GB-SCT'],
  ['wales', 'GB-WLS'], ['welsh', 'GB-WLS'],
  ['england', 'GB-ENG'], ['english', 'GB-ENG'],
]);

const expectedHomeNationCode = player => {
  const text = foldNationality([
    player?.nationalTeam, player?.nationality, player?.nation, player?.country,
  ].filter(Boolean).join(' '));
  return homeNationTerms.find(([term]) => text.includes(term))?.[1] ?? null;
};

export function validateNationalityAssignments(players) {
  const list = Array.isArray(players) ? players : [];
  const missingNationality = [];
  const missingCountryCode = [];
  const unknownCountryCode = [];
  const britishMisassignments = [];
  const contradictions = [];

  for (const player of list) {
    const name = player?.name ?? player?.id ?? 'Ismeretlen játékos';
    const rawNationality = player?.nationality ?? player?.nation ?? player?.country ?? null;
    const actualCode = normaliseCountryCode(player?.countryCode);
    const expected = resolvePlayerNationality(player);
    if (!rawNationality && !player?.nationalTeam) missingNationality.push(name);
    if (!player?.countryCode) missingCountryCode.push(name);
    else if (!actualCode) unknownCountryCode.push({ name, countryCode: player.countryCode });

    const homeCode = expectedHomeNationCode(player);
    if (homeCode && actualCode && homeCode !== actualCode) {
      britishMisassignments.push({ name, expected: homeCode, actual: actualCode });
    }
    if (expected.countryCode && actualCode && expected.countryCode !== actualCode) {
      contradictions.push({ name, nationality: rawNationality, expected: expected.countryCode, actual: actualCode });
    }
  }

  const invalidNames = new Set([
    ...missingNationality,
    ...missingCountryCode,
    ...unknownCountryCode.map(item => item.name),
    ...britishMisassignments.map(item => item.name),
    ...contradictions.map(item => item.name),
  ]);

  return Object.freeze({
    missingNationality: Object.freeze(missingNationality),
    missingCountryCode: Object.freeze(missingCountryCode),
    unknownCountryCode: Object.freeze(unknownCountryCode),
    britishMisassignments: Object.freeze(britishMisassignments),
    contradictions: Object.freeze(contradictions),
    summary: Object.freeze({
      playerCount: list.length,
      missingNationalityCount: missingNationality.length,
      missingCountryCodeCount: missingCountryCode.length,
      unknownCountryCodeCount: unknownCountryCode.length,
      britishMisassignmentCount: britishMisassignments.length,
      contradictionCount: contradictions.length,
      validCount: list.length - invalidNames.size,
    }),
  });
}

export { UNKNOWN_NATIONALITY };
