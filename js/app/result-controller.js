/** Végeredmény-képernyő központi alkalmazási vezérlője. */

import { AI, HUMAN } from '../engine.js';
import { getLine } from '../banter.js';
import { ATTRIBUTE_BY_KEY, attributeValue } from '../data/players.js';
import { summariseClassicMatch } from '../domain/match-summary.js';
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

const resultControllerEscapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export function createResultController({
  ui,
  getState,
  actions,
  clearSaved,
  elementFactory = el,
  attributeRegistry = ATTRIBUTE_BY_KEY,
  attributeValueFn = attributeValue,
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
    clearSaved();

    const won = result.winner === humanId;
    const lost = result.winner === aiId;
    ui.say(getBanterLine(won ? 'gameOverWin' : lost ? 'gameOverLose' : 'gameOverTie'));

    const panel = elementFactory('div', `result-panel ${won ? 'result-panel--win' : lost ? 'result-panel--loss' : 'result-panel--draw'}`);
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
      const summary = summariseClassicMatch({
        game: state.game,
        result,
        attributeRegistry,
        attributeValue: attributeValueFn,
        humanId,
        aiId,
      });
      const category = summary.bestCategory
        ? `${summary.bestCategory.icon ? `${summary.bestCategory.icon} ` : ''}${summary.bestCategory.label}`
        : 'Nem volt megnyert kategória';
      const opponent = state.opponent ?? {};
      const opponentText = opponent.name
        ? `${opponent.name} · ${opponent.level}. szint · OVR ${opponent.overall}`
        : 'Ismeretlen ellenfél';
      const playerOfMatch = summary.playerOfMatch ? `
        <section class="player-of-match" aria-labelledby="player-of-match-title">
          <p class="eyebrow">A mérkőzés játékosa</p>
          <h2 id="player-of-match-title">${resultControllerEscapeHtml(summary.playerOfMatch.name)}</h2>
          <p>${resultControllerEscapeHtml(summary.playerOfMatch.club)} · ${summary.playerOfMatch.wins} megnyert párbaj</p>
        </section>
      ` : '';

      panel.innerHTML = `
        <h1>${heading}</h1>
        <div class="final-score">JÁTÉKOS ${result.human}–${result.ai} GÉP</div>
        <dl class="result-stats result-stats--classic">
          <div><dt>Lejátszott körök</dt><dd>${summary.rounds}</dd></div>
          <div><dt>Megnyert párbajok</dt><dd>${summary.humanWins}</dd></div>
          <div><dt>A gép nyert párbajai</dt><dd>${summary.aiWins}</dd></div>
          <div><dt>Döntetlen párbajok</dt><dd>${summary.ties}</dd></div>
          <div><dt>Legsikeresebb kategória</dt><dd>${resultControllerEscapeHtml(category)}${summary.bestCategory ? ` · ${summary.bestCategory.wins} győzelem` : ''}</dd></div>
          <div><dt>Ellenfél</dt><dd>${resultControllerEscapeHtml(opponentText)}</dd></div>
        </dl>
        ${playerOfMatch}
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
