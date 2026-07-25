/** Végeredmény-képernyő központi alkalmazási vezérlője. */

import { AI, HUMAN } from '../engine.js';
import { getLine } from '../banter.js';
import { ATTRIBUTE_BY_KEY } from '../data/players.js';
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

const resultTeamLabel = team => team?.shortName || team?.name || 'Csapat';

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

  const createTeamMark = team => {
    const wrapper = elementFactory('span', 'quick-match-result-team__mark');
    if (team?.type === 'national' && team.flag) {
      const flag = elementFactory('span', 'quick-match-team-flag', team.flag);
      flag.setAttribute('role', 'img');
      flag.setAttribute('aria-label', `${team.name} zászlaja`);
      wrapper.appendChild(flag);
      return wrapper;
    }

    if (team?.logoPath) {
      const image = document.createElement('img');
      image.src = team.logoPath;
      image.alt = `${team.name} jogtiszta projektlogója`;
      image.addEventListener('error', () => {
        wrapper.replaceChildren(elementFactory('span', 'quick-match-badge-fallback', resultTeamLabel(team)));
      }, { once: true });
      wrapper.appendChild(image);
      return wrapper;
    }

    wrapper.appendChild(elementFactory('span', 'quick-match-badge-fallback', resultTeamLabel(team)));
    return wrapper;
  };

  const createResultTeam = (team, label) => {
    const section = elementFactory('section', 'quick-match-result-team');
    section.style.setProperty('--team-primary', team?.primaryColor || '#234a38');
    section.style.setProperty('--team-secondary', team?.secondaryColor || '#d7b65b');
    section.append(
      elementFactory('span', 'quick-match-pairing__side-label', label),
      createTeamMark(team),
      elementFactory('strong', 'quick-match-result-team__name', team?.name || 'Ismeretlen csapat'),
      elementFactory('small', 'quick-match-result-team__category', team?.competitionName || 'Gyors meccs'),
    );
    return section;
  };

  const showQuickMatchResult = (state, result, won, lost) => {
    const context = state.matchContext;
    if (!context?.playerTeam || !context?.opponentTeam) {
      throw new ResultControllerError('INVALID_QUICK_MATCH_CONTEXT', 'A Gyors meccs csapatadatai hiányoznak.');
    }
    const heading = won ? 'GYŐZELEM' : lost ? 'VERESÉG' : 'DÖNTETLEN';
    const winnerName = won
      ? context.playerTeam.name
      : lost ? context.opponentTeam.name : 'Döntetlen';
    const panel = elementFactory('div', `result-panel result-panel--quick-match ${won ? 'result-panel--win' : lost ? 'result-panel--loss' : 'result-panel--tie'}`);
    panel.append(
      elementFactory('p', 'result-kicker', `Győztes csapat: ${winnerName}`),
      elementFactory('h1', null, heading),
    );

    const matchup = elementFactory('div', 'quick-match-result-matchup');
    matchup.append(
      createResultTeam(context.playerTeam, context.playerName || 'Játékos'),
      elementFactory('div', 'quick-match-result-score', `${result.human} : ${result.ai}`),
      createResultTeam(context.opponentTeam, 'Gép'),
    );
    panel.appendChild(matchup);
    if (result.undecided) panel.appendChild(elementFactory('p', null, `${result.undecided} lap a döntetlenpakliban maradt.`));

    const actionRow = elementFactory('div', 'result-actions quick-match-actions');
    const rematch = elementFactory('button', 'btn', 'Visszavágó');
    const otherOpponent = elementFactory('button', 'btn btn--ghost', 'Másik ellenfél');
    const otherTeam = elementFactory('button', 'btn btn--ghost', 'Másik csapat választása');
    const menu = elementFactory('button', 'btn btn--ghost', 'Vissza a főmenübe');
    rematch.addEventListener('click', () => actions.restartQuickMatch?.(), { once: true });
    otherOpponent.addEventListener('click', () => actions.quickMatchOtherOpponent?.(), { once: true });
    otherTeam.addEventListener('click', () => actions.quickMatchChooseTeam?.(), { once: true });
    menu.addEventListener('click', () => actions.showTitleScreen({ offerOnboarding: false }), { once: true });
    actionRow.append(rematch, otherOpponent, otherTeam, menu);
    panel.appendChild(actionRow);
    return panel;
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

    if (state.mode === 'quick-match') {
      const panel = showQuickMatchResult(state, result, won, lost);
      const showTitle = () => actions.showTitleScreen({ offerOnboarding: false });
      actions.showPanel(panel, showTitle);
      return panel;
    }

    const panel = elementFactory('div', `result-panel ${won ? 'result-panel--win' : 'result-panel--loss'}`);
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
