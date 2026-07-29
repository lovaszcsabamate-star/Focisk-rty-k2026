/** Meccs előtti 11 lapos torna-keret és büntetőrúgó-sorrend. */

import { TOURNAMENT_LINEUP_STORAGE_KEY, stageQuickMatch } from '../deck-selection.js';
import { tournamentStorageService } from '../services/tournament-storage-service.js';
import {
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  tournamentTeamById,
} from './tournament-domain.js';
import { tournamentPlayerStrength, tournamentTacticalSummary } from './tournament-simulation.js';
import { migrateEnhancedTournament, saveLineupForMatch } from './tournament-state.js';
import {
  cardDetails,
  cardSubtitle,
  cardsForTeam,
  escapeHtml,
  panel,
  phaseLabel,
  showPanel,
  teamMark,
  tournamentModeTitle,
} from './tournament-ui.js';

export function showLineupSelection(inputState, match, { returnPanel = null, showCenter } = {}) {
  let state = migrateEnhancedTournament(inputState);
  const humanTeam = tournamentTeamById(state, state.humanTeamId);
  const opponentId = match.homeId === state.humanTeamId ? match.awayId : match.homeId;
  const opponent = tournamentTeamById(state, opponentId);
  const cards = cardsForTeam(state, humanTeam.id).sort((a, b) => tournamentPlayerStrength(b) - tournamentPlayerStrength(a));
  const opponentCards = cardsForTeam(state, opponentId);
  const required = 11;
  const lineupMode = match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK
    ? TOURNAMENT_MATCH_MODE.PENALTIES
    : state.matchMode;
  const availableIds = new Set(cards.map(card => String(card.id)));
  const fromMatch = state.lineupState?.byMatchId?.[match.id] ?? [];
  const fromLast = state.lineupState?.lastLineupIds ?? state.lastLineupIds ?? [];
  const recommended = cards.slice(0, required).map(card => String(card.id));
  let selected = (fromMatch.length ? fromMatch : fromLast.length === required ? fromLast : recommended).map(String).filter(id => availableIds.has(id)).slice(0, required);
  if (selected.length < required && cards.length >= required) selected = recommended;
  const tactical = tournamentTacticalSummary(cards, opponentCards);
  const node = panel('tournament-lineup');
  const move = (id, direction) => {
    const index = selected.indexOf(id); const target = index + direction;
    if (index < 0 || target < 0 || target >= selected.length) return;
    [selected[index], selected[target]] = [selected[target], selected[index]]; render();
  };
  const launch = () => {
    const mode = lineupMode;
    state = saveLineupForMatch(state, match.id, selected, { mode });
    state = { ...state, currentMatchId: match.id, currentMatchMode: mode, currentLineupIds: [...selected], updatedAt: new Date().toISOString() };
    tournamentStorageService.save(state);
    try { localStorage.setItem(TOURNAMENT_LINEUP_STORAGE_KEY, JSON.stringify({ tournamentId: state.id, matchId: match.id, humanIds: selected, mode })); } catch { /* nem blokkoló */ }
    const staged = stageQuickMatch({ playerTeamId: humanTeam.id, opponentTeamId: opponent.id, playerSelection: humanTeam.selection, opponentSelection: opponent.selection, mode, difficulty: state.difficulty, createdAt: new Date().toISOString() });
    if (!staged) { alert('A tornamérkőzés csapatai nem tölthetők be.'); return; }
    globalThis.location.reload();
  };
  const render = () => {
    const selectedSet = new Set(selected); const valid = cards.length >= required && selected.length === required && selectedSet.size === required;
    node.innerHTML = `<div class="tournament-heading"><div><p class="eyebrow">${escapeHtml(state.name)} · ${escapeHtml(tournamentModeTitle(state))}</p><h1>Csapatösszeállítás</h1></div><button class="tournament-help" type="button" aria-label="Csapatösszeállítás súgó">?</button></div>
      <div class="tournament-versus tournament-versus--lineup"><div>${teamMark(humanTeam)}<strong>${escapeHtml(humanTeam.label)}</strong></div><b>VS</b><div>${teamMark(opponent)}<strong>${escapeHtml(opponent.label)}</strong></div></div>
      <section class="tournament-tactical"><h2>Taktikai összegzés</h2>${tactical.sentences.map(sentence => `<p>${escapeHtml(sentence)}</p>`).join('')}<small>${escapeHtml(phaseLabel(state))} · ${escapeHtml(match.label || '')}</small></section>
      ${cards.length < required ? `<p class="tournament-warning">A csapatban csak ${cards.length} használható lap van. Legalább ${required} szükséges.</p>` : ''}
      <div class="tournament-lineup-layout"><section><div class="tournament-lineup-title"><h2>Elérhető pakli</h2><span>${cards.length} lap</span></div><div class="tournament-card-pool">${cards.map(card => `<article class="tournament-lineup-card ${selectedSet.has(String(card.id)) ? 'is-selected' : ''}" data-card-id="${escapeHtml(card.id)}"><button class="tournament-lineup-card__select" type="button" aria-pressed="${selectedSet.has(String(card.id))}"><span class="tournament-lineup-card__avatar">${card?.portrait ? `<img src="${escapeHtml(card.portrait)}" alt="">` : '👤'}</span><span><b>${escapeHtml(card.name)}</b><small>${escapeHtml(cardSubtitle(card))}</small></span><em>${Math.round(tournamentPlayerStrength(card) * 10) / 10}</em></button><button class="tournament-lineup-card__zoom" type="button" aria-label="${escapeHtml(card.name)} kártyájának nagyítása">⌕</button></article>`).join('')}</div></section>
      <section><div class="tournament-lineup-title"><h2>Aktív meccskeret</h2><span class="${valid ? 'is-valid' : 'is-invalid'}">${selected.length}/${required}</span></div><ol class="tournament-selected-list">${selected.map((id, index) => { const card = cards.find(item => String(item.id) === id); if (!card) return ''; return `<li><span>${index + 1}</span><div><b>${escapeHtml(card.name)}</b><small>${escapeHtml(cardSubtitle(card))}</small></div>${lineupMode === TOURNAMENT_MATCH_MODE.PENALTIES ? `<div class="tournament-order-buttons"><button type="button" data-move="up" data-id="${escapeHtml(id)}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="down" data-id="${escapeHtml(id)}" ${index === selected.length - 1 ? 'disabled' : ''}>↓</button></div>` : ''}<button type="button" data-remove="${escapeHtml(id)}" aria-label="${escapeHtml(card.name)} eltávolítása">×</button></li>`; }).join('')}</ol></section></div>
      <div class="tournament-lineup-tools"><button class="btn btn--ghost" id="lineup-auto">Automatikus összeállítás</button><button class="btn btn--ghost" id="lineup-last">Legutóbbi összeállítás</button><button class="btn btn--ghost" id="lineup-reset">Alaphelyzet</button><button class="btn btn--ghost" id="lineup-favorite-use">Kedvenc használata</button><button class="btn btn--ghost" id="lineup-favorite-save">Kedvencként mentés</button></div>
      <div class="tournament-actions"><button class="btn btn--ghost" id="lineup-back">Vissza</button><button class="btn btn--ghost" id="lineup-save" ${valid ? '' : 'disabled'}>Mentés csak erre a meccsre</button><button class="btn" id="lineup-start" ${valid ? '' : 'disabled'}>Meccs indítása</button></div>
      <dialog class="tournament-card-dialog"><button class="tournament-dialog-close" type="button" aria-label="Bezárás">×</button><div data-card-dialog-content></div></dialog><dialog class="tournament-help-dialog"><h2>Csapatösszeállítás</h2><p>Válassz pontosan 11 lapot. Büntetőpárbajnál a lista a rúgók alapértelmezett sorrendje.</p><button class="btn">Értem</button></dialog>`;
    node.querySelectorAll('.tournament-lineup-card__select').forEach(button => button.addEventListener('click', () => { const id = String(button.closest('[data-card-id]')?.dataset.cardId || ''); selected = selectedSet.has(id) ? selected.filter(item => item !== id) : selected.length < required ? [...selected, id] : selected; render(); }));
    node.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { selected = selected.filter(id => id !== button.dataset.remove); render(); }));
    node.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => move(button.dataset.id, button.dataset.move === 'up' ? -1 : 1)));
    const cardDialog = node.querySelector('.tournament-card-dialog');
    node.querySelectorAll('.tournament-lineup-card__zoom').forEach(button => button.addEventListener('click', () => { const id = String(button.closest('[data-card-id]')?.dataset.cardId || ''); const card = cards.find(item => String(item.id) === id); const content = cardDialog?.querySelector('[data-card-dialog-content]'); if (card && content) content.innerHTML = `<div class="tournament-card-zoom"><div class="tournament-card-zoom__visual">${card?.portrait ? `<img src="${escapeHtml(card.portrait)}" alt="">` : '<span>👤</span>'}</div><h2>${escapeHtml(card.name)}</h2><p>${escapeHtml(cardSubtitle(card))}</p>${cardDetails(card)}</div>`; cardDialog?.showModal(); }));
    node.querySelector('.tournament-dialog-close')?.addEventListener('click', () => cardDialog?.close());
    node.querySelector('#lineup-auto')?.addEventListener('click', () => { selected = [...recommended]; render(); }); node.querySelector('#lineup-reset')?.addEventListener('click', () => { selected = [...recommended]; render(); });
    node.querySelector('#lineup-last')?.addEventListener('click', () => { const ids = (state.lineupState?.lastLineupIds ?? []).filter(id => availableIds.has(String(id))).slice(0, required); if (ids.length === required) selected = ids.map(String); render(); });
    node.querySelector('#lineup-favorite-use')?.addEventListener('click', () => { const ids = (state.lineupState?.favoriteLineupIds ?? []).filter(id => availableIds.has(String(id))).slice(0, required); if (ids.length === required) selected = ids.map(String); render(); });
    node.querySelector('#lineup-favorite-save')?.addEventListener('click', () => { if (!valid) return; state = saveLineupForMatch(state, match.id, selected, { favorite: true, mode: lineupMode }); tournamentStorageService.save(state); render(); });
    node.querySelector('#lineup-save')?.addEventListener('click', () => { if (!valid) return; state = saveLineupForMatch(state, match.id, selected, { mode: lineupMode }); tournamentStorageService.save(state); render(); });
    node.querySelector('#lineup-back')?.addEventListener('click', () => showCenter?.(state, returnPanel), { once: true }); node.querySelector('#lineup-start')?.addEventListener('click', () => { if (valid) launch(); }, { once: true });
    const help = node.querySelector('.tournament-help-dialog'); node.querySelector('.tournament-help')?.addEventListener('click', () => help?.showModal()); help?.querySelector('.btn')?.addEventListener('click', () => help.close());
  };
  render(); showPanel(node);
}
