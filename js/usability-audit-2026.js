/**
 * Final usability and accessibility audit layer for Fociskártyák 2026.
 * The game rules and data model are intentionally left untouched.
 */

import { UI } from './ui.js';
import {
  MIN_FILTERED_DECK_SIZE,
  canonicalNationKey,
  nationPresentation,
} from './deck-selection.js';

const previous = Object.freeze({
  renderCard: UI.prototype.renderCard,
  renderScores: UI.prototype.renderScores,
  showDuel: UI.prototype.showDuel,
  showOverlay: UI.prototype.showOverlay,
  hideOverlay: UI.prototype.hideOverlay,
  setInteractionBusy: UI.prototype.setInteractionBusy,
});

const MISSING_TEXT = new Set([
  '', '-', '—', 'n/a', 'na', 'null', 'undefined', 'nan', 'nincs adat', 'ismeretlen',
]);

const fold = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/gu, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[’']/gu, '')
  .replace(/[^a-z0-9]+/gu, ' ')
  .trim();

const visibleFocusable = root => [...(root?.querySelectorAll?.(
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), '
  + 'textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
) ?? [])].filter(node => {
  if (!(node instanceof HTMLElement)) return false;
  if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden';
});

const setText = (node, text) => {
  if (node && node.textContent !== text) node.textContent = text;
};

function removeMissingCardFields(cardNode) {
  if (!(cardNode instanceof HTMLElement)) return;
  cardNode.querySelectorAll('.stat').forEach(row => {
    const value = fold(row.querySelector('.stat__value')?.textContent);
    if (MISSING_TEXT.has(value)) row.remove();
  });

  const club = cardNode.querySelector('.card__club');
  if (club && MISSING_TEXT.has(fold(club.textContent))) club.remove();

  const position = cardNode.querySelector('.card__position');
  if (position && MISSING_TEXT.has(fold(position.textContent))) position.remove();

  const active = cardNode.querySelector('.stat.active');
  if (active) {
    const label = active.querySelector('.stat__label')?.textContent?.trim() || 'Aktuális kategória';
    const value = active.querySelector('.stat__value')?.textContent?.trim() || '';
    active.setAttribute('aria-label', `${label}: ${value}`);
    active.setAttribute('role', 'status');
  }
}

UI.prototype.renderCard = function renderAuditedCard(...args) {
  const cardNode = previous.renderCard.apply(this, args);
  removeMissingCardFields(cardNode);
  return cardNode;
};

function ensureHudContext(ui, game) {
  const hud = document.querySelector('#hud');
  if (!hud) return;

  let context = hud.querySelector('#hud-context');
  if (!context) {
    context = document.createElement('div');
    context.id = 'hud-context';
    context.setAttribute('aria-live', 'polite');
    context.setAttribute('aria-atomic', 'true');
    const mode = document.createElement('span');
    mode.className = 'hud-context__mode';
    const turn = document.createElement('span');
    turn.className = 'hud-context__turn';
    context.append(mode, turn);
    hud.prepend(context);
  }

  const isPenalty = game?.mode === 'penalties';
  const round = Number(game?.round);
  const chooser = game?.chooser === 'human' ? 'Te választasz' : 'Az ellenfél választ';
  setText(context.querySelector('.hud-context__mode'), isPenalty ? 'Büntetőpárbaj' : 'Klasszikus mód');
  setText(
    context.querySelector('.hud-context__turn'),
    Number.isFinite(round) && round > 0 ? `${round}. ${isPenalty ? 'párbaj' : 'kör'} · ${chooser}` : chooser,
  );

  const scores = ui.dom?.hudScores?.querySelectorAll?.('.score') ?? [];
  scores[0]?.classList.add('score--human');
  scores[1]?.classList.add('score--opponent');
  scores[0]?.setAttribute('aria-label', `Saját pontszám: ${scores[0]?.querySelector('b')?.textContent ?? '0'}`);
  scores[1]?.setAttribute('aria-label', `Ellenfél pontszáma: ${scores[1]?.querySelector('b')?.textContent ?? '0'}`);

  ui.dom?.hudMeta?.setAttribute('role', 'status');
  ui.dom?.hudMeta?.setAttribute('aria-live', 'polite');
}

UI.prototype.renderScores = function renderAuditedScores(game) {
  const output = previous.renderScores.call(this, game);
  ensureHudContext(this, game);
  return output;
};

UI.prototype.showDuel = function showAuditedDuel(game, options = {}) {
  const output = previous.showDuel.call(this, game, options);
  const slots = this.dom?.duel?.querySelectorAll?.('.duel-slot') ?? [];
  slots[0]?.classList.add('duel-slot--human');
  slots[1]?.classList.add('duel-slot--opponent');
  slots[0]?.setAttribute('aria-label', 'Saját kijátszott kártya');
  slots[1]?.setAttribute('aria-label', 'Az ellenfél kijátszott kártyája');
  this.dom?.duel?.classList.toggle('is-tie', options?.result?.winner === 'tie');
  return output;
};

function installOverlayFocus(ui, panel) {
  const overlay = ui.dom?.overlay;
  const body = ui.dom?.overlayBody;
  if (!overlay || !body || overlay.hidden || !(panel instanceof HTMLElement)) return;

  ui._auditOverlayReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  const heading = panel.querySelector('h1, h2');
  if (heading) {
    heading.id ||= `dialog-title-${Math.random().toString(36).slice(2, 9)}`;
    overlay.setAttribute('aria-labelledby', heading.id);
  } else {
    overlay.removeAttribute('aria-labelledby');
    overlay.setAttribute('aria-label', 'Párbeszédablak');
  }

  body.tabIndex = -1;
  body.setAttribute('aria-busy', 'false');
  const safeClose = () => panel.querySelector(
    '#keep-save-btn, #settings-back-btn, #rules-back-btn, #resume-btn, '
    + '#onboarding-skip, #menu-btn, [data-dialog-close], .btn--ghost',
  );

  ui._auditOverlayKeydown = event => {
    if (event.key === 'Escape') {
      const close = safeClose();
      if (close instanceof HTMLElement && !close.hasAttribute('disabled')) {
        event.preventDefault();
        close.click();
      }
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = visibleFocusable(panel);
    if (!focusable.length) {
      event.preventDefault();
      body.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  overlay.addEventListener('keydown', ui._auditOverlayKeydown);
  queueMicrotask(() => (visibleFocusable(panel)[0] ?? body).focus({ preventScroll: true }));
}

function cleanupOverlayFocus(ui) {
  const overlay = ui.dom?.overlay;
  if (overlay && ui._auditOverlayKeydown) {
    overlay.removeEventListener('keydown', ui._auditOverlayKeydown);
  }
  ui._auditOverlayKeydown = null;
  const returnFocus = ui._auditOverlayReturnFocus;
  ui._auditOverlayReturnFocus = null;
  queueMicrotask(() => {
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
}

UI.prototype.showOverlay = function showAuditedOverlay(panel) {
  const output = previous.showOverlay.call(this, panel);
  installOverlayFocus(this, panel);
  return output;
};

UI.prototype.hideOverlay = function hideAuditedOverlay(...args) {
  cleanupOverlayFocus(this);
  return previous.hideOverlay.apply(this, args);
};

if (typeof previous.setInteractionBusy === 'function') {
  UI.prototype.setInteractionBusy = function setAuditedInteractionBusy(busy) {
    const output = previous.setInteractionBusy.call(this, busy);
    const state = String(Boolean(busy));
    this.dom?.pub?.setAttribute('aria-busy', state);
    this.dom?.picker?.setAttribute('aria-busy', state);
    this.dom?.playerHand?.setAttribute('aria-busy', state);
    this.dom?.overlayBody?.setAttribute('aria-busy', state);
    return output;
  };
}

const confirmationRules = Object.freeze({
  'restart-btn': 'Biztosan újrakezded a mérkőzést? A jelenlegi játékállás elvész.',
  'home-btn': 'Visszalépsz a főmenübe? A folyamatban lévő mérkőzés mentése megmarad.',
  'delete-save-btn': 'Biztosan törlöd a mentett mérkőzést? Ez nem vonható vissza.',
});

function installDangerousActionConfirmation() {
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button[id]');
    if (!(button instanceof HTMLButtonElement)) return;
    const message = confirmationRules[button.id];
    if (!message || button.dataset.confirmedAction === 'true') {
      if (button?.dataset.confirmedAction === 'true') delete button.dataset.confirmedAction;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!window.confirm(message)) return;
    button.dataset.confirmedAction = 'true';
    button.click();
  }, true);
}

function installTrustedDoubleActivationGuard() {
  const lastActivation = new WeakMap();
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const target = event.target.closest?.('button, summary, [role="button"]');
    if (!(target instanceof HTMLElement)) return;
    if (target.matches(':disabled, [aria-disabled="true"]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const now = performance.now();
    const previousTime = lastActivation.get(target) ?? -Infinity;
    if (now - previousTime < 500) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    lastActivation.set(target, now);
    target.classList.add('is-activating');
    window.setTimeout(() => target.classList.remove('is-activating'), 520);
  }, true);
}

function clubGroups(players) {
  const groups = new Map();
  for (const player of players) {
    const label = String(player?.club ?? '').trim();
    const key = fold(label);
    if (!key) continue;
    const current = groups.get(key) ?? { key, label, count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'hu-HU'));
}

function nationGroups(players) {
  const groups = new Map();
  for (const player of players) {
    const key = canonicalNationKey(player?.nation);
    if (!key) continue;
    const presentation = nationPresentation(key);
    const current = groups.get(key) ?? {
      key,
      label: presentation.label,
      flag: presentation.flag,
      count: 0,
    };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'hu-HU'));
}

function enhanceDeckSelector(selector) {
  if (!(selector instanceof HTMLElement) || selector.dataset.auditEnhanced === 'true') return;
  selector.dataset.auditEnhanced = 'true';

  const body = selector.querySelector('.deck-selector__body');
  const choice = selector.querySelector('.deck-selector__choice');
  const select = selector.querySelector('select');
  if (!body || !choice || !(select instanceof HTMLSelectElement)) return;

  const searchWrap = document.createElement('label');
  searchWrap.className = 'deck-selector__search-wrap';
  const label = document.createElement('span');
  label.className = 'deck-selector__search-label';
  label.textContent = 'Keresés a csapatok és nemzetiségek között';
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'deck-selector__search';
  search.placeholder = 'Kezdj el gépelni…';
  search.autocomplete = 'off';
  search.setAttribute('aria-label', label.textContent);
  const status = document.createElement('span');
  status.className = 'deck-selector__search-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  searchWrap.append(label, search, status);
  choice.before(searchWrap);

  let refreshing = false;
  const refresh = () => {
    if (refreshing) return;
    refreshing = true;
    const players = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__?.players ?? [];
    const kind = selector.querySelector('.deck-kind.is-active')?.dataset.kind ?? 'random';
    const groups = kind === 'club' ? clubGroups(players) : kind === 'nation' ? nationGroups(players) : [];

    select.querySelectorAll('option[data-audit-unavailable]').forEach(option => option.remove());
    const existingLabels = new Set([...select.options].map(option => fold(option.textContent.split('—')[0])));
    for (const item of groups.filter(entry => entry.count < MIN_FILTERED_DECK_SIZE)) {
      const labelText = `${kind === 'nation' ? `${item.flag} ` : ''}${item.label}`;
      if (existingLabels.has(fold(labelText))) continue;
      const option = document.createElement('option');
      option.value = `unavailable:${kind}:${item.key}`;
      option.disabled = true;
      option.dataset.auditUnavailable = 'true';
      option.textContent = `${labelText} — ${item.count} kártya (nem választható: legalább ${MIN_FILTERED_DECK_SIZE} szükséges)`;
      select.appendChild(option);
    }

    search.disabled = kind === 'random';
    search.placeholder = kind === 'club' ? 'Csapat keresése…' : kind === 'nation' ? 'Nemzetiség keresése…' : 'Véletlen paklinál nincs szükség keresésre';
    if (kind === 'random') search.value = '';

    const query = fold(search.value);
    let shown = 0;
    let selectable = 0;
    [...select.options].forEach(option => {
      const matches = !query || fold(option.textContent).includes(query);
      option.hidden = !matches;
      if (matches) {
        shown += 1;
        if (!option.disabled) selectable += 1;
      }
    });

    const selected = select.selectedOptions[0];
    if (selected?.hidden || selected?.disabled) {
      const first = [...select.options].find(option => !option.hidden && !option.disabled);
      if (first) select.value = first.value;
    }

    status.textContent = kind === 'random'
      ? `${players.length} használható kártya áll rendelkezésre.`
      : `${shown} találat, ebből ${selectable} választható. A többi lehetőségnél látható a kizárás oka.`;
    refreshing = false;
  };

  search.addEventListener('input', refresh);
  selector.querySelectorAll('.deck-kind').forEach(button => button.addEventListener('click', () => queueMicrotask(refresh)));
  refresh();
}

function enhanceLiveInterface(root = document) {
  root.querySelectorAll?.('.deck-selector').forEach(enhanceDeckSelector);
  root.querySelectorAll?.('.stat').forEach(row => {
    const value = fold(row.querySelector('.stat__value')?.textContent);
    if (MISSING_TEXT.has(value)) row.remove();
  });

  const penaltyBoard = document.querySelector('#penalty-board');
  if (penaltyBoard) {
    penaltyBoard.setAttribute('aria-label', 'A Büntetőpárbaj próbálkozásai');
    penaltyBoard.querySelectorAll('.attempt').forEach(mark => {
      const text = mark.title || 'Próbálkozás';
      mark.setAttribute('aria-label', text);
      mark.setAttribute('role', 'img');
    });
  }
}

function initialiseAuditLayer() {
  installDangerousActionConfirmation();
  installTrustedDoubleActivationGuard();
  enhanceLiveInterface();

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      enhanceLiveInterface();
    });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.documentElement.dataset.usabilityAudit = '2026';
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialiseAuditLayer, { once: true });
  else initialiseAuditLayer();
}
