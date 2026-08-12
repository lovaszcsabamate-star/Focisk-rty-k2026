/**
 * Match Experience Polish 2.0 – Match Arena Visual Refresh
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

export const MATCH_EXPERIENCE_POLISH_VERSION = 2;

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
  const participants = Array.isArray(state.participants) ? state.participants : [];
  const human = participants.find(team => team?.id === state.humanTeamId) ?? null;
  const opponentId = current.homeId === state.humanTeamId ? current.awayId : current.homeId;
  const opponent = participants.find(team => team?.id === opponentId) ?? null;
  return Object.freeze({
    name: matchText(state.name) || 'Torna',
    stage: matchText(current.label) || matchText(round?.label) || 'Mérkőzés',
    lineupCount: Array.isArray(state.currentLineupIds) ? state.currentLineupIds.length : 0,
    matchId: current.id,
    humanTeam: matchText(human?.label),
    opponentTeam: matchText(opponent?.label),
  });
};

const matchTeams = (game, context = matchTournamentContext()) => ({
  human: matchText(game?.quickMatch?.humanTeam) || context?.humanTeam || 'Játékos',
  ai: matchText(game?.quickMatch?.aiTeam) || context?.opponentTeam || 'Gép',
});

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
    /* Match Arena Visual Refresh 1.0 – tabletop duel surface. */
    #pub.match-arena-refresh #felt.match-arena-tabletop{
      position:relative;isolation:isolate;overflow:hidden;
      border:clamp(6px,.85vw,10px) solid transparent;border-radius:clamp(18px,2.2vw,30px);
      background:
        radial-gradient(ellipse at 50% 34%,rgba(255,255,255,.075),transparent 54%) padding-box,
        repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 2px,rgba(0,0,0,.018) 2px 4px) padding-box,
        linear-gradient(145deg,#174932 0%,#0d3426 52%,#09261c 100%) padding-box,
        repeating-linear-gradient(92deg,#3d2215 0 18px,#6b4328 18px 34px,#4b2d1c 34px 52px,#75492d 52px 66px) border-box;
      box-shadow:0 20px 55px rgba(0,0,0,.58),0 0 0 2px #21120b,0 0 0 4px rgba(132,88,50,.55),inset 0 0 0 2px rgba(255,225,166,.15),inset 0 0 82px rgba(0,0,0,.44);
    }
    #pub.match-arena-refresh #felt.match-arena-tabletop::after{
      content:'';position:absolute;z-index:0;inset:clamp(13px,2vw,24px);border:1px solid rgba(238,221,174,.13);border-radius:18px;
      background:
        radial-gradient(circle at 50% 50%,transparent 0 58px,rgba(238,221,174,.1) 59px 60px,transparent 61px),
        linear-gradient(90deg,transparent calc(50% - .6px),rgba(238,221,174,.1) 50%,transparent calc(50% + .6px));
      pointer-events:none;
    }
    #pub.match-arena-refresh #felt.match-arena-tabletop>*{position:relative;z-index:1}
    #pub.match-arena-refresh.is-battle-active #duel>.duel-slot{padding:5px 2px 9px}
    #pub.match-arena-refresh.is-battle-active #duel>.duel-slot .card{box-shadow:0 18px 38px rgba(0,0,0,.72),0 3px 0 rgba(255,255,255,.035),0 0 0 1px rgba(231,204,139,.28)}
    #pub.match-arena-refresh.is-battle-active #duel>.duel-slot.winner .card{box-shadow:0 0 0 4px var(--win),0 18px 42px rgba(0,0,0,.75),0 0 30px rgba(106,191,122,.38)}

    /* Classic stadium scoreboard: dark metal frame + amber LED display. */
    #pub.match-arena-refresh #hud .match-scoreboard.match-experience-hud{
      --stadium-led-amber:#ffd15a;--stadium-led-dim:#866d32;--stadium-led-green:#8fe29c;
      position:relative;min-height:70px;padding:5px 7px;gap:4px;overflow:hidden;
      border:4px solid #252a28;border-radius:5px;background:#020403;color:#f8f1dc;
      box-shadow:0 0 0 2px #747a75,0 10px 30px rgba(0,0,0,.66),inset 0 0 0 1px #050706,inset 0 0 26px rgba(0,0,0,.9);
    }
    #pub.match-arena-refresh #hud .match-scoreboard.match-experience-hud::after{
      content:'';position:absolute;inset:3px;border:1px solid rgba(255,255,255,.06);border-radius:2px;pointer-events:none;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.86);
    }
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__competition{
      min-height:20px;padding:3px 8px;border-bottom:1px solid rgba(255,209,90,.18);
      background:linear-gradient(180deg,#15251b,#09130e);color:#e8ddbd;font-size:8px;letter-spacing:.16em;text-shadow:0 1px 0 #000;
    }
    #pub.match-arena-refresh #hud .match-experience-hud .match-team{
      min-height:48px;padding:6px 9px;background:linear-gradient(180deg,#141816,#080b09);box-shadow:inset 0 0 16px rgba(0,0,0,.46);
    }
    #pub.match-arena-refresh #hud .match-experience-hud .match-team__name{color:#eee5cd;font-family:ui-monospace,'SFMono-Regular',Consolas,monospace;font-size:clamp(9px,2.2vw,12px);letter-spacing:.06em;text-shadow:0 1px 0 #000}
    #pub.match-arena-refresh #hud .match-experience-hud .match-team__crest{width:36px;height:36px;min-width:36px;padding:0;border:0;background:transparent;filter:drop-shadow(0 3px 5px #000);overflow:visible}
    .match-experience-badge{display:grid;place-items:center;width:100%;height:100%;min-width:0;line-height:1}
    .match-experience-badge .quick-team-mark__image{display:block;width:100%;height:100%;object-fit:contain}
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__score{min-width:126px;padding:5px 9px;gap:6px;border-inline:1px solid rgba(255,209,90,.16);background:#010302;color:var(--stadium-led-amber);box-shadow:inset 0 0 18px rgba(0,0,0,.92)}
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__number{
      min-width:38px;padding:3px 5px;border:1px solid rgba(255,209,90,.2);border-radius:2px;
      background:radial-gradient(circle at 1px 1px,rgba(255,209,90,.17) 1px,transparent 1.3px);background-size:4px 4px;
      color:var(--stadium-led-amber);font-family:ui-monospace,'SFMono-Regular',Consolas,monospace;font-size:clamp(34px,4vw,48px);line-height:.94;letter-spacing:.04em;text-shadow:0 0 6px rgba(255,191,55,.72),0 0 13px rgba(255,153,0,.22);
    }
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__separator{color:var(--stadium-led-dim);font-family:ui-monospace,Consolas,monospace;font-size:22px;text-shadow:0 0 5px rgba(255,209,90,.2)}
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__clock,
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__choice{padding:3px 6px;background:#020403;color:#a9afa8;font-size:7px}
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__clock strong,
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__choice strong{color:var(--stadium-led-amber);font-family:ui-monospace,Consolas,monospace;text-shadow:0 0 6px rgba(255,209,90,.45)}
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__status{min-height:22px;padding:3px 8px;background:#020403;color:#d8c99e;font-size:8px;letter-spacing:.08em}
    #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__status::before{color:var(--stadium-led-green);text-shadow:0 0 7px rgba(86,225,126,.7)}
    #pub.match-arena-refresh #hud .match-scoreboard--penalties.match-experience-hud .match-scoreboard__competition{background:linear-gradient(180deg,#321412,#140807);color:#ffd2c8}

    .gameplay-match-intro.match-experience-intro .gameplay-match-intro__card{width:min(660px,100%);padding:clamp(20px,5vw,34px)}
    .match-experience-intro .gameplay-match-intro__team{display:grid;justify-items:center;gap:8px;min-width:0}
    .match-experience-intro__badge{width:clamp(58px,15vw,92px);height:clamp(58px,15vw,92px)}
    .match-experience-intro__name{display:block;width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:clamp(1rem,4vw,1.65rem);font-weight:950}
    .match-experience-intro__cta{display:inline-grid;place-items:center;min-height:44px;margin-top:16px;padding:8px 18px;border:1px solid rgba(232,195,122,.55);border-radius:999px;background:rgba(232,195,122,.13);color:#fff3bd;font-size:11px;font-weight:950;letter-spacing:.08em}
    .match-experience-intro__lineup{display:block;margin-top:7px;color:#bfb097;font-size:10px;font-weight:800}

    .duel.match-experience-duel{position:relative;align-items:stretch;gap:10px}
    .match-experience-duel>.versus{display:none}
    .match-experience-duel__comparison{
      align-self:center;display:grid;place-items:center;gap:5px;min-width:112px;padding:10px 9px;
      border:3px solid #3a403c;border-radius:5px;background:linear-gradient(180deg,#101411,#030504);color:#f7e8bd;
      box-shadow:0 0 0 1px #777b71,0 12px 32px rgba(0,0,0,.52),inset 0 0 17px rgba(0,0,0,.7);animation:match-experience-pop .24s ease-out both;text-align:center;
    }
    .match-experience-duel__category{max-width:150px;color:#e8c37a;font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;line-height:1.25}
    .match-experience-duel__values{display:flex;align-items:center;justify-content:center;gap:7px;color:var(--stadium-led-amber,#ffd15a);font-family:ui-monospace,Consolas,monospace;font-size:clamp(13px,3.5vw,18px);font-weight:950;white-space:nowrap;text-shadow:0 0 6px rgba(255,194,61,.4)}
    .match-experience-duel__vs{color:#82775f;font-size:8px;font-weight:900;text-shadow:none}
    .match-experience-round-summary{display:block;margin-top:6px;color:#f1d795;font-size:10px;font-weight:900;line-height:1.35}

    /* Round verdict becomes a small stadium result board embedded in the table. */
    #pub.match-arena-refresh #verdict:not(:empty){
      width:min(720px,100%);padding:10px 14px;border:3px solid #303532;border-radius:5px;background:linear-gradient(180deg,#0d110e,#030504);color:#f4ead0;
      box-shadow:0 0 0 1px #747870,0 10px 28px rgba(0,0,0,.55),inset 0 0 20px rgba(0,0,0,.62);text-shadow:0 1px 0 #000;
    }
    #pub.match-arena-refresh #verdict.win{border-color:#396747;box-shadow:0 0 0 1px #7ab688,0 10px 28px rgba(0,0,0,.55),inset 0 0 18px rgba(52,138,73,.16)}
    #pub.match-arena-refresh #verdict.lose{border-color:#6b3835;box-shadow:0 0 0 1px #b77e78,0 10px 28px rgba(0,0,0,.55),inset 0 0 18px rgba(155,55,48,.14)}
    #pub.match-arena-refresh #verdict.tie{border-color:#6e6037;box-shadow:0 0 0 1px #b8a76b,0 10px 28px rgba(0,0,0,.55),inset 0 0 18px rgba(210,184,91,.12)}

    /* Final result uses the same classic-stadium visual language. */
    .result-panel .final-score[data-sports-scoreboard='true']{border:4px solid #2b302d;border-radius:5px;background:#020403;box-shadow:0 0 0 2px #737972,0 12px 34px rgba(0,0,0,.62),inset 0 0 18px rgba(0,0,0,.72)}
    .result-panel .final-score[data-sports-scoreboard='true'] .final-score__team{background:linear-gradient(180deg,#151916,#070a08);color:#eee5cd;font-family:ui-monospace,Consolas,monospace}
    .result-panel .final-score[data-sports-scoreboard='true'] .final-score__numbers{border-inline:1px solid rgba(255,209,90,.18);background:radial-gradient(circle at 1px 1px,rgba(255,209,90,.14) 1px,transparent 1.3px) #010302;background-size:4px 4px;color:#ffd15a;font-family:ui-monospace,Consolas,monospace;text-shadow:0 0 7px rgba(255,194,61,.55)}
    .result-panel .final-score[data-sports-scoreboard='true'] .final-score__time{background:#020403;color:#d9c58f;font-family:ui-monospace,Consolas,monospace}

    .match-experience-result{display:grid;gap:10px;margin:10px 0;padding:12px;border:4px solid #2c312e;border-radius:5px;background:linear-gradient(180deg,#0e120f,#030504);box-shadow:0 0 0 2px #727870,0 12px 34px rgba(0,0,0,.58),inset 0 0 22px rgba(0,0,0,.62)}
    .match-experience-result__scoreline{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px}
    .match-experience-result__team{display:grid;justify-items:center;gap:4px;min-width:0;text-align:center}
    .match-experience-result__team .match-experience-badge{width:44px;height:44px}
    .match-experience-result__team strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eee5cd;font-family:ui-monospace,Consolas,monospace;font-size:10px}
    .match-experience-result__score{min-width:94px;padding:7px 10px;border:1px solid rgba(255,209,90,.2);border-radius:2px;background:radial-gradient(circle at 1px 1px,rgba(255,209,90,.16) 1px,transparent 1.3px) #010302;background-size:4px 4px;color:#ffd15a;font-family:ui-monospace,Consolas,monospace;font-size:clamp(1.6rem,6vw,2.5rem);font-weight:950;letter-spacing:.05em;text-align:center;white-space:nowrap;text-shadow:0 0 7px rgba(255,194,61,.5)}
    .match-experience-result__best{padding-top:8px;border-top:1px solid rgba(255,209,90,.14);color:#bdb397;font-size:10px;text-align:center}
    .match-experience-result__best strong{color:#ffe09a}

    @keyframes match-experience-pop{from{opacity:0;transform:scale(.96) translateY(4px)}to{opacity:1;transform:none}}
    @media(max-width:480px){
      #pub.match-arena-refresh #felt.match-arena-tabletop{border-width:5px;border-radius:18px}
      #pub.match-arena-refresh #felt.match-arena-tabletop::after{inset:9px;border-radius:12px;background:linear-gradient(90deg,transparent calc(50% - .5px),rgba(238,221,174,.08) 50%,transparent calc(50% + .5px))}
      #pub.match-arena-refresh #hud .match-scoreboard.match-experience-hud{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);min-height:60px;padding:4px;border-width:3px;gap:3px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-team__crest{width:30px;height:30px;min-width:30px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-team__name{max-width:80px;font-size:8.5px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__competition{max-width:42vw;font-size:7px;letter-spacing:.1em}
      #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__score{min-width:96px;padding-inline:4px;gap:3px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__number{min-width:27px;padding-inline:2px;font-size:clamp(28px,9vw,38px)}
      #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__separator{font-size:17px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__status{max-width:min(46vw,320px);font-size:7px}
      .match-experience-duel__comparison{min-width:86px;padding:8px 6px;border-width:2px}
      .match-experience-duel__category{max-width:100px;font-size:8px}
      .match-experience-result{border-width:3px;padding:9px}
      .match-experience-result__score{min-width:74px;padding-inline:6px}
    }
    @media(max-width:360px){
      #pub.match-arena-refresh #hud .match-scoreboard.match-experience-hud{padding-inline:3px;gap:2px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-team__crest{width:26px;height:26px;min-width:26px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-team__name{max-width:61px;font-size:7.5px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__score{min-width:88px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__number{min-width:24px;font-size:29px}
      #pub.match-arena-refresh #hud .match-experience-hud .match-scoreboard__status{max-width:44vw;font-size:6.5px}
      .match-experience-duel__comparison{min-width:76px}
    }
    @media(orientation:landscape) and (max-height:520px){
      #pub.match-arena-refresh #felt.match-arena-tabletop{border-width:4px}
      #pub.match-arena-refresh #hud .match-scoreboard.match-experience-hud{min-height:52px}
      .gameplay-match-intro.match-experience-intro .gameplay-match-intro__card{padding:12px 18px}
      .match-experience-intro__badge{width:48px;height:48px}
      .match-experience-intro__cta{min-height:40px;margin-top:8px}
    }
    @media(prefers-reduced-motion:reduce){.match-experience-duel__comparison{animation:none!important}}
    @media(forced-colors:active){
      #pub.match-arena-refresh #felt.match-arena-tabletop,#pub.match-arena-refresh #hud .match-scoreboard.match-experience-hud,.match-experience-result{border:2px solid ButtonText;background:Canvas;color:CanvasText;box-shadow:none;forced-color-adjust:auto}
      #pub.match-arena-refresh #felt.match-arena-tabletop::after{display:none}
    }
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

const matchDecorateArena = (ui, game) => {
  const pub = ui.dom?.pub;
  const felt = pub?.querySelector?.('#felt') ?? document.querySelector?.('#felt');
  if (!pub || !felt || !game) return false;
  pub.classList.add('match-arena-refresh');
  pub.dataset.matchArena = 'tabletop';
  felt.classList.add('match-arena-tabletop');
  felt.dataset.arenaMode = game.mode === 'penalties' ? 'penalties' : 'classic';
  return true;
};

const matchDecorateHud = (ui, game) => {
  const board = ui.dom?.hudScores?.querySelector?.('.match-scoreboard');
  if (!board || !game) return false;
  matchState(ui).lastGame = game;
  matchDecorateArena(ui, game);
  board.classList.add('match-experience-hud');
  board.dataset.scoreboardStyle = 'classic-stadium';
  const context = matchTournamentContext();
  const teams = matchTeams(game, context);
  const home = board.querySelector('.match-team--home');
  const away = board.querySelector('.match-team--away');
  const homeName = home?.querySelector('.match-team__name');
  const awayName = away?.querySelector('.match-team__name');
  const homeCrest = home?.querySelector('.match-team__crest');
  const awayCrest = away?.querySelector('.match-team__crest');
  const competition = board.querySelector('.match-scoreboard__competition');
  const status = board.querySelector('.match-scoreboard__status');

  if (game.quickMatch || context) {
    if (homeName) { homeName.textContent = matchPresentation(teams.human).short; homeName.title = teams.human; }
    if (awayName) { awayName.textContent = matchPresentation(teams.ai).short; awayName.title = teams.ai; }
    homeCrest?.replaceChildren(matchCreateBadge(teams.human));
    awayCrest?.replaceChildren(matchCreateBadge(teams.ai));
  }
  if (competition && (context || game.quickMatch)) {
    competition.textContent = context ? `${context.name} · ${context.stage}` : 'GYORS MECCS';
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
  const context = matchTournamentContext();
  const teams = matchTeams(game, context);
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
  if (eyebrow) eyebrow.textContent = context ? `${context.name} · ${context.stage}` : game.quickMatch ? 'GYORS MECCS' : 'KEZDŐDIK A MÉRKŐZÉS';
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
  matchDecorateArena(ui, game);
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
  matchDecorateArena(ui, game);
  node.querySelector('.match-experience-round-summary')?.remove();
  const context = matchTournamentContext();
  const teams = matchTeams(game, context);
  const winner = result.winner === HUMAN ? teams.human : result.winner === AI ? teams.ai : 'Döntetlen';
  const round = Math.max(1, Number(result.round ?? game.round) || 1);
  const score = matchScore(game);
  const summary = result.winner === 'tie'
    ? `${round}. ${game.mode === 'penalties' ? 'párbaj' : 'kör'} · döntetlen · ${score.human}–${score.ai}`
    : `${winner} nyerte a ${round}. párbajt · ${score.human}–${score.ai}`;
  node.appendChild(el('span', 'match-experience-round-summary', summary));
  return true;
};

const matchDecorateResult = (ui, panel) => {
  if (!panel?.classList?.contains('result-panel') || panel.querySelector('.match-experience-result')) return false;
  const game = matchState(ui).lastGame;
  if (!game) return false;
  const context = matchTournamentContext();
  const teams = matchTeams(game, context);
  const score = matchScore(game);
  const summary = el('section', 'match-experience-result');
  summary.dataset.scoreboardStyle = 'classic-stadium';
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
    matchDecorateArena(this, game);
    matchDecorateIntro(game);
    return output;
  };

  UI.prototype.showAttributePicker = function showMatchExperienceAttributePicker(game) {
    const output = previous.showAttributePicker.call(this, game);
    matchState(this).lastGame = game;
    matchDecorateArena(this, game);
    matchDecorateIntro(game);
    return output;
  };

  UI.prototype.showDuel = function showMatchExperienceDuel(game, options = {}) {
    const output = previous.showDuel.call(this, game, options);
    matchState(this).lastGame = game;
    matchDecorateArena(this, game);
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
