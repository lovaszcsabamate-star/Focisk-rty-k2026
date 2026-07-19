/** Football-broadcast scoreboard and match-rule copy. Loaded after the UX layer. */

import { UI, el } from './ui.js';
import { AI, HUMAN, PHASE } from './engine.js';

const previousClassicScores = UI.prototype._renderClassicScores;
const previousPenaltyScores = UI.prototype._renderPenaltyScores;
const previousShowOverlay = UI.prototype.showOverlay;

const sideLabel = side => side === HUMAN ? 'Játékos' : 'Gép';
const otherSide = side => side === HUMAN ? AI : HUMAN;

function scoreboardStatus(game) {
  if (game.phase === PHASE.GAME_OVER) return 'VÉGEREDMÉNY';
  if (game.phase === PHASE.REVEAL) return `KÖVETKEZŐ VÁLASZTÓ: ${sideLabel(otherSide(game.chooser)).toUpperCase()}`;
  return `KATEGÓRIÁT VÁLASZT: ${sideLabel(game.chooser).toUpperCase()}`;
}

UI.prototype._renderMatchScoreboard = function renderMatchScoreboard(game, human, ai) {
  const board = el('div', `match-scoreboard${game.mode === 'penalties' ? ' match-scoreboard--penalties' : ''}`);
  const status = scoreboardStatus(game);
  board.setAttribute('role', 'status');
  board.setAttribute('aria-live', 'polite');
  board.setAttribute('aria-label', `Játékos ${human}, Gép ${ai}. ${status.toLowerCase()}.`);

  const competition = el('div', 'match-scoreboard__competition', game.mode === 'penalties' ? 'TIZENEGYESEK' : 'NB I KÁRTYAMECCS');
  const home = el('div', 'match-team match-team--home');
  home.append(el('span', 'match-team__crest', '⚽'), el('span', 'match-team__name', 'JÁTÉKOS'));

  const score = el('div', 'match-scoreboard__score');
  score.append(
    el('strong', 'match-scoreboard__number', String(human)),
    el('span', 'match-scoreboard__separator', '–'),
    el('strong', 'match-scoreboard__number', String(ai)),
  );

  const away = el('div', 'match-team match-team--away');
  away.append(el('span', 'match-team__name', 'GÉP'), el('span', 'match-team__crest', '🤖'));

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

UI.prototype.showOverlay = function showAlternatingChooserRules(node) {
  const classicRules = node.querySelector?.('[data-rules="classic"]');
  if (classicRules) {
    classicRules.innerHTML = '<b>Klasszikus szabály:</b> A két fél körönként felváltva választ kategóriát. A kör győztese viszi a két lapot és a döntetlenpaklit.';
  }

  const penaltyRules = node.querySelector?.('[data-rules="penalties"]');
  if (penaltyRules) {
    penaltyRules.innerHTML = '<b>Tizenegyes szabály:</b> A két fél párbajonként felváltva választ kategóriát. 11 lap, öt rendes párbaj, döntetlennél hirtelen halál; azonos értéknél nincs gól.';
  }

  previousShowOverlay.call(this, node);
};
