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

const CATEGORY_COMMIT_RETRY_MS = 80;
const CATEGORY_COMMIT_MAX_ATTEMPTS = 8;

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
  let commitTimer = 0;

  const tiles = sourceButtons.map((button, index) => makeCategoryTile(button, index));

  const setTilesDisabled = disabled => {
    for (const tile of tiles) tile.disabled = disabled;
  };

  const restoreSelection = message => {
    committing = false;
    if (commitTimer) window.clearTimeout(commitTimer);
    commitTimer = 0;
    setTilesDisabled(false);
    next.disabled = false;
    next.textContent = 'Tovább a kártyákhoz';
    next.setAttribute('aria-disabled', 'false');
    status.textContent = message;
    ui.dom.pub.classList.add('is-category-selection');
  };

  const commitSelection = (attempt = 1) => {
    if (!committing || !selectedKey || !selectedTile || !picker.isConnected) return;

    let accepted = false;
    try {
      accepted = ui.handlers.onAttribute?.(selectedKey) !== false;
    } catch (error) {
      console.error('[category-picker] A kategória nem rögzíthető:', error);
      restoreSelection('A kategóriát nem sikerült rögzíteni. Próbáld újra.');
      return;
    }

    if (accepted) {
      status.textContent = `${categoryLabel(selectedTile)} rögzítve. A kártyaválasztás következik.`;
      leaveCategorySelection(ui);
      return;
    }

    if (attempt < CATEGORY_COMMIT_MAX_ATTEMPTS) {
      status.textContent = 'A játéktér előkészítése folyamatban…';
      commitTimer = window.setTimeout(() => commitSelection(attempt + 1), CATEGORY_COMMIT_RETRY_MS);
      return;
    }

    restoreSelection('A játéktér még nem áll készen. Koppints újra a Tovább gombra.');
  };

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

  next.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (committing || !selectedKey || !selectedTile) return;
    committing = true;

    setTilesDisabled(true);
    selectedTile.classList.add('is-selected');
    selectedTile.setAttribute('aria-pressed', 'true');
    next.disabled = true;
    next.textContent = 'Továbblépés…';
    next.setAttribute('aria-disabled', 'true');
    status.textContent = `${categoryLabel(selectedTile)} rögzítése…`;

    commitSelection();
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
