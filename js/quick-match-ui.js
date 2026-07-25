/** Gyors meccs belépési pontja, súgója és szünetképernyője a meglévő UI-rétegben. */

import { UI, el } from './ui.js';

const quickMatchPreviousShowOverlay = UI.prototype.showOverlay;

function enhanceQuickMatchMenu(node, ui) {
  if (!node?.classList?.contains('menu-panel')) return;
  const actions = node.querySelector('.primary-mode-actions');
  if (!actions || actions.querySelector('#quick-match-btn')) return;

  const button = el('button', 'btn mode-start mode-start--quick-match');
  button.id = 'quick-match-btn';
  button.type = 'button';
  button.append(
    el('span', null, '⚡ Gyors meccs'),
    el('small', null, 'Válassz klubot vagy legalább 7 kártyás válogatottat'),
  );
  button.addEventListener('click', () => {
    const open = globalThis.__FOCISKARTYAK_SHOW_QUICK_MATCH__;
    if (typeof open === 'function') open();
    else ui.showToast?.('A Gyors meccs még nem tölthető be.', 'error', 3200);
  });
  actions.appendChild(button);
}

function enhanceQuickMatchRules(node) {
  if (!node?.classList?.contains('rules-panel') || node.querySelector('[data-rules="quick-match"]')) return;
  const classic = node.querySelector('[data-rules="classic"]');
  if (!classic) return;
  const section = el('section', 'rule-card');
  section.dataset.rules = 'quick-match';
  section.innerHTML = `
    <h2>⚡ Gyors meccs</h2>
    <p>Válassz klubot vagy legalább hét valós játékoskártyával rendelkező válogatottat. A gép ugyanabból a kategóriából sorsol eltérő ellenfelet, majd 7–7 csapatkártyával indul a Klasszikus játékmenet.</p>
  `;
  classic.after(section);
}

function enhanceQuickMatchOnboarding(node) {
  const description = node?.querySelector?.('.onboarding-slide p');
  if (!description || !description.textContent.includes('Klasszikus mód')) return;
  description.textContent = 'A Klasszikus mód hosszabb kártyameccs, a Büntetőpárbaj 11 lapos kihívás, a Gyors meccs pedig klub- vagy válogatottal játszható csapatpárharc.';
}

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

UI.prototype.showOverlay = function showOverlayWithQuickMatchEntry(node) {
  enhanceQuickMatchMenu(node, this);
  enhanceQuickMatchRules(node);
  enhanceQuickMatchOnboarding(node);
  return quickMatchPreviousShowOverlay.call(this, node);
};
