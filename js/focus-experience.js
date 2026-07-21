/** Focused duel and card-selection presentation layer. */

const initialiseFocusExperience = () => {
  const pub = document.querySelector('#pub');
  const duel = document.querySelector('#duel');
  const playerHand = document.querySelector('#player-hand');
  const playerZone = document.querySelector('#player-zone');

  if (!pub || !duel || !playerHand || !playerZone) return;

  let animationFrame = 0;
  let disposed = false;

  const setClass = (node, className, enabled) => {
    if (node.classList.contains(className) === enabled) return;
    node.classList.toggle(className, enabled);
  };

  const setAttributeIfChanged = (node, name, value) => {
    if (node.getAttribute(name) === value) return;
    node.setAttribute(name, value);
  };

  const makeChoiceCardAccessible = (card, index) => {
    setClass(card, 'card--choice', true);

    const choiceIndex = String(index);
    if (card.style.getPropertyValue('--choice-index') !== choiceIndex) {
      card.style.setProperty('--choice-index', choiceIndex);
    }

    const animationDelay = `${Math.min(index, 8) * 24}ms`;
    if (card.style.animationDelay !== animationDelay) card.style.animationDelay = animationDelay;

    setAttributeIfChanged(card, 'role', 'button');
    setAttributeIfChanged(card, 'tabindex', '0');
    setAttributeIfChanged(
      card,
      'aria-label',
      `${card.querySelector('.card__name')?.textContent || 'Játékoskártya'} kiválasztása`,
    );

    if (card.dataset.choiceKeyboardBound === 'true') return;
    card.dataset.choiceKeyboardBound = 'true';
    card.addEventListener('keydown', event => {
      if (!card.classList.contains('card--choice')) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      card.click();
    });
  };

  const clearChoiceCardAccessibility = card => {
    if (!card.classList.contains('card--choice') && !card.hasAttribute('tabindex')) return;
    setClass(card, 'card--choice', false);
    card.style.removeProperty('--choice-index');
    card.style.removeProperty('animation-delay');
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');
  };

  const syncFocusState = () => {
    if (disposed || !pub.isConnected) return;

    try {
      const duelCards = [...duel.querySelectorAll('.duel-slot .card')];
      const hasCompleteFaceUpDuel = duelCards.length >= 2
        && !duel.querySelector('.card--back, .card--empty');
      const playableCards = [...playerHand.querySelectorAll(
        '.card.selectable:not(.card--dim):not(.card--unavailable)',
      )];
      const selectionActive = playableCards.length > 0 && !hasCompleteFaceUpDuel;

      setClass(pub, 'is-duel-focus', hasCompleteFaceUpDuel);
      setClass(pub, 'is-card-selection', selectionActive);
      setClass(playerHand, 'hand--selection', selectionActive);
      setAttributeIfChanged(
        playerZone,
        'aria-busy',
        String(!selectionActive && pub.classList.contains('is-processing')),
      );

      const playableSet = new Set(playableCards);
      const allPlayerCards = [...playerHand.querySelectorAll('.card')];
      allPlayerCards.forEach((card, index) => {
        if (selectionActive && playableSet.has(card)) makeChoiceCardAccessible(card, index);
        else clearChoiceCardAccessibility(card);
      });

      if (selectionActive) {
        if (!playerHand.dataset.selectionAnnounced) playerHand.dataset.selectionAnnounced = 'true';
        setAttributeIfChanged(
          playerHand,
          'aria-label',
          'Választható játékoskártyák. Húzd oldalra a sort, majd koppints egy lapra.',
        );
      } else {
        delete playerHand.dataset.selectionAnnounced;
        playerHand.removeAttribute('aria-label');
      }
    } catch (error) {
      console.error('[focus-experience] A fókusznézet frissítése sikertelen:', error);
      pub.classList.remove('is-duel-focus', 'is-card-selection');
      playerHand.classList.remove('hand--selection');
    }
  };

  const scheduleSync = () => {
    if (disposed || animationFrame) return;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = 0;
      syncFocusState();
    });
  };

  // Only DOM insertions/removals matter here. Observing every class mutation caused
  // portrait loading and UI animations to trigger repeated full-hand scans on mobile.
  const observer = new MutationObserver(scheduleSync);
  observer.observe(pub, { childList: true, subtree: true });

  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });

  window.addEventListener('pagehide', () => {
    disposed = true;
    observer.disconnect();
    if (animationFrame) cancelAnimationFrame(animationFrame);
  }, { once: true });

  syncFocusState();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseFocusExperience, { once: true });
} else {
  initialiseFocusExperience();
}
