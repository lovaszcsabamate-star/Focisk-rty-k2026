/**
 * Accessibility and interaction repairs for the card inspector.
 * Loaded after the existing mobile and profile layers.
 */

import { UI } from './ui.js';
import { hasAttributeData } from './data/players.js';

const usabilityPreviousRenderCard = UI.prototype.renderCard;
const usabilityPreviousOpenInspector = UI.prototype.openInspector;
const usabilityPreviousCloseInspector = UI.prototype.closeInspector;
const usabilityPreviousRenderInspector = UI.prototype._renderInspector;
const INSPECTOR_SWIPE_DISTANCE = 44;

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

UI.prototype.renderCard = function renderCardWithReadableName(card, opts = {}) {
  const node = usabilityPreviousRenderCard.call(this, card, opts);
  if (!card || opts.faceDown) return node;

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
  return node;
};

UI.prototype.openInspector = function openAccessibleInspector(...args) {
  const active = document.activeElement;
  this._inspectorReturnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
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
  usabilityPreviousCloseInspector.apply(this, args);

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

  if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);

  const swipeSurface = document.querySelector('#inspector .inspector__centre');
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
    const layer = document.querySelector('#inspector');
    if (!layer) return;

    if (event.key === 'Tab') {
      const focusable = usabilityFocusable(layer);
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

    const current = this.inspector.hand[this.inspector.index];
    const playable = this.inspector.opts.playable
      && (!this.inspector.opts.attribute || hasAttributeData(current, this.inspector.opts.attribute));
    if (!playable) return;

    event.preventDefault();
    const onPlay = this.inspector.opts.onPlay;
    this.closeInspector();
    onPlay(current);
  };

  document.addEventListener('keydown', this._inspectorKeys);
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
