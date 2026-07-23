/** Újrafelhasználható kártyakomponens a kéz-, párbaj- és részletes nézethez. */

import {
  ATTRIBUTE_BY_KEY,
  CARD_ATTRIBUTE_KEYS,
  formatAttribute,
  hasAttributeData,
} from '../data/players.js';
import { ART, el, initials, tryArt } from './dom-primitives.js';

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
  tryArt(portrait, [...ART.portrait(card.id), ...(card.meta?.imageUrl ? [card.meta.imageUrl] : [])]);
  if (card.position) portrait.appendChild(el('span', 'card__position', card.position));
  node.appendChild(portrait);
  node.appendChild(el('div', 'card__name', card.name));
  node.appendChild(el('div', 'card__club', [card.club, card.nation].filter(Boolean).join(' · ')));

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
