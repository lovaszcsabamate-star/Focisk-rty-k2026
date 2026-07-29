/** Torna létrehozási képernyő és formátumválasztás. */

import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  createTournament,
} from './tournament-domain.js';
import { migrateEnhancedTournament } from './tournament-state.js';
import { tournamentStorageService } from '../services/tournament-storage-service.js';
import {
  chooseParticipants,
  escapeHtml,
  panel,
  poolFor,
  restorePanel,
  showPanel,
  supportedCounts,
  teamMark,
  tournamentName,
} from './tournament-ui.js';

export function showTournamentSetup({ returnPanel = null, showCenter } = {}) {
  const setup = { category: TOURNAMENT_CATEGORY.HUNGARIAN, format: TOURNAMENT_FORMAT.LEAGUE, matchMode: TOURNAMENT_MATCH_MODE.CLASSIC, count: 0, humanTeamId: '', difficulty: 'medium' };
  const node = panel('tournament-setup');
  const preset = name => {
    if (name === 'hungarian-league') Object.assign(setup, { category: TOURNAMENT_CATEGORY.HUNGARIAN, format: TOURNAMENT_FORMAT.LEAGUE, count: 12 });
    if (name === 'hungarian-cup') Object.assign(setup, { category: TOURNAMENT_CATEGORY.HUNGARIAN, format: TOURNAMENT_FORMAT.KNOCKOUT, count: 12 });
    if (name === 'nations') Object.assign(setup, { category: TOURNAMENT_CATEGORY.NATIONS, format: TOURNAMENT_FORMAT.GROUP_KNOCKOUT, count: 8 });
    if (name === 'quick-cup') Object.assign(setup, { category: TOURNAMENT_CATEGORY.NATIONS, format: TOURNAMENT_FORMAT.KNOCKOUT, count: 8 });
    setup.humanTeamId = ''; render();
  };
  const render = () => {
    const pool = poolFor(setup.category);
    const counts = supportedCounts(setup.category, setup.format, pool.length);
    if (!counts.includes(setup.count)) setup.count = counts.includes(12) && setup.category === TOURNAMENT_CATEGORY.HUNGARIAN ? 12 : counts.at(-1) ?? 0;
    if (!pool.some(team => team.id === setup.humanTeamId)) setup.humanTeamId = pool[0]?.id ?? '';
    const selected = pool.find(team => team.id === setup.humanTeamId) ?? null;
    const preview = chooseParticipants(pool, setup.count, setup.humanTeamId, setup.category);
    const canStart = Boolean(setup.count >= 4 && preview.length === setup.count && selected);
    node.innerHTML = `<div class="tournament-heading"><div><p class="eyebrow">Új játékmód</p><h1>🏆 Torna mód</h1></div><button class="tournament-help" type="button" aria-label="Torna mód súgó">?</button></div>
      <div class="tournament-presets" aria-label="Gyors tornák"><button class="tournament-preset" data-preset="hungarian-league"><b>Magyar bajnokság</b><small>12 klub · liga</small></button><button class="tournament-preset" data-preset="hungarian-cup"><b>Magyar Kupa</b><small>12 klub · kieséses</small></button><button class="tournament-preset" data-preset="nations"><b>Nemzetek tornája</b><small>Csoport + kieséses</small></button><button class="tournament-preset" data-preset="quick-cup"><b>Villámkupa</b><small>8 csapat · kieséses</small></button></div>
      <section class="tournament-section"><h2>1. Résztvevők</h2><div class="tournament-segmented"><label><input type="radio" name="tournament-category" value="${TOURNAMENT_CATEGORY.HUNGARIAN}" ${setup.category === TOURNAMENT_CATEGORY.HUNGARIAN ? 'checked' : ''}><span>🇭🇺 Magyar klubok</span></label><label><input type="radio" name="tournament-category" value="${TOURNAMENT_CATEGORY.NATIONS}" ${setup.category === TOURNAMENT_CATEGORY.NATIONS ? 'checked' : ''}><span>🌍 Nemzetek és régiók</span></label></div></section>
      <section class="tournament-section"><h2>2. Kupa módja</h2><div class="tournament-format-grid"><label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.GROUP_KNOCKOUT}" ${setup.format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT ? 'checked' : ''}><span><b>Csoportkör + kieséses</b><small>Tabella, majd kupaág</small></span></label><label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.KNOCKOUT}" ${setup.format === TOURNAMENT_FORMAT.KNOCKOUT ? 'checked' : ''}><span><b>Csak kieséses</b><small>Egyenes kieséses tornaág</small></span></label><label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.LEAGUE}" ${setup.format === TOURNAMENT_FORMAT.LEAGUE ? 'checked' : ''}><span><b>Liga</b><small>Mindenki játszik mindenkivel</small></span></label></div></section>
      <section class="tournament-section"><h2>3. Mérkőzésformátum</h2><div class="tournament-segmented"><label><input type="radio" name="tournament-match-mode" value="${TOURNAMENT_MATCH_MODE.CLASSIC}" ${setup.matchMode === TOURNAMENT_MATCH_MODE.CLASSIC ? 'checked' : ''}><span>🃏 Klasszikus</span></label><label><input type="radio" name="tournament-match-mode" value="${TOURNAMENT_MATCH_MODE.PENALTIES}" ${setup.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'checked' : ''}><span>⚽ Büntetőpárbaj</span></label></div><p class="tournament-inline-help">A választott formátum a teljes tornára érvényes. <button class="help-dot" type="button" data-help="format" aria-label="Mérkőzésformátum magyarázata">?</button></p></section>
      <section class="tournament-section tournament-options-grid"><label><span>Résztvevők száma</span><select id="tournament-count">${counts.map(value => `<option value="${value}" ${value === setup.count ? 'selected' : ''}>${value} csapat</option>`).join('')}</select></label><label><span>Nehézség</span><select id="tournament-difficulty"><option value="easy">Könnyű</option><option value="medium" ${setup.difficulty === 'medium' ? 'selected' : ''}>Normál</option><option value="hard">Nehéz</option></select></label></section>
      <section class="tournament-section"><h2>4. Saját csapat</h2>${selected ? `<div class="tournament-selected-team is-human">${teamMark(selected)}<div><strong>${escapeHtml(selected.label)}</strong><small>${selected.count} kártya</small></div></div>` : '<p class="tournament-warning">Nincs legalább 11 kártyával rendelkező használható csapat.</p>'}<select id="tournament-human-team">${pool.map(team => `<option value="${escapeHtml(team.id)}" ${team.id === setup.humanTeamId ? 'selected' : ''}>${escapeHtml(team.label)} (${team.count})</option>`).join('')}</select></section>
      <section class="tournament-section"><h2>Résztvevők</h2><div class="tournament-participant-grid">${preview.map(team => `<div class="tournament-participant ${team.id === setup.humanTeamId ? 'is-human' : ''}">${teamMark(team, true)}<span>${escapeHtml(team.label)}</span></div>`).join('')}</div></section>
      <div class="tournament-actions"><button class="btn btn--ghost" id="tournament-back">Vissza</button><button class="btn" id="tournament-start" ${canStart ? '' : 'disabled'}>Torna indítása</button></div>
      <dialog class="tournament-help-dialog"><h2>Hogyan működik?</h2><p>A gép–gép meccsek a paklierősség, a kategórialefedettség és a kulcskártyák alapján futnak le. Saját meccs előtt 11 lapos aktív keretet állíthatsz össze.</p><button class="btn">Értem</button></dialog>`;
    node.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => preset(button.dataset.preset)));
    node.querySelectorAll('input[name=tournament-category]').forEach(input => input.addEventListener('change', () => { setup.category = input.value; setup.count = 0; setup.humanTeamId = ''; render(); }));
    node.querySelectorAll('input[name=tournament-format]').forEach(input => input.addEventListener('change', () => { setup.format = input.value; setup.count = 0; render(); }));
    node.querySelectorAll('input[name=tournament-match-mode]').forEach(input => input.addEventListener('change', () => { setup.matchMode = input.value; render(); }));
    node.querySelector('#tournament-count')?.addEventListener('change', event => { setup.count = Number(event.target.value) || 0; render(); });
    node.querySelector('#tournament-difficulty')?.addEventListener('change', event => { setup.difficulty = event.target.value; });
    node.querySelector('#tournament-human-team')?.addEventListener('change', event => { setup.humanTeamId = event.target.value; render(); });
    node.querySelector('#tournament-back')?.addEventListener('click', () => restorePanel(returnPanel), { once: true });
    const dialog = node.querySelector('dialog'); node.querySelector('.tournament-help')?.addEventListener('click', () => dialog?.showModal()); node.querySelector('[data-help=format]')?.addEventListener('click', () => dialog?.showModal()); dialog?.querySelector('button')?.addEventListener('click', () => dialog.close());
    node.querySelector('#tournament-start')?.addEventListener('click', () => {
      try {
        let state = createTournament({ name: tournamentName(setup.category, setup.format, setup.count), category: setup.category, format: setup.format, matchMode: setup.matchMode, participants: chooseParticipants(pool, setup.count, setup.humanTeamId, setup.category), humanTeamId: setup.humanTeamId, difficulty: setup.difficulty });
        state = migrateEnhancedTournament(state); tournamentStorageService.save(state); showCenter?.(state, returnPanel);
      } catch (error) { console.error('[tournament-v3] A torna nem hozható létre:', error); alert(error.message || 'A torna nem indítható el.'); }
    }, { once: true });
  };
  render(); showPanel(node);
}
