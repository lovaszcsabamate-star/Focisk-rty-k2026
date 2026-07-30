/** Football-broadcast scoreboard, kickoff, timed turns and tournament-result flow. */

import { UI, el } from './ui.js';
import { AI, HUMAN, PHASE } from './engine.js';
import { hasAttributeData } from './data/players.js';
import { saveBooleanSetting } from './mobile-experience.js';
import {
  TOURNAMENT_HISTORY_STORAGE_KEY,
  tournamentStorageService,
} from './services/tournament-storage-service.js';

export const CHOICE_LIMIT_SECONDS = 90;
export const KICKOFF_STEP_MS = 650;

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
});

const matchdayStates = new WeakMap();
const matchdaySideLabel = side => side === HUMAN ? 'Játékos' : 'Gép';
const matchdayOtherSide = side => side === HUMAN ? AI : HUMAN;
const matchdayNow = () => Date.now();

const matchdayTeamLabel = (game, side) => {
  const quickMatchLabel = side === HUMAN ? game?.quickMatch?.humanTeam : game?.quickMatch?.aiTeam;
  return String(quickMatchLabel ?? matchdaySideLabel(side)).trim() || matchdaySideLabel(side);
};

export function matchdayFormatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function matchdayState(ui) {
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
  };
  matchdayStates.set(ui, state);
  return state;
}

function matchdayScoreboardStatus(game) {
  if (game.phase === PHASE.GAME_OVER) return 'VÉGEREDMÉNY';
  if (game.phase === PHASE.REVEAL) {
    return `KÖVETKEZŐ VÁLASZTÓ: ${matchdaySideLabel(matchdayOtherSide(game.chooser)).toUpperCase()}`;
  }
  return `KATEGÓRIÁT VÁLASZT: ${matchdaySideLabel(game.chooser).toUpperCase()}`;
}

const matchdayOverlayOpen = ui => ui.dom?.overlay?.hidden === false || document.visibilityState === 'hidden';

function matchdayUpdateClockNodes(ui) {
  const state = matchdayState(ui);
  const elapsed = matchdayFormatClock(state.matchElapsedMs / 1000);
  document.querySelectorAll('[data-match-clock]').forEach(node => {
    node.textContent = elapsed;
  });

  const remaining = state.choiceDeadline
    ? Math.max(0, Math.ceil((state.choiceDeadline - matchdayNow()) / 1000))
    : CHOICE_LIMIT_SECONDS;
  document.querySelectorAll('[data-choice-clock]').forEach(node => {
    node.textContent = ui.settings?.timedTurns ? matchdayFormatClock(remaining) : 'NINCS LIMIT';
    node.classList.toggle(
      'is-urgent',
      Boolean(ui.settings?.timedTurns && state.choiceDeadline && remaining <= 10),
    );
  });
}

function matchdayStopChoiceTimer(ui, { keepPending = false } = {}) {
  const state = matchdayState(ui);
  if (state.choiceTimer) globalThis.clearInterval?.(state.choiceTimer);
  state.choiceTimer = 0;
  state.choiceDeadline = 0;
  state.choicePausedAt = 0;
  state.choiceKind = null;
  if (!keepPending) state.pendingChoiceKind = null;
  matchdayUpdateClockNodes(ui);
}

function matchdayAutomaticChoice(ui, kind) {
  const game = matchdayState(ui).lastGame;
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

function matchdayStartChoiceTimer(ui, kind, game = null) {
  const state = matchdayState(ui);
  if (game) state.lastGame = game;
  state.pendingChoiceKind = kind;

  if (!ui.settings?.timedTurns) {
    matchdayStopChoiceTimer(ui, { keepPending: true });
    return false;
  }
  if (state.kickoffRunning || state.kickoffPending) {
    matchdayUpdateClockNodes(ui);
    return true;
  }

  matchdayStopChoiceTimer(ui, { keepPending: true });
  state.choiceKind = kind;
  state.choiceDeadline = matchdayNow() + CHOICE_LIMIT_SECONDS * 1000;
  state.choiceTimer = globalThis.setInterval?.(() => {
    const now = matchdayNow();
    const paused = matchdayOverlayOpen(ui);
    if (paused) {
      if (!state.choicePausedAt) state.choicePausedAt = now;
      return;
    }
    if (state.choicePausedAt) {
      state.choiceDeadline += now - state.choicePausedAt;
      state.choicePausedAt = 0;
    }
    matchdayUpdateClockNodes(ui);
    if (now < state.choiceDeadline) return;
    const expiredKind = state.choiceKind;
    matchdayStopChoiceTimer(ui);
    matchdayAutomaticChoice(ui, expiredKind);
  }, 250) ?? 0;
  matchdayUpdateClockNodes(ui);
  return true;
}

function matchdayStopMatchClock(ui, { reset = false } = {}) {
  const state = matchdayState(ui);
  if (state.matchTimer) globalThis.clearInterval?.(state.matchTimer);
  state.matchTimer = 0;
  state.matchPausedAt = 0;
  if (reset) {
    state.matchStartedAt = 0;
    state.matchElapsedMs = 0;
  }
  matchdayUpdateClockNodes(ui);
}

function matchdayStartMatchClock(ui) {
  const state = matchdayState(ui);
  matchdayStopMatchClock(ui, { reset: true });
  state.matchStartedAt = matchdayNow();
  state.matchTimer = globalThis.setInterval?.(() => {
    const now = matchdayNow();
    if (matchdayOverlayOpen(ui)) {
      if (!state.matchPausedAt) state.matchPausedAt = now;
      return;
    }
    if (state.matchPausedAt) {
      state.matchStartedAt += now - state.matchPausedAt;
      state.matchPausedAt = 0;
    }
    state.matchElapsedMs = Math.max(0, now - state.matchStartedAt);
    matchdayUpdateClockNodes(ui);
  }, 250) ?? 0;
  matchdayUpdateClockNodes(ui);
}

function matchdayPlayWhistle(ui) {
  if (!ui.settings?.sounds) return;
  try {
    const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
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
    oscillator.addEventListener('ended', () => context.close?.(), { once: true });
  } catch {
    // A hangkimenet tiltása nem akadályozhatja a mérkőzés indulását.
  }
}

function matchdayBeginKickoff(ui) {
  const state = matchdayState(ui);
  if (!state.kickoffPending || state.kickoffRunning) return false;
  state.kickoffPending = false;
  state.kickoffRunning = true;
  matchdayStopChoiceTimer(ui, { keepPending: true });

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
      matchdayPlayWhistle(ui);
      matchdayStartMatchClock(ui);
      globalThis.setTimeout?.(() => {
        layer.remove();
        ui.dom?.pub?.classList.remove('matchday-kickoff-active');
        state.kickoffRunning = false;
        if (state.pendingChoiceKind) {
          matchdayStartChoiceTimer(ui, state.pendingChoiceKind, state.lastGame);
        }
      }, 520);
      return;
    }
    index += 1;
    globalThis.setTimeout?.(advance, KICKOFF_STEP_MS);
  };
  advance();
  return true;
}

function matchdayApplyTimedSetting(ui, checked) {
  ui.settings.timedTurns = Boolean(checked);
  saveBooleanSetting('timedTurns', ui.settings.timedTurns);
  if (!ui.settings.timedTurns) {
    matchdayStopChoiceTimer(ui);
  } else {
    const state = matchdayState(ui);
    const hasCategories = Boolean(
      ui.dom?.picker?.querySelector('button[data-attribute], .attr-btn, .category-tile'),
    );
    const kind = hasCategories ? 'attribute' : state.lastSelectable ? 'card' : null;
    if (kind) matchdayStartChoiceTimer(ui, kind, state.lastGame);
  }
  matchdayUpdateClockNodes(ui);
}

function matchdayInjectTimedSetting(ui, root) {
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
    input.addEventListener('change', () => matchdayApplyTimedSetting(ui, input.checked));
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
    input.addEventListener('change', () => matchdayApplyTimedSetting(ui, input.checked));
    label.append(input, el('span', null, '⏱ 90 mp választási idő'));
    menu.querySelector('.primary-mode-actions')?.after(label);
  }
}

function matchdayDecorateFinalScore(ui, root) {
  const final = root?.querySelector?.('.final-score');
  if (!final || final.dataset.sportsScoreboard === 'true') return;
  const match = final.textContent?.match(/JÁTÉKOS\s+(\d+)\s*[–-]\s*(\d+)\s+GÉP/i);
  if (!match) return;

  const elapsed = matchdayFormatClock(matchdayState(ui).matchElapsedMs / 1000);
  final.dataset.sportsScoreboard = 'true';
  final.replaceChildren(
    el('span', 'final-score__team', 'JÁTÉKOS '),
    el('strong', 'final-score__numbers', `${match[1]}–${match[2]}`),
    el('span', 'final-score__team', ' GÉP'),
    el('small', 'final-score__time', ` · IDŐ ${elapsed}`),
  );

  const heading = root.querySelector('h1')?.textContent?.trim().toLocaleUpperCase('hu-HU');
  if (heading === 'DÖNTETLEN') {
    root.classList.remove('result-panel--loss');
    root.classList.add('result-panel--tie');
  }
}

UI.prototype._renderMatchScoreboard = function renderMatchScoreboard(game, human, ai) {
  const board = el(
    'div',
    `match-scoreboard${game.mode === 'penalties' ? ' match-scoreboard--penalties' : ''}`,
  );
  const status = matchdayScoreboardStatus(game);
  const humanLabel = matchdayTeamLabel(game, HUMAN);
  const aiLabel = matchdayTeamLabel(game, AI);
  board.setAttribute('role', 'status');
  board.setAttribute('aria-live', 'polite');
  board.setAttribute(
    'aria-label',
    `${humanLabel} ${human}, ${aiLabel} ${ai}. ${status.toLowerCase()}.`,
  );

  const competition = el(
    'div',
    'match-scoreboard__competition',
    game.mode === 'penalties' ? 'BÜNTETŐPÁRBAJ' : 'KÁRTYAMECCS',
  );
  const clock = el('div', 'match-scoreboard__clock');
  clock.append(el('span', null, 'IDŐ'), el('strong', null, '00:00'));
  clock.querySelector('strong').dataset.matchClock = 'true';

  const home = el('div', 'match-team match-team--home');
  home.append(
    el('span', 'match-team__crest', '⚽'),
    el('span', 'match-team__name', humanLabel.toUpperCase()),
  );
  const score = el('div', 'match-scoreboard__score');
  score.append(
    el('strong', 'match-scoreboard__number', String(human)),
    el('span', 'match-scoreboard__separator', '–'),
    el('strong', 'match-scoreboard__number', String(ai)),
  );
  const away = el('div', 'match-team match-team--away');
  away.append(
    el('span', 'match-team__name', aiLabel.toUpperCase()),
    el('span', 'match-team__crest', '🤖'),
  );
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
  matchdayUpdateClockNodes(this);
};

UI.prototype._renderPenaltyScores = function renderPenaltyMatchScore(game) {
  matchdayPrevious.penaltyScores?.call(this, game);
  this.dom.hudScores.replaceChildren(
    this._renderMatchScoreboard(game, game.scores[HUMAN], game.scores[AI]),
  );
  matchdayUpdateClockNodes(this);
};

UI.prototype.resetTable = function resetMatchdayTable(...args) {
  const output = matchdayPrevious.resetTable.apply(this, args);
  const state = matchdayState(this);
  matchdayStopChoiceTimer(this);
  matchdayStopMatchClock(this, { reset: true });
  state.kickoffPending = true;
  state.kickoffRunning = false;
  state.pendingChoiceKind = null;
  state.lastGame = null;
  state.lastSelectable = false;
  document.querySelector('#matchday-kickoff')?.remove();
  this.dom?.pub?.classList.remove('matchday-kickoff-active');
  return output;
};

UI.prototype.renderScores = function renderScoresWithMatchday(game) {
  const output = matchdayPrevious.renderScores.call(this, game);
  const state = matchdayState(this);
  state.lastGame = game;
  matchdayUpdateClockNodes(this);
  if (state.kickoffPending) matchdayBeginKickoff(this);
  return output;
};

UI.prototype.showAttributePicker = function showTimedAttributePicker(game) {
  const output = matchdayPrevious.showAttributePicker.call(this, game);
  const state = matchdayState(this);
  state.lastGame = game;
  state.lastSelectable = false;
  matchdayStartChoiceTimer(this, 'attribute', game);
  return output;
};

UI.prototype.hideAttributePicker = function hideTimedAttributePicker(...args) {
  if (matchdayState(this).choiceKind === 'attribute') matchdayStopChoiceTimer(this);
  return matchdayPrevious.hideAttributePicker.apply(this, args);
};

UI.prototype.renderHands = function renderTimedHands(game, options = {}) {
  const output = matchdayPrevious.renderHands.call(this, game, options);
  const state = matchdayState(this);
  state.lastGame = game;
  state.lastSelectable = Boolean(options.selectable);
  if (options.selectable) matchdayStartChoiceTimer(this, 'card', game);
  else if (state.choiceKind === 'card') matchdayStopChoiceTimer(this);
  return output;
};

UI.prototype.showDuel = function showMatchdayDuel(...args) {
  matchdayStopChoiceTimer(this);
  return matchdayPrevious.showDuel.apply(this, args);
};

UI.prototype.showVerdict = function showMatchdayVerdict(...args) {
  matchdayStopChoiceTimer(this);
  return matchdayPrevious.showVerdict.apply(this, args);
};

UI.prototype.showOverlay = function showMatchdayOverlay(node) {
  const output = matchdayPrevious.showOverlay.call(this, node);
  matchdayInjectTimedSetting(this, node);
  if (node?.classList?.contains('result-panel')) {
    const state = matchdayState(this);
    matchdayStopChoiceTimer(this);
    if (state.matchStartedAt && state.matchTimer) {
      state.matchElapsedMs = Math.max(0, matchdayNow() - state.matchStartedAt);
    }
    matchdayStopMatchClock(this);
    matchdayDecorateFinalScore(this, node);
  }
  return output;
};

/* Tornaeredmény: az eredmény csak a Torna kezdőlapja gombbal válik véglegessé.
   Az Újrajátszás az eredeti csapatokkal és a korábban kiválasztott kerettel indul. */
const tournamentResultFlow = {
  active: null,
  enhancedPanels: new WeakSet(),
  observer: null,
};

const tournamentClone = value => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

function tournamentRemovePrematureArchive(tournamentId) {
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

function tournamentCaptureOriginalResult(panel) {
  if (tournamentResultFlow.active || tournamentResultFlow.enhancedPanels.has(panel)) return;
  const rematchButton = panel.querySelector('#rematch-btn');
  const stored = tournamentStorageService.read();
  if (!rematchButton || !stored?.currentMatchId) return;
  tournamentResultFlow.active = {
    panel,
    rematchButton,
    beforeResult: tournamentClone(stored),
  };
}

function tournamentEnhanceProcessedResult(panel) {
  const active = tournamentResultFlow.active;
  if (!active || active.panel !== panel || tournamentResultFlow.enhancedPanels.has(panel)) return;
  const context = panel.querySelector('.tournament-result-context');
  const actions = panel.querySelector('.result-actions');
  if (!context || !actions) return;

  const afterResult = tournamentStorageService.read();
  if (!afterResult || afterResult.id !== active.beforeResult.id || afterResult.currentMatchId) return;

  tournamentStorageService.save(active.beforeResult);
  tournamentRemovePrematureArchive(active.beforeResult.id);
  context.textContent = `${afterResult.name} · az eredmény elfogadásra vár`;
  actions.replaceChildren();

  const replayButton = el('button', 'btn btn--ghost', '↻ Meccs újrajátszása');
  replayButton.type = 'button';
  replayButton.addEventListener('click', () => {
    const originalRematch = active.rematchButton;
    tournamentStorageService.save(active.beforeResult);
    tournamentResultFlow.active = null;
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
    tournamentResultFlow.active = null;
    globalThis.FociskartyakTournament?.showCenter?.(afterResult, null);
  }, { once: true });

  actions.append(replayButton, tournamentHomeButton);
  tournamentResultFlow.enhancedPanels.add(panel);
}

function tournamentInspectResults() {
  document.querySelectorAll('.result-panel').forEach(panel => {
    tournamentCaptureOriginalResult(panel);
    tournamentEnhanceProcessedResult(panel);
  });
}

if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
  tournamentResultFlow.observer = new MutationObserver(tournamentInspectResults);
  tournamentResultFlow.observer.observe(document.documentElement, { childList: true, subtree: true });
  tournamentInspectResults();
}
