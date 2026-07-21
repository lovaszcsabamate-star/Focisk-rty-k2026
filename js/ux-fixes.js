import { UI } from './ui.js';
import { ATTRIBUTE_BY_KEY, calculateAge } from './data/players.js';

const uxFallbackBirthAttribute = ATTRIBUTE_BY_KEY.birthDate;
if (uxFallbackBirthAttribute) {
  uxFallbackBirthAttribute.format = (_value, card) => {
    const storedAge = card?.stats?.age;
    const age = typeof storedAge === 'number' && Number.isFinite(storedAge)
      ? storedAge
      : calculateAge(card?.birthDate);
    return typeof age === 'number' && Number.isFinite(age)
      ? `${Math.round(age)} év`
      : 'Nincs adat';
  };
}

/*
 * The database stores nationalities as three-letter football/country codes.
 * Cards show the corresponding flags instead of exposing those codes to players.
 * A few source-specific aliases (for example NGR) are kept for backwards compatibility.
 */
const uxNationAlpha2 = Object.freeze({
  ALB: 'AL', ALG: 'DZ', AND: 'AD', ANG: 'AO', ARG: 'AR', ARM: 'AM', AUS: 'AU', AUT: 'AT', AZE: 'AZ',
  BEL: 'BE', BEN: 'BJ', BFA: 'BF', BGR: 'BG', BIH: 'BA', BLR: 'BY', BOL: 'BO', BRA: 'BR',
  CAN: 'CA', CHI: 'CL', CHL: 'CL', CIV: 'CI', CMR: 'CM', COD: 'CD', COL: 'CO', CPV: 'CV', CRC: 'CR',
  CRO: 'HR', CYP: 'CY', CZE: 'CZ', DEN: 'DK', DEU: 'DE', DNK: 'DK', ECU: 'EC', EGY: 'EG', ENG: 'GB',
  ESP: 'ES', EST: 'EE', FIN: 'FI', FRA: 'FR', GAB: 'GA', GEO: 'GE', GER: 'DE', GHA: 'GH', GIN: 'GN',
  GNB: 'GW', GRC: 'GR', GRE: 'GR', GUI: 'GN', HND: 'HN', HRV: 'HR', HUN: 'HU', IRL: 'IE', ISL: 'IS',
  ISR: 'IL', ITA: 'IT', JAM: 'JM', JPN: 'JP', KAZ: 'KZ', KEN: 'KE', KOR: 'KR', KOS: 'XK', KVX: 'XK',
  LBN: 'LB', LIE: 'LI', LTU: 'LT', LUX: 'LU', LVA: 'LV', MAR: 'MA', MDA: 'MD', MEX: 'MX', MKD: 'MK',
  MLI: 'ML', MLT: 'MT', MNE: 'ME', MOZ: 'MZ', NED: 'NL', NGA: 'NG', NGR: 'NG', NIR: 'GB', NOR: 'NO',
  NZL: 'NZ', PAN: 'PA', PAR: 'PY', PER: 'PE', POL: 'PL', POR: 'PT', PRK: 'KP', ROU: 'RO', RSA: 'ZA',
  RUS: 'RU', SCO: 'GB', SEN: 'SN', SRB: 'RS', SUI: 'CH', SVK: 'SK', SLO: 'SI', SVN: 'SI', SWE: 'SE',
  TGO: 'TG', TRI: 'TT', TTO: 'TT', TUN: 'TN', TUR: 'TR', UAE: 'AE', UGA: 'UG', UKR: 'UA', URU: 'UY',
  USA: 'US', UZB: 'UZ', VEN: 'VE', WAL: 'GB', XKS: 'XK', XKX: 'XK', ZAF: 'ZA', ZAM: 'ZM', ZIM: 'ZW',
});

const uxFlagEmoji = alpha2 => {
  if (!/^[A-Z]{2}$/.test(alpha2 ?? '')) return null;
  return String.fromCodePoint(...[...alpha2].map(letter => 127397 + letter.charCodeAt(0)));
};

const uxNationFlags = nation => String(nation ?? '')
  .split(/\s*\/\s*|\s*,\s*|\s*;\s*/)
  .map(code => code.trim().toUpperCase())
  .filter(Boolean)
  .map(code => uxFlagEmoji(uxNationAlpha2[code] ?? (/^[A-Z]{2}$/.test(code) ? code : null)) ?? '🌐');

const uxOriginalRenderCard = UI.prototype.renderCard;
UI.prototype.renderCard = function renderCardWithNationalityFlags(card, opts = {}) {
  const node = uxOriginalRenderCard.call(this, card, opts);
  if (!card || opts.faceDown || !card.nation) return node;

  const clubLine = node.querySelector('.card__club');
  if (!clubLine) return node;

  const flags = uxNationFlags(card.nation);
  clubLine.replaceChildren();
  if (card.club) clubLine.appendChild(document.createTextNode(card.club));
  if (card.club && flags.length) clubLine.appendChild(document.createTextNode(' · '));

  if (flags.length) {
    const flagGroup = document.createElement('span');
    flagGroup.className = 'card__nation-flags';
    flagGroup.textContent = flags.join(' ');
    flagGroup.title = `Nemzetiség: ${card.nation}`;
    flagGroup.setAttribute('role', 'img');
    flagGroup.setAttribute('aria-label', `Nemzetiség: ${card.nation}`);
    clubLine.appendChild(flagGroup);
  }

  return node;
};

const uxFlagStyle = document.createElement('style');
uxFlagStyle.textContent = `
  .card__nation-flags {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    font-size: 12px;
    line-height: 1;
    letter-spacing: 0;
    vertical-align: -1px;
    filter: drop-shadow(0 1px 0 rgba(0, 0, 0, .18));
  }
  .card--large .card__nation-flags { font-size: 15px; gap: 2px; }
`;
document.head.appendChild(uxFlagStyle);

const uxOriginalRenderInspector = UI.prototype._renderInspector;
UI.prototype._renderInspector = function renderInspectorWithoutMissingDetails() {
  uxOriginalRenderInspector.call(this);
  const details = document.querySelector('#inspector .inspector__details');
  if (!details) return;
  details.querySelectorAll('span').forEach(row => {
    if (row.textContent.includes('Nincs adat')) row.remove();
  });
  if (!details.children.length) details.remove();
};
