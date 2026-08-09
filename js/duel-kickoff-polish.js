/**
 * Duel Visual Polish + Kickoff Countdown 1.0
 *
 * Prezentációs és indítási kapu a meglévő játékmotor fölött. A kickoff-szekvencia
 * tokenizált és megszakítható; nem módosítja a Game/PenaltyGame szabályait.
 */

import {
  UI,
  beginUiEnhancementLayer,
  commitUiEnhancementLayer,
  el,
  rollbackUiEnhancementLayer,
} from './ui.js';
import { AI, HUMAN } from './engine.js';

const DUEL_KICKOFF_LAYER = './duel-kickoff-polish.js';
const DUEL_KICKOFF_STYLE_ID = 'duel-kickoff-polish-styles';
export const KICKOFF_WHISTLE_ASSET = 'assets/ui/referee-whistle.svg';

export const KICKOFF_COUNTDOWN_STEPS = Object.freeze([
  Object.freeze({ id: 'three', label: '3', duration: 380 }),
  Object.freeze({ id: 'two', label: '2', duration: 380 }),
  Object.freeze({ id: 'one', label: '1', duration: 380 }),
  Object.freeze({ id: 'go', label: 'Hajrá!', duration: 500 }),
  Object.freeze({ id: 'whistle', label: 'Síp', duration: 420 }),
]);

const duelKickoffSchedule = (callback, delay) => globalThis.setTimeout?.(callback, delay) ?? null;
const duelKickoffCancelSchedule = timer => {
  if (timer != null) globalThis.clearTimeout?.(timer);
};

/**
 * Determinisztikus, egyetlen aktív tokennel dolgozó kickoff-szekvencia.
 * Régi timer callback soha nem léphet tovább egy újabb indításon.
 */
export function createKickoffSequenceController({
  schedule = duelKickoffSchedule,
  cancelSchedule = duelKickoffCancelSchedule,
} = {}) {
  let serial = 0;
  let active = null;

  const cancel = () => {
    serial += 1;
    if (!active) return false;
    cancelSchedule(active.timer);
    active = null;
    return true;
  };

  const isRunning = () => Boolean(active);
  const currentToken = () => active?.token ?? null;

  const start = ({
    steps = KICKOFF_COUNTDOWN_STEPS,
    reducedMotion = false,
    onStep = () => {},
    onComplete = () => {},
    onError = () => {},
  } = {}) => {
    if (active) return false;
    const sequence = Array.isArray(steps) ? steps.filter(Boolean) : [];
    if (!sequence.length) {
      onComplete();
      return true;
    }

    const token = ++serial;
    let index = 0;
    active = { token, timer: null };

    const tick = () => {
      if (active?.token !== token) return;
      if (index >= sequence.length) {
        active = null;
        try { onComplete(); } catch (error) { onError(error); }
        return;
      }

      const step = sequence[index];
      try {
        onStep(step, index);
      } catch (error) {
        active = null;
        onError(error);
        return;
      }

      const rawDuration = Math.max(0, Number(step.duration) || 0);
      const duration = reducedMotion ? Math.min(rawDuration, 120) : rawDuration;
      active.timer = schedule(() => {
        if (active?.token !== token) return;
        index += 1;
        tick();
      }, duration);
    };

    tick();
    return token;
  };

  return Object.freeze({ start, cancel, isRunning, currentToken });
}

export function duelKickoffVisualState(winner) {
  if (winner === HUMAN) return Object.freeze({ human: 'winner', ai: 'loser' });
  if (winner === AI) return Object.freeze({ human: 'loser', ai: 'winner' });
  return Object.freeze({ human: 'neutral', ai: 'neutral' });
}

const duelKickoffText = value => String(value ?? '').trim();
const completedKickoffGames = new WeakSet();
const kickoffStates = new WeakMap();

const duelKickoffState = ui => {
  let state = kickoffStates.get(ui);
  if (!state) {
    state = {
      controller: createKickoffSequenceController(),
      game: null,
      overlay: null,
    };
    kickoffStates.set(ui, state);
  }
  return state;
};

const duelKickoffTeams = game => ({
  human: duelKickoffText(game?.quickMatch?.humanTeam) || 'Játékos',
  ai: duelKickoffText(game?.quickMatch?.aiTeam) || 'Gép',
});

const duelKickoffTournamentContext = () => {
  let tournament = null;
  try { tournament = globalThis.FociskartyakTournament?.read?.() ?? null; } catch { tournament = null; }
  if (!tournament?.currentMatchId) return null;
  for (const round of Array.isArray(tournament.rounds) ? tournament.rounds : []) {
    const match = round?.matches?.find?.(candidate => candidate?.id === tournament.currentMatchId);
    if (!match) continue;
    return Object.freeze({
      name: duelKickoffText(tournament.name) || 'Torna',
      stage: duelKickoffText(match.label) || duelKickoffText(round?.label) || 'Mérkőzés',
      lineupCount: Array.isArray(tournament.currentLineupIds) ? tournament.currentLineupIds.length : 0,
    });
  }
  return null;
};

const duelKickoffPresentation = label => {
  const branding = globalThis.__FOCISKARTYAK_BRANDING__;
  const presentation = branding?.resolveClubPresentation?.(label);
  if (presentation) return presentation;
  return Object.freeze({
    short: branding?.resolveClubShortLabel?.(label) || duelKickoffText(label).slice(0, 4).toLocaleUpperCase('hu-HU') || 'FC',
    primary: '#6d4d2f',
    secondary: '#d5b45d',
  });
};

const duelKickoffTeamNode = (label, { showBadge = false } = {}) => {
  const team = el('span', 'gameplay-match-intro__team kickoff-countdown__team');
  if (showBadge) {
    const presentation = duelKickoffPresentation(label);
    const badge = el('span', 'quick-team-mark quick-team-mark--text kickoff-countdown__badge', presentation.short);
    badge.dataset.teamLabel = label;
    badge.style.setProperty('--team-primary', presentation.primary);
    badge.style.setProperty('--team-secondary', presentation.secondary);
    badge.setAttribute('aria-hidden', 'true');
    team.appendChild(badge);
  }
  team.appendChild(el('span', 'kickoff-countdown__team-name', label));
  return team;
};

const duelKickoffEnsureStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(DUEL_KICKOFF_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DUEL_KICKOFF_STYLE_ID;
  style.textContent = `
    .duel-slot.duel-visual-winner .card {
      opacity: 1 !important;
      filter: none !important;
      visibility: visible !important;
    }
    .duel-slot.duel-visual-loser {
      opacity: 1 !important;
      visibility: visible !important;
    }
    .duel-slot.duel-visual-loser .card {
      display: flex !important;
      opacity: .86 !important;
      filter: grayscale(.16) saturate(.58) brightness(.72) !important;
      visibility: visible !important;
      transform: none !important;
      box-shadow: 0 10px 24px rgba(0,0,0,.58), 0 0 0 1px rgba(255,255,255,.08) !important;
    }
    .duel-slot.duel-visual-loser .stat.active {
      filter: brightness(.9);
    }

    .gameplay-match-intro.kickoff-countdown-intro {
      cursor: default;
      animation: none !important;
      user-select: none;
    }
    .kickoff-countdown-intro .gameplay-match-intro__card {
      width: min(680px, 100%);
      overflow: hidden;
    }
    .kickoff-countdown__team {
      display: grid;
      justify-items: center;
      gap: 8px;
      min-width: 0;
    }
    .kickoff-countdown__badge {
      display: grid;
      place-items: center;
      width: clamp(54px, 14vw, 88px);
      height: clamp(54px, 14vw, 88px);
    }
    .kickoff-countdown__badge .quick-team-mark__image {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .kickoff-countdown__team-name {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: clamp(.95rem, 3.5vw, 1.45rem);
      font-weight: 950;
    }
    .kickoff-countdown__stage {
      display: grid;
      place-items: center;
      min-height: clamp(112px, 24vh, 168px);
      margin-top: 12px;
    }
    .kickoff-countdown__value {
      color: #fff7df;
      font-family: var(--font-display, system-ui, sans-serif);
      font-size: clamp(4.5rem, 21vw, 9rem);
      font-weight: 950;
      line-height: .9;
      letter-spacing: .02em;
      text-shadow: 0 7px 28px rgba(0,0,0,.7), 0 0 28px rgba(232,195,122,.28);
      animation: kickoff-countdown-pop .28s cubic-bezier(.2,.85,.25,1) both;
    }
    .kickoff-countdown__value[data-step="go"] {
      color: #fff3bd;
      font-size: clamp(2.8rem, 13vw, 6rem);
      text-transform: uppercase;
    }
    .kickoff-countdown__whistle {
      width: clamp(96px, 28vw, 150px);
      height: auto;
      filter: drop-shadow(0 8px 24px rgba(0,0,0,.55));
      animation: kickoff-whistle-pop .3s cubic-bezier(.2,.9,.25,1) both;
    }
    .kickoff-countdown__whistle[hidden],
    .kickoff-countdown__value[hidden] { display: none !important; }
    .kickoff-countdown__hint {
      display: block;
      margin-top: 8px;
      color: #a99a82;
      font-size: 10px;
      font-weight: 750;
    }
    .kickoff-countdown__lineup {
      display: block;
      margin-top: 6px;
      color: #d9c895;
      font-size: 10px;
      font-weight: 900;
    }
    @keyframes kickoff-countdown-pop {
      from { opacity: 0; transform: scale(.74); }
      55% { opacity: 1; transform: scale(1.08); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes kickoff-whistle-pop {
      from { opacity: 0; transform: translateX(-14px) rotate(-8deg) scale(.82); }
      to { opacity: 1; transform: none; }
    }
    @media (max-width: 620px) {
      .kickoff-countdown-intro .gameplay-match-intro__teams { grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); }
      .kickoff-countdown-intro .gameplay-match-intro__versus { width: 40px; height: 40px; }
      .kickoff-countdown__stage { min-height: 104px; }
    }
    @media (orientation: landscape) and (max-height: 520px) {
      .kickoff-countdown-intro .gameplay-match-intro__card { padding: 10px 18px; }
      .kickoff-countdown__badge { width: 46px; height: 46px; }
      .kickoff-countdown__stage { min-height: 68px; margin-top: 4px; }
      .kickoff-countdown__value { font-size: clamp(3.2rem, 14vh, 5rem); }
      .kickoff-countdown__value[data-step="go"] { font-size: clamp(2.2rem, 10vh, 3.8rem); }
      .kickoff-countdown__whistle { width: 82px; }
      .kickoff-countdown__hint { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .kickoff-countdown__value,
      .kickoff-countdown__whistle { animation: none !important; }
    }
  `;
  document.head?.appendChild(style);
};

const duelKickoffCleanupOverlay = state => {
  state.overlay?.remove?.();
  state.overlay = null;
};

const duelKickoffCancel = ui => {
  const state = kickoffStates.get(ui);
  if (!state) return false;
  const cancelled = state.controller.cancel();
  duelKickoffCleanupOverlay(state);
  state.game = null;
  return cancelled;
};

const duelKickoffIsRunning = ui => Boolean(kickoffStates.get(ui)?.controller?.isRunning?.());

const duelKickoffApplyResult = (ui, result) => {
  if (!ui?.dom?.duel || !result) return false;
  const slots = [...ui.dom.duel.querySelectorAll(':scope > .duel-slot')];
  if (slots.length < 2) return false;
  const visual = duelKickoffVisualState(result.winner);
  const states = [visual.human, visual.ai];
  slots.forEach((slot, index) => {
    slot.classList.remove('duel-visual-winner', 'duel-visual-loser');
    slot.removeAttribute('data-duel-result');
    if (states[index] === 'winner') {
      slot.classList.add('duel-visual-winner');
      slot.dataset.duelResult = 'winner';
    } else if (states[index] === 'loser') {
      slot.classList.add('duel-visual-loser');
      slot.dataset.duelResult = 'loser';
    }
  });
  return true;
};

const duelKickoffRemoveLegacyIntro = game => {
  if (!completedKickoffGames.has(game) || typeof document === 'undefined') return false;
  const legacy = document.querySelector('.gameplay-match-intro:not(.kickoff-countdown-intro)');
  if (!legacy) return false;
  legacy.remove();
  return true;
};

const duelKickoffCreateOverlay = game => {
  const teams = duelKickoffTeams(game);
  const tournament = duelKickoffTournamentContext();
  const showBadge = Boolean(game?.quickMatch || tournament);
  const overlay = el('div', 'gameplay-match-intro kickoff-countdown-intro');
  overlay.dataset.kickoffCountdown = 'true';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-atomic', 'true');
  overlay.setAttribute('aria-label', `${teams.human} – ${teams.ai}. Kezdő visszaszámlálás.`);

  const card = el('section', 'gameplay-match-intro__card');
  card.appendChild(el(
    'span',
    'gameplay-match-intro__eyebrow',
    tournament ? `${tournament.name} · ${tournament.stage}` : game?.mode === 'penalties' ? 'Büntetőpárbaj' : 'Kezdődik a mérkőzés',
  ));
  const matchup = el('span', 'gameplay-match-intro__teams');
  matchup.append(
    duelKickoffTeamNode(teams.human, { showBadge }),
    el('span', 'gameplay-match-intro__versus', 'VS'),
    duelKickoffTeamNode(teams.ai, { showBadge }),
  );
  card.appendChild(matchup);

  const stage = el('span', 'kickoff-countdown__stage');
  const value = el('span', 'kickoff-countdown__value', '3');
  value.dataset.step = 'three';
  const whistle = document.createElement('img');
  whistle.className = 'kickoff-countdown__whistle';
  whistle.src = KICKOFF_WHISTLE_ASSET;
  whistle.alt = '';
  whistle.hidden = true;
  stage.append(value, whistle);
  card.appendChild(stage);
  if (tournament?.lineupCount === 11) card.appendChild(el('span', 'kickoff-countdown__lineup', 'Keret: 11/11 ✓'));
  card.appendChild(el('span', 'kickoff-countdown__hint', 'A mérkőzés a síp után indul.'));
  overlay.appendChild(card);
  return { overlay, value, whistle };
};

const duelKickoffReducedMotion = () => {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
};

const duelKickoffStart = (ui, game, { onComplete = () => {}, onError = () => {} } = {}) => {
  if (!ui || !game || typeof document === 'undefined') return false;
  const state = duelKickoffState(ui);
  if (state.controller.isRunning()) return false;
  duelKickoffEnsureStyles();
  duelKickoffCleanupOverlay(state);
  state.game = game;

  const nodes = duelKickoffCreateOverlay(game);
  state.overlay = nodes.overlay;
  document.body.appendChild(nodes.overlay);
  globalThis.__FOCISKARTYAK_TEAM_LOGO_RESTORATION__?.refresh?.();

  const finalize = () => {
    if (state.game !== game) return false;
    completedKickoffGames.add(game);
    duelKickoffCleanupOverlay(state);
    state.game = null;
    return true;
  };

  const token = state.controller.start({
    reducedMotion: duelKickoffReducedMotion(),
    onStep: step => {
      if (state.game !== game) return;
      nodes.value.hidden = step.id === 'whistle';
      nodes.whistle.hidden = step.id !== 'whistle';
      if (step.id !== 'whistle') {
        nodes.value.textContent = step.label;
        nodes.value.dataset.step = step.id;
        nodes.value.setAttribute('aria-label', step.label);
      } else {
        nodes.overlay.setAttribute('aria-label', 'Síp. A mérkőzés indul.');
      }
    },
    onComplete: () => {
      if (!finalize()) return;
      try { onComplete(); } catch (error) { onError(error); }
    },
    onError: error => {
      if (!finalize()) return;
      onError(error);
    },
  });

  return Boolean(token);
};

beginUiEnhancementLayer(DUEL_KICKOFF_LAYER);
try {
  duelKickoffEnsureStyles();
  const duelKickoffPrevious = Object.freeze({
    resetTable: UI.prototype.resetTable,
    renderHands: UI.prototype.renderHands,
    showAttributePicker: UI.prototype.showAttributePicker,
    showDuel: UI.prototype.showDuel,
  });

  UI.prototype.resetTable = function resetTableWithDuelKickoff(...args) {
    duelKickoffCancel(this);
    return duelKickoffPrevious.resetTable.apply(this, args);
  };

  UI.prototype.renderHands = function renderHandsWithDuelKickoff(game, options = {}) {
    const output = duelKickoffPrevious.renderHands.call(this, game, options);
    duelKickoffRemoveLegacyIntro(game);
    return output;
  };

  UI.prototype.showAttributePicker = function showAttributePickerWithDuelKickoff(game) {
    const output = duelKickoffPrevious.showAttributePicker.call(this, game);
    duelKickoffRemoveLegacyIntro(game);
    return output;
  };

  UI.prototype.showDuel = function showDuelWithDuelVisualPolish(game, options = {}) {
    const output = duelKickoffPrevious.showDuel.call(this, game, options);
    if (options.result) duelKickoffApplyResult(this, options.result);
    return output;
  };

  commitUiEnhancementLayer(DUEL_KICKOFF_LAYER);
} catch (error) {
  rollbackUiEnhancementLayer(DUEL_KICKOFF_LAYER);
  throw error;
}

globalThis.__FOCISKARTYAK_DUEL_KICKOFF__ = Object.freeze({
  start: duelKickoffStart,
  cancel: duelKickoffCancel,
  isRunning: duelKickoffIsRunning,
  sequence: KICKOFF_COUNTDOWN_STEPS,
  whistleAsset: KICKOFF_WHISTLE_ASSET,
});
