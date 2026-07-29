/** Torna mód v3: szimuláció, keretszerkesztés, statisztikák, díjak és mentés. */

import { GameRuntime } from './game/game-runtime.js';
import { tournamentStorageService } from './services/tournament-storage-service.js';
import {
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  advanceTournament,
  recordTournamentMatch,
  recordTournamentTiebreak,
  tournamentMatchById,
  tournamentNextHumanMatch,
  tournamentProgress,
  tournamentStandings,
  tournamentTeamById,
} from './tournament/tournament-domain.js';
import { simulatePendingAiMatchesEnhanced, buildTournamentTeamProfile } from './tournament/tournament-simulation.js';
import { appendPlayedResult, applyMatchTelemetry, calculateTournamentAwards, migrateEnhancedTournament } from './tournament/tournament-state.js';
import { showTournamentSetup } from './tournament/tournament-setup-ui.js';
import { showLineupSelection } from './tournament/tournament-lineup-ui.js';
import {
  awardsView,
  bracket,
  cardsForTeam,
  escapeHtml,
  fold,
  formatLabel,
  matchModeLabel,
  navigateHome,
  panel,
  phaseLabel,
  playerById,
  playerStatsView,
  resolveCards,
  restorePanel,
  resultsList,
  showPanel,
  tables,
  teamMark,
  teamStatsView,
  tournamentModeTitle,
} from './tournament/tournament-ui.js';

const runtime = { observer: null, resultPanels: new WeakSet(), lastMenuPanel: null };
const TELEMETRY_KEY = '__FOCISKARTYAK_TOURNAMENT_TELEMETRY__';
const clone = value => JSON.parse(JSON.stringify(value));

function installTelemetryCapture() {
  if (GameRuntime.prototype.__tournamentTelemetryPatched) return;
  const original = GameRuntime.prototype.result;
  Object.defineProperty(GameRuntime.prototype, '__tournamentTelemetryPatched', { value: true });
  GameRuntime.prototype.result = function tournamentResultWithTelemetry() {
    const result = original.call(this); const active = tournamentStorageService.read();
    if (active?.currentMatchId) globalThis[TELEMETRY_KEY] = { tournamentId: active.id, matchId: active.currentMatchId, mode: this.mode, result: clone(result), log: clone(this.game?.log ?? []), capturedAt: new Date().toISOString() };
    return result;
  };
}
installTelemetryCapture();

const simulateAndSave = input => {
  let next = migrateEnhancedTournament(advanceTournament(migrateEnhancedTournament(input)));
  next = simulatePendingAiMatchesEnhanced(next, resolveCards(next));
  next = migrateEnhancedTournament(advanceTournament(next));
  if (next.status === TOURNAMENT_STATUS.COMPLETE && !next.awards) next = calculateTournamentAwards(next);
  tournamentStorageService.save(next); if (next.status === TOURNAMENT_STATUS.COMPLETE) tournamentStorageService.archive(next);
  return next;
};

function showTournamentComplete(inputState, returnPanel = null) {
  const state = inputState.awards ? inputState : calculateTournamentAwards(inputState);
  tournamentStorageService.save(state); tournamentStorageService.archive(state);
  const champion = tournamentTeamById(state, state.championId); const human = tournamentTeamById(state, state.humanTeamId);
  const won = state.championId === state.humanTeamId;
  const standing = state.format === TOURNAMENT_FORMAT.LEAGUE ? tournamentStandings(state).find(row => row.teamId === state.humanTeamId)?.position : null;
  const node = panel('tournament-complete');
  node.innerHTML = `<p class="eyebrow">${escapeHtml(state.name)} · ${escapeHtml(tournamentModeTitle(state))}</p><div class="tournament-trophy">${won ? '🏆' : '🏁'}</div><h1>${won ? 'TORNAGYŐZELEM!' : 'A torna véget ért'}</h1><div class="tournament-champion ${won ? 'is-human' : ''}">${teamMark(champion)}<div><small>Bajnok</small><strong>${escapeHtml(champion?.label || 'Ismeretlen')}</strong></div></div><p>${won ? `${escapeHtml(human?.label)} megszerezte a trófeát.` : standing ? `${escapeHtml(human?.label)} a(z) ${standing}. helyen zárt.` : `${escapeHtml(human?.label)} számára véget ért a sorozat.`}</p><h2>Tornavégi díjak</h2>${awardsView(state)}<h2>Csapatstatisztikák</h2>${teamStatsView(state)}<h2>Játékosstatisztikák</h2>${playerStatsView(state)}${tables(state)}${bracket(state)}<div class="tournament-actions"><button class="btn" id="tournament-new">Új torna</button><button class="btn btn--ghost" id="tournament-home">Főmenü</button></div>`;
  node.querySelector('#tournament-new')?.addEventListener('click', () => showTournamentSetup({ returnPanel, showCenter: showTournamentCenter }), { once: true });
  node.querySelector('#tournament-home')?.addEventListener('click', () => restorePanel(returnPanel), { once: true }); showPanel(node);
}

export function showTournamentCenter(inputState = tournamentStorageService.read(), returnPanel = runtime.lastMenuPanel) {
  if (!inputState) { showTournamentSetup({ returnPanel, showCenter: showTournamentCenter }); return; }
  const state = simulateAndSave(inputState); if (state.status === TOURNAMENT_STATUS.COMPLETE) { showTournamentComplete(state, returnPanel); return; }
  const nextMatch = tournamentNextHumanMatch(state); const human = tournamentTeamById(state, state.humanTeamId);
  const opponentId = nextMatch ? (nextMatch.homeId === state.humanTeamId ? nextMatch.awayId : nextMatch.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId); const progress = tournamentProgress(state);
  const round = nextMatch ? state.rounds.find(item => item.matches?.some(match => match.id === nextMatch.id)) : null;
  const node = panel('tournament-center');
  node.innerHTML = `<div class="tournament-heading"><div><p class="eyebrow">${escapeHtml(formatLabel(state.format))}</p><h1>${escapeHtml(state.name)}</h1><p class="tournament-mode-label">${escapeHtml(tournamentModeTitle(state))}</p></div><span class="tournament-phase">${escapeHtml(phaseLabel(state))}</span></div><div class="tournament-progress"><span style="width:${progress.percent}%"></span></div><p class="tournament-progress-label">${progress.completed} mérkőzés lejátszva · ${progress.percent}%</p>
    ${nextMatch ? `<section class="tournament-next-match"><p>${escapeHtml(round?.label || 'Következő mérkőzés')} · ${escapeHtml(matchModeLabel(nextMatch.status === TOURNAMENT_MATCH_STATUS.TIEBREAK ? TOURNAMENT_MATCH_MODE.PENALTIES : state.matchMode))}</p><div class="tournament-versus"><div class="is-human">${teamMark(human)}<strong>${escapeHtml(human?.label)}</strong></div><b>VS</b><div>${teamMark(opponent)}<strong>${escapeHtml(opponent?.label)}</strong></div></div><button class="btn tournament-play" id="tournament-play">▶ Csapatösszeállítás</button></section>` : '<p class="tournament-warning">Nincs lejátszható saját mérkőzés. A többi találkozó automatikusan lezárul.</p>'}
    <nav class="tournament-tabs"><button class="is-active" data-tab="overview">Áttekintés</button><button data-tab="results">Forduló eredményei</button><button data-tab="simulated">Leszimulált mérkőzések</button>${state.groups?.length || state.format === TOURNAMENT_FORMAT.LEAGUE ? '<button data-tab="table">Tabella</button>' : ''}${state.rounds.some(item => item.stage === 'knockout') ? '<button data-tab="bracket">Tornaág</button>' : ''}<button data-tab="teams">Csapat statisztikák</button><button data-tab="players">Játékos statisztikák</button></nav>
    <div class="tournament-tab-content" data-content="overview"><h2>Saját csapat</h2><div class="tournament-selected-team is-human">${teamMark(human)}<div><strong>${escapeHtml(human?.label)}</strong><small>${escapeHtml(phaseLabel(state))} · ${escapeHtml(tournamentModeTitle(state))}</small></div></div><h2>Legutóbbi eredmények</h2>${resultsList(state, { limit: 8 })}</div>
    <div class="tournament-tab-content" data-content="results" hidden>${resultsList(state)}</div><div class="tournament-tab-content" data-content="simulated" hidden><h2>Leszimulált mérkőzések</h2>${resultsList(state, { simulatedOnly: true })}</div><div class="tournament-tab-content" data-content="table" hidden>${tables(state)}</div><div class="tournament-tab-content" data-content="bracket" hidden>${bracket(state)}</div><div class="tournament-tab-content" data-content="teams" hidden>${teamStatsView(state)}</div><div class="tournament-tab-content" data-content="players" hidden>${playerStatsView(state)}</div>
    <div class="tournament-actions tournament-actions--secondary"><button class="btn" id="tournament-save">💾 Torna mentése</button><button class="btn btn--ghost" id="tournament-center-home">Főmenü</button><button class="btn btn--danger" id="tournament-abandon">Torna feladása</button></div>`;
  node.querySelector('#tournament-play')?.addEventListener('click', () => showLineupSelection(state, nextMatch, { returnPanel, showCenter: showTournamentCenter }), { once: true });
  node.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { node.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('is-active', item === button)); node.querySelectorAll('[data-content]').forEach(content => { content.hidden = content.dataset.content !== button.dataset.tab; }); }));
  node.querySelector('#tournament-save')?.addEventListener('click', () => { const saved = tournamentStorageService.save(state); const button = node.querySelector('#tournament-save'); if (button) button.textContent = saved ? '✓ Torna elmentve' : 'Mentési hiba'; });
  node.querySelector('#tournament-center-home')?.addEventListener('click', () => restorePanel(returnPanel), { once: true });
  node.querySelector('#tournament-abandon')?.addEventListener('click', () => { if (confirm('Biztosan feladod a tornát?')) { tournamentStorageService.clear(); navigateHome(); } }); showPanel(node);
}

const parseResult = node => {
  const score = node.querySelector('.final-score')?.textContent?.match(/JÁTÉKOS\s+(\d+)\s*[–-]\s*(\d+)\s+GÉP/i); if (!score) return null;
  const heading = fold(node.querySelector('h1')?.textContent);
  return { humanScore: Number(score[1]), aiScore: Number(score[2]), humanWon: heading.includes('gyozelem'), humanLost: heading.includes('vereseg') };
};
const handleResultPanel = node => {
  if (!node || runtime.resultPanels.has(node)) return; const stored = tournamentStorageService.read(); if (!stored?.currentMatchId) return;
  const current = tournamentMatchById(stored, stored.currentMatchId); const result = parseResult(node); if (!current || !result) return;
  runtime.resultPanels.add(node); const originalHome = node.querySelector('#menu-btn'); const humanHome = current.homeId === stored.humanTeamId;
  const homeScore = humanHome ? result.humanScore : result.aiScore; const awayScore = humanHome ? result.aiScore : result.humanScore;
  const opponentId = humanHome ? current.awayId : current.homeId; const winnerId = result.humanWon ? stored.humanTeamId : result.humanLost ? opponentId : null;
  let next;
  try {
    if (current.status === TOURNAMENT_MATCH_STATUS.TIEBREAK && !winnerId) {
      throw new Error('A büntetőpárbajnak győztessel kell zárulnia.');
    }
    next = current.status === TOURNAMENT_MATCH_STATUS.TIEBREAK
      ? recordTournamentTiebreak(stored, current.id, { homeScore, awayScore, winnerId })
      : recordTournamentMatch(stored, current.id, { homeScore, awayScore, winnerId, decidedBy: stored.currentMatchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'played-penalties' : 'played-classic' });
    const completed = tournamentMatchById(next, current.id); const telemetry = globalThis[TELEMETRY_KEY];
    if (telemetry?.matchId === current.id && Array.isArray(telemetry.log)) {
      const humanCaptain = stored.currentLineupIds?.[0]; const aiCaptain = telemetry.log?.[0]?.aiCard?.meta?.mirrorOf || telemetry.log?.[0]?.aiCard?.id;
      next = applyMatchTelemetry(next, completed, { ...telemetry, homeSide: humanHome ? 'human' : 'ai', captainIds: [humanCaptain, aiCaptain].filter(Boolean) }, playerById());
    }
    next = appendPlayedResult(next, completed); next.currentMatchId = null; next.currentMatchMode = null; next.currentLineupIds = []; globalThis[TELEMETRY_KEY] = null; next = simulateAndSave(next);
  } catch (error) { console.error('[tournament-v3] A mérkőzés eredménye nem menthető:', error); return; }
  const actions = node.querySelector('.result-actions'); if (actions) { actions.replaceChildren(); const continueButton = document.createElement('button'); continueButton.className = 'btn'; continueButton.textContent = next.status === TOURNAMENT_STATUS.COMPLETE ? '🏆 Torna végeredménye' : '🏆 Torna folytatása'; continueButton.addEventListener('click', () => showTournamentCenter(next, null), { once: true }); const homeButton = document.createElement('button'); homeButton.className = 'btn btn--ghost'; homeButton.textContent = 'Főmenü'; homeButton.addEventListener('click', () => originalHome ? originalHome.click() : navigateHome(), { once: true }); actions.append(continueButton, homeButton); }
  const context = document.createElement('p'); context.className = 'tournament-result-context'; context.textContent = `${next.name} · ${tournamentModeTitle(next)} · eredmény és statisztikák elmentve`; node.prepend(context);
};

const enhanceMenu = node => {
  if (!node || node.dataset.tournamentV3Enhanced === 'true') return; node.dataset.tournamentV3Enhanced = 'true'; runtime.lastMenuPanel = node;
  const primary = node.querySelector('.primary-mode-actions'); if (!primary) return;
  const button = document.createElement('button'); button.className = 'btn mode-start tournament-menu-button'; button.id = 'tournament-mode-btn'; button.innerHTML = '<span>🏆 Torna mód</span><small>Liga, kupa, keretépítés és teljes statisztika</small>'; button.addEventListener('click', () => showTournamentSetup({ returnPanel: node, showCenter: showTournamentCenter }), { once: true }); primary.appendChild(button);
  const stored = tournamentStorageService.read(); if (stored) { const resume = document.createElement('button'); resume.className = 'btn btn--continue tournament-continue-button'; resume.innerHTML = `<span>${stored.status === TOURNAMENT_STATUS.COMPLETE ? '🏆 Torna eredménye' : '▶ Torna folytatása'}</span><small>${escapeHtml(stored.name)} · ${escapeHtml(tournamentModeTitle(stored))} · ${escapeHtml(phaseLabel(stored))}</small>`; resume.addEventListener('click', () => showTournamentCenter(stored, node), { once: true }); node.querySelector('.menu-section-title')?.before(resume); }
};
const refresh = () => { enhanceMenu(document.querySelector('.menu-panel.mobile-home')); handleResultPanel(document.querySelector('.result-panel')); };
export function installTournamentMode() {
  if (runtime.observer) return runtime.observer; runtime.observer = new MutationObserver(refresh); runtime.observer.observe(document.documentElement, { childList: true, subtree: true }); refresh();
  globalThis.FociskartyakTournament = Object.freeze({ showSetup: () => showTournamentSetup({ returnPanel: runtime.lastMenuPanel, showCenter: showTournamentCenter }), showCenter: showTournamentCenter, read: () => tournamentStorageService.read(), save: state => tournamentStorageService.save(migrateEnhancedTournament(state)), clear: () => tournamentStorageService.clear(), teamProfile: teamId => { const state = tournamentStorageService.read(); return state ? buildTournamentTeamProfile(cardsForTeam(state, teamId)) : null; } });
  return runtime.observer;
}
installTournamentMode();
