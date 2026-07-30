/** Klasszikus és Büntetőpárbaj eredményjelző-komponensek. */

import { AI, HUMAN } from '../engine.js';
import { ART, el, tryArt } from './dom-primitives.js';

const scoreboardQuickMatchLabel = (game, side, fallback) => {
  const label = side === HUMAN ? game?.quickMatch?.humanTeam : game?.quickMatch?.aiTeam;
  return String(label ?? fallback).trim() || fallback;
};

const scoreboardRepresentativeCard = (game, side) => {
  const team = game?.teams?.[side];
  if (Array.isArray(team) && team.length) return team[0];
  const players = Array.isArray(game?.players) ? game.players : [];
  return players.find(player => player?.meta?.quickMatchSide === side) ?? null;
};

const createTeamMark = (game, side) => {
  if (!game?.quickMatch?.enabled) return null;
  const card = scoreboardRepresentativeCard(game, side);
  const meta = card?.meta ?? {};
  const kind = meta.quickMatchTeamKind;
  const mark = el('span', `score-team-mark score-team-mark--${kind || 'team'}`);
  mark.setAttribute('aria-hidden', 'true');
  mark.style.display = 'inline-grid';
  mark.style.placeItems = 'center';
  mark.style.width = '28px';
  mark.style.height = '28px';
  mark.style.flex = '0 0 28px';
  mark.style.borderRadius = '50%';
  mark.style.backgroundPosition = 'center';
  mark.style.backgroundRepeat = 'no-repeat';
  mark.style.backgroundSize = 'contain';

  if (kind === 'nation') {
    mark.textContent = meta.quickMatchTeamIcon || '🌍';
  } else if (kind === 'federation' && meta.quickMatchTeamBadge) {
    tryArt(mark, [meta.quickMatchTeamBadge, ART.placeholder('club')]);
  } else if (kind === 'club') {
    const clubId = meta.quickMatchTeamClubId ?? card?.clubId ?? card?.meta?.clubId ?? null;
    tryArt(mark, [...ART.clubLogo({ clubId }), ART.placeholder('club')]);
  } else {
    mark.textContent = meta.quickMatchTeamIcon || '🏆';
  }
  return mark;
};

const createScoreChip = (game, side, label, value, leading) => {
  const chip = el('div', `score${leading ? ' leading' : ''}`);
  const mark = createTeamMark(game, side);
  if (mark) chip.appendChild(mark);
  chip.append(el('span', null, label), el('b', null, String(value)));
  return chip;
};

const renderPiles = (dom, mode, human, ai) => {
  dom.playerPile.replaceChildren(
    el('span', 'pile__label', mode === 'penalties' ? 'Használt lapok' : 'Megnyert lapok'),
    document.createTextNode(human ? ` ${human}` : ''),
  );
  dom.opponentPile.replaceChildren(
    el('span', 'pile__label', mode === 'penalties' ? 'Gép használt lapjai' : 'Gép nyereménye'),
    document.createTextNode(ai ? ` ${ai}` : ''),
  );
  dom.playerPile.classList.toggle('filled', human > 0);
  dom.opponentPile.classList.toggle('filled', ai > 0);
};

const createAttemptRow = (game, side) => {
  const wrapper = el('div', 'attempt-row');
  const heading = el('strong', null);
  const mark = createTeamMark(game, side);
  if (mark) heading.appendChild(mark);
  heading.appendChild(document.createTextNode(scoreboardQuickMatchLabel(game, side, side === HUMAN ? 'JÁTÉKOS' : 'GÉP')));
  wrapper.appendChild(heading);
  const marks = el('div', 'attempt-marks');
  for (let index = 0; index < 11; index += 1) {
    const outcome = game.attempts[side][index];
    const symbol = outcome === 'win' || outcome === 'tie' ? '⚽' : outcome === 'loss' ? '✕' : '○';
    const marker = el('span', `attempt attempt--${outcome ?? 'empty'}`, symbol);
    marker.title = outcome === 'win'
      ? 'Megnyert párbaj'
      : outcome === 'loss'
        ? 'Elveszített párbaj'
        : outcome === 'tie'
          ? 'Döntetlen'
          : 'Hátralévő lap';
    marks.appendChild(marker);
  }
  wrapper.appendChild(marks);
  return wrapper;
};

const renderClassicScoreboard = (dom, game) => {
  const { [HUMAN]: human, [AI]: ai } = game.scores;
  dom.hudScores.replaceChildren(
    createScoreChip(game, HUMAN, scoreboardQuickMatchLabel(game, HUMAN, 'Játékos'), human, human > ai),
    createScoreChip(game, AI, scoreboardQuickMatchLabel(game, AI, 'Gép'), ai, ai > human),
  );
  dom.hudMeta.textContent = `${game.round}. kör · ${game.deck.length} lap a pakliban`;
  renderPiles(dom, 'classic', human, ai);
  dom.pot.textContent = game.pot.length ? `🃏 ${game.pot.length} lap a döntetlenpakliban` : '';
};

const renderPenaltyScoreboard = (dom, game) => {
  const human = game.scores[HUMAN];
  const ai = game.scores[AI];
  const humanLabel = scoreboardQuickMatchLabel(game, HUMAN, 'JÁTÉKOS');
  const aiLabel = scoreboardQuickMatchLabel(game, AI, 'GÉP');
  const score = el('div', 'penalty-score');
  const humanMark = createTeamMark(game, HUMAN);
  const aiMark = createTeamMark(game, AI);
  if (humanMark) score.appendChild(humanMark);
  score.appendChild(document.createTextNode(`${humanLabel} ${human}–${ai} ${aiLabel}`));
  if (aiMark) score.appendChild(aiMark);
  dom.hudScores.replaceChildren(score);
  dom.hudMeta.textContent = game.suddenDeath
    ? `Hirtelen halál · ${game.log.length} lejátszott párbaj`
    : `Rendes párbajok: ${game.regularPlayed}/5 · hátra ${game.regularRemaining}`;
  renderPiles(dom, 'penalties', game.used[HUMAN].length, game.used[AI].length);
  dom.pot.textContent = game.cycle > 1 ? `🔀 ${game.cycle}. kör a változatlan tizeneggyel` : '';
  dom.penaltyBoard.replaceChildren(createAttemptRow(game, HUMAN), createAttemptRow(game, AI));
};

export function renderScoreboardComponent(dom, game, mode) {
  if (mode === 'penalties') renderPenaltyScoreboard(dom, game);
  else renderClassicScoreboard(dom, game);
}
