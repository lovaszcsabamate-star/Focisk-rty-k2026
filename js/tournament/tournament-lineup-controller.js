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
const escapeHtml = value => text(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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
const cardSubtitle = card => [card?.position, card?.meta?.position, card?.club].map(text).find(Boolean) || 'Játékoskártya';
const modeForMatch = (state, match) => match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK
  ? TOURNAMENT_MATCH_MODE.PENALTIES
  : state.matchMode;
const initials = label => text(label).split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join('').toUpperCase();
const teamMark = team => team?.badge
  ? `<img class="safe-lineup-team-mark" src="${escapeHtml(team.badge)}" alt="" loading="lazy">`
  : `<span class="safe-lineup-team-mark safe-lineup-team-mark--fallback" aria-hidden="true">${escapeHtml(team?.icon || initials(team?.label) || 'FK')}</span>`;

function installStyles() {
  if (document.getElementById('safe-tournament-lineup-style')) return;
  const style = document.createElement('style');
  style.id = 'safe-tournament-lineup-style';
  style.textContent = `
    .safe-tournament-lineup{width:min(1120px,calc(100vw - 20px));max-height:calc(100dvh - 18px);overflow:auto;padding:16px}
    .safe-lineup-heading,.safe-lineup-versus,.safe-lineup-toolbar,.safe-lineup-actions,.safe-lineup-title{display:flex;align-items:center;gap:10px}
    .safe-lineup-heading,.safe-lineup-title{justify-content:space-between}.safe-lineup-heading h1{margin:.15rem 0}
    .safe-lineup-versus{justify-content:center;margin:12px 0;padding:12px;border:1px solid rgba(255,239,183,.2);border-radius:16px;background:rgba(0,0,0,.16)}
    .safe-lineup-versus>div{display:flex;align-items:center;gap:8px;min-width:0}.safe-lineup-team-mark{width:48px;height:52px;object-fit:contain;flex:0 0 auto}
    .safe-lineup-team-mark--fallback{display:grid;place-items:center;border:2px solid rgba(255,255,255,.65);border-radius:14px;background:#315f45;color:#fff;font-weight:950}
    .safe-lineup-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(290px,.65fr);gap:14px}.safe-lineup-layout>section{min-width:0;padding:12px;border:1px solid rgba(255,239,183,.14);border-radius:15px;background:rgba(0,0,0,.14)}
    .safe-lineup-counter{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-weight:950}.safe-lineup-counter.is-valid{background:rgba(61,174,92,.23);color:#d4ffdc}.safe-lineup-counter.is-invalid{background:rgba(206,70,61,.2);color:#ffd7d1}
    .safe-lineup-pool{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;max-height:52dvh;overflow:auto;padding:2px}.safe-lineup-card{display:grid;grid-template-columns:1fr 44px;min-width:0;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.035);overflow:hidden}.safe-lineup-card.is-selected{border-color:rgba(255,214,90,.75);background:rgba(255,214,90,.1)}
    .safe-lineup-card__select{display:flex;align-items:center;gap:9px;min-width:0;min-height:58px;padding:8px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.safe-lineup-card__select span:last-child{min-width:0}.safe-lineup-card__select b,.safe-lineup-card__select small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.safe-lineup-card__select small{opacity:.78}.safe-lineup-avatar{display:grid;place-items:center;width:42px;height:48px;flex:0 0 auto;overflow:hidden;border-radius:8px;background:rgba(255,255,255,.08)}.safe-lineup-avatar img{width:100%;height:100%;object-fit:cover}
    .safe-lineup-card__zoom,.safe-lineup-order button,.safe-lineup-remove{min-width:44px;min-height:44px;border:0;border-left:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);color:inherit;cursor:pointer}.safe-lineup-card button:focus-visible,.safe-lineup-selected button:focus-visible,.safe-lineup-toolbar button:focus-visible,.safe-lineup-actions button:focus-visible{outline:3px solid #ffd65a;outline-offset:2px}
    .safe-lineup-selected{margin:0;padding:0;list-style:none;display:grid;gap:7px;max-height:52dvh;overflow:auto}.safe-lineup-selected li{display:grid;grid-template-columns:32px 1fr auto 44px;align-items:center;gap:7px;min-height:52px;padding:4px;border:1px solid rgba(255,255,255,.14);border-radius:10px}.safe-lineup-selected li>span{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgba(255,214,90,.15);font-weight:950}.safe-lineup-selected li>div:nth-child(2){min-width:0}.safe-lineup-selected b,.safe-lineup-selected small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.safe-lineup-selected small{opacity:.75}.safe-lineup-order{display:flex}.safe-lineup-order button{border-left:0;border-radius:8px}.safe-lineup-order button:disabled{opacity:.35;cursor:not-allowed}
    .safe-lineup-toolbar,.safe-lineup-actions{flex-wrap:wrap;margin-top:12px}.safe-lineup-toolbar button,.safe-lineup-actions button{min-height:44px}.safe-lineup-actions{justify-content:flex-end}.safe-lineup-message{margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.06)}.safe-lineup-message.is-error{background:rgba(190,55,48,.19);color:#ffd9d5}.safe-lineup-message.is-success{background:rgba(48,154,78,.18);color:#d5ffdf}
    .safe-lineup-dialog{max-width:min(520px,calc(100vw - 24px));border:1px solid rgba(255,239,183,.35);border-radius:16px;background:#171b18;color:#fff8df}.safe-lineup-dialog::backdrop{background:rgba(0,0,0,.75)}.safe-lineup-dialog img{display:block;max-width:210px;max-height:250px;object-fit:contain;margin:0 auto 10px}.safe-lineup-dialog button{min-width:44px;min-height:44px}
    @media(max-width:760px){.safe-tournament-lineup{width:calc(100vw - 10px);padding:10px}.safe-lineup-layout{grid-template-columns:1fr}.safe-lineup-pool,.safe-lineup-selected{max-height:38dvh}.safe-lineup-toolbar,.safe-lineup-actions{display:grid;grid-template-columns:1fr}.safe-lineup-versus{font-size:.88rem}.safe-lineup-team-mark{width:38px;height:42px}}
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
    const errorMessage = cards.length < TOURNAMENT_LINEUP_SIZE
      ? `A csapatban csak ${cards.length} használható lap van. Pontosan ${TOURNAMENT_LINEUP_SIZE} szükséges.`
      : !validation.valid && selected.length !== TOURNAMENT_LINEUP_SIZE
        ? `A mérkőzés csak pontosan ${TOURNAMENT_LINEUP_SIZE} különböző játékoskártyával indítható.`
        : '';
    node.innerHTML = `
      <div class="safe-lineup-heading"><div><p class="eyebrow">${escapeHtml(state.name)} · Meccs előtti összeállítás</p><h1>Csapatösszeállítás</h1></div><span class="safe-lineup-counter ${validation.valid ? 'is-valid' : 'is-invalid'}" aria-live="polite">${selected.length}/${TOURNAMENT_LINEUP_SIZE}</span></div>
      <div class="safe-lineup-versus"><div>${teamMark(humanTeam)}<strong>${escapeHtml(humanTeam.label)}</strong></div><b>VS</b><div>${teamMark(opponent)}<strong>${escapeHtml(opponent.label)}</strong></div></div>
      <p class="safe-lineup-message ${errorMessage || feedbackKind === 'error' ? 'is-error' : feedbackKind === 'success' ? 'is-success' : ''}" role="status" aria-live="polite">${escapeHtml(feedback || errorMessage || (mode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'A lista sorrendje a büntetőrúgók sorrendje. A nyilakkal módosítható.' : 'Válassz pontosan 11 különböző játékoskártyát.'))}</p>
      <div class="safe-lineup-layout">
        <section><div class="safe-lineup-title"><h2>Elérhető játékosok</h2><span>${cards.length} lap</span></div><div class="safe-lineup-pool">${cards.map(card => {
          const id = text(card.id);
          const active = selectedSet.has(id);
          return `<article class="safe-lineup-card ${active ? 'is-selected' : ''}" data-player-id="${escapeHtml(id)}"><button type="button" class="safe-lineup-card__select" aria-pressed="${active}" aria-label="${escapeHtml(card.name)} ${active ? 'eltávolítása a keretből' : 'hozzáadása a kerethez'}"><span class="safe-lineup-avatar">${card?.portrait ? `<img src="${escapeHtml(card.portrait)}" alt="">` : '👤'}</span><span><b>${escapeHtml(card.name)}</b><small>${escapeHtml(cardSubtitle(card))}</small></span></button><button type="button" class="safe-lineup-card__zoom" aria-label="${escapeHtml(card.name)} kártyájának nagyítása">⌕</button></article>`;
        }).join('')}</div></section>
        <section><div class="safe-lineup-title"><h2>Aktív keret${mode === TOURNAMENT_MATCH_MODE.PENALTIES ? ' és rúgósorrend' : ''}</h2><span>${selected.length}/${TOURNAMENT_LINEUP_SIZE}</span></div><ol class="safe-lineup-selected">${selected.map((id, index) => {
          const card = cards.find(item => text(item.id) === id);
          if (!card) return '';
          const orderControls = mode === TOURNAMENT_MATCH_MODE.PENALTIES
            ? `<div class="safe-lineup-order"><button type="button" data-move="up" data-id="${escapeHtml(id)}" aria-label="${escapeHtml(card.name)} feljebb mozgatása" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="down" data-id="${escapeHtml(id)}" aria-label="${escapeHtml(card.name)} lejjebb mozgatása" ${index === selected.length - 1 ? 'disabled' : ''}>↓</button></div>`
            : '<span></span>';
          return `<li><span>${index + 1}</span><div><b>${escapeHtml(card.name)}</b><small>${escapeHtml(cardSubtitle(card))}</small></div>${orderControls}<button type="button" class="safe-lineup-remove" data-remove="${escapeHtml(id)}" aria-label="${escapeHtml(card.name)} eltávolítása">×</button></li>`;
        }).join('')}</ol></section>
      </div>
      <div class="safe-lineup-toolbar" aria-label="Keretműveletek"><button class="btn btn--ghost" id="safe-lineup-auto" type="button">Automatikus összeállítás</button><button class="btn btn--ghost" id="safe-lineup-last" type="button" ${last.length ? '' : 'disabled'}>Legutóbbi összeállítás használata</button><button class="btn btn--ghost" id="safe-lineup-reset" type="button">Alaphelyzet visszaállítása</button><button class="btn btn--ghost" id="safe-lineup-favorite-save" type="button" ${validation.valid ? '' : 'disabled'}>Kedvenc összeállítás mentése</button><button class="btn btn--ghost" id="safe-lineup-favorite-use" type="button" ${favorite.length ? '' : 'disabled'}>Kedvenc összeállítás használata</button></div>
      <div class="safe-lineup-actions"><button class="btn btn--ghost" id="safe-lineup-back" type="button">Vissza</button><button class="btn btn--ghost" id="safe-lineup-save" type="button" ${validation.valid ? '' : 'disabled'}>Mentés csak az aktuális mérkőzésre</button><button class="btn" id="safe-lineup-start" type="button" ${validation.valid && !runtime.launching ? '' : 'disabled'} aria-disabled="${!validation.valid || runtime.launching}">${runtime.launching ? 'Indítás…' : 'Meccs indítása'}</button></div>
      <dialog class="safe-lineup-dialog"><button type="button" data-dialog-close aria-label="Bezárás">×</button><div data-dialog-content></div></dialog>`;

    node.querySelectorAll('.safe-lineup-card__select').forEach(button => button.addEventListener('click', () => {
      const id = text(button.closest('[data-player-id]')?.dataset.playerId);
      if (selectedSet.has(id)) selected = selected.filter(item => item !== id);
      else if (selected.length < TOURNAMENT_LINEUP_SIZE) selected = [...selected, id];
      else {
        feedback = 'A keret már 11/11. Előbb távolíts el egy játékost.';
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
      content.innerHTML = `${card?.portrait ? `<img src="${escapeHtml(card.portrait)}" alt="${escapeHtml(card.name)}">` : ''}<h2>${escapeHtml(card.name)}</h2><p>${escapeHtml(cardSubtitle(card))}</p>`;
      dialog.showModal();
    }));
    node.querySelector('[data-dialog-close]')?.addEventListener('click', () => dialog?.close());

    node.querySelector('#safe-lineup-auto')?.addEventListener('click', () => {
      selected = [...recommended];
      feedback = 'Automatikus 11 lapos keret összeállítva.';
      feedbackKind = 'success';
      render();
    });
    node.querySelector('#safe-lineup-last')?.addEventListener('click', () => {
      selected = [...last];
      feedback = 'A legutóbbi elérhető keret visszatöltve.';
      feedbackKind = 'success';
      render();
    });
    node.querySelector('#safe-lineup-favorite-use')?.addEventListener('click', () => {
      selected = [...favorite];
      feedback = 'A kedvenc elérhető keret visszatöltve.';
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
