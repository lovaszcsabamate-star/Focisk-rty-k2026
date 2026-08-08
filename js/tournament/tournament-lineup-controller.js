/** A meglévő Torna központ keretválasztó gombját biztonságos, egyetlen aktív UI-val kezeli. */

import {
  TOURNAMENT_LINEUP_STORAGE_KEY,
  resolveQuickMatchSelection,
  stageQuickMatch,
} from '../deck-selection.js';
import { tournamentStorageService } from '../services/tournament-storage-service.js';
import {
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  tournamentNextHumanMatch,
  tournamentTeamById,
} from './tournament-domain.js';
import {
  TOURNAMENT_LINEUP_SIZE,
  automaticTournamentLineup,
  moveTournamentPenaltyOrder,
  resetTournamentMatchLineup,
  saveTournamentLineup,
  storedTournamentLineup,
  validateTournamentLineup,
} from './tournament-lineup-state.js';

const runtime = { installed: false, active: false, launching: false, historyPushed: false };
const text = value => String(value ?? '').trim();
const scalarText = value => ['string', 'number'].includes(typeof value) ? text(value) : '';
const escapeHtml = value => text(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const fold = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU').replace(/[^a-z0-9]+/g, ' ').trim();
const players = () => {
  const payload = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ ?? globalThis.__EMBEDDED_PLAYER_DATA__;
  return Array.isArray(payload?.players) ? payload.players : [];
};
const playerStrength = player => {
  const stats = player?.stats ?? {};
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  return Math.log1p(number(stats.marketValue)) * 1.25 + Math.log1p(number(stats.minutes)) * 1.1
    + Math.log1p(number(stats.appearances)) * 1.4 + Math.log1p(number(stats.starts))
    + Math.log1p(number(stats.goals)) * 1.7 + Math.log1p(number(stats.assists)) * 1.5;
};
const cardPosition = card => scalarText(card?.position) || scalarText(card?.meta?.position);
const cardIdentity = card => scalarText(card?.club) || scalarText(card?.nationality)
  || scalarText(card?.meta?.nationality) || 'Játékoskártya';
const modeForMatch = (state, match) => match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK
  ? TOURNAMENT_MATCH_MODE.PENALTIES
  : state.matchMode;
const modeLabel = mode => mode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'Büntetőpárbaj' : 'Klasszikus';
const initials = label => text(label).split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join('').toUpperCase();
const teamMark = team => team?.badge
  ? `<img class="safe-lineup-team-mark" src="${escapeHtml(team.badge)}" alt="" loading="lazy">`
  : `<span class="safe-lineup-team-mark safe-lineup-team-mark--fallback" aria-hidden="true">${escapeHtml(team?.icon || initials(team?.label) || 'FK')}</span>`;
const roundForMatch = (state, match) => state?.rounds?.find(round => round.matches?.some(item => item.id === match?.id));

export const tournamentLineupPositionGroup = card => {
  const value = fold(cardPosition(card));
  if (!value) return null;
  if (/\b(gk|goalkeeper|keeper|kapus)\b/.test(value)) return 'GK';
  if (/\b(def|df|defender|back|centre back|center back|full back|wing back|vedo)\b/.test(value)) return 'DEF';
  if (/\b(mid|mf|midfielder|midfield|dm|cm|am|kozep|kozeppalyas)\b/.test(value)) return 'MID';
  if (/\b(att|fw|forward|striker|winger|st|cf|tamado|csatar)\b/.test(value)) return 'ATT';
  if (value.includes('kapus')) return 'GK';
  if (value.includes('vedo') || value.includes('back')) return 'DEF';
  if (value.includes('kozep') || value.includes('mid')) return 'MID';
  if (value.includes('tamado') || value.includes('csatar') || value.includes('forward')) return 'ATT';
  return null;
};

export const tournamentLineupPositionSummary = (selectedIds, availablePlayers) => {
  const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(text));
  const summary = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const card of Array.isArray(availablePlayers) ? availablePlayers : []) {
    if (!selected.has(text(card?.id))) continue;
    const group = tournamentLineupPositionGroup(card);
    if (group) summary[group] += 1;
  }
  return Object.freeze(summary);
};

function installStyles() {
  if (document.getElementById('safe-tournament-lineup-style')) return;
  const style = document.createElement('style');
  style.id = 'safe-tournament-lineup-style';
  style.textContent = `
    .safe-tournament-lineup{box-sizing:border-box;width:min(1160px,calc(100vw - 20px));max-height:calc(100dvh - 18px);overflow:auto;overflow-x:hidden;padding:16px;overscroll-behavior:contain}
    .safe-lineup-heading,.safe-lineup-heading__main,.safe-lineup-versus,.safe-lineup-toolbar,.safe-lineup-actions,.safe-lineup-title,.safe-lineup-status,.safe-lineup-position-summary{display:flex;align-items:center;gap:10px}
    .safe-lineup-heading{align-items:flex-start;justify-content:space-between;gap:16px}.safe-lineup-heading__main{align-items:flex-start;flex-direction:column;gap:2px;min-width:0}.safe-lineup-heading h1{margin:.12rem 0;font-size:clamp(1.65rem,4vw,2.7rem)}.safe-lineup-heading p{margin:0;color:#d9c9a7}.safe-lineup-kicker{color:#fff0ad;font-size:.78rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
    .safe-lineup-status{align-items:stretch;flex:0 0 auto}.safe-lineup-mode{display:grid;place-items:center;min-height:54px;padding:7px 12px;border:1px solid rgba(255,214,90,.28);border-radius:14px;background:rgba(255,214,90,.08);color:#fff0ad;font-weight:900;text-align:center}.safe-lineup-counter{display:grid;place-items:center;min-width:116px;padding:6px 12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.07);text-align:center}.safe-lineup-counter small{display:block;font-size:.62rem;font-weight:950;letter-spacing:.08em}.safe-lineup-counter strong{font-size:1.55rem;line-height:1}.safe-lineup-counter em{font-size:.82rem;font-style:normal;opacity:.78}.safe-lineup-counter.is-valid{border-color:rgba(93,217,123,.55);background:rgba(61,174,92,.2);color:#d4ffdc}.safe-lineup-counter.is-invalid{border-color:rgba(225,110,99,.42);background:rgba(206,70,61,.14);color:#ffd7d1}
    .safe-lineup-versus{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);justify-content:center;margin:14px 0;padding:15px;border:1px solid rgba(255,239,183,.22);border-radius:19px;background:radial-gradient(circle at 50% 0,rgba(255,214,90,.11),transparent 58%),rgba(0,0,0,.17)}.safe-lineup-versus>div{display:flex;align-items:center;gap:10px;min-width:0}.safe-lineup-versus>div:last-child{justify-content:flex-end;text-align:right}.safe-lineup-versus strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1.04rem}.safe-lineup-vs{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:rgba(255,214,90,.13);color:#ffd65a;font-size:1.08rem;font-weight:1000}.safe-lineup-team-mark{width:50px;height:54px;object-fit:contain;flex:0 0 auto}.safe-lineup-team-mark--fallback{display:grid;place-items:center;border:2px solid rgba(255,255,255,.65);border-radius:14px;background:#315f45;color:#fff;font-weight:950}
    .safe-lineup-position-summary{flex-wrap:wrap;margin:0 0 12px}.safe-lineup-position-summary>span{display:flex;align-items:center;gap:5px;min-height:34px;padding:5px 9px;border:1px solid rgba(255,239,183,.14);border-radius:999px;background:rgba(255,255,255,.045);font-size:.82rem}.safe-lineup-position-summary b{color:#ffe071}.safe-lineup-position-summary .safe-lineup-position-help{border-style:dashed;color:#d9c9a7}
    .safe-lineup-layout{display:grid;grid-template-columns:minmax(0,1.38fr) minmax(300px,.62fr);gap:14px}.safe-lineup-layout>section{min-width:0;padding:12px;border:1px solid rgba(255,239,183,.14);border-radius:16px;background:rgba(0,0,0,.14)}.safe-lineup-title{justify-content:space-between;align-items:flex-start}.safe-lineup-title h2{margin-bottom:3px}.safe-lineup-title small{display:block;color:#d9c9a7;line-height:1.35}
    .safe-lineup-pool{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:9px;max-height:52dvh;overflow:auto;padding:3px}.safe-lineup-card{display:grid;grid-template-columns:1fr 44px;min-width:0;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.022));overflow:hidden;transition:transform 150ms ease,border-color 150ms ease,background 150ms ease,box-shadow 150ms ease}.safe-lineup-card:hover{border-color:rgba(255,239,183,.32)}.safe-lineup-card.is-selected{border-color:rgba(255,214,90,.85);background:linear-gradient(145deg,rgba(255,214,90,.16),rgba(255,214,90,.06));box-shadow:inset 0 0 0 1px rgba(255,214,90,.2)}
    .safe-lineup-card__select{display:grid;grid-template-columns:46px minmax(0,1fr) 24px;align-items:center;gap:9px;min-width:0;min-height:72px;padding:8px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.safe-lineup-card__copy{min-width:0}.safe-lineup-card__copy b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.safe-lineup-card__meta{display:flex;gap:5px;min-width:0;margin-bottom:4px}.safe-lineup-chip{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 6px;border-radius:999px;background:rgba(255,255,255,.075);color:#d9c9a7;font-size:.65rem;font-weight:850}.safe-lineup-chip--position{background:rgba(255,214,90,.13);color:#ffe79b}.safe-lineup-card__state{display:block;margin-top:4px;color:#cfc3a8;font-size:.68rem}.safe-lineup-card.is-selected .safe-lineup-card__state{color:#fff0ad}.safe-lineup-check{display:grid;place-items:center;width:22px;height:22px;border:1px solid rgba(255,255,255,.18);border-radius:50%;font-size:.76rem;opacity:.35}.safe-lineup-card.is-selected .safe-lineup-check{border-color:#ffd65a;background:#ffd65a;color:#21150e;opacity:1}.safe-lineup-avatar{display:grid;place-items:center;width:44px;height:54px;flex:0 0 auto;overflow:hidden;border-radius:9px;background:rgba(255,255,255,.08)}.safe-lineup-avatar img{width:100%;height:100%;object-fit:cover}
    .safe-lineup-card__zoom,.safe-lineup-order button,.safe-lineup-remove{min-width:44px;min-height:44px;border:0;border-left:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);color:inherit;cursor:pointer}.safe-lineup-card button:focus-visible,.safe-lineup-selected button:focus-visible,.safe-lineup-toolbar button:focus-visible,.safe-lineup-actions button:focus-visible{outline:3px solid #ffd65a;outline-offset:2px}
    .safe-lineup-selected{margin:0;padding:0;list-style:none;display:grid;gap:7px;max-height:52dvh;overflow:auto}.safe-lineup-selected li{display:grid;grid-template-columns:32px minmax(0,1fr) auto 44px;align-items:center;gap:7px;min-height:54px;padding:4px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:rgba(255,255,255,.025)}.safe-lineup-selected li>span{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgba(255,214,90,.15);font-weight:950}.safe-lineup-selected li>div:nth-child(2){min-width:0}.safe-lineup-selected b,.safe-lineup-selected small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.safe-lineup-selected small{opacity:.75}.safe-lineup-order{display:flex;gap:3px}.safe-lineup-order button{border-left:0;border-radius:8px}.safe-lineup-order button:disabled{opacity:.35;cursor:not-allowed}
    .safe-lineup-toolbar,.safe-lineup-actions{flex-wrap:wrap;margin-top:12px}.safe-lineup-toolbar{padding:10px;border:1px solid rgba(255,239,183,.11);border-radius:14px;background:rgba(0,0,0,.12)}.safe-lineup-toolbar button,.safe-lineup-actions button{min-height:44px}.safe-lineup-actions{justify-content:flex-end}.safe-lineup-start{min-width:220px;font-size:.96rem;letter-spacing:.025em}.safe-lineup-message{margin:10px 0;padding:10px 12px;border-radius:11px;background:rgba(255,255,255,.06)}.safe-lineup-message.is-error{background:rgba(190,55,48,.19);color:#ffd9d5}.safe-lineup-message.is-success{background:rgba(48,154,78,.18);color:#d5ffdf}
    .safe-lineup-dialog{max-width:min(520px,calc(100vw - 24px));border:1px solid rgba(255,239,183,.35);border-radius:16px;background:#171b18;color:#fff8df}.safe-lineup-dialog::backdrop{background:rgba(0,0,0,.75)}.safe-lineup-dialog img{display:block;max-width:210px;max-height:250px;object-fit:contain;margin:0 auto 10px}.safe-lineup-dialog button{min-width:44px;min-height:44px}
    @media(max-width:760px){.safe-tournament-lineup{width:calc(100vw - 8px);max-height:calc(100dvh - 8px);padding:10px}.safe-lineup-heading{align-items:stretch;flex-direction:column}.safe-lineup-status{display:grid;grid-template-columns:minmax(0,1fr) 112px}.safe-lineup-mode{min-height:48px}.safe-lineup-counter{min-width:0}.safe-lineup-layout{grid-template-columns:1fr}.safe-lineup-pool{grid-template-columns:repeat(2,minmax(0,1fr));max-height:40dvh}.safe-lineup-selected{max-height:36dvh}.safe-lineup-toolbar{display:grid;grid-template-columns:1fr 1fr}.safe-lineup-toolbar button{width:100%;padding-inline:8px}.safe-lineup-versus{grid-template-columns:minmax(0,1fr) 44px minmax(0,1fr);gap:6px;padding:10px}.safe-lineup-versus>div{flex-direction:column;text-align:center}.safe-lineup-versus>div:last-child{justify-content:center;text-align:center}.safe-lineup-versus strong{max-width:100%;font-size:.78rem}.safe-lineup-team-mark{width:38px;height:42px}.safe-lineup-vs{width:40px;height:40px;font-size:.9rem}.safe-lineup-actions{position:sticky;z-index:7;bottom:-10px;display:grid;grid-template-columns:1fr;margin:12px -4px -10px;padding:10px 4px max(10px,env(safe-area-inset-bottom,0px));border-top:1px solid rgba(255,239,183,.18);background:linear-gradient(180deg,rgba(34,23,15,.92),rgba(24,16,11,.995));box-shadow:0 -12px 26px rgba(0,0,0,.35);backdrop-filter:blur(10px)}.safe-lineup-actions button,.safe-lineup-start{width:100%;min-width:0}.safe-lineup-card__select{grid-template-columns:40px minmax(0,1fr) 20px;gap:6px;min-height:68px;padding:6px}.safe-lineup-avatar{width:38px;height:48px}.safe-lineup-chip{max-width:72px}}
    @media(max-width:420px){.safe-tournament-lineup{width:100vw;max-height:100dvh;border-radius:0}.safe-lineup-pool{grid-template-columns:1fr}.safe-lineup-toolbar{grid-template-columns:1fr}.safe-lineup-position-summary{gap:6px}.safe-lineup-position-summary>span{flex:1 1 auto;justify-content:center}.safe-lineup-status{grid-template-columns:1fr 102px}}
    @media(prefers-reduced-motion:reduce){.safe-lineup-card{transition:none}}
  `;
  document.head.appendChild(style);
}

const createPanel = () => {
  const node = document.createElement('div');
  node.className = 'tournament-panel mobile-sheet safe-tournament-lineup';
  node.tabIndex = -1;
  return node;
};
const showPanel = node => {
  const overlay = document.querySelector('#overlay');
  const body = document.querySelector('#overlay-body');
  if (!overlay || !body) return false;
  body.replaceChildren(node);
  overlay.hidden = false;
  requestAnimationFrame(() => node.querySelector('button:not([disabled])')?.focus?.({ preventScroll: true }));
  return true;
};
const showCenter = state => {
  runtime.active = false;
  runtime.launching = false;
  globalThis.FociskartyakTournament?.showCenter?.(state ?? tournamentStorageService.read(), null);
};
const pushBackState = () => {
  if (runtime.historyPushed) return;
  try {
    history.pushState({ fociskartyakTournamentLineup: true }, '');
    runtime.historyPushed = true;
  } catch {
    runtime.historyPushed = false;
  }
};

function showSafeLineupSelection(inputState, match) {
  let state = inputState;
  const humanTeam = tournamentTeamById(state, state.humanTeamId);
  const opponentId = match.homeId === state.humanTeamId ? match.awayId : match.homeId;
  const opponent = tournamentTeamById(state, opponentId);
  if (!humanTeam || !opponent) return;

  const cards = resolveQuickMatchSelection(players(), humanTeam.selection)
    .filter(card => text(card?.id))
    .sort((left, right) => playerStrength(right) - playerStrength(left));
  const mode = modeForMatch(state, match);
  const round = roundForMatch(state, match);
  const recommended = automaticTournamentLineup(cards, playerStrength);
  const savedMatch = storedTournamentLineup(state, 'match', cards, { matchId: match.id });
  const savedPenalty = mode === TOURNAMENT_MATCH_MODE.PENALTIES
    ? storedTournamentLineup(state, 'penalty', cards, { matchId: match.id })
    : [];
  const savedLast = storedTournamentLineup(state, 'last', cards);
  let selected = [...(savedPenalty.length ? savedPenalty : savedMatch.length ? savedMatch : savedLast.length ? savedLast : recommended)];
  let feedback = '';
  let feedbackKind = '';
  const node = createPanel();
  runtime.active = true;
  runtime.launching = false;
  pushBackState();

  const persist = ({ updateLast = false, saveFavorite = false } = {}) => {
    state = saveTournamentLineup(state, {
      matchId: match.id,
      lineupIds: selected,
      availablePlayers: cards,
      updateLast,
      saveFavorite,
      penaltyOrderIds: mode === TOURNAMENT_MATCH_MODE.PENALTIES ? selected : null,
    });
    if (!tournamentStorageService.save(state)) throw new Error('A keret helyi mentése sikertelen.');
  };

  const launch = () => {
    if (runtime.launching) return;
    const validation = validateTournamentLineup(selected, cards);
    if (!validation.valid) {
      feedback = validation.errors.join(' ');
      feedbackKind = 'error';
      render();
      return;
    }
    runtime.launching = true;
    render();
    try {
      persist({ updateLast: true });
      state = {
        ...state,
        currentMatchId: match.id,
        currentMatchMode: mode,
        currentLineupIds: [...selected],
        updatedAt: new Date().toISOString(),
      };
      if (!tournamentStorageService.save(state)) throw new Error('A tornaállapot nem menthető.');
      globalThis.localStorage?.setItem(TOURNAMENT_LINEUP_STORAGE_KEY, JSON.stringify({
        tournamentId: state.id,
        matchId: match.id,
        humanIds: [...selected],
        mode,
      }));
      const staged = stageQuickMatch({
        playerTeamId: humanTeam.id,
        opponentTeamId: opponent.id,
        playerSelection: humanTeam.selection,
        opponentSelection: opponent.selection,
        mode,
        difficulty: state.difficulty,
        createdAt: new Date().toISOString(),
      });
      if (!staged) throw new Error('A tornamérkőzés csapatai nem tölthetők be.');
      globalThis.location.reload();
    } catch (error) {
      runtime.launching = false;
      feedback = error?.message || 'A mérkőzés nem indítható el.';
      feedbackKind = 'error';
      render();
    }
  };

  const render = () => {
    selected = [...validateTournamentLineup(selected, cards, { required: selected.length }).ids]
      .slice(0, TOURNAMENT_LINEUP_SIZE);
    const validation = validateTournamentLineup(selected, cards);
    const selectedSet = new Set(selected);
    const last = storedTournamentLineup(state, 'last', cards);
    const favorite = storedTournamentLineup(state, 'favorite', cards);
    const positions = tournamentLineupPositionSummary(selected, cards);
    const errorMessage = cards.length < TOURNAMENT_LINEUP_SIZE
      ? `A csapatban csak ${cards.length} használható lap van. Pontosan ${TOURNAMENT_LINEUP_SIZE} szükséges.`
      : !validation.valid && selected.length !== TOURNAMENT_LINEUP_SIZE
        ? `A mérkőzés csak pontosan ${TOURNAMENT_LINEUP_SIZE} különböző játékoskártyával indítható.`
        : '';
    const selectionHint = mode === TOURNAMENT_MATCH_MODE.PENALTIES
      ? 'A kiválasztott 11 sorrendje egyben a büntetőrúgók sorrendje. A nyilakkal finomhangolható.'
      : 'Válassz pontosan 11 különböző játékoskártyát a következő mérkőzésre.';
    const selectedTitle = mode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'Büntetőrúgók sorrendje' : 'Kezdőcsapat';
    node.innerHTML = `
      <div class="safe-lineup-heading">
        <div class="safe-lineup-heading__main"><span class="safe-lineup-kicker">${escapeHtml(state.name)} · ${escapeHtml(round?.label || 'Következő mérkőzés')}</span><h1>Meccsnapi keret</h1><p>Állítsd össze a saját 11-esedet a mérkőzés előtt.</p></div>
        <div class="safe-lineup-status"><span class="safe-lineup-mode">${mode === TOURNAMENT_MATCH_MODE.PENALTIES ? '⚽' : '🃏'} ${escapeHtml(modeLabel(mode))}</span><span class="safe-lineup-counter ${validation.valid ? 'is-valid' : 'is-invalid'}" aria-live="polite"><small>KEZDŐCSAPAT</small><strong>${selected.length}<em> / ${TOURNAMENT_LINEUP_SIZE}</em></strong></span></div>
      </div>
      <div class="safe-lineup-versus"><div>${teamMark(humanTeam)}<strong>${escapeHtml(humanTeam.label)}</strong></div><b class="safe-lineup-vs">VS</b><div>${teamMark(opponent)}<strong>${escapeHtml(opponent.label)}</strong></div></div>
      <div class="safe-lineup-position-summary" aria-label="Keret pozícióeloszlása"><span><b>GK</b>${positions.GK}</span><span><b>DEF</b>${positions.DEF}</span><span><b>MID</b>${positions.MID}</span><span><b>ATT</b>${positions.ATT}</span><span class="safe-lineup-position-help">Tájékoztató jellegű · nincs kötelező formáció</span></div>
      <p class="safe-lineup-message ${errorMessage || feedbackKind === 'error' ? 'is-error' : feedbackKind === 'success' ? 'is-success' : ''}" role="status" aria-live="polite">${escapeHtml(feedback || errorMessage || selectionHint)}</p>
      <div class="safe-lineup-layout">
        <section><div class="safe-lineup-title"><div><h2>Elérhető játékosok</h2><small>Koppints a kártyára a kezdőcsapat módosításához.</small></div><span>${cards.length} lap</span></div><div class="safe-lineup-pool">${cards.map(card => {
          const id = text(card.id);
          const active = selectedSet.has(id);
          const position = cardPosition(card) || '—';
          const identity = cardIdentity(card);
          return `<article class="safe-lineup-card ${active ? 'is-selected' : ''}" data-player-id="${escapeHtml(id)}"><button type="button" class="safe-lineup-card__select" aria-pressed="${active}" aria-label="${escapeHtml(card.name)} ${active ? 'eltávolítása a kezdőcsapatból' : 'hozzáadása a kezdőcsapathoz'}"><span class="safe-lineup-avatar">${card?.portrait ? `<img src="${escapeHtml(card.portrait)}" alt="">` : '👤'}</span><span class="safe-lineup-card__copy"><span class="safe-lineup-card__meta"><span class="safe-lineup-chip safe-lineup-chip--position">${escapeHtml(position)}</span><span class="safe-lineup-chip">${escapeHtml(identity)}</span></span><b>${escapeHtml(card.name)}</b><small class="safe-lineup-card__state">${active ? '✓ A kezdőcsapatban' : 'Kiválasztható'}</small></span><span class="safe-lineup-check" aria-hidden="true">✓</span></button><button type="button" class="safe-lineup-card__zoom" aria-label="${escapeHtml(card.name)} kártyájának nagyítása">⌕</button></article>`;
        }).join('')}</div></section>
        <section><div class="safe-lineup-title"><div><h2>${selectedTitle}</h2><small>${mode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'A sorrend határozza meg a rúgók következését.' : 'A kiválasztott 11 játékos.'}</small></div><span>${selected.length}/${TOURNAMENT_LINEUP_SIZE}</span></div><ol class="safe-lineup-selected">${selected.map((id, index) => {
          const card = cards.find(item => text(item.id) === id);
          if (!card) return '';
          const orderControls = mode === TOURNAMENT_MATCH_MODE.PENALTIES
            ? `<div class="safe-lineup-order"><button type="button" data-move="up" data-id="${escapeHtml(id)}" aria-label="${escapeHtml(card.name)} feljebb mozgatása" title="Feljebb" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="down" data-id="${escapeHtml(id)}" aria-label="${escapeHtml(card.name)} lejjebb mozgatása" title="Lejjebb" ${index === selected.length - 1 ? 'disabled' : ''}>↓</button></div>`
            : '<span></span>';
          return `<li><span>${index + 1}</span><div><b>${escapeHtml(card.name)}</b><small>${escapeHtml(cardPosition(card) || cardIdentity(card))}</small></div>${orderControls}<button type="button" class="safe-lineup-remove" data-remove="${escapeHtml(id)}" aria-label="${escapeHtml(card.name)} eltávolítása">×</button></li>`;
        }).join('')}</ol></section>
      </div>
      <div class="safe-lineup-toolbar" aria-label="Gyors keretműveletek"><button class="btn btn--ghost" id="safe-lineup-auto" type="button">⚡ Automatikus 11</button><button class="btn btn--ghost" id="safe-lineup-last" type="button" ${last.length ? '' : 'disabled'}>↩ Legutóbbi keret</button><button class="btn btn--ghost" id="safe-lineup-favorite-use" type="button" ${favorite.length ? '' : 'disabled'}>⭐ Kedvenc keret</button><button class="btn btn--ghost" id="safe-lineup-favorite-save" type="button" ${validation.valid ? '' : 'disabled'}>☆ Mentés kedvencként</button><button class="btn btn--ghost" id="safe-lineup-reset" type="button">↺ Alaphelyzet</button></div>
      <div class="safe-lineup-actions"><button class="btn btn--ghost" id="safe-lineup-back" type="button">Vissza</button><button class="btn btn--ghost" id="safe-lineup-save" type="button" ${validation.valid ? '' : 'disabled'}>Mentés erre a mérkőzésre</button><button class="btn safe-lineup-start" id="safe-lineup-start" type="button" ${validation.valid && !runtime.launching ? '' : 'disabled'} aria-disabled="${!validation.valid || runtime.launching}">${runtime.launching ? 'INDÍTÁS…' : '▶ MÉRKŐZÉS INDÍTÁSA'}</button></div>
      <dialog class="safe-lineup-dialog"><button type="button" data-dialog-close aria-label="Bezárás">×</button><div data-dialog-content></div></dialog>`;

    node.querySelectorAll('.safe-lineup-card__select').forEach(button => button.addEventListener('click', () => {
      const id = text(button.closest('[data-player-id]')?.dataset.playerId);
      if (selectedSet.has(id)) selected = selected.filter(item => item !== id);
      else if (selected.length < TOURNAMENT_LINEUP_SIZE) selected = [...selected, id];
      else {
        feedback = 'A kezdőcsapat már 11/11. Előbb távolíts el egy játékost.';
        feedbackKind = 'error';
      }
      render();
    }));
    node.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
      selected = selected.filter(id => id !== button.dataset.remove);
      render();
    }));
    node.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => {
      selected = moveTournamentPenaltyOrder(selected, button.dataset.id, button.dataset.move);
      render();
    }));

    const dialog = node.querySelector('.safe-lineup-dialog');
    node.querySelectorAll('.safe-lineup-card__zoom').forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const id = text(button.closest('[data-player-id]')?.dataset.playerId);
      const card = cards.find(item => text(item.id) === id);
      const content = dialog?.querySelector('[data-dialog-content]');
      if (!card || !content) return;
      content.innerHTML = `${card?.portrait ? `<img src="${escapeHtml(card.portrait)}" alt="${escapeHtml(card.name)}">` : ''}<h2>${escapeHtml(card.name)}</h2><p>${escapeHtml(cardPosition(card) || 'Pozíció nincs megadva')} · ${escapeHtml(cardIdentity(card))}</p>`;
      dialog.showModal();
    }));
    node.querySelector('[data-dialog-close]')?.addEventListener('click', () => dialog?.close());

    node.querySelector('#safe-lineup-auto')?.addEventListener('click', () => {
      selected = [...recommended];
      feedback = 'Az automatikus 11 lapos keret összeállt.';
      feedbackKind = 'success';
      render();
    });
    node.querySelector('#safe-lineup-last')?.addEventListener('click', () => {
      selected = [...last];
      feedback = 'A legutóbbi érvényes keret visszatöltve.';
      feedbackKind = 'success';
      render();
    });
    node.querySelector('#safe-lineup-favorite-use')?.addEventListener('click', () => {
      selected = [...favorite];
      feedback = 'A kedvenc érvényes keret visszatöltve.';
      feedbackKind = 'success';
      render();
    });
    node.querySelector('#safe-lineup-reset')?.addEventListener('click', () => {
      state = resetTournamentMatchLineup(state, match.id);
      tournamentStorageService.save(state);
      selected = [...recommended];
      feedback = 'A mérkőzés mentett kerete törölve, az automatikus alaphelyzet visszaállítva.';
      feedbackKind = 'success';
      render();
    });
    node.querySelector('#safe-lineup-favorite-save')?.addEventListener('click', () => {
      try {
        persist({ saveFavorite: true });
        feedback = 'A kedvenc összeállítás elmentve.';
        feedbackKind = 'success';
      } catch (error) {
        feedback = error?.message || 'A kedvenc keret nem menthető.';
        feedbackKind = 'error';
      }
      render();
    });
    node.querySelector('#safe-lineup-save')?.addEventListener('click', () => {
      try {
        persist();
        feedback = 'A keret csak ehhez a mérkőzéshez elmentve.';
        feedbackKind = 'success';
      } catch (error) {
        feedback = error?.message || 'A keret nem menthető.';
        feedbackKind = 'error';
      }
      render();
    });
    node.querySelector('#safe-lineup-back')?.addEventListener('click', () => {
      if (runtime.historyPushed) history.back();
      else showCenter(state);
    }, { once: true });
    node.querySelector('#safe-lineup-start')?.addEventListener('click', launch, { once: true });
  };

  render();
  showPanel(node);
}

function interceptTournamentPlay(event) {
  const button = event.target?.closest?.('#tournament-play');
  if (!button || runtime.launching) return;
  const state = tournamentStorageService.read();
  const match = tournamentNextHumanMatch(state);
  if (!state || !match) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showSafeLineupSelection(state, match);
}

function handleBack() {
  if (!runtime.active) return;
  runtime.historyPushed = false;
  showCenter(tournamentStorageService.read());
}

export function installTournamentLineupController() {
  if (runtime.installed || typeof document === 'undefined') return;
  runtime.installed = true;
  installStyles();
  document.addEventListener('click', interceptTournamentPlay, true);
  globalThis.addEventListener?.('popstate', handleBack);
}

installTournamentLineupController();
