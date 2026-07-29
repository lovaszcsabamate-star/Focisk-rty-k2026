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

/** Meccs előtti 11 lapos torna-keret és büntetőrúgó-sorrend. */

function showLineupSelection(inputState, match, { returnPanel = null, showCenter } = {}) {
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

export { showLineupSelection };

/* Az önálló Android-buildben is aktiválódó, külső asset nélküli megjelenítési tartalék. */
if (globalThis.document && !document.getElementById('tournament-presentation-upgrade-style')) {
  const presentationFold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hu-HU').replace(/[^a-z0-9]+/g, ' ').trim();
  const presentationBrands = [
    [['dvsc', 'debreceni vsc'], 'DVSC', '#c8192e', '#fff'],
    [['dvtk', 'diosgyori vtk'], 'DVTK', '#d71920', '#fff'],
    [['eto fc', 'gyori eto'], 'ETO', '#159447', '#fff'],
    [['ferencvarosi tc', 'ferencvaros'], 'FTC', '#16854a', '#fff'],
    [['kisvarda master good', 'kisvarda'], 'KISV', '#d8222a', '#fff'],
    [['kolorcity kazincbarcika sc', 'kazincbarcika'], 'KBSC', '#2468a9', '#f2cf2f'],
    [['mtk budapest', 'mtk'], 'MTK', '#246eb9', '#fff'],
    [['nyiregyhaza spartacus fc', 'nyiregyhaza'], 'NYÍR', '#c61f30', '#254f9a'],
    [['paksi fc', 'paks'], 'PAKS', '#23864a', '#fff'],
    [['puskas akademia fc', 'puskas akademia'], 'PAFC', '#1f66ad', '#f0c640'],
    [['ujpest fc', 'ujpest'], 'UTE', '#6d3a93', '#fff'],
    [['zte fc', 'zalaegerszegi te'], 'ZTE', '#185ea9', '#fff'],
  ];
  const presentationBrand = label => {
    const folded = presentationFold(label);
    return presentationBrands.find(([aliases]) => aliases.some(alias => folded === alias || folded.includes(alias))) ?? null;
  };
  const presentationLogo = (label, brand) => {
    const [, short, primary, secondary] = brand;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'tournament-team-mark__club-svg');
    svg.setAttribute('viewBox', '0 0 120 140');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path d="M60 5 108 24 101 97 60 132 19 97 12 24Z" fill="${primary}" stroke="${secondary}" stroke-width="7"/><path d="M25 33h70v15H25z" fill="${secondary}" opacity=".94"/><circle cx="60" cy="82" r="25" fill="none" stroke="${secondary}" stroke-width="6"/><path d="m60 65 10 7-4 12H54l-4-12z" fill="${secondary}"/><text x="60" y="42" text-anchor="middle" dominant-baseline="middle" fill="${primary}" font-size="19" font-family="system-ui,sans-serif" font-weight="1000">${short}</text>`;
    svg.setAttribute('aria-label', `${label} klublogó`);
    return svg;
  };
  const presentationEnhance = root => {
    const marks = [];
    if (root?.matches?.('.tournament-team-mark--generated')) marks.push(root);
    root?.querySelectorAll?.('.tournament-team-mark--generated').forEach(mark => marks.push(mark));
    marks.forEach(mark => {
      const label = mark.getAttribute('aria-label') || mark.textContent;
      const brand = presentationBrand(label);
      if (!brand) return;
      mark.replaceChildren(presentationLogo(label, brand));
      mark.classList.replace('tournament-team-mark--generated', 'tournament-team-mark--club');
      mark.removeAttribute('style');
    });
    const brackets = [];
    if (root?.matches?.('.tournament-bracket')) brackets.push(root);
    root?.querySelectorAll?.('.tournament-bracket').forEach(bracket => brackets.push(bracket));
    brackets.forEach(bracket => {
      if (bracket.dataset.treeEnhanced === 'true') return;
      bracket.dataset.treeEnhanced = 'true';
      bracket.classList.add('tournament-bracket--tree');
      bracket.tabIndex = 0;
      bracket.setAttribute('aria-label', 'Kieséses kupaág, vízszintesen görgethető');
      const rounds = [...bracket.querySelectorAll(':scope > .tournament-bracket__round')];
      rounds.at(-1)?.classList.add('is-final');
      rounds.forEach(round => round.querySelectorAll('.tournament-bracket__match').forEach(match => match.classList.add('tournament-bracket__match--connected')));
      const hint = document.createElement('p');
      hint.className = 'tournament-bracket__scroll-hint';
      hint.textContent = 'Húzd oldalra az ág­rajz további fordulóihoz →';
      bracket.before(hint);
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      node.nodeValue = node.nodeValue
        .replaceAll(' · nincs gól', ' · mindkét csapat gólt és pontot kapott')
        .replaceAll('azonos értéknél nincs gól.', 'azonos értéknél mindkét csapat gólt és pontot kap.');
    });
  };
  const style = document.createElement('style');
  style.id = 'tournament-presentation-upgrade-style';
  style.textContent = `.tournament-team-mark--club{overflow:visible;background:none;border:0;clip-path:none}.tournament-team-mark__club-svg{width:100%;height:100%;filter:drop-shadow(0 4px 8px rgba(0,0,0,.48))}.tournament-v3 .tournament-bracket__scroll-hint{width:max-content;margin:0 0 10px;padding:5px 9px;border:1px solid rgba(255,214,90,.25);border-radius:999px;background:rgba(36,23,14,.94);color:#d9c9a7;font-size:.72rem}.tournament-v3 .tournament-bracket--tree{display:grid!important;grid-auto-flow:column;grid-auto-columns:minmax(220px,260px);align-items:stretch;gap:52px;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:4px 28px 18px 2px;scroll-snap-type:x proximity}.tournament-v3 .tournament-bracket--tree>.tournament-bracket__round{position:relative;display:flex!important;min-height:310px;flex-direction:column;justify-content:space-around;gap:18px;scroll-snap-align:start}.tournament-v3 .tournament-bracket__match--connected{position:relative;overflow:visible}.tournament-v3 .tournament-bracket__round:not(.is-final) .tournament-bracket__match--connected::after{content:"";position:absolute;right:-53px;top:50%;width:53px;border-top:2px solid rgba(255,214,90,.48)}.tournament-v3 .tournament-bracket__round:not(:first-child)::before{content:"";position:absolute;left:-27px;top:12%;bottom:12%;border-left:2px solid rgba(255,214,90,.34)}@media(min-width:861px){.tournament-v3 .tournament-bracket__scroll-hint{display:none}}@media(max-width:860px){.tournament-v3 .tournament-bracket--tree{grid-auto-columns:minmax(210px,78vw);gap:44px}.tournament-v3 .tournament-bracket__round:not(.is-final) .tournament-bracket__match--connected::after{right:-45px;width:45px}.tournament-v3 .tournament-bracket__round:not(:first-child)::before{left:-23px}.tournament-v3 .tournament-result-row .tournament-team-mark{display:inline-grid}}`;
  document.head.append(style);
  presentationEnhance(document.body);
  const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) presentationEnhance(node);
    else if (node.nodeType === Node.TEXT_NODE && node.parentElement) presentationEnhance(node.parentElement);
  })));
  observer.observe(document.body, { childList: true, subtree: true });
}
