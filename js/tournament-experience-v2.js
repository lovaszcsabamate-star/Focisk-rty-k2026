/** Fociskártyák 2026 – Torna mód v2 élményréteg. */
import { installTournamentExperienceV2 } from './tournament/tournament-experience-v2-runtime.js';
import { installCupSelectorV3 } from './tournament/tournament-cup-selector-v3.js';

if (!document.getElementById('tournament-experience-v2-compat-style')) {
  const style = document.createElement('style');
  style.id = 'tournament-experience-v2-compat-style';
  style.textContent = `
    .menu-panel[data-tournament-experience-v2="true"] .tournament-continue-button{display:none!important}
    @media(max-width:520px){
      .tournament-center[data-experience-v2="true"] .tournament-table th:nth-child(4),
      .tournament-center[data-experience-v2="true"] .tournament-table td:nth-child(4),
      .tournament-center[data-experience-v2="true"] .tournament-table th:nth-child(5),
      .tournament-center[data-experience-v2="true"] .tournament-table td:nth-child(5),
      .tournament-center[data-experience-v2="true"] .tournament-table th:nth-child(6),
      .tournament-center[data-experience-v2="true"] .tournament-table td:nth-child(6),
      .tournament-center[data-experience-v2="true"] .tournament-table th:nth-child(7),
      .tournament-center[data-experience-v2="true"] .tournament-table td:nth-child(7){display:none}
    }
  `;
  document.head.appendChild(style);
}

const swipeEnhanced = new WeakSet();
function addHorizontalSwipe(node, onPrevious, onNext) {
  if (!node || swipeEnhanced.has(node)) return;
  swipeEnhanced.add(node);
  let startX = null;
  node.addEventListener('touchstart', event => {
    startX = event.touches?.[0]?.clientX ?? null;
  }, { passive: true });
  node.addEventListener('touchend', event => {
    if (startX === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? startX;
    const delta = endX - startX;
    startX = null;
    if (Math.abs(delta) < 42) return;
    if (delta > 0) onPrevious(); else onNext();
  }, { passive: true });
}

function enhanceTournamentSwipes() {
  document.querySelectorAll('.tx-team-carousel').forEach(carousel => {
    addHorizontalSwipe(
      carousel,
      () => carousel.querySelector('[data-team-prev]')?.click?.(),
      () => carousel.querySelector('[data-team-next]')?.click?.(),
    );
  });
  document.querySelectorAll('.tournament-center[data-experience-v2="true"] .tournament-bracket').forEach(bracket => {
    addHorizontalSwipe(bracket, () => {
      const buttons = [...bracket.previousElementSibling?.querySelectorAll?.('button') ?? []];
      const active = Math.max(0, buttons.findIndex(button => button.classList.contains('is-active')));
      buttons[Math.max(0, active - 1)]?.click?.();
    }, () => {
      const buttons = [...bracket.previousElementSibling?.querySelectorAll?.('button') ?? []];
      const active = Math.max(0, buttons.findIndex(button => button.classList.contains('is-active')));
      buttons[Math.min(buttons.length - 1, active + 1)]?.click?.();
    });
  });
}

const swipeObserver = new MutationObserver(enhanceTournamentSwipes);
swipeObserver.observe(document.documentElement, { childList: true, subtree: true });
enhanceTournamentSwipes();

installTournamentExperienceV2();
installCupSelectorV3();
export { installTournamentExperienceV2, installCupSelectorV3 };
