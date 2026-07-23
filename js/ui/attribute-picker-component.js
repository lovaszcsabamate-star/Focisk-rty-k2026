/** Kategóriaválasztó komponens a közös, hitelesen játszható attribútumokhoz. */

import { ATTRIBUTES } from '../data/players.js';
import { el } from './dom-primitives.js';

export function renderAttributePickerComponent(container, game, onAttribute) {
  const available = new Set(game.availableAttributeKeys());
  const playableAttributes = ATTRIBUTES.filter(attribute => available.has(attribute.key));

  container.replaceChildren(...playableAttributes.map(attribute => {
    const button = el('button', 'attr-btn');
    button.appendChild(document.createTextNode(`${attribute.icon} ${attribute.label}`));
    button.appendChild(el('small', null, attribute.hint));
    button.addEventListener('click', () => onAttribute(attribute.key));
    return button;
  }));

  if (!playableAttributes.length) {
    container.appendChild(el(
      'div',
      'picker-hint',
      'Ehhez a leosztáshoz nincs közös, hiteles összehasonlítási adat.',
    ));
  }

  return playableAttributes.map(attribute => attribute.key);
}
