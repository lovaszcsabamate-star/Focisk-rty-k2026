/** Gyors meccs belépési pontja a meglévő főmenü és súgó UI-rétegében. */

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

UI.prototype.showOverlay = function showOverlayWithQuickMatchEntry(node) {
  enhanceQuickMatchMenu(node, this);
  enhanceQuickMatchRules(node);
  enhanceQuickMatchOnboarding(node);
  return quickMatchPreviousShowOverlay.call(this, node);
};
