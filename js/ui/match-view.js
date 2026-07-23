/** Kategóriaválasztó, párbaj és köreredmény vizuális komponense. */

import { ATTRIBUTES, ATTRIBUTE_BY_KEY, formatAttribute } from '../data/players.js';
import { AI, HUMAN } from '../engine.js';
import { el } from './dom.js';

export class MatchView {
  constructor(dom, handlers = {}) {
    this.dom = dom;
    this.handlers = handlers;
  }

  showAttributePicker(game) {
    this.dom.duel.replaceChildren();
    this.dom.verdict.replaceChildren();
    this.dom.verdict.className = '';
    this.handlers.setPrompt('Te választasz kategóriát');
    const available = new Set(game.availableAttributeKeys());
    const playableAttributes = ATTRIBUTES.filter(attribute => available.has(attribute.key));

    this.dom.picker.replaceChildren(...playableAttributes.map(attribute => {
      const button = el('button', 'attr-btn');
      button.appendChild(document.createTextNode(`${attribute.icon} ${attribute.label}`));
      button.appendChild(el('small', null, attribute.hint));
      button.addEventListener('click', () => this.handlers.onAttribute(attribute.key));
      return button;
    }));
    if (!playableAttributes.length) {
      this.dom.picker.appendChild(el('div', 'picker-hint', 'Ehhez a leosztáshoz nincs közös, hiteles összehasonlítási adat.'));
    }
  }

  hideAttributePicker() {
    this.dom.picker.replaceChildren();
  }

  setPrompt(text, highlight) {
    this.dom.prompt.replaceChildren(document.createTextNode(text));
    if (highlight) this.dom.prompt.append(document.createTextNode(' '), el('span', 'highlight', highlight));
  }

  showDuel(game, { opponentHidden = false, result = null } = {}) {
    const attribute = game.attribute;
    const mine = el('div', 'duel-slot');
    mine.append(el('div', 'duel-slot__who', 'Játékos'), game.played[HUMAN]
      ? this.handlers.renderCard(game.played[HUMAN], { activeAttribute: attribute }) : this.emptySlot());
    const theirs = el('div', 'duel-slot');
    theirs.append(el('div', 'duel-slot__who', 'Gép'), opponentHidden || !game.played[AI]
      ? this.handlers.renderCard(null, { faceDown: true }) : this.handlers.renderCard(game.played[AI], { activeAttribute: attribute }));
    if (result?.winner === HUMAN) { mine.classList.add('winner'); theirs.classList.add('loser'); }
    if (result?.winner === AI) { theirs.classList.add('winner'); mine.classList.add('loser'); }
    this.dom.duel.replaceChildren(mine, el('div', 'versus', 'VS'), theirs);
  }

  emptySlot() {
    return el('div', 'card card--empty');
  }

  showVerdict(result, game) {
    const attribute = ATTRIBUTE_BY_KEY[result.attribute];
    const detail = `${attribute.icon} ${attribute.label}: ${formatAttribute(result.humanCard, result.attribute)} – ${formatAttribute(result.aiCard, result.attribute)}`;
    const node = this.dom.verdict;
    node.replaceChildren();
    const isPenalty = game.mode === 'penalties';

    if (result.winner === 'tie') {
      node.className = 'tie';
      node.append('DÖNTETLEN', el('small', null, `${detail}${isPenalty ? ' · nincs gól' : ' · a lapok az asztalon maradnak'}`));
      this.handlers.playSound('tie');
    } else if (result.winner === HUMAN) {
      node.className = 'win';
      const pot = result.potScooped ? ` · +${result.potScooped} lap a döntetlenpakliból` : '';
      node.append(isPenalty ? 'GÓL A JÁTÉKOSNAK' : 'A TIÉD A KÖR', el('small', null, detail + pot));
      this.handlers.playSound('win');
    } else {
      node.className = 'lose';
      const pot = result.potScooped ? ` · +${result.potScooped} lap a döntetlenpakliból` : '';
      node.append(isPenalty ? 'GÓL A GÉPNEK' : 'A GÉPÉ A KÖR', el('small', null, detail + pot));
      this.handlers.playSound('loss');
    }
  }

  async showSuddenDeath() {
    this.dom.suddenDeath.hidden = false;
    this.dom.suddenDeath.textContent = '⚠ HIRTELEN HALÁL ⚠';
    this.handlers.playSound('sudden');
    await new Promise(resolve => setTimeout(resolve, 1200));
    this.dom.suddenDeath.hidden = true;
  }
}
