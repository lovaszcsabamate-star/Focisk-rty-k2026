/** Klasszikus és Büntetőpárbaj eredményjelző-komponensek. */

import { AI, HUMAN } from '../engine.js';
import { el } from './dom-primitives.js';

const createScoreChip = (label, value, leading) => {
  const chip = el('div', `score${leading ? ' leading' : ''}`);
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
  wrapper.appendChild(el('strong', null, side === HUMAN ? 'JÁTÉKOS' : 'GÉP'));
  const marks = el('div', 'attempt-marks');
  for (let index = 0; index < 11; index += 1) {
    const outcome = game.attempts[side][index];
    const symbol = outcome === 'win' ? '⚽' : outcome === 'loss' ? '✕' : outcome === 'tie' ? '—' : '○';
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
    createScoreChip('Játékos', human, human > ai),
    createScoreChip('Gép', ai, ai > human),
  );
  dom.hudMeta.textContent = `${game.round}. kör · ${game.deck.length} lap a pakliban`;
  renderPiles(dom, 'classic', human, ai);
  dom.pot.textContent = game.pot.length ? `🃏 ${game.pot.length} lap a döntetlenpakliban` : '';
};

const renderPenaltyScoreboard = (dom, game) => {
  const human = game.scores[HUMAN];
  const ai = game.scores[AI];
  dom.hudScores.replaceChildren(el('div', 'penalty-score', `JÁTÉKOS ${human}–${ai} GÉP`));
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
