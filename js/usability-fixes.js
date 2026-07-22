/**
 * Accessibility and interaction repairs for the card inspector.
 * Loaded after the existing mobile and profile layers.
 */

import { UI } from './ui.js';
import { hasAttributeData } from './data/players.js';

const usabilityPreviousOpenInspector = UI.prototype.openInspector;
const usabilityPreviousCloseInspector = UI.prototype.closeInspector;
const usabilityPreviousRenderInspector = UI.prototype._renderInspector;
const INSPECTOR_SWIPE_DISTANCE = 44;

const usabilityFocusable = root => [...(root?.querySelectorAll?.(
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
) ?? [])].filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');

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
