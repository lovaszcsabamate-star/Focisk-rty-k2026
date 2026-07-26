/** A mérkőzés közbeni rövid párbajtörténet megjelenítési rétege. */

import { UI, el } from './ui.js';

const matchExperiencePrevious = Object.freeze({
  resetTable: UI.prototype.resetTable,
});

function ensureRecentDuels(ui) {
  let panel = ui.dom?.recentDuels ?? document.querySelector('#recent-duels');
  if (!panel) {
    panel = el('section', 'recent-duels');
    panel.id = 'recent-duels';
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'recent-duels-title');
    panel.append(
      el('h2', 'recent-duels__title', 'Legutóbbi párbajok'),
      el('ol', 'recent-duels__list'),
    );
    const felt = ui.dom?.picker?.parentElement ?? document.querySelector('#felt');
    if (felt && ui.dom?.picker) felt.insertBefore(panel, ui.dom.picker);
    else felt?.appendChild(panel);
  }
  ui.dom.recentDuels = panel;
  return panel;
}

UI.prototype.renderRecentDuels = function renderRecentDuels(rows = []) {
  const panel = ensureRecentDuels(this);
  const list = panel.querySelector('.recent-duels__list');
  const recent = Array.isArray(rows) ? rows.slice(-3) : [];
  list.replaceChildren(...recent.map(row => {
    const item = el('li', `recent-duels__item recent-duels__item--${String(row.winner ?? 'tie')}`);
    const values = row.values ? ` · ${row.values}` : '';
    item.append(
      el('span', 'recent-duels__round', `${row.round}. kör`),
      el('span', 'recent-duels__category', row.categoryLabel),
      el('span', 'recent-duels__result', `${values} · ${row.result}`),
    );
    return item;
  }));
  panel.hidden = recent.length === 0;
  panel.setAttribute('aria-live', recent.length ? 'polite' : 'off');
  return recent;
};

UI.prototype.resetTable = function resetTableWithRecentDuels(...args) {
  const output = matchExperiencePrevious.resetTable.apply(this, args);
  this.renderRecentDuels([]);
  return output;
};
