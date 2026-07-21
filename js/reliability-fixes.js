/** Reliability, restored-save and result-presentation repairs. */

import './mobile-experience.js';
import { UI, el } from './ui.js';
import { AI, HUMAN } from './engine.js';
import { calculateAge } from './data/players.js';
import { loadPlayerName } from './player-profile.js';
import { normalizeLegacyOpponentId, STORAGE_KEYS } from './mobile-experience.js';

export const SAVED_MATCH_STORAGE_KEY = STORAGE_KEYS.save;

export function savedOpponentIdFromRawSave(rawValue) {
  try {
    const parsed = JSON.parse(String(rawValue ?? ''));
    return normalizeLegacyOpponentId(parsed?.difficulty) || null;
  } catch {
    return null;
  }
}

export function shouldSuppressRestoredVerdictFeedback(ui, game) {
  const recordedRounds = Number(ui?.uxStats?.rounds);
  const resolvedRounds = Array.isArray(game?.log) ? game.log.length : 0;
  return resolvedRounds > 0 && Number.isFinite(recordedRounds) && recordedRounds >= resolvedRounds;
}

export function ageResultExplanation(result) {
  if (!['birthDate', 'birthDateOlder'].includes(result?.attribute)) return null;
  const humanAge = calculateAge(result.humanCard?.birthDate);
  const aiAge = calculateAge(result.aiCard?.birthDate);
  if (!Number.isFinite(humanAge) || humanAge !== aiAge) return null;

  const humanDate = Date.parse(result.humanCard.birthDate);
  const aiDate = Date.parse(result.aiCard.birthDate);
  if (!Number.isFinite(humanDate) || !Number.isFinite(aiDate) || humanDate === aiDate) {
    return `mindkettő ${humanAge} éves`;
  }

  const wantsOlder = result.attribute === 'birthDateOlder';
  const humanMatches = wantsOlder ? humanDate < aiDate : humanDate > aiDate;
  const selected = humanMatches ? result.humanCard : result.aiCard;
  return `mindkettő ${humanAge} éves, de ${selected.name} ${wantsOlder ? 'idősebb' : 'fiatalabb'}`;
}

function syncSavedReliabilityOpponent() {
  try {
    const opponentId = savedOpponentIdFromRawSave(localStorage.getItem(SAVED_MATCH_STORAGE_KEY));
    if (opponentId) globalThis.__FOCISKARTYAK_SELECT_OPPONENT__?.(opponentId);
  } catch {
    // Local storage is optional in restricted browser contexts.
  }
}

const reliabilityPreviousShowOverlay = UI.prototype.showOverlay;
UI.prototype.showOverlay = function showReliableOverlay(node) {
  const output = reliabilityPreviousShowOverlay.call(this, node);
  const heading = node?.querySelector?.('h1')?.textContent?.trim().toLocaleUpperCase('hu-HU');
  if (heading === 'DÖNTETLEN' && node.classList?.contains('result-panel')) {
    node.classList.remove('result-panel--loss');
    node.classList.add('result-panel--tie');
  }
  return output;
};

const reliabilityPreviousMatchScoreboard = UI.prototype._renderMatchScoreboard;
if (typeof reliabilityPreviousMatchScoreboard === 'function') {
  UI.prototype._renderMatchScoreboard = function renderReliableMatchScoreboard(game, human, ai) {
    const board = reliabilityPreviousMatchScoreboard.call(this, game, human, ai);
    const playerName = loadPlayerName();
    const opponent = globalThis.__FOCISKARTYAK_OPPONENT__;
    const opponentName = opponent?.name ?? board.querySelector('.match-team--away .match-team__name')?.textContent ?? 'Gép';
    const homeName = board.querySelector('.match-team--home .match-team__name');
    const competition = board.querySelector('.match-scoreboard__competition');
    const status = board.querySelector('.match-scoreboard__status')?.textContent ?? '';

    if (homeName) {
      homeName.textContent = playerName.toLocaleUpperCase('hu-HU');
      homeName.title = playerName;
    }

    if (competition) {
      const prefix = opponent && Number.isFinite(opponent.level) && Number.isFinite(opponent.overall)
        ? `${opponent.level}. SZINT · OVR ${opponent.overall} · `
        : '';
      competition.textContent = `${prefix}${game.mode === 'penalties' ? 'BÜNTETŐPÁRBAJ' : 'NB I KÁRTYAMECCS'}`;
    }

    board.setAttribute('aria-label', `${playerName} ${human}, ${opponentName} ${ai}.${status ? ` ${status.toLocaleLowerCase('hu-HU')}.` : ''}`);
    return board;
  };
}

const reliabilityPreviousPenaltyScores = UI.prototype._renderPenaltyScores;
UI.prototype._renderPenaltyScores = function renderPenaltyHistory(game) {
  reliabilityPreviousPenaltyScores.call(this, game);
  const history = Array.isArray(game.cycleHistory) ? game.cycleHistory : [];
  if (!history.length) return;

  const details = el('details', 'penalty-cycle-history');
  details.appendChild(el('summary', null, `Korábbi ciklusok (${history.length})`));
  const list = el('ol', 'penalty-cycle-history__list');
  for (const entry of history) {
    const humanAttempts = entry.attempts?.[HUMAN] ?? [];
    const aiAttempts = entry.attempts?.[AI] ?? [];
    const goals = attempts => attempts.filter(outcome => outcome === 'win').length;
    const score = entry.scoreAfterCycle ?? {};
    list.appendChild(el(
      'li',
      null,
      `${entry.cycle}. ciklus: ${goals(humanAttempts)}–${goals(aiAttempts)} cikluseredmény · összesen ${score[HUMAN] ?? 0}–${score[AI] ?? 0}`,
    ));
  }
  details.appendChild(list);
  this.dom.penaltyBoard.appendChild(details);
};

const reliabilityPreviousShowVerdict = UI.prototype.showVerdict;
UI.prototype.showVerdict = function showReliableVerdict(result, game) {
  const restoredResult = shouldSuppressRestoredVerdictFeedback(this, game);
  const statsSnapshot = restoredResult && this.uxStats
    ? (typeof structuredClone === 'function' ? structuredClone(this.uxStats) : JSON.parse(JSON.stringify(this.uxStats)))
    : null;
  const previousSounds = this.settings?.sounds;
  const previousVibration = this.settings?.vibration;

  if (restoredResult && this.settings) {
    this.settings.sounds = false;
    this.settings.vibration = false;
  }

  try {
    const output = reliabilityPreviousShowVerdict.call(this, result, game);
    const ageExplanation = ageResultExplanation(result);
    if (ageExplanation) {
      const detail = this.dom.verdict.querySelector('small');
      if (detail) {
        const suffix = detail.textContent.includes(' · ') ? ` · ${detail.textContent.split(' · ').slice(1).join(' · ')}` : '';
        detail.textContent = `${ageExplanation}${suffix}`;
      }
    }
    return output;
  } finally {
    if (restoredResult && this.settings) {
      this.settings.sounds = previousSounds;
      this.settings.vibration = previousVibration;
    }
    if (statsSnapshot) this.uxStats = statsSnapshot;
    if (restoredResult) this.dom?.verdict?.classList.remove('ux-verdict-pop');
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#continue-btn')) return;
    syncSavedReliabilityOpponent();
  }, true);
}
