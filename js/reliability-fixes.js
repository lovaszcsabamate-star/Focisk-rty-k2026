/**
 * Small reliability and usability fixes layered on the existing UI.
 * The game engine and both rule sets remain unchanged.
 */

import './mobile-experience.js';
import { UI } from './ui.js';
import { loadPlayerName, localizeInterfaceTextValue } from './player-profile.js';

export const SAVED_MATCH_STORAGE_KEY = 'fociskartyak:saved-match:v2';

export function savedOpponentIdFromRawSave(rawValue) {
  try {
    const parsed = JSON.parse(String(rawValue ?? ''));
    return typeof parsed?.difficulty === 'string' && parsed.difficulty.trim()
      ? parsed.difficulty.trim()
      : null;
  } catch {
    return null;
  }
}

export function shouldSuppressRestoredVerdictFeedback(ui, game) {
  const recordedRounds = Number(ui?.uxStats?.rounds);
  const resolvedRounds = Array.isArray(game?.log) ? game.log.length : 0;
  return resolvedRounds > 0 && Number.isFinite(recordedRounds) && recordedRounds >= resolvedRounds;
}

function localizeReliabilityTree(root) {
  if (!root) return;
  const documentRoot = root.nodeType === 9 ? root : root.ownerDocument;
  if (!documentRoot?.createTreeWalker) return;

  const walker = documentRoot.createTreeWalker(root, globalThis.NodeFilter?.SHOW_TEXT ?? 4);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const textNode of textNodes) {
    const parentTag = textNode.parentElement?.tagName;
    if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA') continue;
    const localized = localizeInterfaceTextValue(textNode.nodeValue);
    if (localized !== textNode.nodeValue) textNode.nodeValue = localized;
  }

  const nodes = [
    ...(root.matches?.('[title], [aria-label]') ? [root] : []),
    ...(root.querySelectorAll?.('[title], [aria-label]') ?? []),
  ];
  for (const node of nodes) {
    for (const attribute of ['title', 'aria-label']) {
      if (!node.hasAttribute(attribute)) continue;
      const current = node.getAttribute(attribute);
      const localized = localizeInterfaceTextValue(current);
      if (localized !== current) node.setAttribute(attribute, localized);
    }
  }
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
  localizeReliabilityTree(node);

  const heading = node?.querySelector?.('h1')?.textContent?.trim().toLocaleUpperCase('hu-HU');
  if (heading === 'DÖNTETLEN' && node.classList?.contains('result-panel')) {
    node.classList.remove('result-panel--loss');
    node.classList.add('result-panel--tie');
  }

  return reliabilityPreviousShowOverlay.call(this, node);
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

    board.setAttribute(
      'aria-label',
      `${playerName} ${human}, ${opponentName} ${ai}.${status ? ` ${status.toLocaleLowerCase('hu-HU')}.` : ''}`,
    );
    return board;
  };
}

const reliabilityPreviousShowVerdict = UI.prototype.showVerdict;
UI.prototype.showVerdict = function showReliableVerdict(result, game) {
  const restoredResult = shouldSuppressRestoredVerdictFeedback(this, game);
  if (!restoredResult) return reliabilityPreviousShowVerdict.call(this, result, game);

  const statsSnapshot = this.uxStats
    ? (typeof structuredClone === 'function'
      ? structuredClone(this.uxStats)
      : JSON.parse(JSON.stringify(this.uxStats)))
    : null;
  const previousSounds = this.settings?.sounds;
  const previousVibration = this.settings?.vibration;

  if (this.settings) {
    this.settings.sounds = false;
    this.settings.vibration = false;
  }

  try {
    return reliabilityPreviousShowVerdict.call(this, result, game);
  } finally {
    if (this.settings) {
      this.settings.sounds = previousSounds;
      this.settings.vibration = previousVibration;
    }
    if (statsSnapshot) this.uxStats = statsSnapshot;
    this.dom?.verdict?.classList.remove('ux-verdict-pop');
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#continue-btn')) return;
    syncSavedReliabilityOpponent();
  }, true);
}
