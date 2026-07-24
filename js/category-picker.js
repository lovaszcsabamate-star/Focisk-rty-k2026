/**
 * Kétlépcsős, csempés kategóriaválasztó.
 *
 * A mobilos kategóriagombokat a meglévő UI-réteg létrehozza, ez a modul pedig
 * eseménykezelők nélküli csempékké alakítja őket. Így az első koppintás csak
 * kijelöl, a külön Tovább gomb rögzíti a választást, tehát téves koppintás után
 * a játékos könnyen válthat másik kategóriára.
 */

import { UI, el } from './ui.js';

const categoryPickerPrevious = Object.freeze({
  resetTable: UI.prototype.resetTable,
  showAttributePicker: UI.prototype.showAttributePicker,
  hideAttributePicker: UI.prototype.hideAttributePicker,
  renderHands: UI.prototype.renderHands,
  showDuel: UI.prototype.showDuel,
  showVerdict: UI.prototype.showVerdict,
});

const directCategoryButtons = picker => [...(picker?.children ?? [])]
  .filter(node => node.matches?.('.attr-btn--mobile[data-attribute]'));

const categoryLabel = button => button?.querySelector('.attr-btn__label')?.textContent?.trim()
  || button?.getAttribute('aria-label')?.split('.')[0]?.trim()
  || 'Kategória';

function leaveCategorySelection(ui) {
  ui?.dom?.pub?.classList.remove('is-category-selection');
}

function makeCategoryTile(source, index) {
  const tile = source.cloneNode(true);
  const key = source.dataset.attribute;
  tile.classList.add('category-tile');
  tile.classList.remove('is-selected');
  tile.disabled = false;
  tile.dataset.attribute = key;
  tile.dataset.key = key;
  tile.setAttribute('aria-pressed', 'false');

  const direction = tile.querySelector('.attr-btn__direction') ?? tile.querySelector('small');
  if (direction) {
    direction.classList.add('attr-btn__direction');
    direction.id = `category-direction-${key || index}`;
    tile.setAttribute('aria-describedby', direction.id);
  }

  if (!tile.querySelector('.category-tile__check')) {
    const check = el('span', 'category-tile__check', '✓');
    check.setAttribute('aria-hidden', 'true');
    tile.appendChild(check);
  }

  return tile;
}

function installCategorySelection(ui, picker, sourceButtons) {
  const grid = el('div', 'category-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Választható összehasonlítási kategóriák');

  const status = el('span', 'category-picker__status', 'Válassz egy kategóriát a folytatáshoz.');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const next = el('button', 'category-picker__next', 'Tovább a kártyákhoz');
  next.type = 'button';
  next.disabled = true;
  next.setAttribute('aria-disabled', 'true');

  const actions = el('div', 'category-picker__actions');
  actions.append(status, next);

  let selectedKey = null;
  let selectedTile = null;
  let committing = false;

  const tiles = sourceButtons.map((button, index) => makeCategoryTile(button, index));

  const selectTile = tile => {
    if (committing || tile.disabled) return;
    selectedKey = tile.dataset.attribute;
    selectedTile = tile;

    for (const item of tiles) {
      const selected = item === tile;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    }

    status.textContent = `${categoryLabel(tile)} kijelölve. Még válthatsz, vagy lépj tovább.`;
    next.disabled = false;
    next.setAttribute('aria-disabled', 'false');
  };

  for (const tile of tiles) {
    tile.addEventListener('click', () => selectTile(tile));
    grid.appendChild(tile);
  }

  next.addEventListener('click', () => {
    if (committing || !selectedKey || !selectedTile) return;
    committing = true;

    for (const tile of tiles) tile.disabled = true;
    selectedTile.classList.add('is-selected');
    selectedTile.setAttribute('aria-pressed', 'true');
    next.disabled = true;
    next.setAttribute('aria-disabled', 'true');
    status.textContent = `${categoryLabel(selectedTile)} rögzítve. A kártyaválasztás következik.`;
    leaveCategorySelection(ui);

    ui.handlers.onAttribute?.(selectedKey);
  });

  picker.replaceChildren(grid, actions);
  ui.dom.pub.classList.add('is-category-selection');
}

UI.prototype.showAttributePicker = function showTiledAttributePicker(game) {
  const output = categoryPickerPrevious.showAttributePicker.call(this, game);
  const picker = this.dom?.picker;
  const buttons = directCategoryButtons(picker);

  if (buttons.length) installCategorySelection(this, picker, buttons);
  else this.dom?.pub?.classList.add('is-category-selection');

  return output;
};

if (typeof categoryPickerPrevious.hideAttributePicker === 'function') {
  UI.prototype.hideAttributePicker = function hideTiledAttributePicker(...args) {
    leaveCategorySelection(this);
    return categoryPickerPrevious.hideAttributePicker.apply(this, args);
  };
}

UI.prototype.resetTable = function resetTiledCategoryPicker(...args) {
  leaveCategorySelection(this);
  return categoryPickerPrevious.resetTable.apply(this, args);
};

UI.prototype.renderHands = function renderHandsAfterCategory(...args) {
  leaveCategorySelection(this);
  return categoryPickerPrevious.renderHands.apply(this, args);
};

UI.prototype.showDuel = function showDuelAfterCategory(...args) {
  leaveCategorySelection(this);
  return categoryPickerPrevious.showDuel.apply(this, args);
};

UI.prototype.showVerdict = function showVerdictAfterCategory(...args) {
  leaveCategorySelection(this);
  return categoryPickerPrevious.showVerdict.apply(this, args);
};
