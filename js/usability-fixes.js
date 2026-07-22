/**
 * Accessibility and interaction repairs for the card inspector.
 * Loaded after the existing mobile and profile layers.
 */

import { UI } from './ui.js';
import { hasAttributeData } from './data/players.js';
import { HUMAN } from './engine.js';

const usabilityPreviousRenderCard = UI.prototype.renderCard;
const usabilityPreviousRenderHands = UI.prototype.renderHands;
const usabilityPreviousRenderPiles = UI.prototype._renderPiles;
const usabilityPreviousOpenInspector = UI.prototype.openInspector;
const usabilityPreviousCloseInspector = UI.prototype.closeInspector;
const usabilityPreviousRenderInspector = UI.prototype._renderInspector;
const usabilityPreviousInspectorStep = UI.prototype._inspectorStep;
const INSPECTOR_SWIPE_DISTANCE = 44;
const INSPECTOR_TRANSITION_MS = 120;
const INSPECTOR_BACKDROP_ID = 'inspector-stable-backdrop';

const NAME_PARTICLES = new Set([
  'a', 'al', 'ap', 'da', 'das', 'de', 'del', 'della', 'der', 'di', 'do', 'dos',
  'du', 'el', 'la', 'le', 'van', 'von',
]);
const NAME_SUFFIXES = new Set(['ii', 'iii', 'iv', 'jr', 'jr.', 'sr', 'sr.']);

const cleanNameText = value => String(value ?? '')
  .normalize('NFKC')
  .replace(/[…]+/gu, ' ')
  .replace(/\.{2,}/gu, ' ')
  .replace(/[,_]+/gu, ' ')
  .replace(/\s+/gu, ' ')
  .trim();

const titleCaseName = value => {
  const words = cleanNameText(value).toLocaleLowerCase('hu-HU').split(' ').filter(Boolean);
  return words.map((word, index) => {
    if (NAME_SUFFIXES.has(word)) return word.replace('.', '').toLocaleUpperCase('hu-HU');
    if (index > 0 && NAME_PARTICLES.has(word)) return word;
    return word.replace(/(^|[-'’])(\p{L})/gu, (_, prefix, letter) => (
      `${prefix}${letter.toLocaleUpperCase('hu-HU')}`
    ));
  }).join(' ');
};

const profileSlugName = card => {
  const candidates = [
    card?.meta?.profileUrl,
    card?.meta?.birthDateSource,
    card?.meta?.sourceUrl,
  ].filter(value => typeof value === 'string' && value.trim());

  for (const candidate of candidates) {
    try {
      const segments = new URL(candidate).pathname.split('/').filter(Boolean);
      const profileIndex = segments.findIndex(segment => segment.toLocaleLowerCase('hu-HU') === 'profil');
      if (profileIndex <= 0 || segments[profileIndex + 1]?.toLocaleLowerCase('hu-HU') !== 'spieler') continue;
      const slug = decodeURIComponent(segments[profileIndex - 1]).replace(/[-_]+/gu, ' ');
      const words = cleanNameText(slug).split(' ').filter(Boolean);
      if (words.length >= 1 && words.length <= 3) return slug;
    } catch {
      // A hibás vagy relatív forrás-URL nem akadályozhatja a kártya megjelenítését.
    }
  }
  return '';
};

export function cardPlayerDisplayName(card = {}) {
  const explicit = cleanNameText(
    card.shortName
      ?? card.displayName
      ?? card.knownAs
      ?? card.meta?.shortName
      ?? card.meta?.displayName
      ?? card.meta?.knownAs,
  );
  const original = cleanNameText(card.name);
  const originalWords = original.split(' ').filter(Boolean);

  let selected = explicit || original;
  if (!explicit && originalWords.length > 2) {
    const profileName = profileSlugName(card);
    if (profileName) selected = profileName;
  }

  return titleCaseName(selected) || 'Ismeretlen játékos';
}

export function cardNameInitials(value) {
  return cardPlayerDisplayName({ name: value })
    .split(' ')
    .filter(word => !NAME_PARTICLES.has(word.toLocaleLowerCase('hu-HU')))
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('hu-HU');
}

const usabilityFocusable = root => [...(root?.querySelectorAll?.(
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
) ?? [])].filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');

const reducedMotionEnabled = () => (
  document.documentElement.classList.contains('ux-reduced-motion')
  || document.documentElement.classList.contains('reduced-motion')
  || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
);

const ensureInspectorBackdrop = ui => {
  let backdrop = document.getElementById(INSPECTOR_BACKDROP_ID);
  if (backdrop) return backdrop;

  backdrop = document.createElement('div');
  backdrop.id = INSPECTOR_BACKDROP_ID;
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.addEventListener('click', () => ui.closeInspector());
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-visible'));
  return backdrop;
};

const removeInspectorBackdrop = () => {
  const backdrop = document.getElementById(INSPECTOR_BACKDROP_ID);
  if (!backdrop) return;
  backdrop.classList.remove('is-visible');
  window.setTimeout(() => backdrop.remove(), reducedMotionEnabled() ? 1 : 190);
};

const syncHandInspectorButton = ui => {
  const pile = ui.dom?.playerPile;
  if (!pile) return;
  pile.querySelector('.pile__inspect')?.remove();

  const context = ui._handInspectorContext;
  if (!context?.hand?.length) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pile__inspect';
  button.textContent = '🔍';
  button.title = 'Kéz nagyítása';
  button.setAttribute('aria-label', `Kéz nagyítása, ${context.hand.length} kártya`);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();

    const selectedId = ui.dom.playerHand
      ?.querySelector('.card--choice.is-selected')
      ?.dataset.cardId;
    const selectedIndex = selectedId
      ? context.hand.findIndex(card => String(card?.id) === String(selectedId))
      : -1;
    const index = selectedIndex >= 0 ? selectedIndex : 0;

    ui.openInspector(context.hand, index, {
      attribute: context.attribute,
      playable: context.playable,
      onPlay: chosen => ui.handlers.onCard?.(chosen),
    });
  });
  pile.prepend(button);
};

UI.prototype.renderCard = function renderCardWithReadableName(card, opts = {}) {
  const node = usabilityPreviousRenderCard.call(this, card, opts);
  if (!card || opts.faceDown) return node;

  /* A nagyító nem kártyánként jelenik meg: egyetlen kézszintű gomb nyitja meg
     ugyanazt az inspectort a megnyert/használt lapok blokkja fölött. */
  node.querySelector('.card__inspect')?.remove();

  const displayName = cardPlayerDisplayName(card);
  const nameNode = node.querySelector('.card__name');
  if (nameNode) {
    nameNode.textContent = displayName;
    nameNode.title = cleanNameText(card.name) || displayName;
    nameNode.setAttribute('aria-label', displayName);
    nameNode.classList.toggle(
      'card__name--compact',
      displayName.length > 20 || displayName.split(' ').length > 2,
    );
  }

  const portrait = node.querySelector('.card__portrait');
  if (portrait) portrait.dataset.initials = cardNameInitials(displayName);
  node.dataset.displayName = displayName;

  if (node.classList.contains('card--direct-play')) {
    node.setAttribute('aria-label', `${displayName} kijátszása. A részletek a kéz melletti nagyító gombbal nyithatók meg.`);
  }
  return node;
};

UI.prototype.renderHands = function renderHandsWithSingleInspectorButton(game, options = {}) {
  usabilityPreviousRenderHands.call(this, game, options);
  const hand = Array.isArray(game?.hands?.[HUMAN]) ? game.hands[HUMAN] : [];
  this._handInspectorContext = {
    hand,
    attribute: game?.attribute ?? options.inspectAttribute ?? null,
    playable: Boolean(options.selectable),
  };
  syncHandInspectorButton(this);

  const instruction = document.querySelector('#mobile-hand-instruction');
  if (instruction) {
    instruction.textContent = 'A kéz oldalra görgethető. Koppints a lapra a kijátszáshoz, vagy használd a kéz melletti egyetlen nagyító gombot.';
  }
};

UI.prototype._renderPiles = function renderPilesWithSingleInspectorButton(...args) {
  usabilityPreviousRenderPiles.apply(this, args);
  syncHandInspectorButton(this);
};

UI.prototype.openInspector = function openAccessibleInspector(...args) {
  const active = document.activeElement;
  this._inspectorReturnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
  ensureInspectorBackdrop(this);
  usabilityPreviousOpenInspector.apply(this, args);

  const layer = document.querySelector('#inspector');
  const preferred = layer?.querySelector('.inspector__actions .btn:not(:disabled)')
    ?? layer?.querySelector('.inspector__actions .btn')
    ?? layer?.querySelector('button:not(:disabled)');
  preferred?.focus({ preventScroll: true });
};

UI.prototype.closeInspector = function closeAccessibleInspector(...args) {
  const returnFocus = this._inspectorReturnFocus;
  this._inspectorReturnFocus = null;
  if (this._inspectorSwitchTimer) window.clearTimeout(this._inspectorSwitchTimer);
  this._inspectorSwitchTimer = 0;
  this._inspectorSwitching = false;
  usabilityPreviousCloseInspector.apply(this, args);
  removeInspectorBackdrop();

  queueMicrotask(() => {
    if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') {
      returnFocus.focus({ preventScroll: true });
    }
  });
};

UI.prototype._renderInspector = function renderAccessibleInspector(...args) {
  if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);
  this._inspectorKeys = null;

  usabilityPreviousRenderInspector.apply(this, args);
  ensureInspectorBackdrop(this);

  if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);

  const layer = document.querySelector('#inspector');
  const swipeSurface = layer?.querySelector('.inspector__centre');
  const direction = this._inspectorEnteringDirection;
  this._inspectorEnteringDirection = null;

  if (layer && direction) {
    layer.dataset.switchDirection = direction;
    swipeSurface?.classList.add('is-entering');
    void swipeSurface?.offsetWidth;
    requestAnimationFrame(() => swipeSurface?.classList.remove('is-entering'));
  }

  const current = this.inspector?.hand?.[this.inspector.index];
  const playable = Boolean(
    this.inspector?.opts?.playable
    && (!this.inspector.opts.attribute || hasAttributeData(current, this.inspector.opts.attribute)),
  );
  const largeCard = layer?.querySelector('.card--large');
  const playButton = layer?.querySelector('.inspector__actions .btn:not(.btn--ghost)');
  const hint = layer?.querySelector('.inspector__hint');

  if (hint) {
    hint.textContent = playable
      ? '← → kártyaváltás · koppints a lapra a kiválasztáshoz · Esc bezárás'
      : '← → kártyaváltás · Esc bezárás';
  }

  if (playable && largeCard && playButton && !playButton.disabled) {
    largeCard.classList.add('inspector__playable-card');
    largeCard.tabIndex = 0;
    largeCard.setAttribute('role', 'button');
    largeCard.setAttribute('aria-label', `${cardPlayerDisplayName(current)} kiválasztása és kijátszása`);

    const commitLargeCard = event => {
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (this._inspectorSwitching || playButton.disabled) return;
      largeCard.classList.add('is-committing');
      playButton.click();
    };
    largeCard.addEventListener('click', commitLargeCard);
    largeCard.addEventListener('keydown', commitLargeCard);
  }

  let swipeStart = null;

  swipeSurface?.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || event.button !== 0) return;
    swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }, { passive: true });

  swipeSurface?.addEventListener('pointerup', event => {
    if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    swipeStart = null;

    if (Math.abs(deltaX) < INSPECTOR_SWIPE_DISTANCE) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
    this._inspectorStep(deltaX < 0 ? 1 : -1);
  }, { passive: true });

  swipeSurface?.addEventListener('pointercancel', () => {
    swipeStart = null;
  }, { passive: true });

  this._inspectorKeys = event => {
    if (!this.inspector) return;
    const currentLayer = document.querySelector('#inspector');
    if (!currentLayer) return;

    if (event.key === 'Tab') {
      const focusable = usabilityFocusable(currentLayer);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeInspector();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this._inspectorStep(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }

    if (event.key !== 'Enter') return;
    if (event.target.closest?.('button, a, input, select, textarea, [role="button"]')) return;

    const inspected = this.inspector.hand[this.inspector.index];
    const canPlay = this.inspector.opts.playable
      && (!this.inspector.opts.attribute || hasAttributeData(inspected, this.inspector.opts.attribute));
    if (!canPlay) return;

    event.preventDefault();
    const onPlay = this.inspector.opts.onPlay;
    this.closeInspector();
    onPlay(inspected);
  };

  document.addEventListener('keydown', this._inspectorKeys);
};

UI.prototype._inspectorStep = function stepInspectorWithoutBackdropFlash(delta) {
  if (!this.inspector || this._inspectorSwitching) return;

  const layer = document.querySelector('#inspector');
  const centre = layer?.querySelector('.inspector__centre');
  if (!layer || !centre || reducedMotionEnabled()) {
    usabilityPreviousInspectorStep.call(this, delta);
    return;
  }

  this._inspectorSwitching = true;
  const direction = delta > 0 ? 'next' : 'previous';
  layer.dataset.switchDirection = direction;
  centre.classList.add('is-leaving');

  if (this._inspectorSwitchTimer) window.clearTimeout(this._inspectorSwitchTimer);
  this._inspectorSwitchTimer = window.setTimeout(() => {
    this._inspectorSwitchTimer = 0;
    this._inspectorEnteringDirection = direction;
    usabilityPreviousInspectorStep.call(this, delta);
    this._inspectorSwitching = false;
  }, INSPECTOR_TRANSITION_MS);
};

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', event => {
    const card = event.target.closest?.('#player-hand .card--choice');
    if (!card) return;
    requestAnimationFrame(() => {
      card.scrollIntoView({
        block: 'nearest',
        inline: 'center',
        behavior: document.documentElement.classList.contains('ux-reduced-motion') ? 'auto' : 'smooth',
      });
    });
  }, { passive: true });
}
