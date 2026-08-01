/** Fociskártyák 2026 – Torna mód v2 élményréteg. */
import { installTournamentExperienceV2 } from './tournament/tournament-experience-v2-runtime.js';

if (!document.getElementById('tournament-experience-v2-compat-style')) {
  const style = document.createElement('style');
  style.id = 'tournament-experience-v2-compat-style';
  style.textContent = '.menu-panel[data-tournament-experience-v2="true"] .tournament-continue-button{display:none!important}';
  document.head.appendChild(style);
}

installTournamentExperienceV2();
export { installTournamentExperienceV2 };
