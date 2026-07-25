/** Gyors meccshez tartozó szünetképernyő, a Session DOM-logikája nélkül. */

import { el } from '../ui.js';

export class QuickMatchPauseControllerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QuickMatchPauseControllerError';
    this.code = code;
  }
}

const quickPauseRequiredActions = Object.freeze([
  'showPanel',
  'hidePanel',
  'rematch',
  'chooseAnotherTeam',
  'showTitleScreen',
]);

const quickPauseAssertMethod = (target, method, code) => {
  if (typeof target?.[method] !== 'function') {
    throw new QuickMatchPauseControllerError(code, `A Gyors meccs szünetvezérlőből hiányzik a(z) ${method} művelet.`);
  }
};

export function createQuickMatchPauseController({
  getState,
  actions,
  elementFactory = el,
} = {}) {
  if (typeof getState !== 'function') {
    throw new QuickMatchPauseControllerError('INVALID_STATE_ADAPTER', 'A szünetvezérlő állapotadaptere kötelező.');
  }
  quickPauseRequiredActions.forEach(method => quickPauseAssertMethod(actions, method, 'INVALID_ACTIONS'));
  if (typeof elementFactory !== 'function') {
    throw new QuickMatchPauseControllerError('INVALID_ELEMENT_FACTORY', 'A szünetvezérlő elemgyártó függvénye kötelező.');
  }

  const showPauseMenu = () => {
    const context = getState()?.matchContext;
    const ownName = context?.playerTeam?.name ?? 'Saját csapat';
    const opponentName = context?.opponentTeam?.name ?? 'Gép csapata';
    const panel = elementFactory('div', 'pause-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">A játék szünetel</p>
      <h1>Gyors meccs</h1>
      <p>${ownName} – ${opponentName}</p>
      <div class="pause-actions">
        <button class="btn" id="quick-pause-resume" type="button">▶ Játék folytatása</button>
        <button class="btn btn--ghost" id="quick-pause-restart" type="button">↻ Újrakezdés</button>
        <button class="btn btn--ghost" id="quick-pause-team" type="button">⚽ Másik csapat</button>
        <button class="btn btn--ghost" id="quick-pause-home" type="button">⌂ Vissza a főmenübe</button>
      </div>
    `;
    const resume = () => actions.hidePanel();
    panel.querySelector('#quick-pause-resume').addEventListener('click', resume, { once: true });
    panel.querySelector('#quick-pause-restart').addEventListener('click', () => actions.rematch(), { once: true });
    panel.querySelector('#quick-pause-team').addEventListener('click', () => actions.chooseAnotherTeam(), { once: true });
    panel.querySelector('#quick-pause-home').addEventListener('click', () => actions.showTitleScreen({ offerOnboarding: false }), { once: true });
    actions.showPanel(panel, resume);
    return panel;
  };

  return Object.freeze({ showPauseMenu });
}
