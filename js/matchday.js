/** Football-broadcast scoreboard and match-rule copy. Loaded after the UX layer. */

import { UI, el } from './ui.js';
import { AI, HUMAN, PHASE } from './engine.js';

const matchdayPreviousClassicScores = UI.prototype._renderClassicScores;
const matchdayPreviousPenaltyScores = UI.prototype._renderPenaltyScores;
const matchdayPreviousShowOverlay = UI.prototype.showOverlay;

const matchdaySideLabel = side => side === HUMAN ? 'Játékos' : 'Gép';
const matchdayOtherSide = side => side === HUMAN ? AI : HUMAN;
const matchdayTeamLabel = team => team?.shortName || team?.name || 'Csapat';

function matchdayScoreboardStatus(game) {
  if (game.phase === PHASE.GAME_OVER) return 'VÉGEREDMÉNY';
  if (game.phase === PHASE.REVEAL) return `KÖVETKEZŐ VÁLASZTÓ: ${matchdaySideLabel(matchdayOtherSide(game.chooser)).toUpperCase()}`;
  return `KATEGÓRIÁT VÁLASZT: ${matchdaySideLabel(game.chooser).toUpperCase()}`;
}

function matchdayTeamCrest(team) {
  const crest = el('span', 'match-team__crest');
  crest.title = team?.name || 'Csapat';
  if (team?.type === 'national' && team.flag) {
    const flag = el('span', 'quick-match-team-flag', team.flag);
    flag.setAttribute('role', 'img');
    flag.setAttribute('aria-label', `${team.name} zászlaja`);
    crest.appendChild(flag);
    return crest;
  }

  if (team?.logoPath) {
    const image = document.createElement('img');
    image.src = team.logoPath;
    image.alt = `${team.name} jogtiszta projektlogója`;
    image.addEventListener('error', () => {
      crest.replaceChildren(el('span', 'quick-match-badge-fallback', matchdayTeamLabel(team)));
    }, { once: true });
    crest.appendChild(image);
    return crest;
  }

  crest.appendChild(el('span', 'quick-match-badge-fallback', matchdayTeamLabel(team)));
  return crest;
}

UI.prototype._renderMatchScoreboard = function renderMatchScoreboard(game, human, ai) {
  const quick = game.mode === 'quick-match' && this.matchContext;
  const board = el('div', `match-scoreboard${game.mode === 'penalties' ? ' match-scoreboard--penalties' : ''}${quick ? ' match-scoreboard--quick-match' : ''}`);
  const status = matchdayScoreboardStatus(game);
  const playerName = quick ? (this.matchContext.playerName || 'Játékos') : 'Játékos';
  const own = quick ? this.matchContext.playerTeam : null;
  const opponent = quick ? this.matchContext.opponentTeam : null;
  const homeName = quick ? `${playerName} – ${matchdayTeamLabel(own)}` : 'JÁTÉKOS';
  const awayName = quick ? `Gép – ${matchdayTeamLabel(opponent)}` : 'GÉP';

  board.setAttribute('role', 'status');
  board.setAttribute('aria-live', 'polite');
  board.setAttribute('aria-label', `${homeName} ${human}, ${awayName} ${ai}. ${status.toLowerCase()}.`);

  const competitionText = quick
    ? `${this.matchContext.categoryLabel || own?.competitionName || 'GYORS MECCS'} · GYORS MECCS`
    : game.mode === 'penalties' ? 'TIZENEGYESEK' : 'NB I KÁRTYAMECCS';
  const competition = el('div', 'match-scoreboard__competition', competitionText.toLocaleUpperCase('hu-HU'));
  const home = el('div', 'match-team match-team--home');
  home.append(quick ? matchdayTeamCrest(own) : el('span', 'match-team__crest', '⚽'), el('span', 'match-team__name', homeName));

  const score = el('div', 'match-scoreboard__score');
  score.append(
    el('strong', 'match-scoreboard__number', String(human)),
    el('span', 'match-scoreboard__separator', '–'),
    el('strong', 'match-scoreboard__number', String(ai)),
  );

  const away = el('div', 'match-team match-team--away');
  away.append(el('span', 'match-team__name', awayName), quick ? matchdayTeamCrest(opponent) : el('span', 'match-team__crest', '🤖'));

  const possession = el('div', 'match-scoreboard__status', status);
  board.append(competition, home, score, away, possession);
  return board;
};

UI.prototype._renderClassicScores = function renderClassicMatchScore(game) {
  matchdayPreviousClassicScores.call(this, game);
  const { [HUMAN]: human, [AI]: ai } = game.scores;
  this.dom.hudScores.replaceChildren(this._renderMatchScoreboard(game, human, ai));
  if (game.mode === 'quick-match') {
    const remaining = Number.isFinite(game.remainingDeckSize) ? game.remainingDeckSize : 0;
    this.dom.hudMeta.textContent = `${game.round}. kör · ${remaining} csapatkártya a paklikban`;
  }
};

UI.prototype._renderPenaltyScores = function renderPenaltyMatchScore(game) {
  matchdayPreviousPenaltyScores.call(this, game);
  const human = game.scores[HUMAN];
  const ai = game.scores[AI];
  this.dom.hudScores.replaceChildren(this._renderMatchScoreboard(game, human, ai));
};

UI.prototype.showOverlay = function showAlternatingChooserRules(node) {
  matchdayPreviousShowOverlay.call(this, node);

  const classicRules = node.querySelector?.('[data-rules="classic"]');
  if (classicRules) {
    classicRules.innerHTML = '<b>Klasszikus szabály:</b> A két fél körönként felváltva választ kategóriát. A kör győztese viszi a két lapot és a döntetlenpaklit.';
  }

  const penaltyRules = node.querySelector?.('[data-rules="penalties"]');
  if (penaltyRules) {
    penaltyRules.innerHTML = '<b>Tizenegyes szabály:</b> A két fél párbajonként felváltva választ kategóriát. 11 lap, öt rendes párbaj, döntetlennél hirtelen halál; azonos értéknél nincs gól.';
  }

  const quickRules = node.querySelector?.('[data-rules="quick-match"]');
  if (quickRules) {
    quickRules.innerHTML = '<b>Gyors meccs szabály:</b> Két kiválasztott csapat 7–7 valós játékoskártyája játszik a Klasszikus mód közös kör- és kategóriaszabályaival.';
  }
};
