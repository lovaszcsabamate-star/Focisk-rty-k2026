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

  function enhance(root = document) {
    localiseText(root);
    ensureTitleNotice(root);
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
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
