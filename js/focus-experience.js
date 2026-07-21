/** Focused duel and card-selection presentation layer. */

const initialiseFocusExperience = () => {
  const pub = document.querySelector('#pub');
  const duel = document.querySelector('#duel');
  const playerHand = document.querySelector('#player-hand');
  const playerZone = document.querySelector('#player-zone');

  if (!pub || !duel || !playerHand || !playerZone) return;

  const makeChoiceCardAccessible = (card, index) => {
    card.classList.add('card--choice');
    card.style.setProperty('--choice-index', String(index));
    card.style.animationDelay = `${Math.min(index, 8) * 24}ms`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${card.querySelector('.card__name')?.textContent || 'Játékoskártya'} kiválasztása`);

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
    card.classList.remove('card--choice');
    card.style.removeProperty('--choice-index');
    card.style.removeProperty('animation-delay');
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');
  };

  const syncFocusState = () => {
    const duelCards = [...duel.querySelectorAll('.duel-slot .card')];
    const hasCompleteFaceUpDuel = duelCards.length >= 2
      && !duel.querySelector('.card--back, .card--empty');
    const playableCards = [...playerHand.querySelectorAll(
      '.card.selectable:not(.card--dim):not(.card--unavailable)',
    )];
    const selectionActive = playableCards.length > 0 && !hasCompleteFaceUpDuel;

    pub.classList.toggle('is-duel-focus', hasCompleteFaceUpDuel);
    pub.classList.toggle('is-card-selection', selectionActive);
    playerHand.classList.toggle('hand--selection', selectionActive);
    playerZone.setAttribute('aria-busy', String(!selectionActive && pub.classList.contains('is-processing')));

    const playableSet = new Set(playableCards);
    const allPlayerCards = [...playerHand.querySelectorAll('.card')];
    allPlayerCards.forEach((card, index) => {
      if (selectionActive && playableSet.has(card)) makeChoiceCardAccessible(card, index);
      else clearChoiceCardAccessibility(card);
    });

    if (selectionActive && !playerHand.dataset.selectionAnnounced) {
      playerHand.dataset.selectionAnnounced = 'true';
      playerHand.setAttribute('aria-label', 'Választható játékoskártyák. Húzd oldalra a sort, majd koppints egy lapra.');
    } else if (!selectionActive) {
      delete playerHand.dataset.selectionAnnounced;
      playerHand.removeAttribute('aria-label');
    }
  };

  const observer = new MutationObserver(syncFocusState);
  observer.observe(pub, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  window.addEventListener('resize', syncFocusState, { passive: true });
  syncFocusState();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseFocusExperience, { once: true });
} else {
  initialiseFocusExperience();
}
