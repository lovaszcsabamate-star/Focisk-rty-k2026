/** Jól elkülönülő mérkőzésállapot, fázis és következő művelet a játéktéren. */

import { ATTRIBUTE_BY_KEY } from './data/players.js';
import { HUMAN } from './engine.js';
import { UI, el } from './ui.js';

const hierarchyPrevious = Object.freeze({
  resetTable: UI.prototype.resetTable,
  setMode: UI.prototype.setMode,
  renderScores: UI.prototype.renderScores,
  showAttributePicker: UI.prototype.showAttributePicker,
  hideAttributePicker: UI.prototype.hideAttributePicker,
  renderHands: UI.prototype.renderHands,
  showDuel: UI.prototype.showDuel,
  showVerdict: UI.prototype.showVerdict,
});

const contextValue = (root, key) => root?.querySelector(`[data-context-value="${key}"]`);

export function visualHierarchyModeLabel(mode) {
  return mode === 'penalties' ? 'Büntetőpárbaj' : 'Klasszikus';
}

export function visualHierarchyRoundLabel(game = {}) {
  if (game.mode === 'penalties') {
    const played = Number.isFinite(Number(game.regularPlayed)) ? Number(game.regularPlayed) : 0;
    if (game.suddenDeath) {
      const duel = Math.max(1, (Array.isArray(game.log) ? game.log.length : played) + 1);
      return `Hirtelen halál · ${duel}. párbaj`;
    }
    return `${Math.min(played + 1, 5)}. párbaj / 5`;
  }

  const round = Number(game.round);
  return `${Number.isFinite(round) && round > 0 ? round : 1}. kör`;
}

export function visualHierarchyCategoryLabel(attributeKey) {
  const attribute = ATTRIBUTE_BY_KEY[attributeKey];
  return attribute ? `${attribute.icon} ${attribute.label}` : 'Még nincs kiválasztva';
}

export function visualHierarchyResultTitle(result = {}, game = {}) {
  if (result.winner === 'tie') return 'Döntetlen';
  if (result.winner === HUMAN) {
    return game.mode === 'penalties' ? 'Gól – megnyerted a párbajt' : 'Megnyerted a kört';
  }
  return game.mode === 'penalties' ? 'A gép gólt szerzett' : 'A gép nyerte a kört';
}

function createContextItem(key, label) {
  const item = el('div', `match-context__item match-context__item--${key}`);
  item.dataset.contextItem = key;
  const caption = el('span', 'match-context__label', label);
  const value = el('strong', 'match-context__value', '—');
  value.dataset.contextValue = key;
  item.append(caption, value);
  return item;
}

function ensureVisualHierarchy(ui) {
  let context = document.querySelector('#match-context');
  if (!context) {
    context = el('section', 'match-context');
    context.id = 'match-context';
    context.hidden = true;
    context.setAttribute('aria-label', 'Mérkőzés aktuális állapota');
    context.append(
      createContextItem('mode', 'Játékmód'),
      createContextItem('round', 'Aktuális kör'),
      createContextItem('category', 'Összehasonlított kategória'),
    );
    const hud = document.querySelector('#hud');
    hud?.after(context);
  }

  let action = document.querySelector('#next-action-panel');
  if (!action) {
    action = el('section', 'next-action-panel');
    action.id = 'next-action-panel';
    action.hidden = true;
    action.setAttribute('role', 'status');
    action.setAttribute('aria-live', 'polite');
    action.setAttribute('aria-atomic', 'true');
    const step = el('span', 'next-action-panel__step', 'Következő lépés');
    step.dataset.actionPart = 'step';
    const copy = el('div', 'next-action-panel__copy');
    const title = el('strong', 'next-action-panel__title', '');
    title.dataset.actionPart = 'title';
    const detail = el('small', 'next-action-panel__detail', '');
    detail.dataset.actionPart = 'detail';
    copy.append(title, detail);
    action.append(step, copy);
    ui.dom?.prompt?.before(action);
  }

  return { context, action };
}

function updateActionNode(action, { step, title, detail, phase }) {
  if (!action) return;
  action.hidden = false;
  action.dataset.phase = phase;
  const stepNode = action.querySelector('[data-action-part="step"]');
  const titleNode = action.querySelector('[data-action-part="title"]');
  const detailNode = action.querySelector('[data-action-part="detail"]');
  if (stepNode) stepNode.textContent = step;
  if (titleNode) titleNode.textContent = title;
  if (detailNode) detailNode.textContent = detail;
}

function syncMatchContext(ui, game, fallbackAttribute = null) {
  const { context } = ensureVisualHierarchy(ui);
  const mode = game?.mode ?? ui.mode;
  const attributeKey = game?.attribute ?? fallbackAttribute;
  context.hidden = false;
  context.dataset.mode = mode === 'penalties' ? 'penalties' : 'classic';
  const modeNode = contextValue(context, 'mode');
  const roundNode = contextValue(context, 'round');
  const categoryNode = contextValue(context, 'category');
  if (modeNode) modeNode.textContent = visualHierarchyModeLabel(mode);
  if (roundNode) roundNode.textContent = visualHierarchyRoundLabel({ ...game, mode });
  if (categoryNode) categoryNode.textContent = visualHierarchyCategoryLabel(attributeKey);
  context.classList.toggle('has-category', Boolean(attributeKey));
  return context;
}

function showNextAction(ui, actionState) {
  const { action } = ensureVisualHierarchy(ui);
  updateActionNode(action, actionState);
  ui.dom?.pub?.setAttribute('data-visual-phase', actionState.phase);
}

UI.prototype.setMode = function setModeWithVisualHierarchy(mode) {
  const output = hierarchyPrevious.setMode.call(this, mode);
  const context = document.querySelector('#match-context');
  if (context && !context.hidden) {
    context.dataset.mode = mode === 'penalties' ? 'penalties' : 'classic';
    const modeNode = contextValue(context, 'mode');
    if (modeNode) modeNode.textContent = visualHierarchyModeLabel(mode);
  }
  return output;
};

UI.prototype.resetTable = function resetTableWithVisualHierarchy(...args) {
  const output = hierarchyPrevious.resetTable.apply(this, args);
  const context = document.querySelector('#match-context');
  const action = document.querySelector('#next-action-panel');
  if (context) context.hidden = true;
  if (action) action.hidden = true;
  this.dom?.pub?.removeAttribute('data-visual-phase');
  return output;
};

UI.prototype.renderScores = function renderScoresWithVisualHierarchy(game) {
  const output = hierarchyPrevious.renderScores.call(this, game);
  syncMatchContext(this, game);
  this.dom?.hudScores?.classList.add('score-strip--primary');
  return output;
};

UI.prototype.showAttributePicker = function showAttributePickerWithVisualHierarchy(game) {
  const output = hierarchyPrevious.showAttributePicker.call(this, game);
  syncMatchContext(this, game);
  showNextAction(this, {
    step: '1. Kategória',
    title: 'Válassz összehasonlítási kategóriát',
    detail: 'A kijelölt kategória dönti el, melyik kártya nyeri a párbajt.',
    phase: 'category',
  });
  return output;
};

UI.prototype.hideAttributePicker = function hideAttributePickerWithVisualHierarchy(...args) {
  return hierarchyPrevious.hideAttributePicker.apply(this, args);
};

UI.prototype.renderHands = function renderHandsWithVisualHierarchy(game, options = {}) {
  const output = hierarchyPrevious.renderHands.call(this, game, options);
  const attributeKey = game?.attribute ?? options.inspectAttribute ?? null;
  syncMatchContext(this, game, attributeKey);
  if (options.selectable) {
    showNextAction(this, {
      step: '2. Kártya',
      title: 'Válaszd ki a kijátszandó lapot',
      detail: `${visualHierarchyCategoryLabel(attributeKey)} · koppints a választott kártyára.`,
      phase: 'card',
    });
  }
  return output;
};

UI.prototype.showDuel = function showDuelWithVisualHierarchy(game, options = {}) {
  const output = hierarchyPrevious.showDuel.call(this, game, options);
  syncMatchContext(this, game);
  if (!options.result) {
    showNextAction(this, {
      step: 'Párbaj',
      title: 'A két kártya összehasonlítása',
      detail: visualHierarchyCategoryLabel(game?.attribute),
      phase: 'duel',
    });
  }
  return output;
};

UI.prototype.showVerdict = function showVerdictWithVisualHierarchy(result, game) {
  const output = hierarchyPrevious.showVerdict.call(this, result, game);
  syncMatchContext(this, game, result?.attribute);
  showNextAction(this, {
    step: '3. Eredmény',
    title: visualHierarchyResultTitle(result, game),
    detail: `${visualHierarchyCategoryLabel(result?.attribute)} · az eredmény részletei a kártyák alatt láthatók.`,
    phase: result?.winner === 'tie' ? 'result-tie' : result?.winner === HUMAN ? 'result-win' : 'result-loss',
  });
  return output;
};

if (typeof document !== 'undefined') {
  const picker = document.querySelector('#attribute-picker');
  if (picker) {
    new MutationObserver(() => {
      const button = picker.querySelector('.next-round-button');
      const action = document.querySelector('#next-action-panel');
      if (!button || !action) return;
      updateActionNode(action, {
        step: 'Következő lépés',
        title: button.textContent?.trim() || 'Következő kör',
        detail: 'Az új kör ismét kategóriaválasztással kezdődik.',
        phase: 'continue',
      });
      document.querySelector('#pub')?.setAttribute('data-visual-phase', 'continue');
    }).observe(picker, { childList: true, subtree: true });
  }
}
