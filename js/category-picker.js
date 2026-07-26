/**
 * Kétlépcsős, csempés kategóriaválasztó.
 *
 * Az első koppintás csak kijelöli a kategóriát, a külön Tovább gomb pedig
 * rögzíti a választást. A kategória interakcióit kizárólag ez a modul kezeli.
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
const CATEGORY_GROUP_ORDER = Object.freeze([
  'Alapadatok',
  'Pályára lépés',
  'Támadás',
  'Fegyelem',
]);

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

  const describedBy = [];
  const direction = tile.querySelector('.attr-btn__direction') ?? tile.querySelector('small');
  if (direction) {
    direction.classList.add('attr-btn__direction');
    direction.id = `category-direction-${key || index}`;
    describedBy.push(direction.id);
  }

  if (source.dataset.categoryStatus === 'experimental') {
    const known = Number.parseInt(source.dataset.categoryKnown ?? '', 10);
    const total = Number.parseInt(source.dataset.categoryTotal ?? '', 10);
    const coverage = Number.isFinite(known) && Number.isFinite(total)
      ? ` ${known}/${total} játékosnál elérhető.`
      : '';
    const explanation = `Nem minden játékoskártyán érhető el.${coverage}`;
    const badge = el('span', 'category-tile__availability', 'Korlátozott adatok');
    badge.id = `category-availability-${key || index}`;
    badge.title = explanation;
    badge.setAttribute('aria-label', `Korlátozott adatok. ${explanation}`);
    tile.appendChild(badge);
    describedBy.push(badge.id);
  }

  if (describedBy.length) tile.setAttribute('aria-describedby', describedBy.join(' '));

  if (!tile.querySelector('.category-tile__check')) {
    const check = el('span', 'category-tile__check', '✓');
    check.setAttribute('aria-hidden', 'true');
    tile.appendChild(check);
  }

  return tile;
}

function orderedGroups(sourceButtons) {
  const grouped = new Map();
  for (const button of sourceButtons) {
    const group = button.dataset.categoryGroup || 'Egyéb';
    const current = grouped.get(group) ?? [];
    current.push(button);
    grouped.set(group, current);
  }
  return [
    ...CATEGORY_GROUP_ORDER.filter(group => grouped.has(group)),
    ...[...grouped.keys()].filter(group => !CATEGORY_GROUP_ORDER.includes(group)),
  ].map(group => [group, grouped.get(group)]);
}

function installCategorySelection(ui, picker, sourceButtons) {
  picker.dataset.categoryPickerController = 'category-picker';

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
  const tiles = [];

  for (const [group, buttons] of orderedGroups(sourceButtons)) {
    const heading = el('h3', 'category-group-title', group);
    heading.id = `category-group-${group.toLocaleLowerCase('hu-HU').replace(/[^a-z0-9]+/g, '-')}`;
    grid.appendChild(heading);
    for (const [index, button] of buttons.entries()) {
      const tile = makeCategoryTile(button, tiles.length + index);
      tile.dataset.group = group;
      tiles.push(tile);
      grid.appendChild(tile);
    }
  }

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

  const invokeSelection = () => {
    try {
      return ui.handlers.onAttribute?.(selectedKey) !== false;
    } catch (error) {
      console.error('[category-picker] A kategória nem rögzíthető:', error);
      return null;
    }
  };

  const retrySelection = (attempt = 2) => {
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

  for (const tile of tiles) tile.addEventListener('click', () => selectTile(tile));

  next.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (committing || !selectedKey || !selectedTile) return;
    committing = true;

    const accepted = invokeSelection();
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
