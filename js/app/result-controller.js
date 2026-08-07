/** Végeredmény-képernyő központi alkalmazási vezérlője. */

import { AI, HUMAN } from '../engine.js';
import { getLine } from '../banter.js';
import { ATTRIBUTE_BY_KEY } from '../data/players.js';
import {
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STRUCTURED_RESULT_KEY,
  tournamentMatchById,
} from '../tournament/tournament-domain.js';
import { el } from '../ui.js';

export class ResultControllerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ResultControllerError';
    this.code = code;
  }
}

const resultControllerRequiredActions = Object.freeze([
  'setBusy',
  'start',
  'showTitleScreen',
  'showPanel',
]);

const resultControllerAssertMethod = (target, method, code) => {
  if (typeof target?.[method] !== 'function') {
    throw new ResultControllerError(code, `Az eredményvezérlőből hiányzik a(z) ${method} művelet.`);
  }
};

const resultControllerCardId = card => String(card?.meta?.mirrorOf ?? card?.id ?? '').trim();
const resultControllerDuelEvents = (game, matchId) => {
  const log = Array.isArray(game?.log) ? game.log : [];
  return log.map((duel, index) => {
    const humanPlayerId = resultControllerCardId(duel?.humanCard);
    const aiPlayerId = resultControllerCardId(duel?.aiCard);
    const attribute = String(duel?.attribute ?? '').trim();
    const outcome = duel?.winner === HUMAN ? 'win' : duel?.winner === AI ? 'loss' : 'draw';
    if (!humanPlayerId || !attribute) return null;
    return Object.freeze({
      id: `${matchId}:${game?.mode ?? 'classic'}:${index + 1}:${humanPlayerId}:${attribute}`,
      round: Number(duel?.round) || index + 1,
      attribute,
      outcome,
      humanPlayerId,
      humanPlayerName: String(duel?.humanCard?.name ?? humanPlayerId),
      aiPlayerId,
      aiPlayerName: String(duel?.aiCard?.name ?? aiPlayerId),
    });
  }).filter(Boolean);
};

const stageStructuredTournamentResult = ({ result, mode, game, won, lost }) => {
  const tournament = globalThis.FociskartyakTournament?.read?.();
  if (!tournament?.currentMatchId) return null;
  const match = tournamentMatchById(tournament, tournament.currentMatchId);
  if (!match || match.status === TOURNAMENT_MATCH_STATUS.COMPLETE) return null;

  const humanScore = Number(result?.human);
  const aiScore = Number(result?.ai);
  if (!Number.isFinite(humanScore) || !Number.isFinite(aiScore)) return null;

  const humanHome = match.homeId === tournament.humanTeamId;
  const opponentId = humanHome ? match.awayId : match.homeId;
  const playerPayload = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ ?? globalThis.__EMBEDDED_PLAYER_DATA__;
  const playerById = new Map((Array.isArray(playerPayload?.players) ? playerPayload.players : [])
    .map(player => [String(player.id), player]));
  const lineup = (Array.isArray(tournament.currentLineupIds) ? tournament.currentLineupIds : []).map(playerId => ({
    playerId: String(playerId),
    name: playerById.get(String(playerId))?.name || String(playerId),
  }));
  const payload = Object.freeze({
    schemaVersion: 1,
    tournamentId: tournament.id,
    matchId: match.id,
    mode,
    homeScore: humanHome ? humanScore : aiScore,
    awayScore: humanHome ? aiScore : humanScore,
    winnerId: won ? tournament.humanTeamId : lost ? opponentId : null,
    decidedBy: mode === 'penalties'
      ? (match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK ? 'penalties' : 'played-penalties')
      : 'played',
    humanOutcome: won ? 'win' : lost ? 'loss' : 'draw',
    penaltyMatch: mode === 'penalties',
    tiebreak: match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK,
    lineup,
    duels: resultControllerDuelEvents(game, match.id),
    createdAt: new Date().toISOString(),
  });
  globalThis[TOURNAMENT_STRUCTURED_RESULT_KEY] = payload;
  return payload;
};

export function createResultController({
  ui,
  getState,
  actions,
  clearSaved,
  elementFactory = el,
  attributeRegistry = ATTRIBUTE_BY_KEY,
  getBanterLine = getLine,
  humanId = HUMAN,
  aiId = AI,
} = {}) {
  resultControllerAssertMethod(ui, 'setInteractionBusy', 'INVALID_UI');
  resultControllerAssertMethod(ui, 'say', 'INVALID_UI');
  if (typeof getState !== 'function') {
    throw new ResultControllerError('INVALID_STATE_ADAPTER', 'Az eredményvezérlő állapotadaptere kötelező.');
  }
  resultControllerRequiredActions.forEach(method => resultControllerAssertMethod(actions, method, 'INVALID_ACTIONS'));
  if (typeof clearSaved !== 'function') {
    throw new ResultControllerError('INVALID_PERSISTENCE_ADAPTER', 'A mentés törlőfüggvénye kötelező.');
  }
  if (typeof elementFactory !== 'function') {
    throw new ResultControllerError('INVALID_ELEMENT_FACTORY', 'Az eredményvezérlő elemgyártó függvénye kötelező.');
  }

  const bestCategoryLabel = result => {
    if (!Array.isArray(result?.bestCategories) || result.bestCategories.length === 0) {
      return 'Nem volt megnyert kategória';
    }
    return result.bestCategories.map(key => {
      const attribute = attributeRegistry[key];
      return attribute ? `${attribute.icon} ${attribute.label}` : key;
    }).join(', ');
  };

  const showGameOver = () => {
    const state = getState() ?? {};
    const result = state.result;
    if (!result || typeof result !== 'object') {
      throw new ResultControllerError('INVALID_RESULT', 'A végeredmény nem érhető el.');
    }

    actions.setBusy(true);
    ui.setInteractionBusy(false);

    const won = result.winner === humanId;
    const lost = result.winner === aiId;
    const structuredTournamentResult = stageStructuredTournamentResult({
      result,
      mode: state.mode,
      game: state.game,
      won,
      lost,
    });
    clearSaved();
    ui.say(getBanterLine(won ? 'gameOverWin' : lost ? 'gameOverLose' : 'gameOverTie'));

    const panel = elementFactory('div', `result-panel ${won ? 'result-panel--win' : 'result-panel--loss'}`);
    if (structuredTournamentResult && panel && typeof panel === 'object') {
      Object.defineProperty(panel, 'fociskartyakTournamentResult', {
        value: structuredTournamentResult,
        enumerable: false,
        configurable: false,
      });
    }
    if (state.mode === 'penalties') {
      const best = bestCategoryLabel(result);
      panel.innerHTML = `
        <p class="result-kicker">${result.stage === 'hirtelen halál' ? '⚠ Hirtelen halál' : '⏱ Rendes játékidő'}</p>
        <h1>${won ? 'GYŐZELEM' : 'VERESÉG'}</h1>
        <div class="final-score">JÁTÉKOS ${result.human}–${result.ai} GÉP</div>
        <dl class="result-stats">
          <div><dt>Felhasznált párbajok</dt><dd>${result.duels}</dd></div>
          <div><dt>Eldőlt</dt><dd>${result.stage}</dd></div>
          <div><dt>Legeredményesebb kategória</dt><dd>${best}${result.bestCategoryWins ? ` (${result.bestCategoryWins} gól)` : ''}</dd></div>
        </dl>
        <div class="result-actions"><button class="btn" id="rematch-btn">Visszavágó</button><button class="btn btn--ghost" id="menu-btn">Vissza a főmenübe</button></div>
      `;
    } else {
      const heading = won ? 'GYŐZELEM' : lost ? 'VERESÉG' : 'DÖNTETLEN';
      panel.innerHTML = `
        <h1>${heading}</h1>
        <div class="final-score">JÁTÉKOS ${result.human}–${result.ai} GÉP</div>
        ${result.undecided ? `<p>${result.undecided} lap a döntetlenpakliban maradt.</p>` : ''}
        <div class="result-actions"><button class="btn" id="rematch-btn">Visszavágó</button><button class="btn btn--ghost" id="menu-btn">Vissza a főmenübe</button></div>
      `;
    }

    const showTitle = () => actions.showTitleScreen({ offerOnboarding: false });
    panel.querySelector('#rematch-btn').addEventListener('click', () => actions.start(state.mode, state.difficulty), { once: true });
    panel.querySelector('#menu-btn').addEventListener('click', showTitle, { once: true });
    actions.showPanel(panel, showTitle);
    return panel;
  };

  return Object.freeze({
    bestCategoryLabel,
    showGameOver,
  });
}
