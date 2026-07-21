/** Accessibility and interaction repairs for the card inspector. */

import { UI } from './ui.js';
import { hasAttributeData } from './data/players.js';

const previousOpen = UI.prototype.openInspector;
const previousClose = UI.prototype.closeInspector;
const previousRender = UI.prototype._renderInspector;

const focusable = root => [...(root?.querySelectorAll?.('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])]
  .filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');

const controlType = node => {
  if (!node) return null;
  if (node.matches?.('.inspector__nav:first-child')) return 'previous';
  if (node.matches?.('.inspector__nav:last-child')) return 'next';
  if (node.matches?.('.inspector__actions .btn:not(.btn--ghost)')) return 'play';
  if (node.matches?.('.inspector__actions .btn--ghost')) return 'close';
  return null;
};

const refocus = (layer, type) => {
  const selectors = {
    previous: '.inspector__nav:first-child:not(:disabled)',
    next: '.inspector__nav:last-child:not(:disabled)',
    play: '.inspector__actions .btn:not(.btn--ghost):not(:disabled)',
    close: '.inspector__actions .btn--ghost:not(:disabled)',
  };
  const target = layer?.querySelector(selectors[type])
    ?? layer?.querySelector('.inspector__actions .btn:not(:disabled)')
    ?? layer?.querySelector('button:not(:disabled)');
  target?.focus({ preventScroll: true });
};

UI.prototype.openInspector = function openAccessibleInspector(...args) {
  const active = document.activeElement;
  this._inspectorReturnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
  previousOpen.apply(this, args);
  refocus(document.querySelector('#inspector'), 'play');
};

UI.prototype.closeInspector = function closeAccessibleInspector(...args) {
  const returnFocus = this._inspectorReturnFocus;
  this._inspectorReturnFocus = null;
  previousClose.apply(this, args);
  queueMicrotask(() => {
    if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
  });
};

UI.prototype._renderInspector = function renderAccessibleInspector(...args) {
  const previousType = controlType(document.activeElement);
  if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);
  this._inspectorKeys = null;
  previousRender.apply(this, args);
  if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);
  if (this.interactionBusy) this.setInteractionBusy?.(true);
  if (previousType) queueMicrotask(() => refocus(document.querySelector('#inspector'), previousType));

  this._inspectorKeys = event => {
    if (!this.inspector) return;
    const layer = document.querySelector('#inspector');
    if (!layer) return;

    if (event.key === 'Tab') {
      const nodes = focusable(layer);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes.at(-1);
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
      const type = controlType(document.activeElement) ?? (event.key === 'ArrowLeft' ? 'previous' : 'next');
      this._inspectorStep(event.key === 'ArrowLeft' ? -1 : 1);
      queueMicrotask(() => refocus(document.querySelector('#inspector'), type));
      return;
    }

    if (event.key !== 'Enter' || this.interactionBusy) return;
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
    requestAnimationFrame(() => card.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: document.documentElement.classList.contains('ux-reduced-motion') ? 'auto' : 'smooth',
    }));
  }, { passive: true });
}
