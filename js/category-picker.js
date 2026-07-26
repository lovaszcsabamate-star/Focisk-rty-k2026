/**
 * Egyérintéses, csempés kategóriaválasztó.
 *
 * Egyetlen koppintás kijelöli és azonnal rögzíti a kategóriát. Nincs külön
 * megerősítő gomb, ezért mobilon és asztali gépen is gyorsabb a továbblépés.
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

const CATEGORY_TRANSITION_CHECK_MS = 140;

const directCategoryButtons = picker => [...(picker?.children ?? [])]
  .filter(node => node.matches?.('button[data-attribute]'));

const categoryLabel = button => button?.querySelector('.attr-btn__label')?.textContent?.trim()
  || button?.getAttribute('aria-label')?.split('.')[0]?.trim()
  || 'Kategória';

function leaveCategorySelection(ui) {
  ui?.dom?.pub?.classList.remove('is-category-selection');
}

function makeCategoryTile(source, index) {
  const tile = source.cloneNode(true);
  const key = source.dataset.attribute;
  tile.type = 'button';
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
  picker.dataset.categoryPickerController = 'category-picker';

  const grid = el('div', 'category-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Választható összehasonlítási kategóriák');

  const status = el(
    'span',
    'category-picker__status',
    'Koppints egy kategóriára – azonnal továbblépsz a kártyaválasztáshoz.',
  );
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const actions = el('div', 'category-picker__actions category-picker__actions--single');
  actions.append(status);

  let committing = false;
  let transitionTimer = 0;
  const tiles = sourceButtons.map((button, index) => makeCategoryTile(button, index));

  const setTilesDisabled = disabled => {
    for (const tile of tiles) {
      tile.disabled = disabled;
      tile.setAttribute('aria-disabled', String(disabled));
    }
  };

  const restoreSelection = message => {
    committing = false;
    if (transitionTimer) window.clearTimeout(transitionTimer);
    transitionTimer = 0;
    for (const tile of tiles) {
      tile.disabled = false;
      tile.removeAttribute('aria-disabled');
      tile.classList.remove('is-selected');
      tile.setAttribute('aria-pressed', 'false');
    }
    status.textContent = message;
    ui.dom.pub.classList.add('is-category-selection');
  };

  const selectCategory = tile => {
    if (committing || tile.disabled) return;
    const selectedKey = tile.dataset.attribute;
    if (!selectedKey) return;

    committing = true;
    for (const item of tiles) {
      const selected = item === tile;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    }
    setTilesDisabled(true);
    tile.disabled = false;
    tile.removeAttribute('aria-disabled');
    status.textContent = `${categoryLabel(tile)} kiválasztva. Kártyák előkészítése…`;

    let accepted;
    try {
      accepted = ui.handlers.onAttribute?.(selectedKey);
    } catch (error) {
      console.error('[category-picker] A kategória nem rögzíthető:', error);
      restoreSelection('A kategóriát nem sikerült kiválasztani. Koppints egy másik csempére.');
      ui.showToast?.('A kategóriaválasztás nem sikerült.', 'error');
      return;
    }

    if (accepted === false) {
      restoreSelection('Ez a kategória most nem választható. Koppints egy másik csempére.');
      ui.showToast?.('Ez a kategória most nem használható.', 'error');
      return;
    }

    leaveCategorySelection(ui);

    /* A körvezérlő normál esetben azonnal eltávolítja a választót. Ha egy
       váratlan állapot miatt ez nem történik meg, a felület ne maradjon lezárva. */
    transitionTimer = window.setTimeout(() => {
      if (!picker.isConnected || !picker.contains(grid)) return;
      restoreSelection('A játéktér még nem áll készen. Koppints újra egy kategóriára.');
    }, CATEGORY_TRANSITION_CHECK_MS);
  };

  for (const tile of tiles) {
    tile.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      selectCategory(tile);
    });
    grid.appendChild(tile);
  }

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
