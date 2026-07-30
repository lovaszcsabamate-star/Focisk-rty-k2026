/** Újrafelhasználható kártyakomponens a kéz-, párbaj- és részletes nézethez. */

import {
  ATTRIBUTE_BY_KEY,
  CARD_ATTRIBUTE_KEYS,
  formatAttribute,
  hasAttributeData,
} from '../data/players.js';
import { ART, el, initials, tryArt } from './dom-primitives.js';
import { createPlayerFlagElement } from './flag-component.js';

export function getCardRows(card, activeAttributeKey) {
  const rows = CARD_ATTRIBUTE_KEYS
    .map(key => ATTRIBUTE_BY_KEY[key])
    .filter(attribute => attribute && hasAttributeData(card, attribute.key));

  if (!activeAttributeKey) return rows;
  const active = ATTRIBUTE_BY_KEY[activeAttributeKey];
  if (!active || !hasAttributeData(card, activeAttributeKey)) return rows;
  const existingIndex = rows.findIndex(attribute => attribute.key === active.cardStatKey);
  if (existingIndex >= 0) {
    rows[existingIndex] = active;
    return rows;
  }
  return [active, ...rows];
}

function createCardClubLogo(card) {
  const logo = el('span', 'card__club-logo');
  logo.setAttribute('aria-hidden', 'true');
  logo.style.display = 'inline-block';
  logo.style.width = '20px';
  logo.style.height = '20px';
  logo.style.flex = '0 0 20px';
  logo.style.borderRadius = '50%';
  logo.style.backgroundPosition = 'center';
  logo.style.backgroundRepeat = 'no-repeat';
  logo.style.backgroundSize = 'contain';
  logo.style.verticalAlign = 'middle';
  const clubId = card?.clubId ?? card?.meta?.clubId ?? null;
  tryArt(logo, [
    ...ART.clubLogo({ clubId }),
    ART.placeholder('club'),
  ]);
  return logo;
}

function createCardIdentityLine(card) {
  const line = el('div', 'card__club');
  line.style.display = 'flex';
  line.style.alignItems = 'center';
  line.style.gap = '6px';
  line.appendChild(createCardClubLogo(card));
  const copy = el('span', 'card__club-copy');
  if (card.club) copy.appendChild(document.createTextNode(card.club));
  const flag = createPlayerFlagElement(document, card, { compact: true });
  if (card.club) copy.appendChild(document.createTextNode(' · '));
  copy.appendChild(flag);
  line.appendChild(copy);
  return line;
}

export function createCardComponent(card, opts = {}) {
  if (opts.faceDown) {
    const back = el('div', 'card card--back');
    tryArt(back, ART.cardBack());
    return back;
  }

  const node = el('article', 'card');
  node.dataset.cardId = card.id;
  const portrait = el('div', 'card__portrait');
  portrait.dataset.initials = initials(card.name);
  tryArt(portrait, ART.playerPortrait(card));
  if (card.position) portrait.appendChild(el('span', 'card__position', card.position));
  node.appendChild(portrait);
  node.appendChild(el('div', 'card__name', card.name));
  node.appendChild(createCardIdentityLine(card));

  const stats = el('div', 'card__stats');
  for (const attribute of getCardRows(card, opts.activeAttribute)) {
    const active = attribute.key === opts.activeAttribute;
    const row = el('div', `stat${active ? ' active' : ''}`);
    row.appendChild(el('span', 'stat__label', `${attribute.icon} ${attribute.cardLabel ?? attribute.shortLabel ?? attribute.label}`));
    row.appendChild(el('span', 'stat__value', formatAttribute(card, attribute.key)));
    stats.appendChild(row);
  }
  if (stats.childElementCount) node.appendChild(stats);

  if (opts.onClick) {
    node.classList.add('selectable');
    node.addEventListener('click', () => opts.onClick(card));
  }
  if (opts.dimmed) node.classList.add('card--dim');
  if (opts.unavailable) {
    node.classList.add('card--unavailable');
    node.title = 'Ez a kártya nem használható a kiválasztott kategóriában.';
  }
  if (opts.large) node.classList.add('card--large');
  return node;
}
