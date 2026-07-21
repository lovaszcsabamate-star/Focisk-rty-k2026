/** Focused duel and card-selection presentation layer. */

const initialiseFocusExperience = () => {
  const pub = document.querySelector('#pub');
  const duel = document.querySelector('#duel');
  const playerHand = document.querySelector('#player-hand');
  const playerZone = document.querySelector('#player-zone');

  if (!pub || !duel || !playerHand || !playerZone) return;

  let syncQueued = false;
  let transitionTimer = 0;
  let disposed = false;

  const setClass = (node, className, enabled) => {
    if (node.classList.contains(className) === enabled) return;
    node.classList.toggle(className, enabled);
  };

  const setAttributeIfChanged = (node, name, value) => {
    if (node.getAttribute(name) === value) return;
    node.setAttribute(name, value);
  };

  const markChoiceCardSelected = card => {
    if (!card?.classList.contains('card--choice')) return;
    for (const choice of playerHand.querySelectorAll('.card--choice')) {
      const selected = choice === card;
      setClass(choice, 'is-selected', selected);
      setAttributeIfChanged(choice, 'aria-pressed', String(selected));
    }
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
    setAttributeIfChanged(card, 'aria-pressed', String(card.classList.contains('is-selected')));
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
      markChoiceCardSelected(card);
      card.click();
    });
  };

  const clearChoiceCardAccessibility = card => {
    if (!card.classList.contains('card--choice') && !card.hasAttribute('tabindex')) return;
    card.classList.remove('card--choice', 'is-selected');
    card.style.removeProperty('--choice-index');
    card.style.removeProperty('animation-delay');
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');
    card.removeAttribute('aria-pressed');
  };

  const syncFocusState = () => {
    if (disposed || !pub.isConnected) return;

    try {
      const humanDuelCard = duel.querySelector('.duel-slot:first-child .card');
      const battleActive = Boolean(
        humanDuelCard
        && !humanDuelCard.classList.contains('card--empty')
        && !humanDuelCard.classList.contains('card--back'),
      );
      const playableCards = [...playerHand.querySelectorAll(
        '.card.selectable:not(.card--dim):not(.card--unavailable)',
      )];
      const selectionActive = playableCards.length > 0 && !battleActive;

      setClass(pub, 'is-battle-active', battleActive);
      setClass(pub, 'is-duel-focus', battleActive);
      setClass(pub, 'is-card-selection', selectionActive);
      setClass(playerHand, 'hand--selection', selectionActive);
      if (battleActive) pub.classList.remove('is-battle-transition');
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
      pub.classList.remove('is-duel-focus', 'is-battle-active', 'is-battle-transition', 'is-card-selection');
      playerHand.classList.remove('hand--selection');
    }
  };

  /* MutationObserver callbacks already run in a microtask. Keeping the refresh
     in the same microtask queue makes the phase class deterministic in embedded
     WebViews and headless mobile tests where requestAnimationFrame may pause. */
  const scheduleSync = () => {
    if (disposed || syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      syncFocusState();
    });
  };

  const handleChoicePointerDown = event => {
    const card = event.target.closest('.card--choice');
    if (!card || !playerHand.contains(card)) return;
    markChoiceCardSelected(card);
  };

  const handleCommittedPlay = event => {
    const button = event.target.closest('#inspector .inspector__actions .btn:not(.btn--ghost)');
    if (!button || button.disabled) return;
    if (button.dataset.battleTransitionBypass === 'true') {
      delete button.dataset.battleTransitionBypass;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const inspector = document.querySelector('#inspector');
    const inspectedId = inspector?.querySelector('.card')?.dataset.cardId;
    const sourceCard = [...playerHand.querySelectorAll('.card--choice')]
      .find(card => card.dataset.cardId === inspectedId);
    if (sourceCard) markChoiceCardSelected(sourceCard);

    /* Flush the pre-transition state, then fade the inspector and both hand
       zones together. The actual game action fires only after 250 ms. */
    void playerZone.offsetWidth;
    inspector?.classList.add('is-battle-transition');
    pub.classList.add('is-battle-transition');
    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      transitionTimer = 0;
      if (!button.isConnected) {
        pub.classList.remove('is-battle-transition');
        return;
      }
      button.dataset.battleTransitionBypass = 'true';
      button.click();
    }, 250);
  };

  const handleCommittedPlayKey = event => {
    if (event.key !== 'Enter' || event.target.closest('button, input, textarea, select')) return;
    const button = document.querySelector('#inspector .inspector__actions .btn:not(.btn--ghost)');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    button.click();
  };

  const observer = new MutationObserver(scheduleSync);
  observer.observe(pub, { childList: true, subtree: true });

  playerHand.addEventListener('pointerdown', handleChoicePointerDown, { passive: true });
  document.addEventListener('click', handleCommittedPlay, true);
  document.addEventListener('keydown', handleCommittedPlayKey, true);
  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });

  window.addEventListener('pagehide', () => {
    disposed = true;
    observer.disconnect();
    playerHand.removeEventListener('pointerdown', handleChoicePointerDown);
    document.removeEventListener('click', handleCommittedPlay, true);
    document.removeEventListener('keydown', handleCommittedPlayKey, true);
    if (transitionTimer) clearTimeout(transitionTimer);
  }, { once: true });

  syncFocusState();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseFocusExperience, { once: true });
} else {
  initialiseFocusExperience();
}
