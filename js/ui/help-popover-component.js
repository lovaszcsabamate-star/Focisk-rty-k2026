/** Újrahasznosítható, akadálymentes súgó-popover és a Gyors meccs súgójának telepítése. */

let helpPopoverSequence = 0;

const helpPopoverFocusable = root => Array.from(root?.querySelectorAll?.(
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
) ?? []).filter(node => !node.hidden);

const helpPopoverContentForQuickMatch = body => {
  if (body?.dataset?.step === 'opponent') {
    return {
      title: 'Ellenfél kiválasztása',
      text: 'A gép az engedélyezett párosításokból választ ellenfelet. A „Másik ellenfelet kérek” gombbal új sorsolást kérhetsz, a „Meccs indítása” gombbal pedig elindíthatod a mérkőzést.',
    };
  }
  return {
    title: 'Csapatválasztás',
    text: 'A bal és jobb nyilakkal lapozhatsz a csapatok között. Válassz kategóriát, majd nyomd meg az „Ezzel a csapattal játszom” gombot. A „Véletlen csapat” lehetőséggel a játék automatikusan választ neked.',
  };
};

export function createHelpPopover({
  documentRef = globalThis.document ?? null,
  trigger,
  mountNode,
  getContent = () => ({ title: 'Súgó', text: '' }),
} = {}) {
  if (!documentRef || !trigger || !mountNode) return Object.freeze({ open() {}, close() {}, destroy() {} });

  helpPopoverSequence += 1;
  const idBase = `help-popover-${helpPopoverSequence}`;
  const titleId = `${idBase}-title`;
  const textId = `${idBase}-text`;
  const overlay = documentRef.createElement('div');
  overlay.className = 'help-popover';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');

  const panel = documentRef.createElement('section');
  panel.className = 'help-popover__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', titleId);
  panel.setAttribute('aria-describedby', textId);
  panel.tabIndex = -1;

  const header = documentRef.createElement('header');
  header.className = 'help-popover__header';
  const title = documentRef.createElement('h2');
  title.id = titleId;
  const closeButton = documentRef.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'help-popover__close';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Súgó bezárása');
  header.append(title, closeButton);

  const text = documentRef.createElement('p');
  text.id = textId;
  text.className = 'help-popover__text';
  panel.append(header, text);
  overlay.appendChild(panel);
  mountNode.appendChild(overlay);

  let previouslyFocused = null;
  let open = false;

  const close = ({ restoreFocus = true } = {}) => {
    if (!open) return;
    open = false;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) (previouslyFocused?.isConnected ? previouslyFocused : trigger).focus?.({ preventScroll: true });
  };

  const openPopover = () => {
    const content = getContent() ?? {};
    title.textContent = String(content.title || 'Súgó');
    text.textContent = String(content.text || '');
    previouslyFocused = documentRef.activeElement;
    open = true;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    closeButton.focus?.({ preventScroll: true });
  };

  const toggle = () => {
    if (open) close();
    else openPopover();
  };

  const handleOverlayClick = event => {
    if (event.target === overlay) close();
  };

  const handleKeydown = event => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = helpPopoverFocusable(panel);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus?.();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && documentRef.activeElement === first) {
      event.preventDefault();
      last.focus?.();
    } else if (!event.shiftKey && documentRef.activeElement === last) {
      event.preventDefault();
      first.focus?.();
    }
  };

  trigger.setAttribute('aria-controls', idBase);
  trigger.setAttribute('aria-expanded', 'false');
  overlay.id = idBase;
  trigger.addEventListener('click', toggle);
  closeButton.addEventListener('click', () => close());
  overlay.addEventListener('click', handleOverlayClick);
  overlay.addEventListener('keydown', handleKeydown);

  return Object.freeze({
    open: openPopover,
    close,
    destroy() {
      close({ restoreFocus: false });
      trigger.removeEventListener('click', toggle);
      overlay.removeEventListener('click', handleOverlayClick);
      overlay.removeEventListener('keydown', handleKeydown);
      overlay.remove();
    },
  });
}

const enhanceQuickMatchHelp = (documentRef, body) => {
  const headingCopy = body.querySelector?.('.deck-selector__heading-copy');
  const heading = headingCopy?.querySelector?.('h1');
  const lead = headingCopy?.querySelector?.('.deck-selector__lead');
  if (!headingCopy || !heading || !lead || headingCopy.dataset.helpPopoverEnhanced === 'true') return null;

  const originalParent = heading.parentNode;
  const originalNextSibling = heading.nextSibling;
  if (!originalParent) return null;

  headingCopy.dataset.helpPopoverEnhanced = 'true';
  headingCopy.classList.add('has-help-popover');
  lead.setAttribute('aria-hidden', 'true');

  const titleRow = documentRef.createElement('div');
  titleRow.className = 'deck-selector__title-row';
  const trigger = documentRef.createElement('button');
  trigger.type = 'button';
  trigger.className = 'deck-selector__help-button';
  trigger.textContent = '?';
  trigger.setAttribute('aria-label', 'Csapatválasztási súgó megnyitása');
  originalParent.insertBefore(titleRow, heading);
  titleRow.append(heading, trigger);

  const popover = createHelpPopover({
    documentRef,
    trigger,
    mountNode: body,
    getContent: () => helpPopoverContentForQuickMatch(body),
  });

  const selector = body.closest?.('.deck-selector');
  const handleSelectorToggle = () => {
    if (!selector?.open) popover.close({ restoreFocus: false });
  };
  selector?.addEventListener?.('toggle', handleSelectorToggle);

  return () => {
    selector?.removeEventListener?.('toggle', handleSelectorToggle);
    popover.destroy();
    if (titleRow.isConnected) {
      if (originalParent.isConnected) {
        const anchor = originalNextSibling?.parentNode === originalParent ? originalNextSibling : null;
        originalParent.insertBefore(heading, anchor);
      } else if (headingCopy.isConnected) {
        const anchor = lead.parentNode === headingCopy ? lead : null;
        headingCopy.insertBefore(heading, anchor);
      }
      titleRow.remove();
    }
    lead.removeAttribute('aria-hidden');
    headingCopy.classList.remove('has-help-popover');
    delete headingCopy.dataset.helpPopoverEnhanced;
  };
};

export function installHelpPopovers({
  documentRef = globalThis.document ?? null,
  observerFactory = callback => {
    const Observer = globalThis.MutationObserver;
    return typeof Observer === 'function' ? new Observer(callback) : null;
  },
} = {}) {
  if (!documentRef) return () => {};

  const cleanups = new Map();
  let observer = null;
  let started = false;
  let disposed = false;

  const enhance = () => {
    const bodies = documentRef.querySelectorAll?.('.deck-selector__body') ?? [];
    bodies.forEach(body => {
      if (cleanups.has(body)) return;
      const cleanup = enhanceQuickMatchHelp(documentRef, body);
      if (typeof cleanup === 'function') cleanups.set(body, cleanup);
    });
    cleanups.forEach((cleanup, body) => {
      if (body.isConnected) return;
      cleanup();
      cleanups.delete(body);
    });
  };

  const start = () => {
    if (started || disposed) return;
    started = true;
    enhance();
    observer = observerFactory(enhance);
    observer?.observe?.(documentRef.body, { childList: true, subtree: true });
  };

  if (documentRef.readyState === 'loading') documentRef.addEventListener?.('DOMContentLoaded', start, { once: true });
  else start();

  return () => {
    if (disposed) return;
    disposed = true;
    documentRef.removeEventListener?.('DOMContentLoaded', start);
    observer?.disconnect?.();
    cleanups.forEach(cleanup => cleanup());
    cleanups.clear();
  };
}

if (globalThis.document) installHelpPopovers();
