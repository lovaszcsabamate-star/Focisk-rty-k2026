/** Torna menü-, központ-, forduló- és lezárásélmény. */

import {
  EXPERIENCE_VERSION, TOURNAMENT_FORMAT, TOURNAMENT_STATUS, escapeHtml, fold, presetFor,
  trophyMarkup, tournamentNextHumanMatch, tournamentRoundForMatch,
  tournamentTeamById, tournamentProgress, tournamentStorageService,
  ensureExperienceStyle,
} from './tournament-experience-v2-shared.js';
import { showExperienceWizard } from './tournament-experience-v2-wizard.js';

function describeResume(state) {
  const next = tournamentNextHumanMatch(state);
  const round = next ? tournamentRoundForMatch(state, next.id) : null;
  const opponentId = next ? (next.homeId === state.humanTeamId ? next.awayId : next.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId);
  return {
    stage: round?.label || state.phase || 'Következő forduló',
    opponent: opponent?.label || '',
    progress: tournamentProgress(state),
  };
}

function patchMenu(panel) {
  if (!panel) return;
  panel.dataset.tournamentExperienceV2 = 'true';
  const button = panel.querySelector('#tournament-mode-btn');
  if (!button) return;
  const stored = tournamentStorageService.read();
  const resume = stored?.status === TOURNAMENT_STATUS.ACTIVE ? describeResume(stored) : null;
  const stateKey = resume
    ? `active:${stored.id}:${stored.updatedAt ?? ''}:${resume.stage}:${resume.opponent}`
    : 'new';
  if (button.dataset.experienceV2 === 'true' && button.dataset.experienceState === stateKey) return;

  const replacement = button.cloneNode(true);
  replacement.dataset.experienceV2 = 'true';
  replacement.dataset.experienceState = stateKey;
  button.replaceWith(replacement);
  panel.querySelector('.tournament-new-button-v2')?.remove();

  if (resume) {
    replacement.innerHTML = `<span>▶ Torna folytatása</span><small>${escapeHtml(stored.name)} · ${escapeHtml(resume.stage)}${resume.opponent ? ` · Következő: ${escapeHtml(resume.opponent)}` : ''}</small>`;
    replacement.addEventListener('click', () => globalThis.FociskartyakTournament?.showCenter?.(tournamentStorageService.read() ?? stored, panel));
    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.className = 'btn btn--ghost tournament-new-button-v2';
    newButton.textContent = '＋ Új torna';
    newButton.addEventListener('click', () => showExperienceWizard(panel, null, 'type'));
    replacement.after(newButton);
  } else {
    replacement.innerHTML = '<span>🏆 Új torna</span><small>Magyarország, nemzetközi vagy saját kupa</small>';
    replacement.addEventListener('click', () => showExperienceWizard(panel, null, 'type'));
  }
}

function stateTrophy(state) {
  return state?.configuration?.trophy ?? {
    style: presetFor(state?.tournamentType).trophyStyle,
    accent: presetFor(state?.tournamentType).trophyAccent,
    pattern: presetFor(state?.tournamentType).trophyPattern,
  };
}

function enhanceBracket(center) {
  const bracket = center?.querySelector('.tournament-bracket');
  if (!bracket || bracket.dataset.experienceV2 === 'true') return;
  bracket.dataset.experienceV2 = 'true';
  const rounds = [...bracket.querySelectorAll('.tournament-bracket__round')];
  if (!rounds.length) return;
  const nav = document.createElement('nav');
  nav.className = 'tx-bracket-round-nav';
  nav.setAttribute('aria-label', 'Fordulóválasztó');
  const selectRound = index => {
    rounds.forEach((round, roundIndex) => round.classList.toggle('is-mobile-active', roundIndex === index));
    [...nav.querySelectorAll('button')].forEach((button, buttonIndex) => {
      button.classList.toggle('is-active', buttonIndex === index);
      button.setAttribute('aria-selected', buttonIndex === index ? 'true' : 'false');
    });
    rounds[index]?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };
  rounds.forEach((round, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = round.querySelector('h3')?.textContent?.trim() || `${index + 1}. forduló`;
    button.addEventListener('click', () => selectRound(index));
    nav.appendChild(button);
  });
  bracket.before(nav);
  selectRound(Math.max(0, rounds.findIndex(round => round.querySelector('.is-human'))));
}

function simplifyCenterOverview(center) {
  const overview = center.querySelector('[data-content="overview"]');
  if (!overview || overview.dataset.experienceV2 === 'true') return;
  overview.dataset.experienceV2 = 'true';
  const selected = overview.querySelector('.tournament-selected-team');
  const heading = overview.querySelector('h2');
  if (heading) heading.textContent = 'Saját csapat állapota';
  overview.querySelectorAll('.tournament-results-list,.tournament-empty').forEach(node => node.remove());
  if (!selected) overview.innerHTML = '<p class="tournament-empty">A következő mérkőzés fent látható.</p>';
}

function enhanceCenter(center) {
  if (!center || center.dataset.experienceV2 === 'true') return;
  const state = tournamentStorageService.read();
  if (!state || state.status !== TOURNAMENT_STATUS.ACTIVE) return;
  center.dataset.experienceV2 = 'true';
  const next = tournamentNextHumanMatch(state);
  const round = next ? tournamentRoundForMatch(state, next.id) : null;
  const progress = tournamentProgress(state);
  const human = tournamentTeamById(state, state.humanTeamId);
  const trophy = stateTrophy(state);
  const status = document.createElement('section');
  status.className = 'tx-center-status';
  status.innerHTML = `${trophyMarkup(trophy, true)}<div><small>${escapeHtml(state.tournamentType === 'custom' ? 'Saját kupa' : presetFor(state.tournamentType).title)}</small><strong>${escapeHtml(state.name)}</strong><span>${escapeHtml(round?.label || state.phase || 'Aktív torna')} · ${escapeHtml(human?.label || '')}</span></div><div class="tx-center-progress"><b>${progress.percent}%</b><span>${progress.completed} mérkőzés kész</span></div>`;
  center.prepend(status);

  const tabs = center.querySelector('.tournament-tabs');
  const overviewButton = tabs?.querySelector('[data-tab="overview"]');
  const resultsButton = tabs?.querySelector('[data-tab="results"]');
  const tableButton = tabs?.querySelector('[data-tab="table"]');
  const bracketButton = tabs?.querySelector('[data-tab="bracket"]');
  const playersButton = tabs?.querySelector('[data-tab="players"]');
  if (overviewButton) overviewButton.textContent = 'Következő mérkőzés';
  if (resultsButton) resultsButton.textContent = 'Eredmények';
  playersButton?.remove();
  center.querySelector('[data-content="players"]')?.remove();
  const structureButton = state.format === TOURNAMENT_FORMAT.LEAGUE || state.phase === 'group' ? tableButton : bracketButton;
  const unusedStructure = structureButton === tableButton ? bracketButton : tableButton;
  if (structureButton) structureButton.textContent = structureButton === tableButton ? 'Tabella' : 'Tornaág';
  unusedStructure?.remove();
  if (tabs && overviewButton && structureButton && resultsButton) tabs.replaceChildren(overviewButton, structureButton, resultsButton);
  simplifyCenterOverview(center);

  const nextCard = center.querySelector('.tournament-next-match');
  if (nextCard && fold(round?.label).includes('donto')) {
    const banner = document.createElement('section');
    banner.className = 'tx-final-banner';
    banner.innerHTML = `${trophyMarkup(trophy, true)}<strong>A döntő következik</strong><span>A kupa egyetlen mérkőzésre van.</span>`;
    nextCard.before(banner);
    const play = nextCard.querySelector('#tournament-play,.tournament-match-intro-trigger');
    if (play) play.textContent = 'Döntő indítása';
  }

  const actions = center.querySelector('.tournament-actions--secondary');
  if (actions) {
    const save = actions.querySelector('#tournament-save');
    const home = actions.querySelector('#tournament-center-home');
    const abandon = actions.querySelector('#tournament-abandon');
    save?.remove();
    const details = document.createElement('details');
    details.className = 'tx-center-secondary';
    details.innerHTML = '<summary>További lehetőségek</summary><div class="tx-center-secondary__actions"></div>';
    const target = details.querySelector('div');
    if (home) target.appendChild(home);
    if (abandon) target.appendChild(abandon);
    actions.replaceWith(details);
  }
  enhanceBracket(center);
}

function enhanceResultPanel(panel) {
  if (!panel || panel.dataset.experienceV2 === 'true' || !panel.classList.contains('result-panel--tournament')) return;
  const state = tournamentStorageService.read();
  if (!state) return;
  panel.dataset.experienceV2 = 'true';
  const next = tournamentNextHumanMatch(state);
  const round = next ? tournamentRoundForMatch(state, next.id) : null;
  const opponentId = next ? (next.homeId === state.humanTeamId ? next.awayId : next.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId);
  const heading = fold(panel.querySelector('h1')?.textContent);
  const won = heading.includes('gyozelem');
  const lost = heading.includes('vereseg');
  const complete = state.status === TOURNAMENT_STATUS.COMPLETE;
  const title = complete
    ? (state.championId === state.humanTeamId ? 'Tornagyőztes!' : 'A torna számodra véget ért')
    : won ? (round?.label ? 'Bejutottál a következő szakaszba!' : 'Győzelemmel folytatod!')
      : lost ? 'A torna számodra véget ért' : 'A forduló lezárult';
  const detail = complete ? 'Nézd meg a végső helyezést és a torna összesítését.'
    : opponent ? `Következő ellenfeled: ${opponent.label}`
      : round?.label ? `Következő szakasz: ${round.label}` : 'A tornaállapot automatikusan elmentve.';
  const transition = document.createElement('section');
  transition.className = 'tx-round-transition';
  transition.innerHTML = `${trophyMarkup(stateTrophy(state), true)}<div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`;
  const actions = panel.querySelector('.result-actions');
  (actions ?? panel.firstElementChild)?.before?.(transition);
}

function enhanceComplete(panel) {
  if (!panel || panel.dataset.experienceV2 === 'true') return;
  const state = tournamentStorageService.read();
  if (!state || state.status !== TOURNAMENT_STATUS.COMPLETE) return;
  panel.dataset.experienceV2 = 'true';
  const champion = tournamentTeamById(state, state.championId);
  const won = state.championId === state.humanTeamId;
  panel.querySelectorAll(':scope > p.eyebrow,:scope > h1').forEach(node => node.remove());
  const hero = document.createElement('section');
  hero.className = 'tx-complete-hero';
  hero.innerHTML = `${trophyMarkup(stateTrophy(state))}<p class="eyebrow">${escapeHtml(state.name)}</p><h1>${won ? 'Tornagyőztes!' : 'A torna véget ért'}</h1><p>${escapeHtml(champion?.label || 'Ismeretlen csapat')} lett a bajnok.</p>`;
  panel.prepend(hero);
  const detailedNodes = [...panel.children].filter(node =>
    node !== hero
    && !node.classList.contains('tournament-actions')
    && !node.classList.contains('tournament-champion')
  );
  if (detailedNodes.length) {
    const details = document.createElement('details');
    details.className = 'tx-complete-details';
    details.innerHTML = '<summary>Részletes tornaeredmények és játékosstatisztikák</summary>';
    detailedNodes.forEach(node => details.appendChild(node));
    const actions = panel.querySelector('.tournament-actions');
    if (actions) actions.before(details); else panel.appendChild(details);
  }
  const newTournament = panel.querySelector('#tournament-new');
  if (newTournament) {
    const replacement = newTournament.cloneNode(true);
    newTournament.replaceWith(replacement);
    replacement.addEventListener('click', () => showExperienceWizard(null, null, 'type'));
  }
}

function refreshExperience() {
  ensureExperienceStyle();
  patchMenu(document.querySelector('.menu-panel.mobile-home'));
  enhanceCenter(document.querySelector('.tournament-center'));
  enhanceBracket(document.querySelector('.tournament-center'));
  enhanceResultPanel(document.querySelector('.result-panel--tournament'));
  enhanceComplete(document.querySelector('.tournament-complete'));
}

function installTournamentExperienceV2() {
  ensureExperienceStyle();
  if (globalThis.__FOCISKARTYAK_TOURNAMENT_EXPERIENCE_V2__) return globalThis.__FOCISKARTYAK_TOURNAMENT_EXPERIENCE_V2__;
  const observer = new MutationObserver(refreshExperience);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis.__FOCISKARTYAK_TOURNAMENT_EXPERIENCE_V2__ = observer;
  globalThis.FociskartyakTournamentExperience = Object.freeze({
    show: returnPanel => showExperienceWizard(returnPanel),
    version: EXPERIENCE_VERSION,
    refresh: refreshExperience,
  });
  refreshExperience();
  return observer;
}

export { installTournamentExperienceV2, refreshExperience };
