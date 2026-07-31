/** Torna menü-, eredmény- és rendszer-vissza integráció. */

import { showTournamentWizard } from './tournament-flow-wizard.js';
import {
  TOURNAMENT_MATCH_MODE, TOURNAMENT_MATCH_STATUS, TOURNAMENT_STATUS,
  closeTournamentLayers, deckRuntime, ensureStyle, escapeHtml, fold, players, runtime, saveAndVerifyTournament,
  tournamentNextHumanMatch, tournamentProgress, tournamentRoundForMatch, tournamentShuffle,
  tournamentStorageService, tournamentTeamById,
} from './tournament-flow-shared.js';

function describeResume(state) {
  const next = tournamentNextHumanMatch(state);
  const round = next ? tournamentRoundForMatch(state, next.id) : null;
  const opponentId = next ? (next.homeId === state.humanTeamId ? next.awayId : next.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId);
  const progress = tournamentProgress(state);
  const detail = state.status === TOURNAMENT_STATUS.COMPLETE
    ? 'Befejezett torna'
    : `${round?.label || state.phase || 'Következő forduló'}${opponent ? ` · következik: ${opponent.label}` : ''}`;
  return { detail, percent: progress.percent };
}

function enhanceMenu(panel) {
  if (!panel || runtime.menuPanels.has(panel)) return;
  const oldButton = panel.querySelector('#tournament-mode-btn');
  if (!oldButton) return;
  runtime.menuPanels.add(panel);
  const button = oldButton.cloneNode(true);
  button.dataset.flowUpgrade = 'true';
  button.innerHTML = '<span>🏆 Torna mód</span><small>Bajnokság, Magyar Kupa, Világkupa vagy saját torna</small>';
  oldButton.replaceWith(button);
  button.addEventListener('click', () => showTournamentWizard(panel));

  const stored = tournamentStorageService.read();
  const oldResume = panel.querySelector('.tournament-continue-button');
  if (oldResume && stored) {
    const resume = oldResume.cloneNode(true);
    const description = describeResume(stored);
    resume.innerHTML = stored.status === TOURNAMENT_STATUS.COMPLETE
      ? `<span>🏆 Tornaeredmények megtekintése</span><small>${escapeHtml(stored.name)} · ${escapeHtml(description.detail)}</small>`
      : `<span>▶ Torna folytatása · ${description.percent}%</span><small>${escapeHtml(stored.name)} · ${escapeHtml(description.detail)}</small>`;
    oldResume.replaceWith(resume);
    resume.addEventListener('click', () => globalThis.FociskartyakTournament?.showCenter?.(tournamentStorageService.read(), panel));
  }
}

function launchRandomLineup(state, match) {
  const human = tournamentTeamById(state, state.humanTeamId);
  const opponentId = match.homeId === state.humanTeamId ? match.awayId : match.homeId;
  const opponent = tournamentTeamById(state, opponentId);
  if (!human || !opponent) return false;
  const cards = tournamentShuffle(deckRuntime.resolveQuickMatchSelection(players(), human.selection)).slice(0, 11);
  if (cards.length < 4) return false;
  const lineupIds = cards.map(card => String(card.id));
  const mode = match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK
    ? TOURNAMENT_MATCH_MODE.PENALTIES
    : (state.currentMatchMode || state.matchMode);
  const next = saveAndVerifyTournament({ ...state, currentMatchId: match.id, currentMatchMode: mode, currentLineupIds: lineupIds, lastLineupIds: lineupIds, updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem(deckRuntime.TOURNAMENT_LINEUP_STORAGE_KEY, JSON.stringify({ tournamentId: next.id, matchId: match.id, humanIds: lineupIds }));
  } catch { /* A tárolási korlátozás nem blokkolhatja a meccset. */ }
  const staged = deckRuntime.stageQuickMatch({
    playerTeamId: human.id, opponentTeamId: opponent.id, playerSelection: human.selection,
    opponentSelection: opponent.selection, mode, difficulty: state.difficulty, createdAt: new Date().toISOString(),
  });
  if (!staged) return false;
  globalThis.location.reload();
  return true;
}

function enhanceCenter(panel) {
  if (!panel || runtime.centers.has(panel)) return;
  const stored = tournamentStorageService.read();
  if (!stored || stored.status !== TOURNAMENT_STATUS.ACTIVE) return;
  const play = panel.querySelector('#tournament-play');
  if (!play || stored.configuration?.lineupMode !== 'random') return;
  runtime.centers.add(panel);
  const nextMatch = tournamentNextHumanMatch(stored);
  if (!nextMatch) return;
  const rapidTrigger = panel.querySelector('.tournament-match-intro-trigger');
  const target = rapidTrigger ?? play;
  const replacement = target.cloneNode(true);
  replacement.classList.remove('tournament-native-play');
  replacement.textContent = rapidTrigger
    ? '▶ Véletlen keretes mérkőzés indítása'
    : '⚽ Véletlen keret és meccs indítása';
  target.replaceWith(replacement);
  if (rapidTrigger && play.isConnected) play.remove();
  replacement.addEventListener('click', () => {
    try {
      if (!launchRandomLineup(tournamentStorageService.read() ?? stored, nextMatch)) alert('A véletlen keret nem indítható el.');
    } catch (error) {
      console.error('[tournament-flow] Véletlen keret hiba:', error);
      alert(error.message || 'A véletlen keret nem indítható el.');
    }
  });
}

function enhanceCompletePanel(panel) {
  if (!panel || runtime.completePanels.has(panel)) return;
  const button = panel.querySelector('#tournament-new');
  if (!button) return;
  runtime.completePanels.add(panel);
  const replacement = button.cloneNode(true);
  button.replaceWith(replacement);
  replacement.addEventListener('click', () => showTournamentWizard(null));
}

function navigateToMainMenu() {
  closeTournamentLayers();
  try {
    globalThis.location.replace(globalThis.location.href.split('#')[0]);
  } catch {
    globalThis.location.reload();
  }
}

function enhanceResultPanel(panel) {
  if (!panel || runtime.resultPanels.has(panel) || !panel.classList.contains('result-panel--tournament')) return;
  const actions = panel.querySelector('.result-actions');
  const stored = tournamentStorageService.read();
  if (!actions || !stored) return;
  let verified;
  try {
    verified = saveAndVerifyTournament(stored);
  } catch (error) {
    console.error('[tournament-flow] A tornaeredmény mentése nem ellenőrizhető:', error);
    return;
  }
  runtime.resultPanels.add(panel);
  const note = document.createElement('p');
  note.className = 'tournament-save-verified';
  note.textContent = '✓ Tornaállapot elmentve és visszaellenőrizve';
  actions.before(note);
  actions.dataset.tournamentSafeActions = 'true';
  actions.replaceChildren();

  const continueButton = document.createElement('button');
  continueButton.type = 'button'; continueButton.className = 'btn'; continueButton.textContent = 'Tovább a tornában';
  continueButton.addEventListener('click', () => {
    try {
      const state = saveAndVerifyTournament(tournamentStorageService.read() ?? verified);
      closeTournamentLayers();
      globalThis.FociskartyakTournament?.showCenter?.(state, null);
    } catch (error) { alert(error.message); }
  });

  const bracketButton = document.createElement('button');
  bracketButton.type = 'button'; bracketButton.className = 'btn btn--ghost'; bracketButton.textContent = 'Vissza a tornaághoz';
  bracketButton.addEventListener('click', () => {
    try {
      const state = saveAndVerifyTournament(tournamentStorageService.read() ?? verified);
      closeTournamentLayers();
      globalThis.FociskartyakTournament?.showCenter?.(state, null);
      requestAnimationFrame(() => {
        const center = document.querySelector('.tournament-center');
        const target = center?.querySelector('[data-tab="bracket"]') ?? center?.querySelector('[data-tab="table"]') ?? center?.querySelector('[data-tab="results"]');
        target?.click?.();
      });
    } catch (error) { alert(error.message); }
  });

  const homeButton = document.createElement('button');
  homeButton.type = 'button'; homeButton.className = 'btn btn--ghost'; homeButton.textContent = 'Kilépés a főmenübe';
  homeButton.addEventListener('click', () => {
    try {
      saveAndVerifyTournament(tournamentStorageService.read() ?? verified);
      navigateToMainMenu();
    } catch (error) { alert(error.message); }
  });
  actions.append(continueButton, bracketButton, homeButton);
}

function refresh() {
  ensureStyle();
  enhanceMenu(document.querySelector('.menu-panel.mobile-home'));
  enhanceCenter(document.querySelector('.tournament-center'));
  enhanceCompletePanel(document.querySelector('.tournament-complete'));
  const result = document.querySelector('.result-panel--tournament');
  if (result) queueMicrotask(() => enhanceResultPanel(result));
}

function installBackNavigation() {
  const handler = event => {
    const activePanel = document.querySelector('#overlay:not([hidden]) .tournament-panel');
    if (!runtime.wizard && !activePanel) return;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    if (runtime.wizard) {
      runtime.wizard.previous();
      return;
    }
    const stored = tournamentStorageService.read();
    try { if (stored) saveAndVerifyTournament(stored); } catch (error) { console.error('[tournament-flow] Visszalépési mentési hiba:', error); }
    if ((activePanel?.classList.contains('tournament-lineup') || activePanel?.classList.contains('tournament-match-intro')) && stored) {
      closeTournamentLayers();
      globalThis.FociskartyakTournament?.showCenter?.(stored, null);
      return;
    }
    navigateToMainMenu();
  };
  document.addEventListener('backbutton', handler, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') handler(event); }, true);
  globalThis.Capacitor?.Plugins?.App?.addListener?.('backButton', handler);
}

function installTournamentFlowUpgrade() {
  ensureStyle();
  if (runtime.observer) return runtime.observer;
  runtime.observer = new MutationObserver(refresh);
  runtime.observer.observe(document.documentElement, { childList: true, subtree: true });
  installBackNavigation();
  refresh();
  globalThis.FociskartyakTournamentFlow = Object.freeze({
    show: returnPanel => showTournamentWizard(returnPanel),
    saveAndVerify: saveAndVerifyTournament,
    closeLayers: closeTournamentLayers,
  });
  return runtime.observer;
}

export { installTournamentFlowUpgrade };
