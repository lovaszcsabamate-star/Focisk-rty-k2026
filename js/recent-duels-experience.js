/** Recent-duel history and player-of-the-match enhancements layered over the existing experience UI. */

import './gameplay-experience.js';
import { ATTRIBUTE_BY_KEY, attributeValue, formatAttribute } from './data/players.js';
import { AI, HUMAN } from './engine.js';
import { UI, el } from './ui.js';

const RECENT_DUELS_STYLE_ID = 'recent-duels-experience-styles';
const RECENT_DUELS_LIMIT = 3;

const recentDuelsPrevious = Object.freeze({
  resetTable: UI.prototype.resetTable,
  showVerdict: UI.prototype.showVerdict,
  showOverlay: UI.prototype.showOverlay,
});

const recentDuelsStates = new WeakMap();

const recentDuelsFreshState = () => ({
  mode: 'classic',
  recent: [],
  candidates: new Map(),
  sequence: 0,
});

const recentDuelsGetState = ui => {
  let state = recentDuelsStates.get(ui);
  if (!state) {
    state = recentDuelsFreshState();
    recentDuelsStates.set(ui, state);
  }
  return state;
};

const recentDuelsText = value => String(value ?? '').trim();

const recentDuelsCardIdentity = card => recentDuelsText(card?.id)
  || `${recentDuelsText(card?.name)}::${recentDuelsText(card?.club)}`;

const recentDuelsSafeFormat = (card, attribute) => {
  try {
    return recentDuelsText(formatAttribute(card, attribute)) || '—';
  } catch {
    return '—';
  }
};

const recentDuelsMargin = result => {
  try {
    const human = attributeValue(result?.humanCard, result?.attribute);
    const ai = attributeValue(result?.aiCard, result?.attribute);
    if (!Number.isFinite(human) || !Number.isFinite(ai)) return 0;
    return Math.abs(human - ai) / Math.max(Math.abs(human), Math.abs(ai), 1);
  } catch {
    return 0;
  }
};

const recentDuelsResultLabel = winner => {
  if (winner === HUMAN) return 'Te nyertél';
  if (winner === AI) return 'A gép nyert';
  return 'Döntetlen';
};

const recentDuelsWinnerClass = winner => {
  if (winner === HUMAN) return 'human';
  if (winner === AI) return 'ai';
  return 'tie';
};

const recentDuelsRecordCandidate = (state, result) => {
  const card = result?.winner === HUMAN
    ? result.humanCard
    : result?.winner === AI
      ? result.aiCard
      : null;
  if (!card) return;

  const identity = recentDuelsCardIdentity(card);
  if (!identity) return;
  const current = state.candidates.get(identity) ?? {
    card,
    side: result.winner,
    wins: 0,
    bestMargin: 0,
    firstWin: state.sequence,
  };
  current.wins += 1;
  current.bestMargin = Math.max(current.bestMargin, recentDuelsMargin(result));
  state.candidates.set(identity, current);
};

const recentDuelsPlayerOfMatch = state => [...state.candidates.values()]
  .sort((left, right) => right.wins - left.wins
    || right.bestMargin - left.bestMargin
    || left.firstWin - right.firstWin)[0] ?? null;

const recentDuelsEnsureStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(RECENT_DUELS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = RECENT_DUELS_STYLE_ID;
  style.textContent = `
    .recent-duels-panel { width: min(760px, 100%); margin: 8px auto 4px; padding: 0; border: 1px solid rgba(232,195,122,.28); border-radius: 14px; background: rgba(11,9,7,.58); color: #f3e7cf; overflow: hidden; }
    .recent-duels-panel > summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 38px; padding: 8px 12px; cursor: pointer; font-size: 11px; font-weight: 900; letter-spacing: .04em; list-style: none; }
    .recent-duels-panel > summary::-webkit-details-marker { display: none; }
    .recent-duels-panel > summary::after { content: '▾'; color: #e8c777; transition: transform .18s ease; }
    .recent-duels-panel:not([open]) > summary::after { transform: rotate(-90deg); }
    .recent-duels-panel__count { margin-left: auto; padding: 2px 7px; border-radius: 999px; background: rgba(232,195,122,.13); color: #e8d3a4; font-size: 9px; }
    .recent-duels-list { display: grid; gap: 5px; margin: 0; padding: 0 8px 8px; list-style: none; }
    .recent-duels-item { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 8px; min-width: 0; padding: 7px 9px; border-radius: 10px; background: rgba(255,255,255,.045); font-size: 10px; }
    .recent-duels-item__round { color: #bdae94; font-weight: 850; white-space: nowrap; }
    .recent-duels-item__detail { min-width: 0; }
    .recent-duels-item__detail strong, .recent-duels-item__detail small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .recent-duels-item__detail strong { color: #fff7df; font-size: 10px; }
    .recent-duels-item__detail small { margin-top: 2px; color: #bdae94; font-size: 9px; }
    .recent-duels-item__result { font-weight: 900; white-space: nowrap; }
    .recent-duels-item--human .recent-duels-item__result { color: #9ee1a8; }
    .recent-duels-item--ai .recent-duels-item__result { color: #efaaaa; }
    .recent-duels-item--tie .recent-duels-item__result { color: #e8d184; }
    .experience-player-of-match { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 10px; align-items: center; margin: 14px 0; padding: 12px 13px; border: 1px solid rgba(232,195,122,.42); border-radius: 16px; background: linear-gradient(135deg, rgba(232,195,122,.15), rgba(255,255,255,.035)); }
    .experience-player-of-match__icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(232,195,122,.16); font-size: 23px; }
    .experience-player-of-match__copy { min-width: 0; }
    .experience-player-of-match__copy span, .experience-player-of-match__copy strong, .experience-player-of-match__copy small { display: block; }
    .experience-player-of-match__copy span { color: #d7bd80; font-size: 9px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    .experience-player-of-match__copy strong { margin-top: 3px; overflow: hidden; color: #fff7df; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
    .experience-player-of-match__copy small { margin-top: 3px; color: #c9baa1; font-size: 10px; line-height: 1.35; }
    @media (max-width: 620px) { .recent-duels-item { grid-template-columns: auto minmax(0,1fr); } .recent-duels-item__result { grid-column: 2; } }
    @media (prefers-reduced-motion: reduce) { .recent-duels-panel > summary::after { transition: none; } }
  `;
  document.head?.appendChild(style);
};

const recentDuelsEnsurePanel = ui => {
  if (typeof document === 'undefined') return null;
  let panel = document.querySelector('#recent-duels-panel');
  if (panel) return panel;

  panel = document.createElement('details');
  panel.id = 'recent-duels-panel';
  panel.className = 'recent-duels-panel';
  panel.open = true;
  const summary = document.createElement('summary');
  summary.append(
    el('span', null, 'Legutóbbi párbajok'),
    el('span', 'recent-duels-panel__count', '0 / 3'),
  );
  const list = document.createElement('ol');
  list.className = 'recent-duels-list';
  panel.append(summary, list);

  const picker = ui.dom?.picker ?? document.querySelector('#attribute-picker');
  if (picker?.parentElement) picker.before(panel);
  else document.querySelector('#felt')?.appendChild(panel);
  return panel;
};

const recentDuelsRender = ui => {
  const state = recentDuelsGetState(ui);
  const panel = recentDuelsEnsurePanel(ui);
  if (!panel) return;
  const list = panel.querySelector('.recent-duels-list');
  const count = panel.querySelector('.recent-duels-panel__count');
  count.textContent = `${state.recent.length} / ${RECENT_DUELS_LIMIT}`;
  list.replaceChildren(...state.recent.map(entry => {
    const item = el('li', `recent-duels-item recent-duels-item--${entry.winnerClass}`);
    const detail = el('span', 'recent-duels-item__detail');
    detail.append(
      el('strong', null, entry.category),
      el('small', null, entry.values),
    );
    item.append(
      el('span', 'recent-duels-item__round', `${entry.round}. kör`),
      detail,
      el('span', 'recent-duels-item__result', entry.result),
    );
    return item;
  }));
  panel.hidden = state.recent.length === 0;
};

const recentDuelsRecord = (ui, result, game) => {
  const state = recentDuelsGetState(ui);
  state.mode = game?.mode === 'penalties' ? 'penalties' : 'classic';
  state.sequence += 1;
  const attribute = ATTRIBUTE_BY_KEY[result?.attribute];
  const category = recentDuelsText(attribute?.label ?? attribute?.nameHu ?? result?.attribute) || 'Ismeretlen kategória';
  const values = `${recentDuelsSafeFormat(result?.humanCard, result?.attribute)} – ${recentDuelsSafeFormat(result?.aiCard, result?.attribute)}`;
  state.recent = [
    ...state.recent,
    {
      round: Number.isFinite(game?.round) ? game.round : state.sequence,
      category,
      values,
      result: recentDuelsResultLabel(result?.winner),
      winnerClass: recentDuelsWinnerClass(result?.winner),
    },
  ].slice(-RECENT_DUELS_LIMIT);
  recentDuelsRecordCandidate(state, result);
  recentDuelsRender(ui);
};

const recentDuelsInjectPlayerOfMatch = (ui, panel) => {
  panel?.querySelector?.('.experience-player-of-match')?.remove();
  if (!panel?.classList?.contains('result-panel')) return;
  const state = recentDuelsGetState(ui);
  if (state.mode !== 'classic') return;
  const candidate = recentDuelsPlayerOfMatch(state);
  if (!candidate) return;

  const block = el('section', 'experience-player-of-match');
  block.setAttribute('aria-labelledby', 'experience-player-of-match-title');
  const copy = el('div', 'experience-player-of-match__copy');
  const title = el('strong', null, recentDuelsText(candidate.card?.name) || 'Ismeretlen játékos');
  title.id = 'experience-player-of-match-title';
  const club = recentDuelsText(candidate.card?.club) || 'Ismeretlen klub';
  const side = candidate.side === HUMAN ? 'saját csapat' : 'ellenfél';
  copy.append(
    el('span', null, 'A mérkőzés játékosa'),
    title,
    el('small', null, `${club} · ${candidate.wins} megnyert párbaj · ${side}`),
  );
  block.append(el('span', 'experience-player-of-match__icon', '⭐'), copy);

  const summary = panel.querySelector('.experience-summary');
  if (summary) summary.before(block);
  else panel.querySelector('.result-actions')?.before(block);
};

UI.prototype.resetTable = function resetTableWithRecentDuels(...args) {
  const state = recentDuelsGetState(this);
  state.mode = this.mode === 'penalties' ? 'penalties' : 'classic';
  state.recent = [];
  state.candidates.clear();
  state.sequence = 0;
  document.querySelector('#recent-duels-panel')?.remove();
  return recentDuelsPrevious.resetTable.apply(this, args);
};

UI.prototype.showVerdict = function showVerdictWithRecentDuels(result, game) {
  const output = recentDuelsPrevious.showVerdict.call(this, result, game);
  recentDuelsRecord(this, result, game);
  return output;
};

UI.prototype.showOverlay = function showOverlayWithRecentDuels(panel) {
  const output = recentDuelsPrevious.showOverlay.call(this, panel);
  recentDuelsInjectPlayerOfMatch(this, panel);
  return output;
};

recentDuelsEnsureStyles();
