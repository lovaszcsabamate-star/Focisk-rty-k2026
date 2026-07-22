from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'js/visual-system.js'
text = path.read_text(encoding='utf-8')
old = """    const observer = new MutationObserver(mutations => {
      ensureAppearanceButton();
      ensureIndependentNotice();
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches('.card')) enhanceCard(node);
          node.querySelectorAll?.('.card').forEach(enhanceCard);
        });
        if (mutation.target instanceof Element
          && (mutation.target.id === 'verdict' || mutation.target.id === 'duel')) updateResultEffects();
      }
      enhanceInterface();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.documentElement.dataset.visualSystem = 'ready';"""
new = """    const cardRoot = document.querySelector('#table') ?? document.body;
    const cardObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches('.card')) enhanceCard(node);
          node.querySelectorAll?.('.card').forEach(enhanceCard);
        });
      }
    });
    cardObserver.observe(cardRoot, { childList: true, subtree: true });

    [document.querySelector('#verdict'), document.querySelector('#duel')]
      .filter(Boolean)
      .forEach(target => {
        const resultObserver = new MutationObserver(() => {
          enhanceInterface(target);
          updateResultEffects();
        });
        resultObserver.observe(target, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['class'],
        });
      });

    document.documentElement.dataset.visualSystem = 'ready';"""
if old not in text:
    raise SystemExit('A teljes dokumentumos vizuális MutationObserver blokk nem található.')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('A vizuális rendszer célzott megfigyelőket használ.')
