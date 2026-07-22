/** Pure reliability helpers used directly by the session controller. */

export const SAVED_MATCH_STORAGE_KEY = 'fociskartyak:saved-match:v2';

const LEGACY_OPPONENT_IDS = Object.freeze({
  pub: 'bogdan', regular: 'd-raven', shark: 'h-li',
  easy: 'bogdan', medium: 'd-raven', hard: 'h-li',
});

export function savedOpponentIdFromRawSave(rawValue) {
  try {
    const parsed = JSON.parse(String(rawValue ?? ''));
    const difficulty = typeof parsed?.difficulty === 'string' ? parsed.difficulty.trim() : '';
    return difficulty ? (LEGACY_OPPONENT_IDS[difficulty] ?? difficulty) : null;
  } catch {
    return null;
  }
}

export function syncSavedReliabilityOpponent(rawValue) {
  let raw = rawValue;
  if (raw === undefined) {
    try { raw = localStorage.getItem(SAVED_MATCH_STORAGE_KEY); } catch { raw = null; }
  }
  const opponentId = savedOpponentIdFromRawSave(raw);
  if (opponentId) globalThis.__FOCISKARTYAK_SELECT_OPPONENT__?.(opponentId);
  return opponentId;
}

export function shouldSuppressRestoredVerdictFeedback(ui, game) {
  const recordedRounds = Number(ui?.uxStats?.rounds);
  const resolvedRounds = Array.isArray(game?.log) ? game.log.length : 0;
  return resolvedRounds > 0 && Number.isFinite(recordedRounds) && recordedRounds >= resolvedRounds;
}
