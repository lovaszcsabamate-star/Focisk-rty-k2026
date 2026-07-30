/** Football-broadcast scoreboard, kickoff, timed turns and tournament-result flow. */

import { UI, el } from './ui.js';
import { AI, HUMAN, PHASE } from './engine.js';
import { hasAttributeData } from './data/players.js';
import { settingStorageKey } from './app/configuration.js';
import { readStoredBoolean, writeStoredBoolean } from './services/storage-service.js';
import {
  TOURNAMENT_HISTORY_STORAGE_KEY,
  tournamentStorageService,
} from './services/tournament-storage-service.js';

export const CHOICE_LIMIT_SECONDS = 90;
export const KICKOFF_STEP_MS = 650;

const TIMED_TURNS_KEY = settingStorageKey('timedTurns');
const matchdayPrevious = Object.freeze({
  classicScores: UI.prototype._renderClassicScores,
  penaltyScores: UI.prototype._renderPenaltyScores,
  resetTable: UI.prototype.resetTable,
  renderScores: UI.prototype.renderScores,
  showAttributePicker: UI.prototype.showAttributePicker,
  hideAttributePicker: UI.prototype.hideAttributePicker,
  renderHands: UI.prototype.renderHands,
  showDuel: UI.prototype.showDuel,
  showVerdict: UI.prototype.showVerdict,
  showOverlay: UI.prototype.showOverlay,
  setSettings: UI.prototype.setSettings,
});

const matchdayStates = new WeakMap();
const sideLabel = side => side === HUMAN ? 'Játékos' : 'Gép';
const otherSide = side => side === HUMAN ? AI : HUMAN;
const now = () => Date.now();

const teamLabel = (game, side) => {
  const quick = side === HUMAN ? game?.quickMatch?.humanTeam : game?.quickMatch?.aiTeam;
  return String(quick ?? sideLabel(side)).trim() || sideLabel(side);
};

export function matchdayFormatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function stateFor(ui) {
  let state = matchdayStates.get(ui);
  if (state) return state;
  state = {
    kickoffPending: true,
    kickoffRunning: false,
    pendingChoiceKind: null,
    lastGame: null,
    lastSelectable: false,
    matchStartedAt: 0,
    matchPausedAt: 0,
    matchElapsedMs: 0,
    matchTimer: 0,
    choiceDeadline: 0,
    choicePausedAt: 0,
    choiceTimer: 0,
    choiceKind: null,
    whistleContext: null,
  };
  matchdayStates.set(ui, state);
  return state;
}

function scoreboardStatus(game) {
  if (game.phase === PHASE.GAME_OVER) return 'VÉGEREDMÉNY';
  if (game.phase === PHASE.REVEAL) {
    return `KÖVETKEZŐ VÁLASZTÓ: ${sideLabel(otherSide(game.chooser)).toUpperCase()}`;
  }
  return `KATEGÓRIÁT VÁLASZT: ${sideLabel(game.chooser).toUpperCase()}`;
}

const isPaused = ui => ui.dom?.overlay?.hidden === false || document.visibilityState === 'hidden';

function updateClocks(ui) {
  const state = stateFor(ui);
  const elapsed = matchdayFormatClock(state.matchElapsedMs / 1000);
  document.querySelectorAll('[data-match-clock]').forEach(node => {
    node.textContent = elapsed;
  });

  const remaining = state.choiceDeadline
    ? Math.max(0, Math.ceil((state.choiceDeadline - now()) / 1000))
    : CHOICE_LIMIT_SECONDS;
  document.querySelectorAll('[data-choice-clock]').forEach(node => {
    node.textContent = ui.settings?.timedTurns ? matchdayFormatClock(remaining) : 'NINCS LIMIT';
    node.classList.toggle(
      'is-urgent',
      Boolean(ui.settings?.timedTurns && state.choiceDeadline && remaining <= 10),
    );
  });
}

function stopChoiceTimer(ui, { keepPending = false } = {}) {
  const state = stateFor(ui);
  if (state.choiceTimer) globalThis.clearInterval?.(state.choiceTimer);
  state.choiceTimer = 0;
  state.choiceDeadline = 0;
  state.choicePausedAt = 0;
  state.choiceKind = null;
  if (!keepPending) state.pendingChoiceKind = null;
  updateClocks(ui);
}

function automaticChoice(ui, kind) {
  const game = stateFor(ui).lastGame;
  if (!game) return false;

  if (kind === 'attribute') {
    const key = game.availableAttributeKeys?.()[0];
    if (!key) return false;
    ui.showToast?.('Lejárt a 90 másodperc – automatikus kategóriaválasztás.', 'info', 2600);
    ui.handlers?.onAttribute?.(key);
    return true;
  }

  const attribute = game.attribute;
  const cards = Array.isArray(game.hands?.[HUMAN]) ? game.hands[HUMAN] : [];
  const card = cards.find(item => !attribute || hasAttributeData(item, attribute));
  if (!card) return false;
  ui.showToast?.('Lejárt a 90 másodperc – automatikus kártyaválasztás.', 'info', 2600);
  ui.handlers?.onCard?.(card);
  return true;
}

function startChoiceTimer(ui, kind, game = null) {
  const state = stateFor(ui);
  if (game) state.lastGame = game;
  state.pendingChoiceKind = kind;

  if (!ui.settings?.timedTurns) {
    stopChoiceTimer(ui, { keepPending: true });
    return false;
  }
  if (state.kickoffPending || state.kickoffRunning) {
    updateClocks(ui);
    return true;
  }

  stopChoiceTimer(ui, { keepPending: true });
  state.choiceKind = kind;
  state.choiceDeadline = now() + CHOICE_LIMIT_SECONDS * 1000;
  state.choiceTimer = globalThis.setInterval?.(() => {
    const current = now();
    if (isPaused(ui)) {
      if (!state.choicePausedAt) state.choicePausedAt = current;
      return;
    }
    if (state.choicePausedAt) {
      state.choiceDeadline += current - state.choicePausedAt;
      state.choicePausedAt = 0;
    }
    updateClocks(ui);
    if (current < state.choiceDeadline) return;
    const expiredKind = state.choiceKind;
    stopChoiceTimer(ui);
    automaticChoice(ui, expiredKind);
  }, 250) ?? 0;
  updateClocks(ui);
  return true;
}

function stopMatchClock(ui, { reset = false } = {}) {
  const state = stateFor(ui);
  if (state.matchTimer) globalThis.clearInterval?.(state.matchTimer);
  state.matchTimer = 0;
  state.matchPausedAt = 0;
  if (reset) {
    state.matchStartedAt = 0;
    state.matchElapsedMs = 0;
  }
  updateClocks(ui);
}

function startMatchClock(ui) {
  const state = stateFor(ui);
  stopMatchClock(ui, { reset: true });
  state.matchStartedAt = now();
  state.matchTimer = globalThis.setInterval?.(() => {
    const current = now();
    if (isPaused(ui)) {
      if (!state.matchPausedAt) state.matchPausedAt = current;
      return;
    }
    if (state.matchPausedAt) {
      state.matchStartedAt += current - state.matchPausedAt;
      state.matchPausedAt = 0;
    }
    state.matchElapsedMs = Math.max(0, current - state.matchStartedAt);
    updateClocks(ui);
  }, 250) ?? 0;
  updateClocks(ui);
}

function prepareWhistle(ui) {
  if (!ui.settings?.sounds) return null;
  try {
    const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextCtor) return null;
    const context = new AudioContextCtor();
    context.resume?.();
    stateFor(ui).whistleContext = context;
    return context;
  } catch {
    return null;
  }
}

function playWhistle(ui) {
  if (!ui.settings?.sounds) return;
  const state = stateFor(ui);
  try {
    const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    const context = state.whistleContext ?? (AudioContextCtor ? new AudioContextCtor() : null);
    if (!context) return;
    context.resume?.();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1850, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(2450, context.currentTime + .22);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.18, context.currentTime + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .38);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .4);
    oscillator.addEventListener('ended', () => {
      context.close?.();
      state.whistleContext = null;
    }, { once: true });
  } catch {
    state.whistleContext = null;
  }
}

function beginKickoff(ui) {
  const state = stateFor(ui);
  if (!state.kickoffPending || state.kickoffRunning) return false;
  state.kickoffPending = false;
  state.kickoffRunning = true;
  stopChoiceTimer(ui, { keepPending: true });
  prepareWhistle(ui);

  document.querySelector('#matchday-kickoff')?.remove();
  const layer = el('div', 'matchday-kickoff');
  layer.id = 'matchday-kickoff';
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'assertive');
  document.body.appendChild(layer);
  ui.dom?.pub?.classList.add('matchday-kickoff-active');

  const steps = ['3', '2', '1', '📣 SÍP!'];
  let index = 0;
  const advance = () => {
    layer.textContent = steps[index];
    layer.dataset.step = String(index);
    if (index === steps.length - 1) {
      playWhistle(ui);
      startMatchClock(ui);
      globalThis.setTimeout?.(() => {
        layer.remove();
        ui.dom?.pub?.classList.remove('matchday-kickoff-active');
        state.kickoffRunning = false;
        if (state.pendingChoiceKind) startChoiceTimer(ui, state.pendingChoiceKind, state.lastGame);
      }, 520);
      return;
    }
    index += 1;
    globalThis.setTimeout?.(advance, KICKOFF_STEP_MS);
  };
  advance();
  return true;
}

function applyTimedSetting(ui, enabled) {
  ui.settings.timedTurns = Boolean(enabled);
  writeStoredBoolean(TIMED_TURNS_KEY, ui.settings.timedTurns);
  if (!ui.settings.timedTurns) {
    stopChoiceTimer(ui);
  } else {
    const state = stateFor(ui);
    const categoriesVisible = Boolean(
      ui.dom?.picker?.querySelector('button[data-attribute], .attr-btn, .category-tile'),
    );
    const kind = categoriesVisible ? 'attribute' : state.lastSelectable ? 'card' : null;
    if (kind) startChoiceTimer(ui, kind, state.lastGame);
  }
  updateClocks(ui);
}

function injectTimedSetting(ui, root) {
  const list = root?.querySelector?.('.settings-list');
  if (list && !list.querySelector('[data-setting="timedTurns"]')) {
    const row = el('label', 'setting-switch');
    row.dataset.setting = 'timedTurns';
    const copy = el('span', 'setting-switch__copy');
    copy.append(
      el('strong', null, '⏱ 90 mp-es választási idő'),
      el('small', null, 'Kategória- és kártyaválasztásonként 90 másodperc'),
    );
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(ui.settings?.timedTurns);
    input.setAttribute('aria-label', '90 másodperces választási idő');
    input.addEventListener('change', () => applyTimedSetting(ui, input.checked));
    row.append(copy, input, el('span', 'setting-switch__visual'));
    list.appendChild(row);
  }

  const menu = root?.classList?.contains('menu-panel') ? root : root?.querySelector?.('.menu-panel');
  if (menu && !menu.querySelector('[data-timed-mode-toggle]')) {
    const label = el('label', 'timed-mode-toggle');
    label.dataset.timedModeToggle = 'true';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(ui.settings?.timedTurns);
    input.addEventListener('change', () => applyTimedSetting(ui, input.checked));
    label.append(input, el('span', null, '⏱ 90 mp választási idő'));
    menu.querySelector('.primary-mode-actions')?.after(label);
  }
}

function decorateFinalScore(ui, root) {
  const final = root?.querySelector?.('.final-score');
  if (!final || final.dataset.sportsScoreboard === 'true') return;
  const match = final.textContent?.match(/JÁTÉKOS\s+(\d+)\s*[–-]\s*(\d+)\s+GÉP/i);
  if (!match) return;

  final.dataset.sportsScoreboard = 'true';
  final.replaceChildren(
    el('span', 'final-score__team', 'JÁTÉKOS '),
    el('strong', 'final-score__numbers', `${match[1]}–${match[2]}`),
    el('span', 'final-score__team', ' GÉP'),
    el('small', 'final-score__time', ` · IDŐ ${matchdayFormatClock(stateFor(ui).matchElapsedMs / 1000)}`),
  );

  const heading = root.querySelector('h1')?.textContent?.trim().toLocaleUpperCase('hu-HU');
  if (heading === 'DÖNTETLEN') {
    root.classList.remove('result-panel--loss');
    root.classList.add('result-panel--tie');
  }
}

UI.prototype._renderMatchScoreboard = function renderMatchScoreboard(game, human, ai) {
  const board = el('div', `match-scoreboard${game.mode === 'penalties' ? ' match-scoreboard--penalties' : ''}`);
  const status = scoreboardStatus(game);
  const humanLabel = teamLabel(game, HUMAN);
  const aiLabel = teamLabel(game, AI);
  board.setAttribute('role', 'status');
  board.setAttribute('aria-live', 'polite');
  board.setAttribute('aria-label', `${humanLabel} ${human}, ${aiLabel} ${ai}. ${status.toLowerCase()}.`);

  const competition = el('div', 'match-scoreboard__competition', game.mode === 'penalties' ? 'BÜNTETŐPÁRBAJ' : 'KÁRTYAMECCS');
  const clock = el('div', 'match-scoreboard__clock');
  clock.append(el('span', null, 'IDŐ'), el('strong', null, '00:00'));
  clock.querySelector('strong').dataset.matchClock = 'true';

  const home = el('div', 'match-team match-team--home');
  home.append(el('span', 'match-team__crest', '⚽'), el('span', 'match-team__name', humanLabel.toUpperCase()));
  const score = el('div', 'match-scoreboard__score');
  score.append(
    el('strong', 'match-scoreboard__number', String(human)),
    el('span', 'match-scoreboard__separator', '–'),
    el('strong', 'match-scoreboard__number', String(ai)),
  );
  const away = el('div', 'match-team match-team--away');
  away.append(el('span', 'match-team__name', aiLabel.toUpperCase()), el('span', 'match-team__crest', '🤖'));
  const statusNode = el('div', 'match-scoreboard__status', status);
  const choice = el('div', 'match-scoreboard__choice');
  choice.append(
    el('span', null, 'VÁLASZTÁS'),
    el('strong', null, this.settings?.timedTurns ? '01:30' : 'NINCS LIMIT'),
  );
  choice.querySelector('strong').dataset.choiceClock = 'true';
  board.append(competition, clock, home, score, away, statusNode, choice);
  return board;
};

UI.prototype._renderClassicScores = function renderClassicMatchScore(game) {
  matchdayPrevious.classicScores?.call(this, game);
  const { [HUMAN]: human, [AI]: ai } = game.scores;
  this.dom.hudScores.replaceChildren(this._renderMatchScoreboard(game, human, ai));
  updateClocks(this);
};

UI.prototype._renderPenaltyScores = function renderPenaltyMatchScore(game) {
  matchdayPrevious.penaltyScores?.call(this, game);
  this.dom.hudScores.replaceChildren(this._renderMatchScoreboard(game, game.scores[HUMAN], game.scores[AI]));
  updateClocks(this);
};

UI.prototype.setSettings = function setMatchdaySettings(settings = {}) {
  const timedTurns = readStoredBoolean(TIMED_TURNS_KEY, settings.timedTurns ?? this.settings?.timedTurns ?? false);
  return matchdayPrevious.setSettings.call(this, { ...settings, timedTurns });
};

UI.prototype.resetTable = function resetMatchdayTable(...args) {
  const output = matchdayPrevious.resetTable.apply(this, args);
  const state = stateFor(this);
  stopChoiceTimer(this);
  stopMatchClock(this, { reset: true });
  state.kickoffPending = true;
  state.kickoffRunning = false;
  state.pendingChoiceKind = null;
  state.lastGame = null;
  state.lastSelectable = false;
  state.whistleContext?.close?.();
  state.whistleContext = null;
  document.querySelector('#matchday-kickoff')?.remove();
  this.dom?.pub?.classList.remove('matchday-kickoff-active');
  return output;
};

UI.prototype.renderScores = function renderScoresWithMatchday(game) {
  const output = matchdayPrevious.renderScores.call(this, game);
  const state = stateFor(this);
  state.lastGame = game;
  updateClocks(this);
  if (state.kickoffPending) beginKickoff(this);
  return output;
};

UI.prototype.showAttributePicker = function showTimedAttributePicker(game) {
  const output = matchdayPrevious.showAttributePicker.call(this, game);
  const state = stateFor(this);
  state.lastGame = game;
  state.lastSelectable = false;
  startChoiceTimer(this, 'attribute', game);
  return output;
};

UI.prototype.hideAttributePicker = function hideTimedAttributePicker(...args) {
  if (stateFor(this).choiceKind === 'attribute') stopChoiceTimer(this);
  return matchdayPrevious.hideAttributePicker.apply(this, args);
};

UI.prototype.renderHands = function renderTimedHands(game, options = {}) {
  const output = matchdayPrevious.renderHands.call(this, game, options);
  const state = stateFor(this);
  state.lastGame = game;
  state.lastSelectable = Boolean(options.selectable);
  if (options.selectable) startChoiceTimer(this, 'card', game);
  else if (state.choiceKind === 'card') stopChoiceTimer(this);
  return output;
};

UI.prototype.showDuel = function showMatchdayDuel(...args) {
  stopChoiceTimer(this);
  return matchdayPrevious.showDuel.apply(this, args);
};

UI.prototype.showVerdict = function showMatchdayVerdict(...args) {
  stopChoiceTimer(this);
  return matchdayPrevious.showVerdict.apply(this, args);
};

UI.prototype.showOverlay = function showMatchdayOverlay(node) {
  const output = matchdayPrevious.showOverlay.call(this, node);
  injectTimedSetting(this, node);
  if (node?.classList?.contains('result-panel')) {
    const state = stateFor(this);
    stopChoiceTimer(this);
    if (state.matchStartedAt && state.matchTimer) state.matchElapsedMs = Math.max(0, now() - state.matchStartedAt);
    stopMatchClock(this);
    decorateFinalScore(this, node);
  }
  return output;
};

/* A torna eredménye csak a Torna kezdőlapjára továbblépve válik véglegessé. */
const tournamentFlow = {
  active: null,
  enhancedPanels: new WeakSet(),
  observer: null,
};

const cloneTournament = value => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function removePrematureArchive(tournamentId) {
  try {
    const raw = globalThis.localStorage?.getItem(TOURNAMENT_HISTORY_STORAGE_KEY);
    if (!raw) return;
    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return;
    globalThis.localStorage.setItem(
      TOURNAMENT_HISTORY_STORAGE_KEY,
      JSON.stringify(history.filter(item => item?.id !== tournamentId)),
    );
  } catch {
    // A történeti lista tisztítása nem akadályozhatja az újrajátszást.
  }
}

function captureTournamentResult(panel) {
  if (tournamentFlow.active || tournamentFlow.enhancedPanels.has(panel)) return;
  const rematchButton = panel.querySelector('#rematch-btn');
  const stored = tournamentStorageService.read();
  if (!rematchButton || !stored?.currentMatchId) return;
  tournamentFlow.active = {
    panel,
    rematchButton,
    beforeResult: cloneTournament(stored),
  };
}

function enhanceTournamentResult(panel) {
  const active = tournamentFlow.active;
  if (!active || active.panel !== panel || tournamentFlow.enhancedPanels.has(panel)) return;
  const context = panel.querySelector('.tournament-result-context');
  const actions = panel.querySelector('.result-actions');
  if (!context || !actions) return;

  const afterResult = tournamentStorageService.read();
  if (!afterResult || afterResult.id !== active.beforeResult.id || afterResult.currentMatchId) return;

  tournamentStorageService.save(active.beforeResult);
  removePrematureArchive(active.beforeResult.id);
  context.textContent = `${afterResult.name} · az eredmény elfogadásra vár`;
  actions.replaceChildren();

  const replayButton = el('button', 'btn btn--ghost', '↻ Meccs újrajátszása');
  replayButton.type = 'button';
  replayButton.addEventListener('click', () => {
    const originalRematch = active.rematchButton;
    tournamentStorageService.save(active.beforeResult);
    tournamentFlow.active = null;
    originalRematch.click();
  }, { once: true });

  const tournamentHomeButton = el(
    'button',
    'btn',
    afterResult.status === 'complete' ? '🏆 Torna végeredménye' : '🏆 Torna kezdőlapja',
  );
  tournamentHomeButton.type = 'button';
  tournamentHomeButton.addEventListener('click', () => {
    tournamentStorageService.save(afterResult);
    tournamentFlow.active = null;
    globalThis.FociskartyakTournament?.showCenter?.(afterResult, null);
  }, { once: true });

  actions.append(replayButton, tournamentHomeButton);
  tournamentFlow.enhancedPanels.add(panel);
}

function inspectTournamentResults() {
  document.querySelectorAll('.result-panel').forEach(panel => {
    captureTournamentResult(panel);
    enhanceTournamentResult(panel);
  });
}

if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
  tournamentFlow.observer = new MutationObserver(inspectTournamentResults);
  tournamentFlow.observer.observe(document.documentElement, { childList: true, subtree: true });
  inspectTournamentResults();
}
