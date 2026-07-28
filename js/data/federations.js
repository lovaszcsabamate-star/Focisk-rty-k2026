/** Központi, UI- és adatbázisfüggetlen labdarúgó-föderációs törzsadat. */

export const FEDERATION_TEAM_MINIMUM = 11;

export const FEDERATION_DEFINITIONS = Object.freeze({
  UEFA: Object.freeze({
    code: 'UEFA',
    name: 'Europe',
    label: 'Európa',
    shortLabel: 'Európa',
    asset: 'assets/federations/federation-europe.svg',
    colors: Object.freeze({ primary: '#123b72', secondary: '#d5af44', accent: '#f7f2df' }),
  }),
  CAF: Object.freeze({
    code: 'CAF',
    name: 'Africa',
    label: 'Afrika',
    shortLabel: 'Afrika',
    asset: 'assets/federations/federation-africa.svg',
    colors: Object.freeze({ primary: '#15583a', secondary: '#d6ad42', accent: '#111713' }),
  }),
  CONMEBOL: Object.freeze({
    code: 'CONMEBOL',
    name: 'South America',
    label: 'Dél-Amerika',
    shortLabel: 'Dél-Amerika',
    asset: 'assets/federations/federation-south-america.svg',
    colors: Object.freeze({ primary: '#155b48', secondary: '#75c7e8', accent: '#f5fbfc' }),
  }),
  CONCACAF: Object.freeze({
    code: 'CONCACAF',
    name: 'CONCACAF',
    label: 'CONCACAF',
    shortLabel: 'CONCACAF',
    asset: 'assets/federations/federation-concacaf.svg',
    colors: Object.freeze({ primary: '#103b63', secondary: '#2cb8b5', accent: '#f4fbfb' }),
  }),
  AFC: Object.freeze({
    code: 'AFC',
    name: 'Asia',
    label: 'Ázsia',
    shortLabel: 'Ázsia',
    asset: 'assets/federations/federation-asia.svg',
    colors: Object.freeze({ primary: '#7b2634', secondary: '#d4aa45', accent: '#fff7e8' }),
  }),
  OFC: Object.freeze({
    code: 'OFC',
    name: 'Oceania',
    label: 'Óceánia',
    shortLabel: 'Óceánia',
    asset: 'assets/federations/federation-oceania.svg',
    colors: Object.freeze({ primary: '#115d7a', secondary: '#37b7b2', accent: '#f2fcff' }),
  }),
});

export const KNOWN_FEDERATION_CODES = Object.freeze(new Set(Object.keys(FEDERATION_DEFINITIONS)));

/**
 * A besorolás a labdarúgó-konföderációs tagságot követi, nem pusztán a földrajzot.
 * Ezért például Izrael és Kazahsztán UEFA, Ausztrália AFC, Suriname CONCACAF.
 */
export const COUNTRY_CODE_TO_FEDERATION_CODE = Object.freeze({
  AD: 'UEFA', AE: 'AFC', AL: 'UEFA', AM: 'UEFA', AO: 'CAF', AR: 'CONMEBOL', AT: 'UEFA', AU: 'AFC', AZ: 'UEFA',
  BA: 'UEFA', BE: 'UEFA', BF: 'CAF', BG: 'UEFA', BJ: 'CAF', BO: 'CONMEBOL', BR: 'CONMEBOL', BY: 'UEFA',
  CA: 'CONCACAF', CD: 'CAF', CF: 'CAF', CH: 'UEFA', CI: 'CAF', CL: 'CONMEBOL', CM: 'CAF', CO: 'CONMEBOL',
  CR: 'CONCACAF', CV: 'CAF', CY: 'UEFA', CZ: 'UEFA', DE: 'UEFA', DK: 'UEFA', DZ: 'CAF',
  EC: 'CONMEBOL', EE: 'UEFA', EG: 'CAF', ES: 'UEFA', FI: 'UEFA', FR: 'UEFA',
  GA: 'CAF', GE: 'UEFA', GH: 'CAF', GM: 'CAF', GN: 'CAF', GR: 'UEFA', GW: 'CAF',
  HN: 'CONCACAF', HR: 'UEFA', HT: 'CONCACAF', HU: 'UEFA',
  IE: 'UEFA', IL: 'UEFA', IR: 'AFC', IS: 'UEFA', IT: 'UEFA',
  JM: 'CONCACAF', JP: 'AFC', KE: 'CAF', KG: 'AFC', KP: 'AFC', KR: 'AFC', KZ: 'UEFA',
  LB: 'AFC', LI: 'UEFA', LT: 'UEFA', LU: 'UEFA', LV: 'UEFA',
  MA: 'CAF', MD: 'UEFA', ME: 'UEFA', MK: 'UEFA', ML: 'CAF', MT: 'UEFA', MX: 'CONCACAF', MZ: 'CAF',
  NG: 'CAF', NL: 'UEFA', NO: 'UEFA', NZ: 'OFC',
  PA: 'CONCACAF', PE: 'CONMEBOL', PL: 'UEFA', PT: 'UEFA', PY: 'CONMEBOL',
  RO: 'UEFA', RS: 'UEFA', RU: 'UEFA',
  SE: 'UEFA', SI: 'UEFA', SK: 'UEFA', SN: 'CAF', SR: 'CONCACAF',
  TG: 'CAF', TN: 'CAF', TR: 'UEFA', TT: 'CONCACAF',
  UA: 'UEFA', UG: 'CAF', US: 'CONCACAF', UY: 'CONMEBOL', UZ: 'AFC',
  VE: 'CONMEBOL', XK: 'UEFA', ZA: 'CAF', ZM: 'CAF', ZW: 'CAF',
  'GB-ENG': 'UEFA', 'GB-SCT': 'UEFA', 'GB-WLS': 'UEFA', 'GB-NIR': 'UEFA',
});

export function normaliseFederationCode(value) {
  const code = String(value ?? '').trim().toLocaleUpperCase('en-US');
  return KNOWN_FEDERATION_CODES.has(code) ? code : null;
}

export function resolveFederationByCountryCode(value) {
  const countryCode = String(value ?? '').trim().toLocaleUpperCase('en-US').replace(/_/g, '-');
  const federationCode = COUNTRY_CODE_TO_FEDERATION_CODE[countryCode] ?? null;
  const definition = federationCode ? FEDERATION_DEFINITIONS[federationCode] : null;
  return Object.freeze({
    countryCode: countryCode || null,
    federation: definition?.name ?? null,
    federationLabel: definition?.label ?? null,
    federationCode,
    known: Boolean(definition),
  });
}

export function federationPresentation(value) {
  const federationCode = normaliseFederationCode(value);
  const definition = federationCode ? FEDERATION_DEFINITIONS[federationCode] : null;
  if (!definition) {
    return Object.freeze({
      code: null,
      name: null,
      label: 'Ismeretlen régió',
      shortLabel: 'Régió',
      asset: null,
      colors: Object.freeze({ primary: '#4a4a4a', secondary: '#d8d8d8', accent: '#ffffff' }),
      known: false,
    });
  }
  return Object.freeze({ ...definition, known: true });
}
