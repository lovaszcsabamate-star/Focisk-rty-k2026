/** Torna menü-, eredmény-, meccsindítási és rendszer-vissza integráció. */

import { showTournamentWizard } from './tournament-flow-wizard.js';
import {
  TOURNAMENT_MATCH_MODE, TOURNAMENT_MATCH_STATUS, TOURNAMENT_STATUS,
  closeTournamentLayers, deckRuntime, ensureStyle, escapeHtml, players, runtime, saveAndVerifyTournament,
  tournamentNextHumanMatch, tournamentProgress, tournamentRoundForMatch, tournamentShuffle,
  tournamentStorageService, tournamentTeamById,
} from './tournament-flow-shared.js';

const enhancedCarousels = new WeakSet();
const enhancedLaunchButtons = new WeakSet();
const enhancedKickoffButtons = new WeakSet();
const TOURNAMENT_HISTORY_KEY = '__fociskartyakTournamentOverlay';
const MATCH_LAUNCH_QUERY_KEY = 'tournamentMatchLaunch';
let lastBackNavigationAt = 0;

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

function syncResumeButton(panel) {
  const stored = tournamentStorageService.read();
  let resume = panel.querySelector('.tournament-continue-button');
  if (!stored) {
    resume?.remove();
    return;
  }
  if (!resume || resume.dataset.flowResume !== 'true') {
    const replacement = resume?.cloneNode(true) ?? document.createElement('button');
    replacement.className = 'btn btn--continue tournament-continue-button';
    replacement.dataset.flowResume = 'true';
    if (resume) resume.replaceWith(replacement);
    else panel.querySelector('.menu-section-title')?.before(replacement);
    resume = replacement;
    resume.addEventListener('click', () => {
      const latest = tournamentStorageService.read();
      if (latest) globalThis.FociskartyakTournament?.showCenter?.(latest, panel);
    });
  }
  const description = describeResume(stored);
  const markup = stored.status === TOURNAMENT_STATUS.COMPLETE
    ? `<span>🏆 Tornaeredmények megtekintése</span><small>${escapeHtml(stored.name)} · ${escapeHtml(description.detail)}</small>`
    : `<span>▶ Torna folytatása · ${description.percent}%</span><small>${escapeHtml(stored.name)} · ${escapeHtml(description.detail)}</small>`;
  if (resume.innerHTML !== markup) resume.innerHTML = markup;
}

function enhanceMenu(panel) {
  if (!panel) return;
  if (!runtime.menuPanels.has(panel)) {
    const oldButton = panel.querySelector('#tournament-mode-btn');
    if (oldButton) {
      runtime.menuPanels.add(panel);
      const button = oldButton.cloneNode(true);
      button.dataset.flowUpgrade = 'true';
      button.innerHTML = '<span>🏆 Torna mód</span><small>Bajnokság, Magyar Kupa, Világkupa vagy saját torna</small>';
      oldButton.replaceWith(button);
      button.addEventListener('click', () => showTournamentWizard(panel));
    }
  }
  syncResumeButton(panel);
}

function enhanceTeamSwipe(carousel) {
  if (!carousel || enhancedCarousels.has(carousel)) return;
  enhancedCarousels.add(carousel);
  let startX = null;
  carousel.addEventListener('touchstart', event => {
    startX = event.touches?.[0]?.clientX ?? null;
  }, { passive: true });
  carousel.addEventListener('touchend', event => {
    if (startX === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? startX;
    const delta = endX - startX;
    startX = null;
    if (Math.abs(delta) < 42) return;
    carousel.querySelector(delta < 0 ? '[data-next-team]' : '[data-prev]')?.click?.();
  }, { passive: true });
}

function navigateToStagedMatch(trigger) {
  if (trigger) {
    trigger.disabled = true;
    trigger.dataset.matchLaunching = 'true';
    trigger.textContent = '⚽ Párbaj indítása…';
  }
  try {
    const target = new URL(globalThis.location.href);
    target.searchParams.set(MATCH_LAUNCH_QUERY_KEY, String(Date.now()));
    globalThis.location.replace(target.href);
  } catch (error) {
    console.warn('[tournament-flow] A kényszerített meccsnavigáció nem használható:', error);
    globalThis.location.reload();
  }
  globalThis.setTimeout?.(() => {
    try { globalThis.location.reload(); } catch { /* A navigáció már elindult. */ }
  }, 700);
}

function launchPreparedMatch(state, match, lineupIds, trigger = null) {
  const human = tournamentTeamById(state, state.humanTeamId);
  const opponentId = match?.homeId === state.humanTeamId ? match?.awayId : match?.homeId;
  const opponent = tournamentTeamById(state, opponentId);
  const uniqueLineupIds = [...new Set((lineupIds ?? []).map(id => String(id)).filter(Boolean))];
  if (!human || !opponent || !match || uniqueLineupIds.length < 4) return false;

  const mode = match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK
    ? TOURNAMENT_MATCH_MODE.PENALTIES
    : (state.currentMatchMode || state.matchMode);
  const next = saveAndVerifyTournament({
    ...state,
    currentMatchId: match.id,
    currentMatchMode: mode,
    currentLineupIds: uniqueLineupIds,
    lastLineupIds: uniqueLineupIds,
    updatedAt: new Date().toISOString(),
  });

  try {
    localStorage.setItem(deckRuntime.TOURNAMENT_LINEUP_STORAGE_KEY, JSON.stringify({
      tournamentId: next.id,
      matchId: match.id,
      humanIds: uniqueLineupIds,
    }));
  } catch { /* A tárolási korlátozás nem blokkolhatja a meccset. */ }

  const staged = deckRuntime.stageQuickMatch({
    playerTeamId: human.id,
    opponentTeamId: opponent.id,
    playerSelection: human.selection,
    opponentSelection: opponent.selection,
    mode,
    difficulty: state.difficulty,
    createdAt: new Date().toISOString(),
  });
  if (!staged) {
    try {
      localStorage.removeItem(deckRuntime.TOURNAMENT_LINEUP_STORAGE_KEY);
      saveAndVerifyTournament(state);
    } catch { /* Az eredeti tornaállapot visszaállítása best effort. */ }
    return false;
  }

  navigateToStagedMatch(trigger);
  return true;
}

function launchRandomLineup(state, match, trigger = null) {
  const human = tournamentTeamById(state, state.humanTeamId);
  if (!human || !match) return false;
  const cards = tournamentShuffle(deckRuntime.resolveQuickMatchSelection(players(), human.selection)).slice(0, 11);
  if (cards.length < 4) return false;
  return launchPreparedMatch(state, match, cards.map(card => card.id), trigger);
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
      if (!launchRandomLineup(tournamentStorageService.read() ?? stored, nextMatch, replacement)) {
        replacement.disabled = false;
        alert('A véletlen keret nem indítható el.');
      }
    } catch (error) {
      replacement.disabled = false;
      console.error('[tournament-flow] Véletlen keret hiba:', error);
      alert(error.message || 'A véletlen keret nem indítható el.');
    }
  });
}

function enhanceLineup(panel) {
  const start = panel?.querySelector('#lineup-start');
  if (!start || enhancedLaunchButtons.has(start) || start.dataset.flowMatchLaunch === 'true') return;
  const replacement = start.cloneNode(true);
  replacement.dataset.flowMatchLaunch = 'true';
  start.replaceWith(replacement);
  enhancedLaunchButtons.add(replacement);
  replacement.addEventListener('click', () => {
    const state = tournamentStorageService.read();
    const match = state ? tournamentNextHumanMatch(state) : null;
    const lineupIds = [...panel.querySelectorAll('[data-player-id]:checked')]
      .map(input => input.dataset.playerId)
      .filter(Boolean);
    try {
      if (!state || !match || !launchPreparedMatch(state, match, lineupIds, replacement)) {
        replacement.disabled = false;
        replacement.removeAttribute('data-match-launching');
        replacement.textContent = 'Meccs indítása';
        alert('A párbaj indítása nem sikerült. Ellenőrizd a kiválasztott keretet, majd próbáld újra.');
      }
    } catch (error) {
      replacement.disabled = false;
      replacement.removeAttribute('data-match-launching');
      replacement.textContent = 'Meccs indítása';
      console.error('[tournament-flow] A párbaj indítása sikertelen:', error);
      alert(error.message || 'A párbaj indítása nem sikerült.');
    }
  });
}

function enhanceTournamentKickoff(button) {
  if (!button || enhancedKickoffButtons.has(button)) return;
  const state = tournamentStorageService.read();
  if (!state?.currentMatchId) return;
  enhancedKickoffButtons.add(button);
  button.textContent = '⚽ Párbaj indítása…';
  button.disabled = true;
  globalThis.setTimeout?.(() => {
    if (!button.isConnected) return;
    button.disabled = false;
    button.click();
  }, 120);
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

function activeTournamentPanel() {
  return document.querySelector('#overlay:not([hidden]) .tournament-panel');
}

function armTournamentHistory() {
  if (!runtime.wizard && !activeTournamentPanel()) return;
  const current = globalThis.history?.state;
  if (current && typeof current === 'object' && current[TOURNAMENT_HISTORY_KEY] === true) return;
  try {
    const previous = current && typeof current === 'object' ? current : {};
    globalThis.history?.pushState?.({ ...previous, [TOURNAMENT_HISTORY_KEY]: true }, '');
  } catch (error) {
    console.warn('[tournament-flow] A rendszer-vissza előzmény nem hozható létre:', error);
  }
}

function refresh() {
  ensureStyle();
  enhanceMenu(document.querySelector('.menu-panel.mobile-home'));
  enhanceCenter(document.querySelector('.tournament-center'));
  enhanceLineup(document.querySelector('.tournament-lineup'));
  enhanceTournamentKickoff(document.querySelector('.penalty-intro #kickoff-btn'));
  enhanceCompletePanel(document.querySelector('.tournament-complete'));
  document.querySelectorAll('.tournament-team-carousel').forEach(enhanceTeamSwipe);
  const result = document.querySelector('.result-panel--tournament');
  if (result) queueMicrotask(() => enhanceResultPanel(result));
  armTournamentHistory();
}

function installBackNavigation() {
  const handler = event => {
    const activePanel = activeTournamentPanel();
    if (!runtime.wizard && !activePanel) return;
    const now = Date.now();
    if (now - lastBackNavigationAt < 180) return;
    lastBackNavigationAt = now;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    if (runtime.wizard) {
      runtime.wizard.previous();
      queueMicrotask(armTournamentHistory);
      return;
    }
    const stored = tournamentStorageService.read();
    try { if (stored) saveAndVerifyTournament(stored); } catch (error) { console.error('[tournament-flow] Visszalépési mentési hiba:', error); }
    if ((activePanel?.classList.contains('tournament-lineup') || activePanel?.classList.contains('tournament-match-intro')) && stored) {
      closeTournamentLayers();
      globalThis.FociskartyakTournament?.showCenter?.(stored, null);
      queueMicrotask(armTournamentHistory);
      return;
    }
    navigateToMainMenu();
  };
  document.addEventListener('backbutton', handler, true);
  globalThis.addEventListener?.('popstate', handler, true);
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
    launchPreparedMatch,
  });
  return runtime.observer;
}

export { installTournamentFlowUpgrade };
