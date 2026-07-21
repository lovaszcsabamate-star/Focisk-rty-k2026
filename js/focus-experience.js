/** Focused duel and card-selection presentation layer. */

const initialiseFocusExperience = () => {
  const pub = document.querySelector('#pub');
  const duel = document.querySelector('#duel');
  const playerHand = document.querySelector('#player-hand');
  const playerZone = document.querySelector('#player-zone');
  const overlay = document.querySelector('#overlay');

  if (!pub || !duel || !playerHand || !playerZone) return;

  let syncQueued = false;
  let transitionTimer = 0;
  let transitionTarget = null;
  let disposed = false;

  const setClass = (node, className, enabled) => {
    if (node.classList.contains(className) === enabled) return;
    node.classList.toggle(className, enabled);
  };

  const setAttributeIfChanged = (node, name, value) => {
    if (node.getAttribute(name) === value) return;
    node.setAttribute(name, value);
  };

  const cancelTransition = () => {
    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = 0;
    transitionTarget = null;
    pub.classList.remove('is-battle-transition');
    document.querySelector('#inspector')?.classList.remove('is-battle-transition');
  };

  const transitionStillValid = (target, { inspector = false } = {}) => {
    if (disposed || !target?.isConnected) return false;
    if (overlay && !overlay.hidden) return false;
    if (pub.classList.contains('is-processing')) return false;
    if (target.getAttribute('aria-disabled') === 'true' || target.disabled) return false;
    if (inspector) return Boolean(document.querySelector('#inspector')?.contains(target));
    return playerHand.contains(target)
      && target.classList.contains('card--choice')
      && target.classList.contains('card--direct-play');
  };

  const scheduleCommittedAction = (target, action, options = {}) => {
    cancelTransition();
    transitionTarget = target;
    transitionTimer = window.setTimeout(() => {
      transitionTimer = 0;
      const currentTarget = transitionTarget;
      transitionTarget = null;
      if (!transitionStillValid(currentTarget, options)) {
        cancelTransition();
        return;
      }
      action(currentTarget);
    }, 250);
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
    card.dataset.gameAction = 'play-card';

    const choiceIndex = String(index);
    if (card.style.getPropertyValue('--choice-index') !== choiceIndex) card.style.setProperty('--choice-index', choiceIndex);

    const animationDelay = `${Math.min(index, 8) * 24}ms`;
    if (card.style.animationDelay !== animationDelay) card.style.animationDelay = animationDelay;

    setAttributeIfChanged(card, 'role', 'button');
    setAttributeIfChanged(card, 'tabindex', '0');
    setAttributeIfChanged(card, 'aria-pressed', String(card.classList.contains('is-selected')));
    setAttributeIfChanged(card, 'aria-label', `${card.querySelector('.card__name')?.textContent || 'Játékoskártya'} kiválasztása`);

    if (card.dataset.choiceKeyboardBound === 'true') return;
    card.dataset.choiceKeyboardBound = 'true';
    card.addEventListener('keydown', event => {
      if (!card.classList.contains('card--choice') || card.getAttribute('aria-disabled') === 'true') return;
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
    card.removeAttribute('data-game-action');
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
      const playableCards = [...playerHand.querySelectorAll('.card.selectable:not(.card--dim):not(.card--unavailable)')];
      const selectionActive = playableCards.length > 0 && !battleActive && (overlay?.hidden ?? true);

      if (!selectionActive && transitionTimer) cancelTransition();
      setClass(pub, 'is-battle-active', battleActive);
      setClass(pub, 'is-duel-focus', battleActive);
      setClass(pub, 'is-card-selection', selectionActive);
      setClass(playerHand, 'hand--selection', selectionActive);
      if (battleActive) pub.classList.remove('is-battle-transition');
      setAttributeIfChanged(playerZone, 'aria-busy', String(!selectionActive && pub.classList.contains('is-processing')));

      const playableSet = new Set(playableCards);
      [...playerHand.querySelectorAll('.card')].forEach((card, index) => {
        if (selectionActive && playableSet.has(card)) makeChoiceCardAccessible(card, index);
        else clearChoiceCardAccessibility(card);
      });

      if (selectionActive) {
        playerHand.dataset.selectionAnnounced = 'true';
        setAttributeIfChanged(playerHand, 'aria-label', 'Választható játékoskártyák. Húzd oldalra a sort, majd koppints egy lapra.');
      } else {
        delete playerHand.dataset.selectionAnnounced;
        playerHand.removeAttribute('aria-label');
      }
    } catch (error) {
      console.error('[focus-experience] A fókusznézet frissítése sikertelen:', error);
      cancelTransition();
      pub.classList.remove('is-duel-focus', 'is-battle-active', 'is-card-selection');
      playerHand.classList.remove('hand--selection');
    }
  };

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
    if (!card || !playerHand.contains(card) || card.getAttribute('aria-disabled') === 'true') return;
    markChoiceCardSelected(card);
  };

  const handleDirectChoicePlay = event => {
    const card = event.target.closest('#player-hand .card--choice.card--direct-play');
    if (!card || !playerHand.contains(card) || event.target.closest('.card__inspect')) return;
    if (card.dataset.battleTransitionBypass === 'true') {
      delete card.dataset.battleTransitionBypass;
      return;
    }
    if (card.getAttribute('aria-disabled') === 'true' || card.disabled) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    markChoiceCardSelected(card);
    void playerZone.offsetWidth;
    pub.classList.add('is-battle-transition');
    scheduleCommittedAction(card, current => {
      current.dataset.battleTransitionBypass = 'true';
      current.click();
    });
  };

  const handleCommittedPlay = event => {
    const button = event.target.closest('#inspector .inspector__actions .btn:not(.btn--ghost)');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    if (button.dataset.battleTransitionBypass === 'true') {
      delete button.dataset.battleTransitionBypass;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const inspector = document.querySelector('#inspector');
    const inspectedId = inspector?.querySelector('.card')?.dataset.cardId;
    const sourceCard = [...playerHand.querySelectorAll('.card--choice')].find(card => card.dataset.cardId === inspectedId);
    if (sourceCard) markChoiceCardSelected(sourceCard);

    void playerZone.offsetWidth;
    inspector?.classList.add('is-battle-transition');
    pub.classList.add('is-battle-transition');
    scheduleCommittedAction(button, current => {
      current.dataset.battleTransitionBypass = 'true';
      current.click();
    }, { inspector: true });
  };

  const handleCommittedPlayKey = event => {
    if (event.key !== 'Enter' || event.target.closest('button, input, textarea, select')) return;
    const button = document.querySelector('#inspector .inspector__actions .btn:not(.btn--ghost)');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    button.click();
  };

  const observer = new MutationObserver(scheduleSync);
  observer.observe(pub, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-disabled'] });
  if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });

  playerHand.addEventListener('pointerdown', handleChoicePointerDown, { passive: true });
  document.addEventListener('click', handleDirectChoicePlay, true);
  document.addEventListener('click', handleCommittedPlay, true);
  document.addEventListener('keydown', handleCommittedPlayKey, true);
  document.addEventListener('fociskartyak:interaction-invalidated', cancelTransition);
  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });

  window.addEventListener('pagehide', () => {
    disposed = true;
    observer.disconnect();
    playerHand.removeEventListener('pointerdown', handleChoicePointerDown);
    document.removeEventListener('click', handleDirectChoicePlay, true);
    document.removeEventListener('click', handleCommittedPlay, true);
    document.removeEventListener('keydown', handleCommittedPlayKey, true);
    document.removeEventListener('fociskartyak:interaction-invalidated', cancelTransition);
    cancelTransition();
  }, { once: true });

  syncFocusState();
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialiseFocusExperience, { once: true });
  else initialiseFocusExperience();
}
