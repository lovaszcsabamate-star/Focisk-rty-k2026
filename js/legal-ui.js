/** Hungarian wording, independent-project notice and legal UI safeguards. */

(() => {
  const NOTICE = 'A Fociskártyák 2026 független projekt. Nem áll hivatalos kapcsolatban a játékban megjelenített klubokkal, ligákkal vagy sportszövetségekkel.';
  const REPLACEMENTS = new Map([
    ['Penalties mód', 'Büntetőpárbaj'],
    ['Tizenegyes mód', 'Büntetőpárbaj'],
  ]);

  function localiseText(root) {
    if (!(root instanceof Node)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const replacement = REPLACEMENTS.get(node.nodeValue?.trim());
      if (replacement) node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), replacement);
    }
  }

  function ensureTitleNotice(root = document) {
    const panel = root.matches?.('.mobile-home') ? root : root.querySelector?.('.mobile-home');
    if (!panel || panel.querySelector('.menu-independent-project-note')) return;
    const notice = document.createElement('p');
    notice.className = 'menu-independent-project-note';
    notice.textContent = NOTICE;
    panel.appendChild(notice);
  }

  function preserveInspectorBackdrop() {
    const inspector = document.querySelector('#inspector');
    const backdrop = document.querySelector('#inspector-stable-backdrop');
    if (inspector && backdrop && !backdrop.classList.contains('is-visible')) {
      backdrop.classList.add('is-visible');
    }
  }

  function enhance(root = document) {
    localiseText(root);
    ensureTitleNotice(root);
    preserveInspectorBackdrop();
  }

  function start() {
    enhance(document);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) enhance(node);
          else if (node instanceof Text) localiseText(node.parentNode);
        });
      }
      preserveInspectorBackdrop();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
