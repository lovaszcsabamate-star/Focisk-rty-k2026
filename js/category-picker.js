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

const traceCategoryPicker = (...parts) => {
  const target = globalThis.__runtimeSmoke?.consoleErrors;
  if (Array.isArray(target)) target.push(`[category-trace] ${parts.map(value => String(value)).join(' | ')}`);
};

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

function installCategorySelection(ui, picker, sourceButtons, game) {
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

  const updateDiagnostics = result => {
    const available = game?.availableAttributeKeys?.() ?? [];
    next.dataset.gamePhase = String(game?.phase ?? 'missing');
    next.dataset.gameChooser = String(game?.chooser ?? 'missing');
    next.dataset.selectedKey = String(selectedKey ?? 'missing');
    next.dataset.keyAvailable = String(Array.isArray(available) && available.includes(selectedKey));
    next.dataset.handlerType = typeof ui.handlers?.onAttribute;
    next.dataset.handlerResult = String(result);
  };

  const restoreSelection = message => {
    traceCategoryPicker('restore', message);
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

  const invokeSelection = () => {
    traceCategoryPicker('invoke-before', selectedKey, game?.phase, game?.chooser, picker.isConnected);
    try {
      const result = ui.handlers.onAttribute?.(selectedKey);
      updateDiagnostics(result);
      traceCategoryPicker('invoke-after', selectedKey, result, game?.phase, game?.chooser, picker.isConnected);
      return result !== false;
    } catch (error) {
      updateDiagnostics(`error:${error?.name ?? 'Error'}`);
      traceCategoryPicker('invoke-error', error?.name, error?.message);
      console.error('[category-picker] A kategória nem rögzíthető:', error);
      return null;
    }
  };

  const retrySelection = (attempt = 2) => {
    traceCategoryPicker('retry', attempt, committing, selectedKey, picker.isConnected);
    if (!committing || !selectedKey || !selectedTile || !picker.isConnected) return;
    const accepted = invokeSelection();

    if (accepted === true) {
      leaveCategorySelection(ui);
      return;
    }
    if (accepted === null) {
      restoreSelection('A kategóriát nem sikerült rögzíteni. Próbáld újra.');
      return;
    }
    if (attempt >= CATEGORY_COMMIT_MAX_ATTEMPTS) {
      restoreSelection('A játéktér még nem áll készen. Koppints újra a Tovább gombra.');
      return;
    }

    commitTimer = window.setTimeout(() => retrySelection(attempt + 1), CATEGORY_COMMIT_RETRY_MS);
  };

  const selectTile = tile => {
    traceCategoryPicker('tile-click', tile?.dataset?.attribute, committing, tile?.disabled);
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
    traceCategoryPicker('next-click', committing, selectedKey, selectedTile?.isConnected, next.disabled);
    event.preventDefault();
    event.stopPropagation();
    if (committing || !selectedKey || !selectedTile) return;
    committing = true;

    const accepted = invokeSelection();
    traceCategoryPicker('next-result', accepted, picker.isConnected);
    if (accepted === true) {
      leaveCategorySelection(ui);
      return;
    }
    if (accepted === null) {
      restoreSelection('A kategóriát nem sikerült rögzíteni. Próbáld újra.');
      return;
    }

    setTilesDisabled(true);
    selectedTile.classList.add('is-selected');
    selectedTile.setAttribute('aria-pressed', 'true');
    next.disabled = true;
    next.textContent = 'Továbblépés…';
    next.setAttribute('aria-disabled', 'true');
    status.textContent = 'A játéktér előkészítése folyamatban…';
    commitTimer = window.setTimeout(() => retrySelection(2), CATEGORY_COMMIT_RETRY_MS);
  });

  picker.replaceChildren(grid, actions);
  ui.dom.pub.classList.add('is-category-selection');
}

UI.prototype.showAttributePicker = function showTiledAttributePicker(game) {
  const output = categoryPickerPrevious.showAttributePicker.call(this, game);
  const picker = this.dom?.picker;
  const buttons = directCategoryButtons(picker);

  if (buttons.length) installCategorySelection(this, picker, buttons, game);
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
