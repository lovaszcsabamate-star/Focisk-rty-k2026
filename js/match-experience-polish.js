/**
 * Match Experience Polish 1.0
 *
 * Kizárólag prezentációs réteg. Nem módosít játékszabályt, pontszámot, AI-t vagy
 * mentési sémát. A már meglévő matchday/gameplay-polish UI-ra épül, és a központi
 * jogtiszta branding API-t használja.
 */

import { ATTRIBUTE_BY_KEY, formatAttribute } from './data/players.js';
import { AI, HUMAN } from './engine.js';
import {
  UI,
  beginUiEnhancementLayer,
  commitUiEnhancementLayer,
  el,
  rollbackUiEnhancementLayer,
} from './ui.js';

const MATCH_EXPERIENCE_LAYER = './match-experience-polish.js';
const MATCH_EXPERIENCE_STYLE_ID = 'match-experience-polish-styles';

const matchText = value => String(value ?? '').trim();
const matchScore = game => ({
  human: Number(game?.scores?.[HUMAN] ?? game?.result?.()?.human ?? 0) || 0,
  ai: Number(game?.scores?.[AI] ?? game?.result?.()?.ai ?? 0) || 0,
});

const matchBranding = () => globalThis.__FOCISKARTYAK_BRANDING__ ?? null;
const matchPresentation = label => {
  const resolved = matchBranding()?.resolveClubPresentation?.(label);
  if (resolved) return resolved;
  const text = matchText(label);
  return Object.freeze({
    short: matchBranding()?.resolveClubShortLabel?.(text) || text.split(/\s+/).map(part => part[0]).join('').slice(0, 4).toUpperCase() || 'FC',
    primary: '#6d4d2f',
    secondary: '#d5b45d',
  });
};

const matchTeams = game => ({
  human: matchText(game?.quickMatch?.humanTeam) || 'Játékos',
  ai: matchText(game?.quickMatch?.aiTeam) || 'Gép',
});

const matchTournamentContext = () => {
  let state = null;
  try { state = globalThis.FociskartyakTournament?.read?.() ?? null; } catch { state = null; }
  if (!state?.currentMatchId) return null;
  const rounds = Array.isArray(state.rounds) ? state.rounds : [];
  let current = null;
  let round = null;
  for (const candidateRound of rounds) {
    const match = candidateRound?.matches?.find?.(item => item?.id === state.currentMatchId);
    if (!match) continue;
    current = match;
    round = candidateRound;
    break;
  }
  if (!current) return null;
  return Object.freeze({
    name: matchText(state.name) || 'Torna',
    stage: matchText(current.label) || matchText(round?.label) || 'Mérkőzés',
    lineupCount: Array.isArray(state.currentLineupIds) ? state.currentLineupIds.length : 0,
    matchId: current.id,
  });
};

const matchCreateBadge = (label, className = '') => {
  const presentation = matchPresentation(label);
  const badge = el('span', `quick-team-mark quick-team-mark--text match-experience-badge ${className}`.trim(), presentation.short);
  badge.dataset.teamLabel = matchText(label);
  badge.style.setProperty('--team-primary', presentation.primary);
  badge.style.setProperty('--team-secondary', presentation.secondary);
  badge.setAttribute('aria-hidden', 'true');
  return badge;
};

export const matchExperienceSecondaryLabel = game => {
  if (!game) return '';
  const round = Math.max(1, Number(game.round) || 1);
  if (game.mode === 'penalties') {
    return `${round}. párbaj · ${game.suddenDeath ? 'Hirtelen halál' : 'Büntetőpárbaj'}`;
  }
  const attribute = ATTRIBUTE_BY_KEY[game.attribute];
  if (attribute) return `${round}. kör · ${attribute.icon} ${attribute.label}`;
  return `${round}. kör · ${game.chooser === HUMAN ? 'Te választasz' : 'A gép választ'}`;
};

export const matchExperienceBestCategory = game => {
  const wins = new Map();
  for (const result of Array.isArray(game?.log) ? game.log : []) {
    if (result?.winner !== HUMAN || !ATTRIBUTE_BY_KEY[result.attribute]) continue;
    wins.set(result.attribute, (wins.get(result.attribute) ?? 0) + 1);
  }
  const ranked = [...wins.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    const leftLabel = ATTRIBUTE_BY_KEY[left[0]]?.label ?? left[0];
    const rightLabel = ATTRIBUTE_BY_KEY[right[0]]?.label ?? right[0];
    return leftLabel.localeCompare(rightLabel, 'hu-HU');
  });
  const best = ranked[0];
  if (!best) return null;
  const attribute = ATTRIBUTE_BY_KEY[best[0]];
  return Object.freeze({ key: best[0], wins: best[1], icon: attribute.icon, label: attribute.label });
};

const matchEnsureStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(MATCH_EXPERIENCE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MATCH_EXPERIENCE_STYLE_ID;
  style.textContent = `
    .match-scoreboard.match-experience-hud{padding:7px 10px;gap:6px;border-radius:14px;min-height:66px}
    .match-experience-hud .match-scoreboard__competition{font-size:8px;letter-spacing:.12em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .match-experience-hud .match-scoreboard__status{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(46vw,320px)}
    .match-experience-hud .match-team{min-width:0;gap:5px}
    .match-experience-hud .match-team__name{min-width:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:clamp(9px,2.4vw,12px)}
    .match-experience-hud .match-team__crest{width:38px;height:38px;min-width:38px;padding:0;border:0;background:transparent;overflow:visible}
    .match-experience-badge{display:grid;place-items:center;width:100%;height:100%;min-width:0;line-height:1}
    .match-experience-badge .quick-team-mark__image{display:block;width:100%;height:100%;object-fit:contain}
    .match-experience-hud .match-scoreboard__score{font-size:clamp(1.35rem,5vw,2rem);line-height:1;white-space:nowrap}
    .match-experience-hud .match-scoreboard__clock{font-size:9px}

    .gameplay-match-intro.match-experience-intro .gameplay-match-intro__card{width:min(660px,100%);padding:clamp(20px,5vw,34px)}
    .match-experience-intro .gameplay-match-intro__team{display:grid;justify-items:center;gap:8px;min-width:0}
    .match-experience-intro__badge{width:clamp(58px,15vw,92px);height:clamp(58px,15vw,92px)}
    .match-experience-intro__name{display:block;width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:clamp(1rem,4vw,1.65rem);font-weight:950}
    .match-experience-intro__cta{display:inline-grid;place-items:center;min-height:44px;margin-top:16px;padding:8px 18px;border:1px solid rgba(232,195,122,.55);border-radius:999px;background:rgba(232,195,122,.13);color:#fff3bd;font-size:11px;font-weight:950;letter-spacing:.08em}
    .match-experience-intro__lineup{display:block;margin-top:7px;color:#bfb097;font-size:10px;font-weight:800}

    .duel.match-experience-duel{position:relative;align-items:stretch;gap:10px}
    .match-experience-duel > .versus{display:none}
    .match-experience-duel__comparison{align-self:center;display:grid;place-items:center;gap:5px;min-width:112px;padding:10px 9px;border:1px solid rgba(232,195,122,.36);border-radius:15px;background:linear-gradient(180deg,rgba(34,25,17,.96),rgba(13,11,9,.96));box-shadow:0 12px 32px rgba(0,0,0,.3);animation:match-experience-pop .24s ease-out both;text-align:center}
    .match-experience-duel__category{max-width:150px;color:#e8c37a;font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;line-height:1.25}
    .match-experience-duel__values{display:flex;align-items:center;justify-content:center;gap:7px;color:#fff7df;font-size:clamp(13px,3.5vw,18px);font-weight:950;white-space:nowrap}
    .match-experience-duel__vs{color:#a99675;font-size:8px;font-weight:900}
    .match-experience-round-summary{display:block;margin-top:6px;color:#f1d795;font-size:10px;font-weight:900;line-height:1.35}

    .match-experience-result{display:grid;gap:10px;margin:10px 0;padding:12px;border:1px solid rgba(232,195,122,.3);border-radius:16px;background:rgba(0,0,0,.2)}
    .match-experience-result__scoreline{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px}
    .match-experience-result__team{display:grid;justify-items:center;gap:4px;min-width:0;text-align:center}
    .match-experience-result__team .match-experience-badge{width:44px;height:44px}
    .match-experience-result__team strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}
    .match-experience-result__score{color:#fff7df;font-size:clamp(1.4rem,6vw,2.25rem);font-weight:950;white-space:nowrap}
    .match-experience-result__best{padding-top:8px;border-top:1px solid rgba(255,255,255,.08);color:#d8c9b0;font-size:10px;text-align:center}
    .match-experience-result__best strong{color:#fff3bd}

    @keyframes match-experience-pop{from{opacity:0;transform:scale(.96) translateY(4px)}to{opacity:1;transform:none}}
    @media(max-width:480px){
      .match-scoreboard.match-experience-hud{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);padding:6px 7px}
      .match-experience-hud .match-team__crest{width:32px;height:32px;min-width:32px}
      .match-experience-hud .match-team__name{max-width:86px;font-size:9px}
      .match-experience-hud .match-scoreboard__competition{max-width:42vw}
      .match-experience-duel__comparison{min-width:86px;padding:8px 6px}
      .match-experience-duel__category{max-width:100px;font-size:8px}
    }
    @media(max-width:360px){
      .match-scoreboard.match-experience-hud{padding-inline:5px;gap:3px}
      .match-experience-hud .match-team__crest{width:28px;height:28px;min-width:28px}
      .match-experience-hud .match-team__name{max-width:66px;font-size:8px}
      .match-experience-hud .match-scoreboard__status{max-width:44vw;font-size:8px}
      .match-experience-duel__comparison{min-width:76px}
    }
    @media(orientation:landscape) and (max-height:520px){
      .gameplay-match-intro.match-experience-intro .gameplay-match-intro__card{padding:12px 18px}
      .match-experience-intro__badge{width:48px;height:48px}
      .match-experience-intro__cta{min-height:40px;margin-top:8px}
    }
    @media(prefers-reduced-motion:reduce){.match-experience-duel__comparison{animation:none!important}}
  `;
  document.head?.appendChild(style);
};

const matchStates = new WeakMap();
const matchState = ui => {
  let state = matchStates.get(ui);
  if (!state) {
    state = { lastGame: null };
    matchStates.set(ui, state);
  }
  return state;
};

const matchDecorateHud = (ui, game) => {
  const board = ui.dom?.hudScores?.querySelector?.('.match-scoreboard');
  if (!board || !game) return false;
  matchState(ui).lastGame = game;
  board.classList.add('match-experience-hud');
  const teams = matchTeams(game);
  const context = matchTournamentContext();
  const home = board.querySelector('.match-team--home');
  const away = board.querySelector('.match-team--away');
  const homeName = home?.querySelector('.match-team__name');
  const awayName = away?.querySelector('.match-team__name');
  const homeCrest = home?.querySelector('.match-team__crest');
  const awayCrest = away?.querySelector('.match-team__crest');
  const competition = board.querySelector('.match-scoreboard__competition');
  const status = board.querySelector('.match-scoreboard__status');

  if (game.quickMatch) {
    if (homeName) { homeName.textContent = matchPresentation(teams.human).short; homeName.title = teams.human; }
    if (awayName) { awayName.textContent = matchPresentation(teams.ai).short; awayName.title = teams.ai; }
    homeCrest?.replaceChildren(matchCreateBadge(teams.human));
    awayCrest?.replaceChildren(matchCreateBadge(teams.ai));
  }
  if (competition && (context || game.quickMatch)) {
    competition.textContent = context ? `${context.name} · ${context.stage}` : 'QUICK MATCH';
    competition.title = competition.textContent;
  }
  if (status) {
    status.textContent = matchExperienceSecondaryLabel(game);
    status.setAttribute('aria-live', 'off');
  }
  return true;
};

const matchDecorateIntro = game => {
  const overlay = document.querySelector('.gameplay-match-intro');
  if (!overlay || overlay.dataset.matchExperienceReady === 'true' || !game) return false;
  overlay.dataset.matchExperienceReady = 'true';
  overlay.classList.add('match-experience-intro');
  const teams = matchTeams(game);
  const context = matchTournamentContext();
  const eyebrow = overlay.querySelector('.gameplay-match-intro__eyebrow');
  const teamNodes = [...overlay.querySelectorAll('.gameplay-match-intro__team')];
  const labels = [teams.human, teams.ai];
  teamNodes.forEach((node, index) => {
    const label = labels[index];
    if (!label) return;
    node.replaceChildren(
      matchCreateBadge(label, 'match-experience-intro__badge'),
      el('span', 'match-experience-intro__name', label),
    );
    node.title = label;
  });
  if (eyebrow) eyebrow.textContent = context ? `${context.name} · ${context.stage}` : game.quickMatch ? 'QUICK MATCH' : 'KEZDŐDIK A MÉRKŐZÉS';
  const card = overlay.querySelector('.gameplay-match-intro__card');
  if (card && !card.querySelector('.match-experience-intro__cta')) {
    card.appendChild(el('span', 'match-experience-intro__cta', 'MÉRKŐZÉS INDÍTÁSA'));
    if (context?.lineupCount === 11) card.appendChild(el('span', 'match-experience-intro__lineup', 'Keret: 11/11 ✓'));
  }
  overlay.setAttribute('aria-label', `${teams.human} – ${teams.ai}. Mérkőzés indítása vagy az intro átugrása.`);
  globalThis.__FOCISKARTYAK_TEAM_LOGO_RESTORATION__?.refresh?.();
  return true;
};

const matchDecorateDuel = (ui, game, result) => {
  if (!ui.dom?.duel || !game || !result?.attribute) return false;
  const attribute = ATTRIBUTE_BY_KEY[result.attribute];
  if (!attribute) return false;
  ui.dom.duel.classList.add('match-experience-duel');
  ui.dom.duel.querySelector('.match-experience-duel__comparison')?.remove();
  const comparison = el('div', 'match-experience-duel__comparison');
  comparison.setAttribute('aria-label', `${attribute.label}: ${formatAttribute(result.humanCard, result.attribute)} kontra ${formatAttribute(result.aiCard, result.attribute)}`);
  comparison.append(
    el('div', 'match-experience-duel__category', `${attribute.icon} ${attribute.label}`),
  );
  const values = el('div', 'match-experience-duel__values');
  values.append(
    el('span', null, formatAttribute(result.humanCard, result.attribute)),
    el('span', 'match-experience-duel__vs', 'VS'),
    el('span', null, formatAttribute(result.aiCard, result.attribute)),
  );
  comparison.appendChild(values);
  const slots = [...ui.dom.duel.querySelectorAll(':scope > .duel-slot')];
  if (slots[0] && slots[1]) slots[0].after(comparison);
  else ui.dom.duel.appendChild(comparison);
  return true;
};

const matchDecorateVerdict = (ui, result, game) => {
  const node = ui.dom?.verdict;
  if (!node || !result || !game) return false;
  node.querySelector('.match-experience-round-summary')?.remove();
  const teams = matchTeams(game);
  const winner = result.winner === HUMAN ? teams.human : result.winner === AI ? teams.ai : 'Döntetlen';
  const round = Math.max(1, Number(result.round ?? game.round) || 1);
  const score = matchScore(game);
  const summary = result.winner === 'tie'
    ? `${round}. ${game.mode === 'penalties' ? 'párbaj' : 'kör'} · döntetlen · ${score.human}–${score.ai}`
    : `${winner} nyerte a ${round}. ${game.mode === 'penalties' ? 'párbajt' : 'párbajt'} · ${score.human}–${score.ai}`;
  node.appendChild(el('span', 'match-experience-round-summary', summary));
  return true;
};

const matchDecorateResult = (ui, panel) => {
  if (!panel?.classList?.contains('result-panel') || panel.querySelector('.match-experience-result')) return false;
  const game = matchState(ui).lastGame;
  if (!game) return false;
  const teams = matchTeams(game);
  const score = matchScore(game);
  const summary = el('section', 'match-experience-result');
  summary.setAttribute('aria-label', `Végeredmény: ${teams.human} ${score.human}, ${teams.ai} ${score.ai}`);
  const scoreline = el('div', 'match-experience-result__scoreline');
  const teamBlock = (label, side) => {
    const block = el('div', `match-experience-result__team match-experience-result__team--${side}`);
    block.append(matchCreateBadge(label), el('strong', null, label));
    return block;
  };
  scoreline.append(
    teamBlock(teams.human, 'human'),
    el('div', 'match-experience-result__score', `${score.human}–${score.ai}`),
    teamBlock(teams.ai, 'ai'),
  );
  summary.appendChild(scoreline);
  const best = matchExperienceBestCategory(game);
  if (best) {
    const bestNode = el('div', 'match-experience-result__best');
    bestNode.append('Legjobb kategória · ', el('strong', null, `${best.icon} ${best.label}`), ` · ${best.wins} győzelem`);
    summary.appendChild(bestNode);
  }
  const heading = panel.querySelector('h1');
  if (heading) heading.after(summary);
  else panel.prepend(summary);
  globalThis.__FOCISKARTYAK_TEAM_LOGO_RESTORATION__?.refresh?.();
  return true;
};

beginUiEnhancementLayer(MATCH_EXPERIENCE_LAYER);
try {
  matchEnsureStyles();
  const previous = Object.freeze({
    renderScores: UI.prototype.renderScores,
    renderHands: UI.prototype.renderHands,
    showAttributePicker: UI.prototype.showAttributePicker,
    showDuel: UI.prototype.showDuel,
    showVerdict: UI.prototype.showVerdict,
    showOverlay: UI.prototype.showOverlay,
  });

  UI.prototype.renderScores = function renderMatchExperienceScores(game) {
    const output = previous.renderScores.call(this, game);
    matchDecorateHud(this, game);
    return output;
  };

  UI.prototype.renderHands = function renderMatchExperienceHands(game, options = {}) {
    const output = previous.renderHands.call(this, game, options);
    matchState(this).lastGame = game;
    matchDecorateIntro(game);
    return output;
  };

  UI.prototype.showAttributePicker = function showMatchExperienceAttributePicker(game) {
    const output = previous.showAttributePicker.call(this, game);
    matchState(this).lastGame = game;
    matchDecorateIntro(game);
    return output;
  };

  UI.prototype.showDuel = function showMatchExperienceDuel(game, options = {}) {
    const output = previous.showDuel.call(this, game, options);
    matchState(this).lastGame = game;
    if (options.result) matchDecorateDuel(this, game, options.result);
    return output;
  };

  UI.prototype.showVerdict = function showMatchExperienceVerdict(result, game) {
    const output = previous.showVerdict.call(this, result, game);
    matchState(this).lastGame = game;
    matchDecorateVerdict(this, result, game);
    return output;
  };

  UI.prototype.showOverlay = function showMatchExperienceOverlay(panel) {
    const output = previous.showOverlay.call(this, panel);
    matchDecorateResult(this, panel);
    return output;
  };

  commitUiEnhancementLayer(MATCH_EXPERIENCE_LAYER);
} catch (error) {
  rollbackUiEnhancementLayer(MATCH_EXPERIENCE_LAYER);
  throw error;
}
