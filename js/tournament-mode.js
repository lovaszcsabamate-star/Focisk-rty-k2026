/** Torna mód: beállítás, sorsolás, mentés, szimuláció és Gyors meccs-integráció. */

import {
  QUICK_MATCH_CATEGORY,
  buildQuickMatchCatalog,
  quickMatchEntriesForCategory,
  resolveQuickMatchSelection,
  stageQuickMatch,
} from './deck-selection.js';
import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  advanceTournament,
  createTournament,
  recordTournamentMatch,
  recordTournamentTiebreak,
  simulatePendingAiMatches,
  tournamentMatchById,
  tournamentNextHumanMatch,
  tournamentProgress,
  tournamentShuffle,
  tournamentStandings,
  tournamentTeamById,
} from './tournament/tournament-domain.js';
import { tournamentStorageService } from './services/tournament-storage-service.js';

const tournamentRuntime = {
  observer: null,
  resultPanels: new WeakSet(),
  lastMenuPanel: null,
};

const tournamentEscape = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const tournamentFold = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tournamentPlayers = () => {
  const payload = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ ?? globalThis.__EMBEDDED_PLAYER_DATA__;
  return Array.isArray(payload?.players) ? payload.players : [];
};

const tournamentCatalog = () => buildQuickMatchCatalog(tournamentPlayers());

const tournamentPool = category => {
  const catalog = tournamentCatalog();
  if (category === TOURNAMENT_CATEGORY.NATIONS) {
    return [
      ...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.NATIONAL),
      ...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.FEDERATION),
    ].filter(entry => entry.usable);
  }
  return quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.HUNGARIAN)
    .filter(entry => entry.usable);
};

const tournamentSupportedCounts = (format, available) => {
  const presets = format === TOURNAMENT_FORMAT.KNOCKOUT
    ? [4, 8, 16, 32]
    : format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT
      ? [4, 8, 12, 16, 24, 32]
      : [4, 6, 8, 10, 12, 16];
  const supported = presets.filter(value => value <= available);
  if (format === TOURNAMENT_FORMAT.LEAGUE && available >= 4 && !supported.includes(available) && available <= 16) {
    supported.push(available);
  }
  return [...new Set(supported)].sort((a, b) => a - b);
};

const tournamentName = (category, format) => {
  if (category === TOURNAMENT_CATEGORY.HUNGARIAN && format === TOURNAMENT_FORMAT.LEAGUE) return 'Magyar bajnokság';
  if (category === TOURNAMENT_CATEGORY.HUNGARIAN) return 'Magyar kupa';
  if (format === TOURNAMENT_FORMAT.LEAGUE) return 'Nemzetek ligája';
  if (format === TOURNAMENT_FORMAT.KNOCKOUT) return 'Nemzetek kupája';
  return 'Nemzetek tornája';
};

const tournamentFormatLabel = format => ({
  [TOURNAMENT_FORMAT.GROUP_KNOCKOUT]: 'Csoportkör + kieséses',
  [TOURNAMENT_FORMAT.KNOCKOUT]: 'Csak kieséses',
  [TOURNAMENT_FORMAT.LEAGUE]: 'Liga',
}[format] ?? format);

const tournamentPhaseLabel = state => {
  if (state.status === TOURNAMENT_STATUS.COMPLETE) return 'Befejezett torna';
  if (state.phase === 'group') return 'Csoportkör';
  if (state.phase === 'knockout') return 'Kieséses szakasz';
  return 'Liga';
};

const tournamentTeamMark = team => {
  if (team?.badge) {
    return `<img class="tournament-team-mark__image" src="${tournamentEscape(team.badge)}" alt="" loading="lazy">`;
  }
  return `<span class="tournament-team-mark__fallback" aria-hidden="true">${tournamentEscape(team?.icon || (team?.kind === 'club' ? '🛡️' : '🌍'))}</span>`;
};

const tournamentPanel = (className = '') => {
  const panel = document.createElement('div');
  panel.className = `tournament-panel mobile-sheet ${className}`.trim();
  panel.tabIndex = -1;
  return panel;
};

const tournamentShowPanel = panel => {
  const overlay = document.querySelector('#overlay');
  const body = document.querySelector('#overlay-body');
  if (!overlay || !body) return false;
  body.replaceChildren(panel);
  overlay.hidden = false;
  requestAnimationFrame(() => panel.querySelector('button, select, input')?.focus?.({ preventScroll: true }));
  return true;
};

const tournamentRestorePanel = panel => {
  if (panel?.isConnected) return;
  if (panel) tournamentShowPanel(panel);
  else location.reload();
};

const tournamentChooseParticipants = (pool, count, humanId, category) => {
  const human = pool.find(team => team.id === humanId);
  if (!human) return [];
  const chosen = [human];
  const used = new Set([human.id]);
  if (category === TOURNAMENT_CATEGORY.NATIONS) {
    const preferred = ['magyar', 'ukran', 'szerb', 'nigeria', 'del amerika'];
    for (const keyword of preferred) {
      const match = pool.find(team => !used.has(team.id) && tournamentFold(`${team.label} ${team.id}`).includes(keyword));
      if (match) {
        chosen.push(match);
        used.add(match.id);
      }
    }
  }
  for (const team of tournamentShuffle(pool.filter(item => !used.has(item.id)))) {
    if (chosen.length >= count) break;
    chosen.push(team);
    used.add(team.id);
  }
  return chosen.slice(0, count);
};

function showTournamentSetup(returnPanel = tournamentRuntime.lastMenuPanel) {
  const setup = {
    category: TOURNAMENT_CATEGORY.HUNGARIAN,
    format: TOURNAMENT_FORMAT.LEAGUE,
    count: 0,
    humanTeamId: '',
    difficulty: 'medium',
  };
  const panel = tournamentPanel('tournament-setup');

  const applyPreset = preset => {
    if (preset === 'hungarian') {
      setup.category = TOURNAMENT_CATEGORY.HUNGARIAN;
      setup.format = TOURNAMENT_FORMAT.LEAGUE;
    } else if (preset === 'nations') {
      setup.category = TOURNAMENT_CATEGORY.NATIONS;
      setup.format = TOURNAMENT_FORMAT.GROUP_KNOCKOUT;
    } else {
      setup.category = TOURNAMENT_CATEGORY.NATIONS;
      setup.format = TOURNAMENT_FORMAT.KNOCKOUT;
    }
    setup.count = 0;
    setup.humanTeamId = '';
    render();
  };

  const render = () => {
    const pool = tournamentPool(setup.category);
    const counts = tournamentSupportedCounts(setup.format, pool.length);
    if (!counts.includes(setup.count)) setup.count = counts.at(-1) ?? 0;
    if (!pool.some(team => team.id === setup.humanTeamId)) setup.humanTeamId = pool[0]?.id ?? '';
    const selected = pool.find(team => team.id === setup.humanTeamId) ?? null;
    const preview = tournamentChooseParticipants(pool, setup.count, setup.humanTeamId, setup.category);
    const canStart = setup.count >= 4 && preview.length === setup.count && selected;

    panel.innerHTML = `
      <div class="tournament-heading">
        <div><p class="eyebrow">Új játékmód</p><h1>🏆 Torna mód</h1></div>
        <button class="tournament-help" type="button" aria-label="Torna mód súgó" title="Torna mód súgó">?</button>
      </div>
      <div class="tournament-presets" aria-label="Gyors tornák">
        <button class="tournament-preset" type="button" data-preset="hungarian"><b>Magyar bajnokság</b><small>Klubok · liga</small></button>
        <button class="tournament-preset" type="button" data-preset="nations"><b>Nemzetek tornája</b><small>Csoport + kieséses</small></button>
        <button class="tournament-preset" type="button" data-preset="cup"><b>Villámkupa</b><small>Csak kieséses</small></button>
      </div>
      <section class="tournament-section">
        <h2>1. Résztvevők</h2>
        <div class="tournament-segmented" role="radiogroup" aria-label="Tornakategória">
          <label><input type="radio" name="tournament-category" value="${TOURNAMENT_CATEGORY.HUNGARIAN}" ${setup.category === TOURNAMENT_CATEGORY.HUNGARIAN ? 'checked' : ''}><span>🇭🇺 Magyar klubok</span></label>
          <label><input type="radio" name="tournament-category" value="${TOURNAMENT_CATEGORY.NATIONS}" ${setup.category === TOURNAMENT_CATEGORY.NATIONS ? 'checked' : ''}><span>🌍 Nemzetek és régiók</span></label>
        </div>
      </section>
      <section class="tournament-section">
        <h2>2. Kupa mód</h2>
        <div class="tournament-format-grid">
          <label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.GROUP_KNOCKOUT}" ${setup.format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT ? 'checked' : ''}><span><b>Csoportkör + kieséses</b><small>Tabella, majd egyenes kiesés</small></span></label>
          <label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.KNOCKOUT}" ${setup.format === TOURNAMENT_FORMAT.KNOCKOUT ? 'checked' : ''}><span><b>Csak kieséses</b><small>Egy vereség és vége</small></span></label>
          <label><input type="radio" name="tournament-format" value="${TOURNAMENT_FORMAT.LEAGUE}" ${setup.format === TOURNAMENT_FORMAT.LEAGUE ? 'checked' : ''}><span><b>Liga</b><small>Mindenki játszik mindenkivel</small></span></label>
        </div>
      </section>
      <section class="tournament-section tournament-options-grid">
        <label><span>Résztvevők száma</span><select id="tournament-count" ${counts.length ? '' : 'disabled'}>${counts.map(value => `<option value="${value}" ${value === setup.count ? 'selected' : ''}>${value} csapat</option>`).join('')}</select></label>
        <label><span>Nehézség</span><select id="tournament-difficulty"><option value="easy" ${setup.difficulty === 'easy' ? 'selected' : ''}>Könnyű</option><option value="medium" ${setup.difficulty === 'medium' ? 'selected' : ''}>Normál</option><option value="hard" ${setup.difficulty === 'hard' ? 'selected' : ''}>Nehéz</option></select></label>
      </section>
      <section class="tournament-section">
        <h2>3. Saját csapat</h2>
        ${selected ? `<div class="tournament-selected-team">${tournamentTeamMark(selected)}<div><strong>${tournamentEscape(selected.label)}</strong><small>${tournamentEscape(selected.subtitle)} · ${selected.count} kártya</small></div></div>` : '<p class="tournament-warning">Nincs elegendő használható csapat ebben a kategóriában.</p>'}
        <select id="tournament-human-team" aria-label="Saját csapat" ${pool.length ? '' : 'disabled'}>${pool.map(team => `<option value="${tournamentEscape(team.id)}" ${team.id === setup.humanTeamId ? 'selected' : ''}>${tournamentEscape(team.label)} (${team.count})</option>`).join('')}</select>
      </section>
      <section class="tournament-section">
        <h2>Várható mezőny</h2>
        <div class="tournament-team-chips">${preview.map(team => `<span class="tournament-team-chip ${team.id === setup.humanTeamId ? 'is-human' : ''}">${tournamentEscape(team.icon || '⚽')} ${tournamentEscape(team.label)}</span>`).join('')}</div>
      </section>
      <div class="tournament-actions">
        <button class="btn btn--ghost" id="tournament-back" type="button">Vissza</button>
        <button class="btn" id="tournament-start" type="button" ${canStart ? '' : 'disabled'}>Torna indítása</button>
      </div>
      <dialog class="tournament-help-dialog"><h2>Hogyan működik?</h2><p>A saját mérkőzéseidet a megszokott kártyajátékkal játszod le. A többi találkozót a rendszer a csapatok valódi kártyaadataiból számított erőviszonyok alapján szimulálja. Kieséses döntetlennél automatikusan Penalties következik.</p><button class="btn" type="button">Értem</button></dialog>
    `;

    panel.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => applyPreset(button.dataset.preset)));
    panel.querySelectorAll('input[name=tournament-category]').forEach(input => input.addEventListener('change', () => {
      setup.category = input.value;
      setup.count = 0;
      setup.humanTeamId = '';
      render();
    }));
    panel.querySelectorAll('input[name=tournament-format]').forEach(input => input.addEventListener('change', () => {
      setup.format = input.value;
      setup.count = 0;
      render();
    }));
    panel.querySelector('#tournament-count')?.addEventListener('change', event => {
      setup.count = Number(event.target.value) || 0;
      render();
    });
    panel.querySelector('#tournament-difficulty')?.addEventListener('change', event => {
      setup.difficulty = event.target.value;
    });
    panel.querySelector('#tournament-human-team')?.addEventListener('change', event => {
      setup.humanTeamId = event.target.value;
      render();
    });
    panel.querySelector('#tournament-back')?.addEventListener('click', () => tournamentRestorePanel(returnPanel), { once: true });
    const dialog = panel.querySelector('.tournament-help-dialog');
    panel.querySelector('.tournament-help')?.addEventListener('click', () => dialog?.showModal());
    dialog?.querySelector('button')?.addEventListener('click', () => dialog.close());
    panel.querySelector('#tournament-start')?.addEventListener('click', () => {
      const participants = tournamentChooseParticipants(pool, setup.count, setup.humanTeamId, setup.category);
      try {
        const state = createTournament({
          name: tournamentName(setup.category, setup.format),
          category: setup.category,
          format: setup.format,
          participants,
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
  tournamentShowPanel(panel);
}

const tournamentPlayerStrength = player => {
  const stats = player?.stats ?? {};
  const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  return Math.log1p(number(stats.marketValue)) * 1.25
    + Math.log1p(number(stats.minutes)) * 1.1
    + Math.log1p(number(stats.appearances)) * 1.4
    + Math.log1p(number(stats.starts))
    + Math.log1p(number(stats.goals)) * 1.7
    + Math.log1p(number(stats.assists)) * 1.5;
};

const tournamentStrengthResolver = state => {
  const players = tournamentPlayers();
  const cache = new Map();
  return teamId => {
    if (cache.has(teamId)) return cache.get(teamId);
    const team = tournamentTeamById(state, teamId);
    const cards = team ? resolveQuickMatchSelection(players, team.selection) : [];
    const best = cards.map(tournamentPlayerStrength).sort((a, b) => b - a).slice(0, 11);
    const strength = best.length
      ? best.reduce((sum, value) => sum + value, 0) / best.length + Math.log1p(cards.length)
      : 1;
    cache.set(teamId, strength);
    return strength;
  };
};

const tournamentSimulateAndSave = state => {
  let next = simulatePendingAiMatches(advanceTournament(state), tournamentStrengthResolver(state));
  next = advanceTournament(next);
  tournamentStorageService.save(next);
  if (next.status === TOURNAMENT_STATUS.COMPLETE) tournamentStorageService.archive(next);
  return next;
};

const tournamentStandingTable = (state, groupId = null) => {
  const rows = tournamentStandings(state, groupId);
  return `<div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>#</th><th>Csapat</th><th>M</th><th>GY</th><th>D</th><th>V</th><th>+/−</th><th>P</th></tr></thead><tbody>${rows.map(row => {
    const team = tournamentTeamById(state, row.teamId);
    return `<tr class="${row.teamId === state.humanTeamId ? 'is-human' : ''}"><td>${row.position}</td><td>${tournamentEscape(team?.icon || '')} ${tournamentEscape(team?.label || row.teamId)}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.difference > 0 ? '+' : ''}${row.difference}</td><td><b>${row.points}</b></td></tr>`;
  }).join('')}</tbody></table></div>`;
};

const tournamentTables = state => {
  if (state.format === TOURNAMENT_FORMAT.LEAGUE) return tournamentStandingTable(state);
  if (state.groups?.length) return `<div class="tournament-groups">${state.groups.map(group => `<section><h3>${tournamentEscape(group.label)}</h3>${tournamentStandingTable(state, group.id)}</section>`).join('')}</div>`;
  return '';
};

const tournamentBracket = state => {
  const rounds = (state.rounds ?? []).filter(round => round.stage === 'knockout');
  if (!rounds.length) return '';
  return `<div class="tournament-bracket" aria-label="Kieséses tornaág">${rounds.map(round => `<section class="tournament-bracket__round"><h3>${tournamentEscape(round.label)}</h3>${round.matches.map(match => {
    const home = tournamentTeamById(state, match.homeId);
    const away = tournamentTeamById(state, match.awayId);
    const score = match.status === TOURNAMENT_MATCH_STATUS.COMPLETE ? `${match.homeScore}–${match.awayScore}${match.decidedBy === 'penalties' ? ' (b.)' : ''}` : match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK ? 'Büntetők' : '–';
    return `<div class="tournament-bracket__match ${[match.homeId, match.awayId].includes(state.humanTeamId) ? 'is-human' : ''}"><span class="${match.winnerId === match.homeId ? 'is-winner' : ''}">${tournamentEscape(home?.label || match.homeId)}</span><b>${score}</b><span class="${match.winnerId === match.awayId ? 'is-winner' : ''}">${tournamentEscape(away?.label || match.awayId)}</span></div>`;
  }).join('')}</section>`).join('')}</div>`;
};

const tournamentRecentResults = state => {
  const matches = (state.rounds ?? []).flatMap(round => round.matches ?? [])
    .filter(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE)
    .slice(-6).reverse();
  if (!matches.length) return '<p class="tournament-empty">Még nincs lejátszott mérkőzés.</p>';
  return `<div class="tournament-results-list">${matches.map(match => {
    const home = tournamentTeamById(state, match.homeId);
    const away = tournamentTeamById(state, match.awayId);
    return `<div class="tournament-result-row"><span>${tournamentEscape(home?.label || match.homeId)}</span><b>${match.homeScore}–${match.awayScore}</b><span>${tournamentEscape(away?.label || match.awayId)}</span></div>`;
  }).join('')}</div>`;
};

function launchTournamentMatch(state, match) {
  const humanTeam = tournamentTeamById(state, state.humanTeamId);
  const opponentId = match.homeId === state.humanTeamId ? match.awayId : match.homeId;
  const opponent = tournamentTeamById(state, opponentId);
  if (!humanTeam || !opponent) return;
  const mode = match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK ? 'penalties' : 'classic';
  const next = {
    ...state,
    currentMatchId: match.id,
    currentMatchMode: mode,
    updatedAt: new Date().toISOString(),
  };
  tournamentStorageService.save(next);
  const staged = stageQuickMatch({
    playerTeamId: humanTeam.id,
    opponentTeamId: opponent.id,
    playerSelection: humanTeam.selection,
    opponentSelection: opponent.selection,
    mode,
    difficulty: state.difficulty,
    createdAt: new Date().toISOString(),
  });
  if (!staged) {
    alert('A tornamérkőzéshez tartozó csapatok jelenleg nem tölthetők be.');
    return;
  }
  location.reload();
}

function showTournamentComplete(state, returnPanel = null) {
  const panel = tournamentPanel('tournament-complete');
  const champion = tournamentTeamById(state, state.championId);
  const human = tournamentTeamById(state, state.humanTeamId);
  const won = state.championId === state.humanTeamId;
  const standing = state.format === TOURNAMENT_FORMAT.LEAGUE
    ? tournamentStandings(state).find(row => row.teamId === state.humanTeamId)?.position
    : null;
  panel.innerHTML = `
    <p class="eyebrow">${tournamentEscape(state.name)}</p>
    <div class="tournament-trophy" aria-hidden="true">${won ? '🏆' : '🏁'}</div>
    <h1>${won ? 'TORNAGYŐZELEM!' : 'A torna véget ért'}</h1>
    <div class="tournament-champion">${tournamentTeamMark(champion)}<div><small>Bajnok</small><strong>${tournamentEscape(champion?.label || 'Ismeretlen')}</strong></div></div>
    <p>${won ? `${tournamentEscape(human?.label)} veretlenül vagy a döntő megnyerésével megszerezte a trófeát.` : standing ? `${tournamentEscape(human?.label)} a(z) ${standing}. helyen zárt.` : `${tournamentEscape(human?.label)} számára véget ért a sorozat.`}</p>
    ${tournamentTables(state)}
    ${tournamentBracket(state)}
    <div class="tournament-actions"><button class="btn" id="tournament-new">Új torna</button><button class="btn btn--ghost" id="tournament-home">Főmenü</button></div>
  `;
  panel.querySelector('#tournament-new')?.addEventListener('click', () => showTournamentSetup(returnPanel), { once: true });
  panel.querySelector('#tournament-home')?.addEventListener('click', () => tournamentRestorePanel(returnPanel), { once: true });
  tournamentShowPanel(panel);
}

function showTournamentCenter(inputState = tournamentStorageService.read(), returnPanel = tournamentRuntime.lastMenuPanel) {
  if (!inputState) {
    showTournamentSetup(returnPanel);
    return;
  }
  const state = tournamentSimulateAndSave(inputState);
  if (state.status === TOURNAMENT_STATUS.COMPLETE) {
    showTournamentComplete(state, returnPanel);
    return;
  }
  const nextMatch = tournamentNextHumanMatch(state);
  const human = tournamentTeamById(state, state.humanTeamId);
  const opponentId = nextMatch ? (nextMatch.homeId === state.humanTeamId ? nextMatch.awayId : nextMatch.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId);
  const progress = tournamentProgress(state);
  const round = nextMatch ? (state.rounds ?? []).find(item => item.matches?.some(match => match.id === nextMatch.id)) : null;
  const panel = tournamentPanel('tournament-center');
  panel.innerHTML = `
    <div class="tournament-heading"><div><p class="eyebrow">${tournamentEscape(tournamentFormatLabel(state.format))}</p><h1>${tournamentEscape(state.name)}</h1></div><span class="tournament-phase">${tournamentEscape(tournamentPhaseLabel(state))}</span></div>
    <div class="tournament-progress"><span style="width:${progress.percent}%"></span></div>
    <p class="tournament-progress-label">${progress.completed} mérkőzés lejátszva · ${progress.percent}%</p>
    ${nextMatch ? `<section class="tournament-next-match"><p>${tournamentEscape(round?.label || 'Következő mérkőzés')}</p><div class="tournament-versus"><div>${tournamentTeamMark(human)}<strong>${tournamentEscape(human?.label)}</strong></div><b>VS</b><div>${tournamentTeamMark(opponent)}<strong>${tournamentEscape(opponent?.label)}</strong></div></div><button class="btn tournament-play" id="tournament-play">${nextMatch.status === TOURNAMENT_MATCH_STATUS.TIEBREAK ? '⚽ Büntetőpárbaj indítása' : '▶ Következő mérkőzés'}</button></section>` : '<p class="tournament-warning">Nincs lejátszható saját mérkőzés. A hátralévő gépi találkozók szimulációja folyamatban van.</p>'}
    <nav class="tournament-tabs" aria-label="Torna adatai"><button type="button" class="is-active" data-tab="overview">Áttekintés</button><button type="button" data-tab="results">Eredmények</button>${state.groups?.length || state.format === TOURNAMENT_FORMAT.LEAGUE ? '<button type="button" data-tab="table">Tabella</button>' : ''}${state.rounds?.some(item => item.stage === 'knockout') ? '<button type="button" data-tab="bracket">Tornaág</button>' : ''}</nav>
    <div class="tournament-tab-content" data-content="overview"><h2>Saját csapat</h2><div class="tournament-selected-team">${tournamentTeamMark(human)}<div><strong>${tournamentEscape(human?.label)}</strong><small>${tournamentEscape(tournamentPhaseLabel(state))}</small></div></div><h2>Legutóbbi eredmények</h2>${tournamentRecentResults(state)}</div>
    <div class="tournament-tab-content" data-content="results" hidden>${tournamentRecentResults(state)}</div>
    <div class="tournament-tab-content" data-content="table" hidden>${tournamentTables(state)}</div>
    <div class="tournament-tab-content" data-content="bracket" hidden>${tournamentBracket(state)}</div>
    <div class="tournament-actions tournament-actions--secondary"><button class="btn btn--ghost" id="tournament-center-home">Főmenü</button><button class="btn btn--danger" id="tournament-abandon">Torna feladása</button></div>
  `;
  panel.querySelector('#tournament-play')?.addEventListener('click', () => launchTournamentMatch(state, nextMatch), { once: true });
  panel.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    panel.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('is-active', item === button));
    panel.querySelectorAll('[data-content]').forEach(content => { content.hidden = content.dataset.content !== button.dataset.tab; });
  }));
  panel.querySelector('#tournament-center-home')?.addEventListener('click', () => tournamentRestorePanel(returnPanel), { once: true });
  panel.querySelector('#tournament-abandon')?.addEventListener('click', () => {
    if (!confirm('Biztosan feladod a jelenlegi tornát?')) return;
    tournamentStorageService.clear();
    location.reload();
  });
  tournamentShowPanel(panel);
}

const tournamentParseResult = panel => {
  const text = panel.querySelector('.final-score')?.textContent ?? '';
  const match = text.match(/JÁTÉKOS\s+(\d+)\s*[–-]\s*(\d+)\s+GÉP/i);
  if (!match) return null;
  const heading = tournamentFold(panel.querySelector('h1')?.textContent);
  return {
    humanScore: Number(match[1]),
    aiScore: Number(match[2]),
    humanWon: heading.includes('gyozelem'),
    humanLost: heading.includes('vereseg'),
    tie: heading.includes('dontetlen'),
  };
};

const tournamentHandleResultPanel = panel => {
  if (!panel || tournamentRuntime.resultPanels.has(panel)) return;
  const stored = tournamentStorageService.read();
  if (!stored?.currentMatchId) return;
  const currentMatch = tournamentMatchById(stored, stored.currentMatchId);
  const result = tournamentParseResult(panel);
  if (!currentMatch || !result) return;
  tournamentRuntime.resultPanels.add(panel);

  const humanHome = currentMatch.homeId === stored.humanTeamId;
  const homeScore = humanHome ? result.humanScore : result.aiScore;
  const awayScore = humanHome ? result.aiScore : result.humanScore;
  const opponentId = humanHome ? currentMatch.awayId : currentMatch.homeId;
  const winnerId = result.humanWon ? stored.humanTeamId : result.humanLost ? opponentId : null;
  let next;

  try {
    if (stored.currentMatchMode === 'penalties' || currentMatch.status === TOURNAMENT_MATCH_STATUS.TIEBREAK) {
      if (!winnerId) throw new Error('A büntetőpárbaj nem zárult győztessel.');
      next = recordTournamentTiebreak(stored, currentMatch.id, { homeScore, awayScore, winnerId });
    } else {
      next = recordTournamentMatch(stored, currentMatch.id, {
        homeScore,
        awayScore,
        winnerId,
        decidedBy: 'played',
      });
    }
    next.currentMatchId = null;
    next.currentMatchMode = null;
    next = tournamentSimulateAndSave(next);
  } catch (error) {
    console.error('[tournament] A mérkőzés eredménye nem menthető:', error);
    return;
  }

  const updatedMatch = tournamentMatchById(next, currentMatch.id);
  const actions = panel.querySelector('.result-actions');
  if (actions) {
    actions.replaceChildren();
    const continueButton = document.createElement('button');
    continueButton.className = 'btn';
    continueButton.textContent = updatedMatch?.status === TOURNAMENT_MATCH_STATUS.TIEBREAK
      ? '⚽ Büntetőpárbaj'
      : next.status === TOURNAMENT_STATUS.COMPLETE ? '🏆 Torna végeredménye' : '🏆 Torna folytatása';
    continueButton.addEventListener('click', () => showTournamentCenter(next, null), { once: true });
    const homeButton = document.createElement('button');
    homeButton.className = 'btn btn--ghost';
    homeButton.textContent = 'Főmenü';
    homeButton.addEventListener('click', () => location.reload(), { once: true });
    actions.append(continueButton, homeButton);
  }
  const context = document.createElement('p');
  context.className = 'tournament-result-context';
  context.textContent = `${next.name} · ${tournamentPhaseLabel(next)}`;
  panel.prepend(context);
};

const tournamentEnhanceMenu = panel => {
  if (!panel || panel.dataset.tournamentEnhanced === 'true') return;
  panel.dataset.tournamentEnhanced = 'true';
  tournamentRuntime.lastMenuPanel = panel;
  const primary = panel.querySelector('.primary-mode-actions');
  if (!primary) return;
  const button = document.createElement('button');
  button.className = 'btn mode-start tournament-menu-button';
  button.id = 'tournament-mode-btn';
  button.innerHTML = '<span>🏆 Torna mód</span><small>Liga, kupa vagy csoportkör</small>';
  button.addEventListener('click', () => showTournamentSetup(panel), { once: true });
  primary.appendChild(button);

  const stored = tournamentStorageService.read();
  if (stored) {
    const continueButton = document.createElement('button');
    continueButton.className = 'btn btn--continue tournament-continue-button';
    continueButton.innerHTML = `<span>${stored.status === TOURNAMENT_STATUS.COMPLETE ? '🏆 Torna eredménye' : '▶ Torna folytatása'}</span><small>${tournamentEscape(stored.name)} · ${tournamentEscape(tournamentPhaseLabel(stored))}</small>`;
    continueButton.addEventListener('click', () => showTournamentCenter(stored, panel), { once: true });
    const title = panel.querySelector('.menu-section-title');
    title?.before(continueButton);
  }
};

const tournamentRefreshUi = () => {
  tournamentEnhanceMenu(document.querySelector('.menu-panel.mobile-home'));
  tournamentHandleResultPanel(document.querySelector('.result-panel'));
};

export function installTournamentMode() {
  if (tournamentRuntime.observer) return tournamentRuntime.observer;
  tournamentRuntime.observer = new MutationObserver(tournamentRefreshUi);
  tournamentRuntime.observer.observe(document.documentElement, { childList: true, subtree: true });
  tournamentRefreshUi();
  globalThis.FociskartyakTournament = Object.freeze({
    showSetup: showTournamentSetup,
    showCenter: showTournamentCenter,
    read: () => tournamentStorageService.read(),
    clear: () => tournamentStorageService.clear(),
  });
  return tournamentRuntime.observer;
}

installTournamentMode();
