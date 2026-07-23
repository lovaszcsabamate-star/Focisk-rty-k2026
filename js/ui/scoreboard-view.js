/** Klasszikus és Büntetőpárbaj eredményjelző nézete. */

import { AI, HUMAN } from '../engine.js';
import { el } from './dom.js';

export class ScoreboardView {
  constructor(dom, modeProvider) {
    this.dom = dom;
    this.modeProvider = modeProvider;
  }

  renderClassicScores(game, { renderPiles, scoreChip }) {
    const { [HUMAN]: human, [AI]: ai } = game.scores;
    this.dom.hudScores.replaceChildren(scoreChip('Játékos', human, human > ai), scoreChip('Gép', ai, ai > human));
    this.dom.hudMeta.textContent = `${game.round}. kör · ${game.deck.length} lap a pakliban`;
    renderPiles(human, ai);
    this.dom.pot.textContent = game.pot.length ? `🃏 ${game.pot.length} lap a döntetlenpakliban` : '';
  }

  renderPenaltyScores(game, { renderPiles }) {
    const human = game.scores[HUMAN];
    const ai = game.scores[AI];
    this.dom.hudScores.replaceChildren(el('div', 'penalty-score', `JÁTÉKOS ${human}–${ai} GÉP`));
    this.dom.hudMeta.textContent = game.suddenDeath
      ? `Hirtelen halál · ${game.log.length} lejátszott párbaj`
      : `Rendes párbajok: ${game.regularPlayed}/5 · hátra ${game.regularRemaining}`;
    renderPiles(game.used[HUMAN].length, game.used[AI].length);
    this.dom.pot.textContent = game.cycle > 1 ? `🔀 ${game.cycle}. kör a változatlan tizeneggyel` : '';

    const attemptRow = side => {
      const wrapper = el('div', 'attempt-row');
      wrapper.appendChild(el('strong', null, side === HUMAN ? 'JÁTÉKOS' : 'GÉP'));
      const marks = el('div', 'attempt-marks');
      for (let index = 0; index < 11; index += 1) {
        const outcome = game.attempts[side][index];
        const symbol = outcome === 'win' ? '⚽' : outcome === 'loss' ? '✕' : outcome === 'tie' ? '—' : '○';
        const marker = el('span', `attempt attempt--${outcome ?? 'empty'}`, symbol);
        marker.title = outcome === 'win' ? 'Megnyert párbaj' : outcome === 'loss' ? 'Elveszített párbaj' : outcome === 'tie' ? 'Döntetlen' : 'Hátralévő lap';
        marks.appendChild(marker);
      }
      wrapper.appendChild(marks);
      return wrapper;
    };
    this.dom.penaltyBoard.replaceChildren(attemptRow(HUMAN), attemptRow(AI));
  }

  renderPiles(human, ai) {
    const penalties = this.modeProvider() === 'penalties';
    this.dom.playerPile.replaceChildren(el('span', 'pile__label', penalties ? 'Használt lapok' : 'Megnyert lapok'), document.createTextNode(human ? ` ${human}` : ''));
    this.dom.opponentPile.replaceChildren(el('span', 'pile__label', penalties ? 'Gép használt lapjai' : 'Gép nyereménye'), document.createTextNode(ai ? ` ${ai}` : ''));
    this.dom.playerPile.classList.toggle('filled', human > 0);
    this.dom.opponentPile.classList.toggle('filled', ai > 0);
  }

  scoreChip(label, value, leading) {
    const chip = el('div', `score${leading ? ' leading' : ''}`);
    chip.append(el('span', null, label), el('b', null, String(value)));
    return chip;
  }
}
