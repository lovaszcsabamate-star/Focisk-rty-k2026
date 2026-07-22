/** Football-broadcast scoreboard rendered directly from session state. */

import { UI, el } from './ui.js';
import { AI, HUMAN, PHASE } from './engine.js';

const previousClassicScores = UI.prototype._renderClassicScores;
const previousPenaltyScores = UI.prototype._renderPenaltyScores;
const sideLabel = (side, playerName) => side === HUMAN ? playerName : 'Gép';
const otherSide = side => side === HUMAN ? AI : HUMAN;

function scoreboardStatus(game, playerName) {
  if (game.phase === PHASE.GAME_OVER) return 'VÉGEREDMÉNY';
  if (game.phase === PHASE.REVEAL) return `KÖVETKEZŐ VÁLASZTÓ: ${sideLabel(otherSide(game.chooser), playerName).toLocaleUpperCase('hu-HU')}`;
  return `KATEGÓRIÁT VÁLASZT: ${sideLabel(game.chooser, playerName).toLocaleUpperCase('hu-HU')}`;
}

UI.prototype._renderMatchScoreboard = function renderMatchScoreboard(game, human, ai) {
  const playerName = this.playerName;
  const opponentName = globalThis.__FOCISKARTYAK_OPPONENT__?.name ?? 'Gép';
  const board = el('div', `match-scoreboard${game.mode === 'penalties' ? ' match-scoreboard--penalties' : ''}`);
  const status = scoreboardStatus(game, playerName);
  board.setAttribute('role', 'status');
  board.setAttribute('aria-live', 'polite');
  board.setAttribute('aria-label', `${playerName} ${human}, ${opponentName} ${ai}. ${status.toLocaleLowerCase('hu-HU')}.`);

  const opponent = globalThis.__FOCISKARTYAK_OPPONENT__;
  const prefix = opponent && Number.isFinite(opponent.level) && Number.isFinite(opponent.overall)
    ? `${opponent.level}. SZINT · OVR ${opponent.overall} · `
    : '';
  const competition = el('div', 'match-scoreboard__competition', `${prefix}${game.mode === 'penalties' ? 'BÜNTETŐPÁRBAJ' : 'NB I KÁRTYAMECCS'}`);
  const home = el('div', 'match-team match-team--home');
  const homeName = el('span', 'match-team__name', playerName.toLocaleUpperCase('hu-HU'));
  homeName.dataset.playerName = 'upper';
  homeName.title = playerName;
  home.append(el('span', 'match-team__crest', '⚽'), homeName);

  const score = el('div', 'match-scoreboard__score');
  score.append(
    el('strong', 'match-scoreboard__number', String(human)),
    el('span', 'match-scoreboard__separator', '–'),
    el('strong', 'match-scoreboard__number', String(ai)),
  );

  const away = el('div', 'match-team match-team--away');
  away.append(el('span', 'match-team__name', opponentName.toLocaleUpperCase('hu-HU')), el('span', 'match-team__crest', '🤖'));
  const possession = el('div', 'match-scoreboard__status', status);
  board.append(competition, home, score, away, possession);
  return board;
};

UI.prototype._renderClassicScores = function renderClassicMatchScore(game) {
  previousClassicScores.call(this, game);
  const { [HUMAN]: human, [AI]: ai } = game.scores;
  this.dom.hudScores.replaceChildren(this._renderMatchScoreboard(game, human, ai));
};

UI.prototype._renderPenaltyScores = function renderPenaltyMatchScore(game) {
  previousPenaltyScores.call(this, game);
  const human = game.scores[HUMAN];
  const ai = game.scores[AI];
  this.dom.hudScores.replaceChildren(this._renderMatchScoreboard(game, human, ai));
};
