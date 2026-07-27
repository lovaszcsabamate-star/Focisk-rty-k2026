/**
 * Egyérintéses, teljes kategóriaválasztó.
 *
 * Minden regisztrált összehasonlítási kategória látható. Az adott leosztásban
 * nem használható elemek megmaradnak a listában, de egyértelműen le vannak
 * tiltva, így a felhasználó mindig látja a játék teljes lehetőségkészletét.
 */

import { UI, el } from './ui.js';
import {
  ATTRIBUTES,
  attributeValue,
  formatAttribute,
  hasAttributeData,
} from './data/players.js';
import { HUMAN } from './engine.js';

const categoryPickerPrevious = Object.freeze({
  resetTable: UI.prototype.resetTable,
  hideAttributePicker: UI.prototype.hideAttributePicker,
  renderHands: UI.prototype.renderHands,
  showDuel: UI.prototype.showDuel,
  showVerdict: UI.prototype.showVerdict,
});

const CATEGORY_AUTO_COMMIT_MS = 0;
const CATEGORY_TRANSITION_CHECK_MS = 180;

const categoryLabel = button => button?.querySelector('.attr-btn__label')?.textContent?.trim()
  || button?.getAttribute('aria-label')?.split('.')[0]?.trim()
  || 'Kategória';

const directionLabel = attribute => {
  if (attribute.key === 'birthDate') return 'kevesebb életkor a jobb';
  if (attribute.key === 'birthDateOlder') return 'több életkor a jobb';
  return ['higher', 'later'].includes(attribute.direction) ? 'több a jobb' : 'kevesebb a jobb';
};

const bestHumanCard = (game, attribute) => {
  const cards = game.hands[HUMAN]
    .filter(card => hasAttributeData(card, attribute.key))
    .slice();
  if (!cards.length) return null;
  const multiplier = ['higher', 'later'].includes(attribute.direction) ? -1 : 1;
  return cards.sort((a, b) => multiplier * (
    attributeValue(a, attribute.key) - attributeValue(b, attribute.key)
  ))[0];
};

function leaveCategorySelection(ui) {
  ui?.dom?.pub?.classList.remove('is-category-selection');
}

function installCategoryVisibilityStyles() {
  if (typeof document === 'undefined' || document.querySelector('#category-picker-visibility-styles')) return;
  const style = document.createElement('style');
  style.id = 'category-picker-visibility-styles';
  style.textContent = `
    #pub.is-category-selection #table {
      min-height: 100dvh !important;
      grid-template-rows: auto minmax(0, 1fr) !important;
    }
    #pub.is-category-selection #opponent-zone,
    #pub.is-category-selection #player-zone,
    #pub.is-category-selection #banter {
      display: none !important;
    }
    #pub.is-category-selection #felt {
      position: relative !important;
      z-index: 30 !important;
      width: 100% !important;
      max-width: none !important;
      min-height: 0 !important;
      max-height: none !important;
      height: calc(100dvh - var(--hud-height, 92px)) !important;
      padding: 10px !important;
      align-items: stretch !important;
      justify-content: flex-start !important;
      overflow: hidden !important;
    }
    #pub.is-category-selection #attribute-picker {
      width: 100% !important;
      max-width: 1100px !important;
      height: 100% !important;
      max-height: none !important;
      min-height: 0 !important;
      margin-inline: auto !important;
      display: grid !important;
      grid-template-rows: minmax(0, 1fr) auto !important;
      overflow: hidden !important;
    }
    #pub.is-category-selection #attribute-picker > .category-grid {
      min-height: 0 !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
    }
    #pub.is-category-selection .category-tile--unavailable,
    #pub.is-category-selection .category-tile[data-available='false'] {
      border-style: dashed !important;
      background: linear-gradient(145deg, rgba(45,48,45,.94), rgba(27,31,29,.98)) !important;
      opacity: .62 !important;
      filter: saturate(.45) !important;
      cursor: not-allowed !important;
    }
    #pub.is-category-selection .category-tile--unavailable .attr-btn__value,
    #pub.is-category-selection .category-tile[data-available='false'] .attr-btn__value {
      color: rgba(242,230,208,.72) !important;
      white-space: normal !important;
      text-overflow: clip !important;
    }
    #pub.is-category-selection .category-picker__status {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
    }
    @media (max-width: 430px) {
      #pub.is-category-selection #felt {
        height: calc(100dvh - 76px) !important;
        padding: 6px !important;
      }
      #pub.is-category-selection #attribute-picker > .category-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
      }
    }
    @media (max-width: 340px) {
      #pub.is-category-selection #attribute-picker > .category-grid {
        grid-template-columns: minmax(0, 1fr) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function makeSourceButton(game, attribute, available) {
  const playable = available.has(attribute.key);
  const best = playable ? bestHumanCard(game, attribute) : null;
  const button = el('button', `attr-btn attr-btn--mobile${playable ? '' : ' attr-btn--unavailable'}`);
  button.type = 'button';
  button.dataset.attribute = attribute.key;
  button.dataset.available = String(playable);
  button.disabled = !playable;
  button.setAttribute('aria-disabled', String(!playable));

  const valueText = playable && best
    ? `Legjobb saját: ${formatAttribute(best, attribute.key)}`
    : 'Ebben a leosztásban nincs mindkét oldalon adat';
  button.append(
    el('span', 'attr-btn__label', `${attribute.icon} ${attribute.label}`),
    el('strong', 'attr-btn__value', valueText),
    el('small', 'attr-btn__direction', playable ? directionLabel(attribute) : 'Most nem választható'),
  );
  button.setAttribute(
    'aria-label',
    playable
      ? `${attribute.label}. ${best ? `Legjobb saját érték: ${formatAttribute(best, attribute.key)}.` : ''} ${directionLabel(attribute)}.`
      : `${attribute.label}. Ebben a leosztásban nincs mindkét oldalon hiteles adat, ezért most nem választható.`,
  );
  return button;
}

function makeCategoryTile(source, index) {
  const tile = source.cloneNode(true);
  const key = source.dataset.attribute;
  const available = source.dataset.available !== 'false' && !source.disabled;
  tile.type = 'button';
  tile.classList.add('category-tile');
  tile.classList.toggle('category-tile--unavailable', !available);
  tile.classList.remove('is-selected');
  tile.disabled = !available;
  tile.dataset.attribute = key;
  tile.dataset.key = key;
  tile.dataset.available = String(available);
  tile.setAttribute('aria-pressed', 'false');
  tile.setAttribute('aria-disabled', String(!available));

  const direction = tile.querySelector('.attr-btn__direction') ?? tile.querySelector('small');
  if (direction) {
    direction.classList.add('attr-btn__direction');
    direction.id = `category-direction-${key || index}`;
    tile.setAttribute('aria-describedby', direction.id);
  }

  const check = el('span', 'category-tile__check', '✓');
  check.setAttribute('aria-hidden', 'true');
  tile.appendChild(check);
  return tile;
}

function installCategorySelection(ui, game) {
  const picker = ui.dom.picker;
  const available = new Set(game.availableAttributeKeys());
  const sourceButtons = ATTRIBUTES.map(attribute => makeSourceButton(game, attribute, available));
  const playableCount = sourceButtons.filter(button => !button.disabled).length;

  picker.dataset.categoryPickerController = 'category-picker';
  const grid = el('div', 'category-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Összehasonlítási kategóriák');

  const status = el(
    'span',
    'category-picker__status',
    `${playableCount} most választható · ${sourceButtons.length} kategória látható`,
  );
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const commit = el('button', 'category-picker__next sr-only', 'Tovább a kártyákhoz');
  commit.type = 'button';
  commit.disabled = true;
  commit.hidden = true;
  commit.tabIndex = -1;
  commit.setAttribute('aria-hidden', 'true');

  const actions = el('div', 'category-picker__actions category-picker__actions--single');
  actions.append(status, commit);

  let selectedKey = null;
  let selectedTile = null;
  let committing = false;
  let autoCommitTimer = 0;
  let transitionTimer = 0;
  const tiles = sourceButtons.map((button, index) => makeCategoryTile(button, index));

  const setTilesDisabled = disabled => {
    for (const tile of tiles) {
      const unavailable = tile.dataset.available === 'false';
      const nextDisabled = disabled || unavailable;
      tile.disabled = nextDisabled;
      tile.setAttribute('aria-disabled', String(nextDisabled));
    }
  };

  const restoreSelection = message => {
    committing = false;
    selectedKey = null;
    selectedTile = null;
    if (autoCommitTimer) window.clearTimeout(autoCommitTimer);
    if (transitionTimer) window.clearTimeout(transitionTimer);
    autoCommitTimer = 0;
    transitionTimer = 0;
    commit.disabled = true;
    for (const tile of tiles) {
      tile.classList.remove('is-selected');
      tile.setAttribute('aria-pressed', 'false');
    }
    setTilesDisabled(false);
    status.textContent = message;
    ui.dom.pub.classList.add('is-category-selection');
  };

  const commitSelection = () => {
    if (committing || !selectedKey || !selectedTile) return;
    committing = true;
    commit.disabled = true;

    try {
      const accepted = ui.handlers.onAttribute?.(selectedKey);
      if (accepted === false) {
        restoreSelection('Ez a kategória most nem választható. Válassz egy másik csempét.');
        ui.showToast?.('Ez a kategória most nem használható.', 'error');
        return;
      }
    } catch (error) {
      console.error('[category-picker] A kategória nem rögzíthető:', error);
      restoreSelection('A kategóriát nem sikerült kiválasztani. Válassz egy másik csempét.');
      ui.showToast?.('A kategóriaválasztás nem sikerült.', 'error');
      return;
    }

    leaveCategorySelection(ui);
    transitionTimer = window.setTimeout(() => {
      if (!picker.isConnected || !picker.contains(grid)) return;
      restoreSelection('A játéktér még nem áll készen. Koppints újra egy kategóriára.');
    }, CATEGORY_TRANSITION_CHECK_MS);
  };

  commit.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    commitSelection();
  });

  for (const tile of tiles) {
    tile.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (committing || selectedKey || tile.disabled) return;
      selectedKey = tile.dataset.attribute;
      selectedTile = tile;
      for (const item of tiles) {
        const selected = item === tile;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      }
      setTilesDisabled(true);
      status.textContent = `${categoryLabel(tile)} kiválasztva. Kártyák előkészítése…`;
      commit.disabled = false;
      autoCommitTimer = window.setTimeout(() => commit.click(), CATEGORY_AUTO_COMMIT_MS);
    });
    grid.appendChild(tile);
  }

  picker.replaceChildren(grid, actions);
  ui.dom.pub.classList.add('is-category-selection');
}

UI.prototype.showAttributePicker = function showCompleteTiledAttributePicker(game) {
  this.dom.duel.replaceChildren();
  this.dom.verdict.replaceChildren();
  this.dom.verdict.className = '';
  this.setPrompt('Te következel – válassz kategóriát');
  installCategorySelection(this, game);
  this._uxSetStep?.(1);
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

installCategoryVisibilityStyles();
