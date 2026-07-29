/** Torna v3 közös felületi segédek és nézetek. */

import {
  QUICK_MATCH_CATEGORY,
  buildQuickMatchCatalog,
  quickMatchEntriesForCategory,
  resolveQuickMatchSelection,
} from '../deck-selection.js';
import { ATTRIBUTE_BY_KEY } from '../data/players.js';
import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  isHungarianCup12,
  tournamentMatches,
  tournamentShuffle,
  tournamentStandings,
  tournamentTeamById,
} from './tournament-domain.js';
import { tournamentPlayerStrength } from './tournament-simulation.js';
import { calculateTournamentAwards, playerStatistics, teamStatistics } from './tournament-state.js';

export const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU').replace(/[^a-z0-9]+/g, ' ').trim();
const text = value => String(value ?? '').trim();
export const players = () => {
  const payload = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ ?? globalThis.__EMBEDDED_PLAYER_DATA__;
  return Array.isArray(payload?.players) ? payload.players : [];
};
export const playerById = () => new Map(players().map(player => [String(player.id), player]));
export const poolFor = category => {
  const catalog = buildQuickMatchCatalog(players());
  const entries = category === TOURNAMENT_CATEGORY.NATIONS
    ? [...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.NATIONAL), ...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.FEDERATION)]
    : quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.HUNGARIAN);
  return entries.filter(entry => entry.usable && Number(entry.count) >= 11);
};
export const cardsForTeam = (state, teamId) => {
  const team = tournamentTeamById(state, teamId);
  return team ? resolveQuickMatchSelection(players(), team.selection) : [];
};
export const resolveCards = state => teamId => cardsForTeam(state, teamId);

const initials = label => text(label).split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join('').toUpperCase();
const hue = label => [...text(label)].reduce((sum, char) => (sum + char.charCodeAt(0) * 7) % 360, 28);
export const teamMark = (team, compact = false) => {
  const sizeClass = compact ? ' is-compact' : '';
  if (team?.badge) return `<span class="tournament-team-mark${sizeClass}"><img class="tournament-team-mark__image" src="${escapeHtml(team.badge)}" alt="${escapeHtml(team.label)} embléma" loading="lazy"></span>`;
  if (team?.kind === 'nation' && team?.icon) return `<span class="tournament-team-mark tournament-team-mark--nation${sizeClass}" aria-label="${escapeHtml(team.label)}"><span class="tournament-team-mark__shield">${escapeHtml(initials(team.label) || 'V')}</span><span class="tournament-team-mark__flag">${escapeHtml(team.icon)}</span></span>`;
  if (team?.icon) return `<span class="tournament-team-mark tournament-team-mark--icon${sizeClass}" aria-label="${escapeHtml(team.label)}">${escapeHtml(team.icon)}</span>`;
  return `<span class="tournament-team-mark tournament-team-mark--generated${sizeClass}" aria-label="${escapeHtml(team?.label)}" style="--team-hue:${hue(team?.label)}">${escapeHtml(initials(team?.label) || 'FK')}</span>`;
};

export const panel = className => {
  const node = document.createElement('div');
  node.className = `tournament-panel tournament-v3 mobile-sheet ${className ?? ''}`.trim();
  node.tabIndex = -1;
  return node;
};
export const showPanel = node => {
  const overlay = document.querySelector('#overlay');
  const body = document.querySelector('#overlay-body');
  if (!overlay || !body) return false;
  body.replaceChildren(node); overlay.hidden = false;
  requestAnimationFrame(() => node.querySelector('button, select, input')?.focus?.({ preventScroll: true }));
  return true;
};
export const navigateHome = () => {
  try { globalThis.location.assign(new URL('./index.html', globalThis.location.href).href); }
  catch { globalThis.location.reload(); }
};
export const restorePanel = node => node ? showPanel(node) : navigateHome();
export const formatLabel = format => ({
  [TOURNAMENT_FORMAT.GROUP_KNOCKOUT]: 'Csoportkör + kieséses',
  [TOURNAMENT_FORMAT.KNOCKOUT]: 'Csak kieséses',
  [TOURNAMENT_FORMAT.LEAGUE]: 'Liga',
}[format] ?? format);
export const matchModeLabel = mode => mode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'Büntetőpárbaj' : 'Klasszikus';
export const tournamentModeTitle = state => `${matchModeLabel(state.matchMode)} torna`;
export const phaseLabel = state => state.status === TOURNAMENT_STATUS.COMPLETE ? 'Befejezett torna'
  : state.phase === 'group' ? 'Csoportkör' : state.phase === 'knockout' ? 'Kieséses szakasz' : 'Liga';
export const tournamentName = (category, format, count) => {
  if (category === TOURNAMENT_CATEGORY.HUNGARIAN && format === TOURNAMENT_FORMAT.KNOCKOUT && count === 12) return 'Magyar Kupa';
  if (category === TOURNAMENT_CATEGORY.HUNGARIAN && format === TOURNAMENT_FORMAT.LEAGUE) return 'Magyar bajnokság';
  if (category === TOURNAMENT_CATEGORY.HUNGARIAN) return 'Magyar klubkupa';
  if (format === TOURNAMENT_FORMAT.LEAGUE) return 'Nemzetek ligája';
  return format === TOURNAMENT_FORMAT.KNOCKOUT ? 'Nemzetek kupája' : 'Nemzetek tornája';
};
export const supportedCounts = (category, format, available) => {
  const presets = format === TOURNAMENT_FORMAT.KNOCKOUT
    ? (category === TOURNAMENT_CATEGORY.HUNGARIAN ? [4, 8, 12, 16, 32] : [4, 8, 16, 32])
    : format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT ? [4, 8, 12, 16, 24, 32] : [4, 6, 8, 10, 12, 16];
  return presets.filter(value => value <= available);
};
export const chooseParticipants = (pool, count, humanId, category) => {
  const human = pool.find(team => team.id === humanId);
  if (!human) return [];
  const chosen = [human]; const used = new Set([human.id]);
  if (category === TOURNAMENT_CATEGORY.NATIONS) {
    for (const keyword of ['magyar', 'ukran', 'szerb', 'nigeria', 'del amerika']) {
      const match = pool.find(team => !used.has(team.id) && fold(`${team.label} ${team.id}`).includes(keyword));
      if (match) { chosen.push(match); used.add(match.id); }
    }
  }
  for (const team of tournamentShuffle(pool.filter(item => !used.has(item.id)))) {
    if (chosen.length >= count) break;
    chosen.push(team); used.add(team.id);
  }
  return chosen.slice(0, count);
};

export const matchScore = match => {
  if (match.status === TOURNAMENT_MATCH_STATUS.TIEBREAK) return 'Büntetők';
  if (match.status !== TOURNAMENT_MATCH_STATUS.COMPLETE) return '–';
  const suffix = String(match.decidedBy).includes('penalties')
    ? (match.simulation?.suddenDeath ? ' (b., hirtelen halál)' : ' (b.)')
    : match.simulation?.suddenDeath ? ' (hirtelen halál)' : '';
  return `${match.homeScore}–${match.awayScore}${suffix}`;
};
const standingsTable = (state, groupId = null) => `<div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>#</th><th>Csapat</th><th>M</th><th>GY</th><th>D</th><th>V</th><th>+/−</th><th>P</th></tr></thead><tbody>${tournamentStandings(state, groupId).map(row => {
  const team = tournamentTeamById(state, row.teamId);
  return `<tr class="${row.teamId === state.humanTeamId ? 'is-human' : ''}"><td>${row.position}</td><td><span class="tournament-table-team">${teamMark(team, true)}<b>${escapeHtml(team?.label || row.teamId)}</b></span></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.difference > 0 ? '+' : ''}${row.difference}</td><td><b>${row.points}</b></td></tr>`;
}).join('')}</tbody></table></div>`;
export const tables = state => state.format === TOURNAMENT_FORMAT.LEAGUE ? standingsTable(state)
  : state.groups?.length ? `<div class="tournament-groups">${state.groups.map(group => `<section><h3>${escapeHtml(group.label)}</h3>${standingsTable(state, group.id)}</section>`).join('')}</div>` : '';
export const bracket = state => {
  const rounds = state.rounds?.filter(round => round.stage === 'knockout') ?? [];
  if (!rounds.length) return '<p class="tournament-empty">A kieséses ág még nem alakult ki.</p>';
  const byes = isHungarianCup12(state) && state.hungarianCupByeTeamIds?.length
    ? `<section class="tournament-bracket__round"><h3>Erőnyerők</h3>${state.hungarianCupByeTeamIds.map(id => { const team = tournamentTeamById(state, id); return `<div class="tournament-bracket__match ${id === state.humanTeamId ? 'is-human' : ''}"><span class="is-winner">${teamMark(team, true)} ${escapeHtml(team?.label || id)}</span><b>→</b><span>Negyeddöntő</span></div>`; }).join('')}</section>` : '';
  return `<div class="tournament-bracket" aria-label="Kieséses tornaág">${byes}${rounds.map(round => `<section class="tournament-bracket__round"><h3>${escapeHtml(round.label)}</h3>${round.matches.map(match => { const home = tournamentTeamById(state, match.homeId); const away = tournamentTeamById(state, match.awayId); return `<div class="tournament-bracket__match ${[match.homeId, match.awayId].includes(state.humanTeamId) ? 'is-human' : ''}"><span class="${match.winnerId === match.homeId ? 'is-winner' : ''}">${teamMark(home, true)} ${escapeHtml(home?.label || match.homeId)}</span><b>${matchScore(match)}</b><span class="${match.winnerId === match.awayId ? 'is-winner' : ''}">${teamMark(away, true)} ${escapeHtml(away?.label || match.awayId)}</span></div>`; }).join('')}</section>`).join('')}</div>`;
};
export const resultsList = (state, { simulatedOnly = false, limit = 24 } = {}) => {
  const matches = tournamentMatches(state).filter(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE)
    .filter(match => !simulatedOnly || String(match.decidedBy).startsWith('simulation')).slice(-limit).reverse();
  if (!matches.length) return '<p class="tournament-empty">Még nincs megjeleníthető mérkőzés.</p>';
  return `<div class="tournament-results-list">${matches.map(match => { const home = tournamentTeamById(state, match.homeId); const away = tournamentTeamById(state, match.awayId); const mode = String(match.decidedBy).includes('penalties') ? TOURNAMENT_MATCH_MODE.PENALTIES : state.matchMode; return `<article class="tournament-result-card ${[match.homeId, match.awayId].includes(state.humanTeamId) ? 'is-human' : ''}"><div class="tournament-result-row"><span>${teamMark(home, true)} ${escapeHtml(home?.label || match.homeId)}</span><b>${matchScore(match)}</b><span>${teamMark(away, true)} ${escapeHtml(away?.label || match.awayId)}</span></div><footer><span>${escapeHtml(matchModeLabel(mode))}</span>${match.simulation?.summary ? `<small>${escapeHtml(match.simulation.summary)}</small>` : ''}</footer></article>`; }).join('')}</div>`;
};

export const teamStatsView = state => {
  const stats = teamStatistics(state); if (!stats.length) return '<p class="tournament-empty">A csapatstatisztikák az első forduló után jelennek meg.</p>';
  const bestAttack = [...stats].sort((a, b) => b.scored - a.scored)[0];
  const bestDefense = [...stats].filter(item => item.played).sort((a, b) => a.conceded - b.conceded)[0];
  const surprise = [...stats].sort((a, b) => b.longestWinStreak - a.longestWinStreak || b.difference - a.difference)[0];
  const highlight = (label, stat, value) => stat ? `<div class="tournament-stat-highlight">${teamMark(tournamentTeamById(state, stat.teamId), true)}<div><small>${label}</small><strong>${escapeHtml(stat.label)}</strong><span>${escapeHtml(value)}</span></div></div>` : '';
  return `<div class="tournament-stat-highlights">${highlight('Legeredményesebb', stats[0], `${stats[0].wins} győzelem`)}${highlight('Legjobb támadás', bestAttack, `${bestAttack.scored} rúgott kör/gól`)}${highlight('Legjobb védelem', bestDefense, `${bestDefense?.conceded ?? 0} kapott kör/gól`)}${highlight('Meglepetéscsapat', surprise, `${surprise.longestWinStreak} meccses sorozat`)}</div><div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>Csapat</th><th>M</th><th>GY</th><th>D</th><th>V</th><th>Rúgott</th><th>Kapott</th><th>+/−</th><th>Sorozat</th><th>Átlag</th></tr></thead><tbody>${stats.map(item => `<tr class="${item.teamId === state.humanTeamId ? 'is-human' : ''}"><td><span class="tournament-table-team">${teamMark(tournamentTeamById(state, item.teamId), true)}<b>${escapeHtml(item.label)}</b></span></td><td>${item.played}</td><td>${item.wins}</td><td>${item.draws}</td><td>${item.losses}</td><td>${item.scored}</td><td>${item.conceded}</td><td>${item.difference > 0 ? '+' : ''}${item.difference}</td><td>${item.longestWinStreak}</td><td>${item.averagePerformance}</td></tr>`).join('')}</tbody></table></div>`;
};
const miniPlayer = (label, item, value) => item ? `<div class="tournament-stat-highlight"><div class="tournament-mini-card">${item.cardImage ? `<img src="${escapeHtml(item.cardImage)}" alt="">` : '<span>👤</span>'}</div><div><small>${escapeHtml(label)}</small><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(value)}</span></div></div>` : '';
export const playerStatsView = state => {
  const stats = playerStatistics(state); if (!stats.length) return '<p class="tournament-empty">Az első mérkőzések után jelennek meg az egyéni statisztikák.</p>';
  const penalties = state.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES;
  const mostUsed = [...stats].sort((a, b) => b.selections - a.selections)[0];
  const mostMotm = [...stats].sort((a, b) => b.manOfMatchCount - a.manOfMatchCount || b.totalPerformance - a.totalPerformance)[0];
  const efficient = [...stats].filter(item => item.selections >= 2).sort((a, b) => b.efficiency - a.efficiency)[0] ?? stats[0];
  return `<div class="tournament-player-leaders">${stats.slice(0, 3).map((item, index) => `<article><span class="tournament-leader-rank">${index + 1}</span><div class="tournament-mini-card">${item.cardImage ? `<img src="${escapeHtml(item.cardImage)}" alt="">` : '<span>👤</span>'}</div><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.teamLabel)}</small><b>${penalties ? `${item.penaltyGoals} gól` : `${item.duelWins} megnyert párharc`}</b></div></article>`).join('')}</div><div class="tournament-stat-highlights">${miniPlayer('Legtöbbet használt lap', mostUsed, `${mostUsed.selections} kiválasztás`)}${miniPlayer('Legtöbb meccs embere', mostMotm, `${mostMotm.manOfMatchCount} cím`)}${miniPlayer('Legjobb hatékonyság', efficient, `${efficient.efficiency}%`)}</div><div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>Játékos</th><th>M</th>${penalties ? '<th>Büntető</th><th>Gól</th><th>Kihagyott</th><th>Hirtelen halál</th><th>Döntő</th>' : '<th>Kiválasztás</th><th>GY</th><th>D</th><th>V</th><th>Legjobb kategória</th>'}<th>Kulcspillanat</th><th>Meccs embere</th><th>Hatékonyság</th></tr></thead><tbody>${stats.map(item => `<tr><td><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.teamLabel)}</small></td><td>${item.appearances}</td>${penalties ? `<td>${item.penaltyAttempts}</td><td>${item.penaltyGoals}</td><td>${item.penaltyMisses}</td><td>${item.suddenDeathGoals}</td><td>${item.decisivePenalties}</td>` : `<td>${item.selections}</td><td>${item.duelWins}</td><td>${item.duelDraws}</td><td>${item.duelLosses}</td><td>${escapeHtml(ATTRIBUTE_BY_KEY[item.bestCategory]?.label || item.bestCategory || '–')}</td>`}<td>${item.keyMoments}</td><td>${item.manOfMatchCount}</td><td>${item.efficiency}%</td></tr>`).join('')}</tbody></table></div>`;
};
const awardCard = (state, title, item, metric) => {
  if (!item) return ''; const team = tournamentTeamById(state, item.teamId);
  return `<article class="tournament-award-card"><span class="tournament-award-icon">🏅</span><small>${escapeHtml(title)}</small><div class="tournament-award-person">${item.cardImage ? `<img src="${escapeHtml(item.cardImage)}" alt="">` : teamMark(team, true)}<div><strong>${escapeHtml(item.name || item.label)}</strong><span>${escapeHtml(item.teamLabel || team?.label || '')}</span></div></div><b>${escapeHtml(metric)}</b></article>`;
};
export const awardsView = state => {
  const awards = state.awards ?? calculateTournamentAwards(state).awards;
  const scoringMetric = state.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? `${awards.scoringKing?.penaltyGoals ?? 0} büntetőgól` : `${awards.scoringKing?.duelWins ?? 0} körgyőzelem`;
  return `<div class="tournament-awards">${awardCard(state, 'Torna legjobb játékosa', awards.bestPlayer, `${awards.bestPlayer?.totalPerformance ?? 0} teljesítménypont`)}${awardCard(state, state.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'Büntetőkirály' : 'Gólkirály', awards.scoringKing, scoringMetric)}${awardCard(state, 'Legtöbb megnyert párharc', awards.duelKing, `${awards.duelKing?.duelWins ?? 0} párharc`)}${awardCard(state, 'Legjobb csapatkapitány', awards.bestCaptain, `${awards.bestCaptain?.captainAppearances ?? 0} kapitányi szereplés`)}${awardCard(state, 'Meglepetésember', awards.surprisePlayer, `${awards.surprisePlayer?.efficiency ?? 0}% hatékonyság`)}${awardCard(state, 'Legeredményesebb csapat', awards.bestTeam, `${awards.bestTeam?.wins ?? 0} győzelem`)}</div>`;
};
export const cardSubtitle = card => [card?.position || card?.meta?.position, card?.club, card?.nationality].filter(Boolean).join(' · ');
export const cardDetails = card => { const stats = card?.stats ?? {}; return `<dl><div><dt>Poszt</dt><dd>${escapeHtml(card?.position || card?.meta?.position || 'Nincs adat')}</dd></div><div><dt>Mérkőzés</dt><dd>${Number(stats.appearances) || 0}</dd></div><div><dt>Gól</dt><dd>${Number(stats.goals) || 0}</dd></div><div><dt>Gólpassz</dt><dd>${Number(stats.assists) || 0}</dd></div><div><dt>Sárga lap</dt><dd>${Number(stats.yellowCards) || 0}</dd></div></dl>`; };
