/** Hungarian UI wording and unobtrusive independent-project notice. */

(() => {
  const NOTICE = 'A Fociskártyák 2026 független projekt. Nem áll hivatalos kapcsolatban a játékban megjelenített klubokkal, ligákkal vagy sportszövetségekkel.';
  const REPLACEMENTS = new Map([
    ['Penalties mód', 'Büntetőpárbaj'],
    ['Tizenegyes mód', 'Büntetőpárbaj'],
  ]);

  function localiseText(root) {
    if (!(root instanceof Node)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      const trimmed = textNode.nodeValue?.trim();
      if (REPLACEMENTS.has(trimmed)) {
        textNode.nodeValue = textNode.nodeValue.replace(trimmed, REPLACEMENTS.get(trimmed));
      }
      textNode = walker.nextNode();
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

  /* A nagyított kártya DOM-ja lapozáskor újraépül, a külön háttérréteg viszont
     végig megmarad. Lassú Android WebView-ban se engedjük, hogy egy későn
     érkező osztálymódosítás egy képkockára átlátszóvá tegye. */
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

  const start = () => {
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
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
