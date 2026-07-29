/** Torna mód: beállítás, 12 csapatos Magyar Kupa, keretválasztás, mentés és szimuláció. */

import {
  QUICK_MATCH_CATEGORY,
  TOURNAMENT_LINEUP_STORAGE_KEY,
  buildQuickMatchCatalog,
  quickMatchEntriesForCategory,
  resolveQuickMatchSelection,
  stageQuickMatch,
} from './deck-selection.js';
import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  advanceTournament,
  createTournament,
  isHungarianCup12,
  recordTournamentMatch,
  recordTournamentTiebreak,
  simulatePendingAiMatches,
  tournamentMatchById,
  tournamentMatches,
  tournamentNextHumanMatch,
  tournamentProgress,
  tournamentShuffle,
  tournamentStandings,
  tournamentTeamById,
} from './tournament/tournament-domain.js';
import { tournamentStorageService } from './services/tournament-storage-service.js';

const runtime = { observer: null, resultPanels: new WeakSet(), lastMenuPanel: null };
const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU').replace(/[^a-z0-9]+/g, ' ').trim();
const players = () => {
  const payload = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ ?? globalThis.__EMBEDDED_PLAYER_DATA__;
  return Array.isArray(payload?.players) ? payload.players : [];
};
const catalog = () => buildQuickMatchCatalog(players());
const poolFor = category => {
  const value = catalog();
  if (category === TOURNAMENT_CATEGORY.NATIONS) {
    return [
      ...quickMatchEntriesForCategory(value, QUICK_MATCH_CATEGORY.NATIONAL),
      ...quickMatchEntriesForCategory(value, QUICK_MATCH_CATEGORY.FEDERATION),
    ].filter(entry => entry.usable);
  }
  return quickMatchEntriesForCategory(value, QUICK_MATCH_CATEGORY.HUNGARIAN).filter(entry => entry.usable);
};
const playerStrength = player => {
  const stats = player?.stats ?? {};
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  return Math.log1p(number(stats.marketValue)) * 1.25 + Math.log1p(number(stats.minutes)) * 1.1
    + Math.log1p(number(stats.appearances)) * 1.4 + Math.log1p(number(stats.starts))
    + Math.log1p(number(stats.goals)) * 1.7 + Math.log1p(number(stats.assists)) * 1.5;
};
const initials = label => String(label ?? '').split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join('').toUpperCase();
const hue = label => [...String(label ?? '')].reduce((sum, char) => (sum + char.charCodeAt(0) * 7) % 360, 28);
const teamMark = team => {
  if (team?.badge) return `<img class="tournament-team-mark__image" src="${escapeHtml(team.badge)}" alt="" loading="lazy">`;
  if (team?.kind === 'nation' && team?.icon) return `<span class="tournament-team-mark__fallback" aria-hidden="true">${escapeHtml(team.icon)}</span>`;
  return `<span class="tournament-team-mark__generated" aria-hidden="true" style="display:grid;place-items:center;width:54px;height:62px;clip-path:polygon(50% 0,94% 18%,88% 75%,50% 100%,12% 75%,6% 18%);background:hsl(${hue(team?.label)} 58% 35%);border:2px solid rgba(255,255,255,.7);font-weight:900;color:white;text-shadow:0 1px 3px #000">${escapeHtml(initials(team?.label) || 'FK')}</span>`;
};
const panel = className => {
  const node = document.createElement('div');
  node.className = `tournament-panel mobile-sheet ${className ?? ''}`.trim();
  node.tabIndex = -1;
  return node;
};
const showPanel = node => {
  const overlay = document.querySelector('#overlay');
  const body = document.querySelector('#overlay-body');
  if (!overlay || !body) return false;
  body.replaceChildren(node);
  overlay.hidden = false;
  requestAnimationFrame(() => node.querySelector('button, select, input')?.focus?.({ preventScroll: true }));
  return true;
};
const restorePanel = node => node ? showPanel(node) : navigateHome();
const navigateHome = () => {
  try {
    const target = new URL('./index.html', globalThis.location.href).href;
    globalThis.location.assign(target);
  } catch {
    globalThis.location.reload();
  }
};
const formatLabel = format => ({
  [TOURNAMENT_FORMAT.GROUP_KNOCKOUT]: 'Csoportkör + kieséses',
  [TOURNAMENT_FORMAT.KNOCKOUT]: 'Csak kieséses',
  [TOURNAMENT_FORMAT.LEAGUE]: 'Liga',
}[format] ?? format);
const matchModeLabel = mode => mode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'Büntetőpárbaj' : 'Klasszikus';
const phaseLabel = state => state.status === TOURNAMENT_STATUS.COMPLETE ? 'Befejezett torna'
  : state.phase === 'group' ? 'Csoportkör' : state.phase === 'knockout' ? 'Kieséses szakasz' : 'Liga';
const tournamentName = (category, format, count) => {
  if (category === TOURNAMENT_CATEGORY.HUNGARIAN && format === TOURNAMENT_FORMAT.KNOCKOUT && count === 12) return 'Magyar Kupa';
  if (category === TOURNAMENT_CATEGORY.HUNGARIAN && format === TOURNAMENT_FORMAT.LEAGUE) return 'Magyar bajnokság';
  if (category === TOURNAMENT_CATEGORY.HUNGARIAN) return 'Magyar klubkupa';
  if (format === TOURNAMENT_FORMAT.LEAGUE) return 'Nemzetek ligája';
  if (format === TOURNAMENT_FORMAT.KNOCKOUT) return 'Nemzetek kupája';
  return 'Nemzetek tornája';
};
const supportedCounts = (category, format, available) => {
  const presets = format === TOURNAMENT_FORMAT.KNOCKOUT
    ? (category === TOURNAMENT_CATEGORY.HUNGARIAN ? [4, 8, 12, 16, 32] : [4, 8, 16, 32])
    : format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT ? [4, 8, 12, 16, 24, 32] : [4, 6, 8, 10, 12, 16];
  return presets.filter(value => value <= available);
};
const chooseParticipants = (pool, count, humanId, category) => {
  const human = pool.find(team => team.id === humanId);
  if (!human) return [];
  const chosen = [human];
  const used = new Set([human.id]);
  if (category === TOURNAMENT_CATEGORY.NATIONS) {
    for (const keyword of ['magyar', 'ukran', 'szerb', 'nigeria', 'del amerika']) {
      const match = pool.find(team => !used.has(team.id) && fold(`${team.label} ${team.id}`).includes(keyword));
      if (match) { chosen.push(match); used.add(match.id); }
    }
  }
  for (const team of tournamentShuffle(pool.filter(item => !used.has(item.id)))) {
    if (chosen.length >= count) break;
    chosen.push(team);
    used.add(team.id);
  }
  return chosen.slice(0, count);
};

function showTournamentSetup(returnPanel = runtime.lastMenuPanel) {
  const setup = {
    category: TOURNAMENT_CATEGORY.HUNGARIAN,
    format: TOURNAMENT_FORMAT.LEAGUE,
    matchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
    count: 0,
    humanTeamId: '',
    difficulty: 'medium',
  };
  const node = panel('tournament-setup');
  const preset = name => {
    if (name === 'hungarian-league') Object.assign(setup, { category: TOURNAMENT_CATEGORY.HUNGARIAN, format: TOURNAMENT_FORMAT.LEAGUE, count: 12 });
    if (name === 'hungarian-cup') Object.assign(setup, { category: TOURNAMENT_CATEGORY.HUNGARIAN, format: TOURNAMENT_FORMAT.KNOCKOUT, count: 12 });
    if (name === 'nations') Object.assign(setup, { category: TOURNAMENT_CATEGORY.NATIONS, format: TOURNAMENT_FORMAT.GROUP_KNOCKOUT, count: 8 });
    if (name === 'quick-cup') Object.assign(setup, { category: TOURNAMENT_CATEGORY.NATIONS, format: TOURNAMENT_FORMAT.KNOCKOUT, count: 8 });
    setup.humanTeamId = '';
    render();
  };
  const render = () => {
    const pool = poolFor(setup.category);
    const counts = supportedCounts(setup.category, setup.format, pool.length);
    if (!counts.includes(setup.count)) setup.count = counts.includes(12) && setup.category === TOURNAMENT_CATEGORY.HUNGARIAN ? 12 : counts.at(-1) ?? 0;
    if (!pool.some(team => team.id === setup.humanTeamId)) setup.humanTeamId = pool[0]?.id ?? '';
    const selected = pool.find(team => team.id === setup.humanTeamId) ?? null;
    const preview = chooseParticipants(pool, setup.count, setup.humanTeamId, setup.category);
    const canStart = setup.count >= 4 && preview.length === setup.count && selected;
    node.innerHTML = `
      <div class="tournament-heading"><div><p class="eyebrow">Új játékmód</p><h1>🏆 Torna mód</h1></div><button class="tournament-help" type="button" aria-label="Torna mód súgó">?</button></div>
      <div class="tournament-presets" aria-label="Gyors tornák">
        <button class="tournament-preset" data-preset="hungarian-league"><b>Magyar bajnokság</b><small>12 klub · liga</small></button>
        <button class="tournament-preset" data-preset="hungarian-cup"><b>Magyar Kupa</b><small>12 klub · 8 csapat az 1. körben</small></button>
        <button class="tournament-preset" data-preset="nations"><b>Nemzetek tornája</b><small>Csoport + kieséses</small></button>
        <button class="tournament-preset" data-preset="quick-cup"><b>Villámkupa</b><small>8 csapat · kieséses</small></button>
      </div>
      <section class="tournament-section"><h2>1. Résztvevők</h2><div class="tournament-segmented">
        <label><input type="radio" name="tournament-category" value="${TOURNAMENT_CATEGORY.HUNGARIAN}" ${setup.category === TOURNAMENT_CATEGORY.HUNGARIAN ? 'checked' : ''}><span>🇭🇺 Magyar klubok</span></label>
        <label><input type="radio" name="tournament-category" value="${TOURNAMENT_CATEGORY.NATIONS}" ${setup.category === TOURNAMENT_CATEGORY.NATIONS ? 'checked' : ''}><span>🌍 Nemzetek és régiók</span></label>
      </div></section>
      <section class="tournament-section"><h2>2. Tornaforma</h2><div class="tournament-format-grid">
        <label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.GROUP_KNOCKOUT}" ${setup.format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT ? 'checked' : ''}><span><b>Csoportkör + kieséses</b><small>Tabella, majd kupaág</small></span></label>
        <label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.KNOCKOUT}" ${setup.format === TOURNAMENT_FORMAT.KNOCKOUT ? 'checked' : ''}><span><b>Csak kieséses</b><small>A Magyar Kupa 12 csapatos</small></span></label>
        <label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.LEAGUE}" ${setup.format === TOURNAMENT_FORMAT.LEAGUE ? 'checked' : ''}><span><b>Liga</b><small>Mindenki játszik mindenkivel</small></span></label>
      </div></section>
      <section class="tournament-section"><h2>3. Mérkőzésformátum</h2><div class="tournament-segmented">
        <label><input type="radio" name="tournament-match-mode" value="${TOURNAMENT_MATCH_MODE.CLASSIC}" ${setup.matchMode === TOURNAMENT_MATCH_MODE.CLASSIC ? 'checked' : ''}><span>🃏 Klasszikus</span></label>
        <label><input type="radio" name="tournament-match-mode" value="${TOURNAMENT_MATCH_MODE.PENALTIES}" ${setup.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'checked' : ''}><span>⚽ Büntetőpárbaj</span></label>
      </div></section>
      <section class="tournament-section tournament-options-grid">
        <label><span>Résztvevők száma</span><select id="tournament-count">${counts.map(value => `<option value="${value}" ${value === setup.count ? 'selected' : ''}>${value} csapat</option>`).join('')}</select></label>
        <label><span>Nehézség</span><select id="tournament-difficulty"><option value="easy">Könnyű</option><option value="medium" ${setup.difficulty === 'medium' ? 'selected' : ''}>Normál</option><option value="hard">Nehéz</option></select></label>
      </section>
      <section class="tournament-section"><h2>4. Saját csapat</h2>${selected ? `<div class="tournament-selected-team">${teamMark(selected)}<div><strong>${escapeHtml(selected.label)}</strong><small>${selected.count} kártya</small></div></div>` : '<p class="tournament-warning">Nincs használható csapat.</p>'}<select id="tournament-human-team">${pool.map(team => `<option value="${escapeHtml(team.id)}" ${team.id === setup.humanTeamId ? 'selected' : ''}>${escapeHtml(team.label)} (${team.count})</option>`).join('')}</select></section>
      ${setup.category === TOURNAMENT_CATEGORY.HUNGARIAN && setup.format === TOURNAMENT_FORMAT.KNOCKOUT && setup.count === 12 ? '<section class="tournament-section"><h2>Magyar Kupa lebonyolítása</h2><p><b>1. kör:</b> 8 csapat, 4 továbbjutó és 4 erőnyerő. <b>Negyeddöntő:</b> 8 csapat. <b>Elődöntő:</b> 4 csapat. <b>Döntő:</b> 2 csapat.</p></section>' : ''}
      <section class="tournament-section"><h2>Várható mezőny</h2><div class="tournament-team-chips">${preview.map(team => `<span class="tournament-team-chip ${team.id === setup.humanTeamId ? 'is-human' : ''}">${escapeHtml(team.icon || '⚽')} ${escapeHtml(team.label)}</span>`).join('')}</div></section>
      <div class="tournament-actions"><button class="btn btn--ghost" id="tournament-back">Vissza</button><button class="btn" id="tournament-start" ${canStart ? '' : 'disabled'}>Torna indítása</button></div>
      <dialog class="tournament-help-dialog"><h2>Hogyan működik?</h2><p>A gépi találkozók automatikusan leszimulálódnak. Saját meccs előtt 11 játékoskártyából álló keretet választhatsz. A torna automatikusan mentődik, és külön Mentés gombbal is rögzíthető.</p><button class="btn">Értem</button></dialog>`;
    node.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => preset(button.dataset.preset)));
    node.querySelectorAll('input[name=tournament-category]').forEach(input => input.addEventListener('change', () => { setup.category = input.value; setup.count = 0; setup.humanTeamId = ''; render(); }));
    node.querySelectorAll('input[name=tournament-format]').forEach(input => input.addEventListener('change', () => { setup.format = input.value; setup.count = 0; render(); }));
    node.querySelectorAll('input[name=tournament-match-mode]').forEach(input => input.addEventListener('change', () => { setup.matchMode = input.value; }));
    node.querySelector('#tournament-count')?.addEventListener('change', event => { setup.count = Number(event.target.value) || 0; render(); });
    node.querySelector('#tournament-difficulty')?.addEventListener('change', event => { setup.difficulty = event.target.value; });
    node.querySelector('#tournament-human-team')?.addEventListener('change', event => { setup.humanTeamId = event.target.value; render(); });
    node.querySelector('#tournament-back')?.addEventListener('click', () => restorePanel(returnPanel), { once: true });
    const dialog = node.querySelector('dialog');
    node.querySelector('.tournament-help')?.addEventListener('click', () => dialog?.showModal());
    dialog?.querySelector('button')?.addEventListener('click', () => dialog.close());
    node.querySelector('#tournament-start')?.addEventListener('click', () => {
      try {
        const state = createTournament({
          name: tournamentName(setup.category, setup.format, setup.count),
          category: setup.category,
          format: setup.format,
          matchMode: setup.matchMode,
          participants: chooseParticipants(pool, setup.count, setup.humanTeamId, setup.category),
          humanTeamId: setup.humanTeamId,
          difficulty: setup.difficulty,
        });
        tournamentStorageService.save(state);
        showTournamentCenter(state, returnPanel);
      } catch (error) {
        console.error('[tournament] A torna nem hozható létre:', error);
        alert(error.message || 'A torna nem indítható el.');
      }
    }, { once: true });
  };
  render();
  showPanel(node);
}

const strengthResolver = state => {
  const allPlayers = players();
  const cache = new Map();
  return teamId => {
    if (cache.has(teamId)) return cache.get(teamId);
    const team = tournamentTeamById(state, teamId);
    const cards = team ? resolveQuickMatchSelection(allPlayers, team.selection) : [];
    const best = cards.map(playerStrength).sort((a, b) => b - a).slice(0, 11);
    const value = best.length ? best.reduce((sum, score) => sum + score, 0) / best.length + Math.log1p(cards.length) : 1;
    cache.set(teamId, value);
    return value;
  };
};
const simulateAndSave = state => {
  let next = simulatePendingAiMatches(advanceTournament(state), strengthResolver(state));
  next = advanceTournament(next);
  tournamentStorageService.save(next);
  if (next.status === TOURNAMENT_STATUS.COMPLETE) tournamentStorageService.archive(next);
  return next;
};
const standingsTable = (state, groupId = null) => `<div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>#</th><th>Csapat</th><th>M</th><th>GY</th><th>D</th><th>V</th><th>+/−</th><th>P</th></tr></thead><tbody>${tournamentStandings(state, groupId).map(row => {
  const team = tournamentTeamById(state, row.teamId);
  return `<tr class="${row.teamId === state.humanTeamId ? 'is-human' : ''}"><td>${row.position}</td><td><span style="display:inline-flex;align-items:center;gap:6px">${teamMark(team)}<b>${escapeHtml(team?.label || row.teamId)}</b></span></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.difference > 0 ? '+' : ''}${row.difference}</td><td><b>${row.points}</b></td></tr>`;
}).join('')}</tbody></table></div>`;
const tables = state => state.format === TOURNAMENT_FORMAT.LEAGUE ? standingsTable(state)
  : state.groups?.length ? `<div class="tournament-groups">${state.groups.map(group => `<section><h3>${escapeHtml(group.label)}</h3>${standingsTable(state, group.id)}</section>`).join('')}</div>` : '';
const bracket = state => {
  const rounds = state.rounds?.filter(round => round.stage === 'knockout') ?? [];
  if (!rounds.length) return '';
  const byes = isHungarianCup12(state) && state.hungarianCupByeTeamIds?.length
    ? `<section class="tournament-bracket__round"><h3>Erőnyerők</h3>${state.hungarianCupByeTeamIds.map(id => `<div class="tournament-bracket__match"><span class="is-winner">${escapeHtml(tournamentTeamById(state, id)?.label || id)}</span><b>→</b><span>Negyeddöntő</span></div>`).join('')}</section>` : '';
  return `<div class="tournament-bracket" aria-label="Kieséses tornaág">${byes}${rounds.map(round => `<section class="tournament-bracket__round"><h3>${escapeHtml(round.label)}</h3>${round.matches.map(match => {
    const home = tournamentTeamById(state, match.homeId);
    const away = tournamentTeamById(state, match.awayId);
    const score = match.status === TOURNAMENT_MATCH_STATUS.COMPLETE ? `${match.homeScore}–${match.awayScore}${String(match.decidedBy).includes('penalties') ? ' (b.)' : ''}` : match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK ? 'Büntetők' : '–';
    return `<div class="tournament-bracket__match ${[match.homeId, match.awayId].includes(state.humanTeamId) ? 'is-human' : ''}"><span class="${match.winnerId === match.homeId ? 'is-winner' : ''}">${escapeHtml(home?.label || match.homeId)}</span><b>${score}</b><span class="${match.winnerId === match.awayId ? 'is-winner' : ''}">${escapeHtml(away?.label || match.awayId)}</span></div>`;
  }).join('')}</section>`).join('')}</div>`;
};
const recentResults = state => {
  const matches = tournamentMatches(state).filter(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE).slice(-10).reverse();
  if (!matches.length) return '<p class="tournament-empty">Még nincs lejátszott mérkőzés.</p>';
  return `<div class="tournament-results-list">${matches.map(match => {
    const home = tournamentTeamById(state, match.homeId);
    const away = tournamentTeamById(state, match.awayId);
    return `<div class="tournament-result-row"><span>${teamMark(home)} ${escapeHtml(home?.label || match.homeId)}</span><b>${match.homeScore}–${match.awayScore}${String(match.decidedBy).includes('penalties') ? ' (b.)' : ''}</b><span>${teamMark(away)} ${escapeHtml(away?.label || match.awayId)}</span></div>`;
  }).join('')}</div>`;
};
const playerStatsView = state => {
  const stats = Object.values(state.playerStats ?? {}).sort((a, b) => b.appearances - a.appearances || b.wins - a.wins);
  if (!stats.length) return '<p class="tournament-empty">Az első saját mérkőzés után jelennek meg a játékosstatisztikák.</p>';
  return `<div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>Játékos</th><th>M</th><th>GY</th><th>D</th><th>V</th><th>Büntető</th></tr></thead><tbody>${stats.map(item => `<tr><td><b>${escapeHtml(item.name)}</b></td><td>${item.appearances}</td><td>${item.wins}</td><td>${item.draws}</td><td>${item.losses}</td><td>${item.penaltyMatches}</td></tr>`).join('')}</tbody></table></div>`;
};

function showLineupSelection(state, match, returnPanel) {
  const humanTeam = tournamentTeamById(state, state.humanTeamId);
  const opponentId = match.homeId === state.humanTeamId ? match.awayId : match.homeId;
  const opponent = tournamentTeamById(state, opponentId);
  const cards = resolveQuickMatchSelection(players(), humanTeam.selection).sort((a, b) => playerStrength(b) - playerStrength(a));
  const required = Math.min(11, cards.length);
  const reusable = (state.lastLineupIds ?? []).filter(id => cards.some(card => String(card.id) === String(id)));
  const selected = new Set((reusable.length === required ? reusable : cards.slice(0, required).map(card => card.id)).map(String));
  const node = panel('tournament-lineup');
  const render = () => {
    node.innerHTML = `<p class="eyebrow">Meccs előtti összeállítás</p><h1>Válassz ${required} játékoskártyát</h1>
      <div class="tournament-versus"><div>${teamMark(humanTeam)}<strong>${escapeHtml(humanTeam.label)}</strong></div><b>VS</b><div>${teamMark(opponent)}<strong>${escapeHtml(opponent.label)}</strong></div></div>
      <p><b>${selected.size}/${required}</b> kiválasztva · ${escapeHtml(matchModeLabel(match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK ? TOURNAMENT_MATCH_MODE.PENALTIES : state.matchMode))}</p>
      <div class="tournament-lineup-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;max-height:52vh;overflow:auto">${cards.map(card => `<label style="display:flex;gap:8px;align-items:center;padding:9px;border:1px solid rgba(255,255,255,.2);border-radius:10px"><input type="checkbox" data-player-id="${escapeHtml(card.id)}" ${selected.has(String(card.id)) ? 'checked' : ''}><span><b>${escapeHtml(card.name)}</b><small style="display:block">${escapeHtml(card.position || card.meta?.position || '')}</small></span></label>`).join('')}</div>
      <div class="tournament-actions"><button class="btn btn--ghost" id="lineup-auto">Legjobb 11</button><button class="btn btn--ghost" id="lineup-back">Vissza</button><button class="btn" id="lineup-start" ${selected.size === required ? '' : 'disabled'}>Meccs indítása</button></div>`;
    node.querySelectorAll('[data-player-id]').forEach(input => input.addEventListener('change', () => {
      const id = String(input.dataset.playerId);
      if (input.checked && selected.size >= required) { input.checked = false; return; }
      if (input.checked) selected.add(id); else selected.delete(id);
      render();
    }));
    node.querySelector('#lineup-auto')?.addEventListener('click', () => { selected.clear(); cards.slice(0, required).forEach(card => selected.add(String(card.id))); render(); });
    node.querySelector('#lineup-back')?.addEventListener('click', () => showTournamentCenter(state, returnPanel), { once: true });
    node.querySelector('#lineup-start')?.addEventListener('click', () => launchTournamentMatch(state, match, [...selected]), { once: true });
  };
  render();
  showPanel(node);
}

function launchTournamentMatch(state, match, lineupIds) {
  const humanTeam = tournamentTeamById(state, state.humanTeamId);
  const opponentId = match.homeId === state.humanTeamId ? match.awayId : match.homeId;
  const opponent = tournamentTeamById(state, opponentId);
  if (!humanTeam || !opponent || !Array.isArray(lineupIds) || lineupIds.length < 4) return;
  const mode = match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK ? TOURNAMENT_MATCH_MODE.PENALTIES : state.matchMode;
  const next = { ...state, currentMatchId: match.id, currentMatchMode: mode, currentLineupIds: lineupIds, lastLineupIds: lineupIds, updatedAt: new Date().toISOString() };
  tournamentStorageService.save(next);
  try {
    localStorage.setItem(TOURNAMENT_LINEUP_STORAGE_KEY, JSON.stringify({ tournamentId: state.id, matchId: match.id, humanIds: lineupIds }));
  } catch { /* A mentés hiánya nem blokkolhatja a játékot. */ }
  const staged = stageQuickMatch({
    playerTeamId: humanTeam.id,
    opponentTeamId: opponent.id,
    playerSelection: humanTeam.selection,
    opponentSelection: opponent.selection,
    mode,
    difficulty: state.difficulty,
    createdAt: new Date().toISOString(),
  });
  if (!staged) { alert('A tornamérkőzés csapatai nem tölthetők be.'); return; }
  globalThis.location.reload();
}

function showTournamentComplete(state, returnPanel = null) {
  const node = panel('tournament-complete');
  const champion = tournamentTeamById(state, state.championId);
  const human = tournamentTeamById(state, state.humanTeamId);
  const won = state.championId === state.humanTeamId;
  const standing = state.format === TOURNAMENT_FORMAT.LEAGUE ? tournamentStandings(state).find(row => row.teamId === state.humanTeamId)?.position : null;
  node.innerHTML = `<p class="eyebrow">${escapeHtml(state.name)} · ${escapeHtml(matchModeLabel(state.matchMode))}</p><div class="tournament-trophy">${won ? '🏆' : '🏁'}</div><h1>${won ? 'TORNAGYŐZELEM!' : 'A torna véget ért'}</h1><div class="tournament-champion">${teamMark(champion)}<div><small>Bajnok</small><strong>${escapeHtml(champion?.label || 'Ismeretlen')}</strong></div></div><p>${won ? `${escapeHtml(human?.label)} megszerezte a trófeát.` : standing ? `${escapeHtml(human?.label)} a(z) ${standing}. helyen zárt.` : `${escapeHtml(human?.label)} számára véget ért a sorozat.`}</p>${tables(state)}${bracket(state)}<h2>Játékosstatisztikák</h2>${playerStatsView(state)}<div class="tournament-actions"><button class="btn" id="tournament-new">Új torna</button><button class="btn btn--ghost" id="tournament-home">Főmenü</button></div>`;
  node.querySelector('#tournament-new')?.addEventListener('click', () => showTournamentSetup(returnPanel), { once: true });
  node.querySelector('#tournament-home')?.addEventListener('click', () => restorePanel(returnPanel), { once: true });
  showPanel(node);
}

function showTournamentCenter(inputState = tournamentStorageService.read(), returnPanel = runtime.lastMenuPanel) {
  if (!inputState) { showTournamentSetup(returnPanel); return; }
  const state = simulateAndSave(inputState);
  if (state.status === TOURNAMENT_STATUS.COMPLETE) { showTournamentComplete(state, returnPanel); return; }
  const nextMatch = tournamentNextHumanMatch(state);
  const human = tournamentTeamById(state, state.humanTeamId);
  const opponentId = nextMatch ? (nextMatch.homeId === state.humanTeamId ? nextMatch.awayId : nextMatch.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId);
  const progress = tournamentProgress(state);
  const round = nextMatch ? state.rounds.find(item => item.matches?.some(match => match.id === nextMatch.id)) : null;
  const node = panel('tournament-center');
  node.innerHTML = `<div class="tournament-heading"><div><p class="eyebrow">${escapeHtml(formatLabel(state.format))} · ${escapeHtml(matchModeLabel(state.matchMode))}</p><h1>${escapeHtml(state.name)}</h1></div><span class="tournament-phase">${escapeHtml(phaseLabel(state))}</span></div><div class="tournament-progress"><span style="width:${progress.percent}%"></span></div><p class="tournament-progress-label">${progress.completed} mérkőzés lejátszva · ${progress.percent}%</p>
    ${nextMatch ? `<section class="tournament-next-match"><p>${escapeHtml(round?.label || 'Következő mérkőzés')}</p><div class="tournament-versus"><div>${teamMark(human)}<strong>${escapeHtml(human?.label)}</strong></div><b>VS</b><div>${teamMark(opponent)}<strong>${escapeHtml(opponent?.label)}</strong></div></div><button class="btn tournament-play" id="tournament-play">▶ Keret összeállítása</button></section>` : '<p class="tournament-warning">Nincs lejátszható saját mérkőzés.</p>'}
    <nav class="tournament-tabs"><button class="is-active" data-tab="overview">Áttekintés</button><button data-tab="results">Eredmények</button>${state.groups?.length || state.format === TOURNAMENT_FORMAT.LEAGUE ? '<button data-tab="table">Tabella</button>' : ''}${state.rounds.some(item => item.stage === 'knockout') ? '<button data-tab="bracket">Tornaág</button>' : ''}<button data-tab="players">Játékos statisztikák</button></nav>
    <div class="tournament-tab-content" data-content="overview"><h2>Saját csapat</h2><div class="tournament-selected-team">${teamMark(human)}<div><strong>${escapeHtml(human?.label)}</strong><small>${escapeHtml(phaseLabel(state))}</small></div></div><h2>Leszimulált és lejátszott mérkőzések</h2>${recentResults(state)}</div>
    <div class="tournament-tab-content" data-content="results" hidden>${recentResults(state)}</div><div class="tournament-tab-content" data-content="table" hidden>${tables(state)}</div><div class="tournament-tab-content" data-content="bracket" hidden>${bracket(state)}</div><div class="tournament-tab-content" data-content="players" hidden>${playerStatsView(state)}</div>
    <div class="tournament-actions tournament-actions--secondary"><button class="btn" id="tournament-save">💾 Játék mentése</button><button class="btn btn--ghost" id="tournament-center-home">Főmenü</button><button class="btn btn--danger" id="tournament-abandon">Torna feladása</button></div>`;
  node.querySelector('#tournament-play')?.addEventListener('click', () => showLineupSelection(state, nextMatch, returnPanel), { once: true });
  node.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    node.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('is-active', item === button));
    node.querySelectorAll('[data-content]').forEach(content => { content.hidden = content.dataset.content !== button.dataset.tab; });
  }));
  node.querySelector('#tournament-save')?.addEventListener('click', () => {
    const saved = tournamentStorageService.save(state);
    const button = node.querySelector('#tournament-save');
    if (button) button.textContent = saved ? '✓ Játék elmentve' : 'Mentési hiba';
  });
  node.querySelector('#tournament-center-home')?.addEventListener('click', () => restorePanel(returnPanel), { once: true });
  node.querySelector('#tournament-abandon')?.addEventListener('click', () => { if (confirm('Biztosan feladod a tornát?')) { tournamentStorageService.clear(); navigateHome(); } });
  showPanel(node);
}

const parseResult = node => {
  const score = node.querySelector('.final-score')?.textContent?.match(/JÁTÉKOS\s+(\d+)\s*[–-]\s*(\d+)\s+GÉP/i);
  if (!score) return null;
  const heading = fold(node.querySelector('h1')?.textContent);
  return { humanScore: Number(score[1]), aiScore: Number(score[2]), humanWon: heading.includes('gyozelem'), humanLost: heading.includes('vereseg'), tie: heading.includes('dontetlen') };
};
const updatePlayerStats = (state, result) => {
  const next = { ...state, playerStats: { ...(state.playerStats ?? {}) } };
  const byId = new Map(players().map(player => [String(player.id), player]));
  for (const id of state.currentLineupIds ?? []) {
    const player = byId.get(String(id));
    const previous = next.playerStats[id] ?? { playerId: id, name: player?.name || String(id), appearances: 0, wins: 0, draws: 0, losses: 0, penaltyMatches: 0 };
    next.playerStats[id] = {
      ...previous,
      appearances: previous.appearances + 1,
      wins: previous.wins + (result.humanWon ? 1 : 0),
      draws: previous.draws + (result.tie ? 1 : 0),
      losses: previous.losses + (result.humanLost ? 1 : 0),
      penaltyMatches: previous.penaltyMatches + (state.currentMatchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 1 : 0),
    };
  }
  return next;
};
const handleResultPanel = node => {
  if (!node || runtime.resultPanels.has(node)) return;
  const stored = tournamentStorageService.read();
  if (!stored?.currentMatchId) return;
  const current = tournamentMatchById(stored, stored.currentMatchId);
  const result = parseResult(node);
  if (!current || !result) return;
  runtime.resultPanels.add(node);
  const originalHome = node.querySelector('#menu-btn');
  const humanHome = current.homeId === stored.humanTeamId;
  const homeScore = humanHome ? result.humanScore : result.aiScore;
  const awayScore = humanHome ? result.aiScore : result.humanScore;
  const opponentId = humanHome ? current.awayId : current.homeId;
  const winnerId = result.humanWon ? stored.humanTeamId : result.humanLost ? opponentId : null;
  let next;
  try {
    if (current.status === TOURNAMENT_MATCH_STATUS.TIEBREAK) {
      if (!winnerId) throw new Error('A büntetőpárbaj nem zárult győztessel.');
      next = recordTournamentTiebreak(stored, current.id, { homeScore, awayScore, winnerId });
    } else {
      next = recordTournamentMatch(stored, current.id, { homeScore, awayScore, winnerId, decidedBy: stored.currentMatchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'played-penalties' : 'played' });
    }
    next = updatePlayerStats(next, result);
    next.currentMatchId = null;
    next.currentMatchMode = null;
    next.currentLineupIds = [];
    next = simulateAndSave(next);
  } catch (error) {
    console.error('[tournament] A mérkőzés eredménye nem menthető:', error);
    return;
  }
  const actions = node.querySelector('.result-actions');
  if (actions) {
    actions.replaceChildren();
    const continueButton = document.createElement('button');
    continueButton.className = 'btn';
    continueButton.textContent = next.status === TOURNAMENT_STATUS.COMPLETE ? '🏆 Torna végeredménye' : '🏆 Torna folytatása';
    continueButton.addEventListener('click', () => showTournamentCenter(next, null), { once: true });
    const homeButton = document.createElement('button');
    homeButton.className = 'btn btn--ghost';
    homeButton.textContent = 'Főmenü';
    homeButton.addEventListener('click', () => {
      if (originalHome) originalHome.click();
      else navigateHome();
    }, { once: true });
    actions.append(continueButton, homeButton);
  }
  const context = document.createElement('p');
  context.className = 'tournament-result-context';
  context.textContent = `${next.name} · ${phaseLabel(next)} · eredmény elmentve`;
  node.prepend(context);
};
const enhanceMenu = node => {
  if (!node || node.dataset.tournamentEnhanced === 'true') return;
  node.dataset.tournamentEnhanced = 'true';
  runtime.lastMenuPanel = node;
  const primary = node.querySelector('.primary-mode-actions');
  if (!primary) return;
  const button = document.createElement('button');
  button.className = 'btn mode-start tournament-menu-button';
  button.id = 'tournament-mode-btn';
  button.innerHTML = '<span>🏆 Torna mód</span><small>Magyar Kupa, liga vagy csoportkör</small>';
  button.addEventListener('click', () => showTournamentSetup(node), { once: true });
  primary.appendChild(button);
  const stored = tournamentStorageService.read();
  if (stored) {
    const resume = document.createElement('button');
    resume.className = 'btn btn--continue tournament-continue-button';
    resume.innerHTML = `<span>${stored.status === TOURNAMENT_STATUS.COMPLETE ? '🏆 Torna eredménye' : '▶ Torna folytatása'}</span><small>${escapeHtml(stored.name)} · ${escapeHtml(phaseLabel(stored))}</small>`;
    resume.addEventListener('click', () => showTournamentCenter(stored, node), { once: true });
    node.querySelector('.menu-section-title')?.before(resume);
  }
};
const refresh = () => { enhanceMenu(document.querySelector('.menu-panel.mobile-home')); handleResultPanel(document.querySelector('.result-panel')); };
export function installTournamentMode() {
  if (runtime.observer) return runtime.observer;
  runtime.observer = new MutationObserver(refresh);
  runtime.observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh();
  globalThis.FociskartyakTournament = Object.freeze({ showSetup: showTournamentSetup, showCenter: showTournamentCenter, read: () => tournamentStorageService.read(), save: state => tournamentStorageService.save(state), clear: () => tournamentStorageService.clear() });
  return runtime.observer;
}
installTournamentMode();
