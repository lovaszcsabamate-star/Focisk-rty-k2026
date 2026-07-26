/** Independent-project notice and legal UI safeguards. */

(() => {
  const NOTICE = 'A Fociskártyák 2026 független projekt. Nem áll hivatalos kapcsolatban a játékban megjelenített klubokkal, ligákkal vagy sportszövetségekkel.';

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
    ensureTitleNotice(root);
    preserveInspectorBackdrop();
  }

  function start() {
    enhance(document);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) enhance(node);
        });
      }
      preserveInspectorBackdrop();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
