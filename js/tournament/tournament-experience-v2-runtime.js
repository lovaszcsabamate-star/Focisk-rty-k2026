/** Torna menü-, központ-, forduló-, statisztika- és lezárásélmény. */

import { ATTRIBUTE_BY_KEY } from '../data/players.js';
import { UI } from '../ui.js';
import {
  TOURNAMENT_MATCH_STATUS,
  tournamentMatchById,
  tournamentMatches,
} from './tournament-domain.js';
import {
  EXPERIENCE_VERSION, TOURNAMENT_FORMAT, TOURNAMENT_STATUS, escapeHtml, fold, presetFor,
  trophyMarkup, tournamentNextHumanMatch, tournamentRoundForMatch,
  tournamentTeamById, tournamentProgress, tournamentStorageService,
  ensureExperienceStyle,
} from './tournament-experience-v2-shared.js';
import { showExperienceWizard } from './tournament-experience-v2-wizard.js';

export const TOURNAMENT_STATISTICS_VERSION = 1;
export const TOURNAMENT_STATISTICS_MIN_DUELS = 3;
const TOURNAMENT_STATISTICS_HOOK = '__fociskartyakTournamentStatisticsHook';
const TOURNAMENT_STATISTICS_STYLE_ID = 'tournament-statistics-v1-style';
const tournamentStatisticsText = value => String(value ?? '').trim();
const tournamentStatisticsClone = value => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const tournamentStatisticsSegments = state => Object.values(state?.tournamentAnalytics?.segments ?? {})
  .filter(segment => segment && typeof segment === 'object');

const normaliseTournamentLineup = lineup => (Array.isArray(lineup) ? lineup : []).map(item => ({
  playerId: tournamentStatisticsText(item?.playerId),
  name: tournamentStatisticsText(item?.name || item?.playerId),
})).filter(item => item.playerId);

const normaliseTournamentDuel = duel => {
  const id = tournamentStatisticsText(duel?.id);
  const humanPlayerId = tournamentStatisticsText(duel?.humanPlayerId);
  const attribute = tournamentStatisticsText(duel?.attribute);
  const outcome = tournamentStatisticsText(duel?.outcome);
  if (!id || !humanPlayerId || !attribute || !['win', 'draw', 'loss'].includes(outcome)) return null;
  return {
    id,
    round: Math.max(1, Number(duel?.round) || 1),
    attribute,
    outcome,
    humanPlayerId,
    humanPlayerName: tournamentStatisticsText(duel?.humanPlayerName || humanPlayerId),
    aiPlayerId: tournamentStatisticsText(duel?.aiPlayerId),
    aiPlayerName: tournamentStatisticsText(duel?.aiPlayerName),
  };
};

const tournamentStatisticsSegmentId = payload => `${tournamentStatisticsText(payload?.matchId)}:${payload?.tiebreak ? 'tiebreak' : 'regular'}:${payload?.penaltyMatch ? 'penalties' : 'classic'}`;

export function tournamentPlayerStatistics(state) {
  const rows = new Map();
  const rowFor = (playerId, name = playerId) => {
    if (!rows.has(playerId)) {
      rows.set(playerId, {
        playerId,
        name: tournamentStatisticsText(name) || playerId,
        matchIds: new Set(),
        penaltyMatchIds: new Set(),
        matchOutcomes: new Map(),
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      });
    }
    const row = rows.get(playerId);
    if (!row.name && name) row.name = tournamentStatisticsText(name);
    return row;
  };

  for (const segment of tournamentStatisticsSegments(state)) {
    const matchId = tournamentStatisticsText(segment.matchId);
    const outcome = ['win', 'draw', 'loss'].includes(segment.humanOutcome) ? segment.humanOutcome : null;
    for (const player of normaliseTournamentLineup(segment.lineup)) {
      const row = rowFor(player.playerId, player.name);
      if (matchId) row.matchIds.add(matchId);
      if (matchId && segment.penaltyMatch) row.penaltyMatchIds.add(matchId);
      if (matchId && outcome) row.matchOutcomes.set(matchId, outcome);
    }
    for (const rawDuel of Array.isArray(segment.duels) ? segment.duels : []) {
      const duel = normaliseTournamentDuel(rawDuel);
      if (!duel) continue;
      const row = rowFor(duel.humanPlayerId, duel.humanPlayerName);
      if (matchId) row.matchIds.add(matchId);
      row.played += 1;
      row.wins += duel.outcome === 'win' ? 1 : 0;
      row.draws += duel.outcome === 'draw' ? 1 : 0;
      row.losses += duel.outcome === 'loss' ? 1 : 0;
    }
  }

  return [...rows.values()].map(row => {
    const matchOutcomes = [...row.matchOutcomes.values()];
    return {
      playerId: row.playerId,
      name: row.name,
      appearances: row.matchIds.size,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      winRate: row.played ? Math.round(row.wins / row.played * 100) : 0,
      matchWins: matchOutcomes.filter(value => value === 'win').length,
      matchDraws: matchOutcomes.filter(value => value === 'draw').length,
      matchLosses: matchOutcomes.filter(value => value === 'loss').length,
      penaltyMatches: row.penaltyMatchIds.size,
    };
  }).sort((a, b) => b.wins - a.wins || b.played - a.played || b.winRate - a.winRate
    || a.name.localeCompare(b.name, 'hu-HU'));
}

export function tournamentCategoryStatistics(state) {
  const rows = new Map();
  for (const segment of tournamentStatisticsSegments(state)) {
    for (const rawDuel of Array.isArray(segment.duels) ? segment.duels : []) {
      const duel = normaliseTournamentDuel(rawDuel);
      if (!duel) continue;
      const row = rows.get(duel.attribute) ?? {
        attribute: duel.attribute,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      };
      row.played += 1;
      row.wins += duel.outcome === 'win' ? 1 : 0;
      row.draws += duel.outcome === 'draw' ? 1 : 0;
      row.losses += duel.outcome === 'loss' ? 1 : 0;
      rows.set(duel.attribute, row);
    }
  }
  return [...rows.values()].map(row => ({
    ...row,
    winRate: row.played ? Math.round(row.wins / row.played * 100) : 0,
  })).sort((a, b) => b.played - a.played || b.wins - a.wins || a.attribute.localeCompare(b.attribute));
}

export function tournamentTeamStatistics(state) {
  const rows = new Map((state?.participants ?? []).map(team => [team.id, {
    teamId: team.id,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    scored: 0,
    conceded: 0,
    difference: 0,
    points: 0,
    pointsRelevant: false,
  }]));

  for (const match of tournamentMatches(state)) {
    if (match.status !== TOURNAMENT_MATCH_STATUS.COMPLETE) continue;
    const home = rows.get(match.homeId);
    const away = rows.get(match.awayId);
    if (!home || !away) continue;
    const regularHome = Number(match.homeScore) || 0;
    const regularAway = Number(match.awayScore) || 0;
    const tiebreakHome = Number(match.tiebreakScore?.home) || 0;
    const tiebreakAway = Number(match.tiebreakScore?.away) || 0;
    const homeScore = regularHome + tiebreakHome;
    const awayScore = regularAway + tiebreakAway;
    home.played += 1;
    away.played += 1;
    home.scored += homeScore;
    home.conceded += awayScore;
    away.scored += awayScore;
    away.conceded += homeScore;
    const draw = !match.winnerId;
    if (draw) {
      home.draws += 1;
      away.draws += 1;
    } else if (match.winnerId === match.homeId) {
      home.wins += 1;
      away.losses += 1;
    } else if (match.winnerId === match.awayId) {
      away.wins += 1;
      home.losses += 1;
    }
    if (['league', 'group'].includes(match.stage)) {
      home.pointsRelevant = true;
      away.pointsRelevant = true;
      if (draw) {
        home.points += 1;
        away.points += 1;
      } else if (match.winnerId === match.homeId) home.points += 3;
      else if (match.winnerId === match.awayId) away.points += 3;
    }
  }

  return [...rows.values()].map(row => ({
    ...row,
    difference: row.scored - row.conceded,
    winRate: row.played ? Math.round(row.wins / row.played * 100) : 0,
  }));
}

const rebuildLegacyPlayerStats = state => Object.fromEntries(tournamentPlayerStatistics(state).map(row => [row.playerId, {
  playerId: row.playerId,
  name: row.name,
  appearances: row.appearances,
  wins: row.matchWins,
  draws: row.matchDraws,
  losses: row.matchLosses,
  penaltyMatches: row.penaltyMatches,
  duels: row.played,
  duelWins: row.wins,
  duelDraws: row.draws,
  duelLosses: row.losses,
}]));

export function mergeTournamentResultAnalytics(state, payload) {
  if (!state || typeof state !== 'object' || !payload || typeof payload !== 'object') return state;
  if (tournamentStatisticsText(payload.tournamentId) !== tournamentStatisticsText(state.id)) return state;
  const matchId = tournamentStatisticsText(payload.matchId);
  if (!matchId || !tournamentMatchById(state, matchId)) return state;
  const segmentId = tournamentStatisticsSegmentId(payload);
  const next = tournamentStatisticsClone(state);
  const analytics = next.tournamentAnalytics && typeof next.tournamentAnalytics === 'object'
    ? next.tournamentAnalytics
    : {};
  const segments = analytics.segments && typeof analytics.segments === 'object' ? { ...analytics.segments } : {};
  if (!segments[segmentId]) {
    segments[segmentId] = {
      segmentId,
      matchId,
      mode: tournamentStatisticsText(payload.mode) || (payload.penaltyMatch ? 'penalties' : 'classic'),
      humanOutcome: ['win', 'draw', 'loss'].includes(payload.humanOutcome) ? payload.humanOutcome : 'draw',
      penaltyMatch: Boolean(payload.penaltyMatch),
      tiebreak: Boolean(payload.tiebreak),
      lineup: normaliseTournamentLineup(payload.lineup),
      duels: (Array.isArray(payload.duels) ? payload.duels : []).map(normaliseTournamentDuel).filter(Boolean),
      createdAt: tournamentStatisticsText(payload.createdAt),
    };
  }
  next.tournamentAnalytics = {
    version: TOURNAMENT_STATISTICS_VERSION,
    segments,
  };
  next.playerStats = rebuildLegacyPlayerStats(next);
  return next;
}

export function tournamentStatisticsSnapshot(state) {
  const teamRows = tournamentTeamStatistics(state);
  const team = teamRows.find(row => row.teamId === state?.humanTeamId) ?? {
    teamId: state?.humanTeamId ?? '', played: 0, wins: 0, draws: 0, losses: 0,
    scored: 0, conceded: 0, difference: 0, points: 0, pointsRelevant: false, winRate: 0,
  };
  const players = tournamentPlayerStatistics(state);
  const categories = tournamentCategoryStatistics(state);
  const duelSummary = categories.reduce((summary, row) => ({
    played: summary.played + row.played,
    wins: summary.wins + row.wins,
    draws: summary.draws + row.draws,
    losses: summary.losses + row.losses,
  }), { played: 0, wins: 0, draws: 0, losses: 0 });
  const bestWinRate = players.filter(row => row.played >= TOURNAMENT_STATISTICS_MIN_DUELS)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.played - a.played)[0] ?? null;
  return { team, players, categories, duelSummary, bestWinRate };
}

function ensureStatisticsStyle() {
  if (document.getElementById(TOURNAMENT_STATISTICS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOURNAMENT_STATISTICS_STYLE_ID;
  style.textContent = `
    .tx-stats{display:grid;gap:14px}.tx-stats__cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.tx-stats__card{display:grid;gap:3px;min-height:84px;padding:13px;border:1px solid rgba(255,239,183,.16);border-radius:16px;background:linear-gradient(155deg,rgba(255,214,90,.09),rgba(255,255,255,.025));text-align:center}.tx-stats__card strong{color:#fff0ad;font-size:clamp(1.55rem,5vw,2.25rem);line-height:1}.tx-stats__card span{color:#cdbfa9;font-size:.68rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.tx-stats__meta{display:flex;flex-wrap:wrap;gap:7px}.tx-stats__meta span{padding:7px 10px;border:1px solid rgba(255,239,183,.14);border-radius:999px;background:rgba(0,0,0,.18);font-size:.75rem;font-weight:850}.tx-stats__section{display:grid;gap:8px;padding:13px;border:1px solid rgba(255,239,183,.12);border-radius:16px;background:rgba(0,0,0,.14)}.tx-stats__section h3{margin:0}.tx-stats__row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 9px;border-radius:11px;background:rgba(255,255,255,.035)}.tx-stats__row strong,.tx-stats__row small{display:block}.tx-stats__row small{margin-top:2px;color:#c6b79f}.tx-stats__value{color:#fff0ad;font-weight:950;text-align:right}.tx-stats__note{margin:0;color:#c6b79f;font-size:.74rem;line-height:1.4}
    @media(max-width:620px){.tx-stats__cards{grid-template-columns:repeat(2,minmax(0,1fr))}.tx-stats__card{min-height:74px;padding:10px}.tx-stats__row{font-size:.86rem}}
    @media(max-width:340px){.tx-stats__meta{display:grid;grid-template-columns:1fr 1fr}.tx-stats__meta span{text-align:center}}
    @media(forced-colors:active){.tx-stats__card,.tx-stats__section,.tx-stats__row,.tx-stats__meta span{border-color:ButtonText;background:Canvas;color:CanvasText;forced-color-adjust:auto}}
  `;
  document.head.appendChild(style);
}

export function renderTournamentStatistics(state) {
  const snapshot = tournamentStatisticsSnapshot(state);
  const team = snapshot.team;
  const humanTeam = tournamentTeamById(state, state?.humanTeamId);
  const cards = [
    [team.played, 'Lejátszott meccs'],
    [team.wins, 'Győzelem'],
    [`${team.winRate}%`, 'Győzelmi arány'],
    [snapshot.duelSummary.wins, 'Megnyert párbaj'],
  ];
  const playerRows = snapshot.players.slice(0, 5).map((player, index) => `<div class="tx-stats__row"><div><strong>${index + 1}. ${escapeHtml(player.name)}</strong><small>${player.played} párbaj · ${player.draws} döntetlen · ${player.losses} vereség</small></div><div class="tx-stats__value">${player.wins} GY · ${player.winRate}%</div></div>`).join('');
  const categoryRows = snapshot.categories.slice(0, 5).map(row => {
    const attribute = ATTRIBUTE_BY_KEY[row.attribute];
    const label = attribute ? `${attribute.icon ?? ''} ${attribute.label}`.trim() : row.attribute;
    return `<div class="tx-stats__row"><div><strong>${escapeHtml(label)}</strong><small>${row.played} választás · ${row.draws} döntetlen · ${row.losses} vereség</small></div><div class="tx-stats__value">${row.wins} GY · ${row.winRate}%</div></div>`;
  }).join('');
  const rateNote = snapshot.bestWinRate
    ? `Legjobb győzelmi arány legalább ${TOURNAMENT_STATISTICS_MIN_DUELS} párbajjal: ${escapeHtml(snapshot.bestWinRate.name)} – ${snapshot.bestWinRate.winRate}%.`
    : `A győzelmi arány rangsor legalább ${TOURNAMENT_STATISTICS_MIN_DUELS} lejátszott párbaj után jelenik meg.`;
  return `<section class="tx-stats" aria-label="Torna statisztikák"><div class="tx-stats__cards">${cards.map(([value, label]) => `<div class="tx-stats__card"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><div class="tx-stats__meta"><span>${escapeHtml(humanTeam?.label || 'Saját csapat')}</span><span>Párbajpontok: ${team.scored}–${team.conceded}</span><span>Különbség: ${team.difference > 0 ? '+' : ''}${team.difference}</span>${team.pointsRelevant ? `<span>Pontok: ${team.points}</span>` : ''}</div><section class="tx-stats__section"><h3>Legjobb játékosok</h3>${playerRows || '<p class="tournament-empty">Az első lejátszott saját párbaj után jelennek meg a játékosstatisztikák.</p>'}<p class="tx-stats__note">${rateNote}</p></section><section class="tx-stats__section"><h3>Leggyakoribb kategóriák</h3>${categoryRows || '<p class="tournament-empty">Még nincs eltárolt kategória-párbaj. Régebbi mentések ettől továbbra is használhatók.</p>'}</section></section>`;
}

function installTournamentStatisticsResultHook() {
  const previousShowOverlay = UI.prototype.showOverlay;
  if (typeof previousShowOverlay !== 'function' || previousShowOverlay[TOURNAMENT_STATISTICS_HOOK]) return;
  function showTournamentStatisticsOverlay(node) {
    const payload = node?.fociskartyakTournamentResult ?? null;
    const output = previousShowOverlay.call(this, node);
    if (payload?.tournamentId && payload?.matchId) {
      const stored = tournamentStorageService.read();
      const match = stored?.id === payload.tournamentId ? tournamentMatchById(stored, payload.matchId) : null;
      if (stored && match && match.status !== TOURNAMENT_MATCH_STATUS.PENDING) {
        const merged = mergeTournamentResultAnalytics(stored, payload);
        tournamentStorageService.save(merged);
      }
    }
    return output;
  }
  Object.defineProperty(showTournamentStatisticsOverlay, TOURNAMENT_STATISTICS_HOOK, { value: true });
  UI.prototype.showOverlay = showTournamentStatisticsOverlay;
}

function describeResume(state) {
  const next = tournamentNextHumanMatch(state);
  const round = next ? tournamentRoundForMatch(state, next.id) : null;
  const opponentId = next ? (next.homeId === state.humanTeamId ? next.awayId : next.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId);
  return {
    stage: round?.label || state.phase || 'Következő forduló',
    opponent: opponent?.label || '',
    progress: tournamentProgress(state),
  };
}

function patchMenu(panel) {
  if (!panel) return;
  panel.dataset.tournamentExperienceV2 = 'true';
  const button = panel.querySelector('#tournament-mode-btn');
  if (!button) return;
  const stored = tournamentStorageService.read();
  const resume = stored?.status === TOURNAMENT_STATUS.ACTIVE ? describeResume(stored) : null;
  const stateKey = resume
    ? `active:${stored.id}:${stored.updatedAt ?? ''}:${resume.stage}:${resume.opponent}`
    : 'new';
  if (button.dataset.experienceV2 === 'true' && button.dataset.experienceState === stateKey) return;

  const replacement = button.cloneNode(true);
  replacement.dataset.experienceV2 = 'true';
  replacement.dataset.experienceState = stateKey;
  button.replaceWith(replacement);
  panel.querySelector('.tournament-new-button-v2')?.remove();

  if (resume) {
    replacement.innerHTML = `<span>▶ Torna folytatása</span><small>${escapeHtml(stored.name)} · ${escapeHtml(resume.stage)}${resume.opponent ? ` · Következő: ${escapeHtml(resume.opponent)}` : ''}</small>`;
    replacement.addEventListener('click', () => globalThis.FociskartyakTournament?.showCenter?.(tournamentStorageService.read() ?? stored, panel));
    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.className = 'btn btn--ghost tournament-new-button-v2';
    newButton.textContent = '＋ Új torna';
    newButton.addEventListener('click', () => showExperienceWizard(panel, null, 'type'));
    replacement.after(newButton);
  } else {
    replacement.innerHTML = '<span>🏆 Új torna</span><small>Magyarország, nemzetközi vagy saját kupa</small>';
    replacement.addEventListener('click', () => showExperienceWizard(panel, null, 'type'));
  }
}

function stateTrophy(state) {
  return state?.configuration?.trophy ?? {
    style: presetFor(state?.tournamentType).trophyStyle,
    accent: presetFor(state?.tournamentType).trophyAccent,
    pattern: presetFor(state?.tournamentType).trophyPattern,
  };
}

function enhanceBracket(center) {
  const bracket = center?.querySelector('.tournament-bracket');
  if (!bracket || bracket.dataset.experienceV2 === 'true') return;
  bracket.dataset.experienceV2 = 'true';
  const rounds = [...bracket.querySelectorAll('.tournament-bracket__round')];
  if (!rounds.length) return;
  const nav = document.createElement('nav');
  nav.className = 'tx-bracket-round-nav';
  nav.setAttribute('aria-label', 'Fordulóválasztó');
  const selectRound = index => {
    rounds.forEach((round, roundIndex) => round.classList.toggle('is-mobile-active', roundIndex === index));
    [...nav.querySelectorAll('button')].forEach((button, buttonIndex) => {
      button.classList.toggle('is-active', buttonIndex === index);
      button.setAttribute('aria-selected', buttonIndex === index ? 'true' : 'false');
    });
    rounds[index]?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };
  rounds.forEach((round, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = round.querySelector('h3')?.textContent?.trim() || `${index + 1}. forduló`;
    button.addEventListener('click', () => selectRound(index));
    nav.appendChild(button);
  });
  bracket.before(nav);
  selectRound(Math.max(0, rounds.findIndex(round => round.querySelector('.is-human'))));
}

function simplifyCenterOverview(center) {
  const overview = center.querySelector('[data-content="overview"]');
  if (!overview || overview.dataset.experienceV2 === 'true') return;
  overview.dataset.experienceV2 = 'true';
  const selected = overview.querySelector('.tournament-selected-team');
  const heading = overview.querySelector('h2');
  if (heading) heading.textContent = 'Saját csapat állapota';
  overview.querySelectorAll('.tournament-results-list,.tournament-empty').forEach(node => node.remove());
  if (!selected) overview.innerHTML = '<p class="tournament-empty">A következő mérkőzés fent látható.</p>';
}

function enhanceCenter(center) {
  if (!center || center.dataset.experienceV2 === 'true') return;
  const state = tournamentStorageService.read();
  if (!state || state.status !== TOURNAMENT_STATUS.ACTIVE) return;
  center.dataset.experienceV2 = 'true';
  const next = tournamentNextHumanMatch(state);
  const round = next ? tournamentRoundForMatch(state, next.id) : null;
  const progress = tournamentProgress(state);
  const human = tournamentTeamById(state, state.humanTeamId);
  const trophy = stateTrophy(state);
  const status = document.createElement('section');
  status.className = 'tx-center-status';
  status.innerHTML = `${trophyMarkup(trophy, true)}<div><small>${escapeHtml(state.tournamentType === 'custom' ? 'Saját kupa' : presetFor(state.tournamentType).title)}</small><strong>${escapeHtml(state.name)}</strong><span>${escapeHtml(round?.label || state.phase || 'Aktív torna')} · ${escapeHtml(human?.label || '')}</span></div><div class="tx-center-progress"><b>${progress.percent}%</b><span>${progress.completed} mérkőzés kész</span></div>`;
  center.prepend(status);

  const tabs = center.querySelector('.tournament-tabs');
  const overviewButton = tabs?.querySelector('[data-tab="overview"]');
  const resultsButton = tabs?.querySelector('[data-tab="results"]');
  const tableButton = tabs?.querySelector('[data-tab="table"]');
  const bracketButton = tabs?.querySelector('[data-tab="bracket"]');
  const playersButton = tabs?.querySelector('[data-tab="players"]');
  const playersContent = center.querySelector('[data-content="players"]');
  if (overviewButton) overviewButton.textContent = 'Következő mérkőzés';
  if (resultsButton) resultsButton.textContent = 'Eredmények';
  if (playersButton && playersContent) {
    playersButton.textContent = 'Statisztikák';
    playersButton.dataset.tab = 'statistics';
    playersContent.dataset.content = 'statistics';
    playersContent.innerHTML = renderTournamentStatistics(state);
  }
  const structureButton = state.format === TOURNAMENT_FORMAT.LEAGUE || state.phase === 'group' ? tableButton : bracketButton;
  const unusedStructure = structureButton === tableButton ? bracketButton : tableButton;
  if (structureButton) structureButton.textContent = structureButton === tableButton ? 'Tabella' : 'Tornaág';
  unusedStructure?.remove();
  if (tabs && overviewButton && resultsButton) {
    const ordered = [overviewButton, structureButton, resultsButton, playersButton].filter(Boolean);
    tabs.replaceChildren(...ordered);
  }
  simplifyCenterOverview(center);

  const nextCard = center.querySelector('.tournament-next-match');
  if (nextCard && fold(round?.label).includes('donto')) {
    const banner = document.createElement('section');
    banner.className = 'tx-final-banner';
    banner.innerHTML = `${trophyMarkup(trophy, true)}<strong>A döntő következik</strong><span>A kupa egyetlen mérkőzésre van.</span>`;
    nextCard.before(banner);
    const play = nextCard.querySelector('#tournament-play,.tournament-match-intro-trigger');
    if (play) play.textContent = 'Döntő indítása';
  }

  const actions = center.querySelector('.tournament-actions--secondary');
  if (actions) {
    const save = actions.querySelector('#tournament-save');
    const home = actions.querySelector('#tournament-center-home');
    const abandon = actions.querySelector('#tournament-abandon');
    save?.remove();
    const details = document.createElement('details');
    details.className = 'tx-center-secondary';
    details.innerHTML = '<summary>További lehetőségek</summary><div class="tx-center-secondary__actions"></div>';
    const target = details.querySelector('div');
    if (home) target.appendChild(home);
    if (abandon) target.appendChild(abandon);
    actions.replaceWith(details);
  }
  enhanceBracket(center);
}

function enhanceResultPanel(panel) {
  if (!panel || panel.dataset.experienceV2 === 'true' || !panel.classList.contains('result-panel--tournament')) return;
  const state = tournamentStorageService.read();
  if (!state) return;
  panel.dataset.experienceV2 = 'true';
  const next = tournamentNextHumanMatch(state);
  const round = next ? tournamentRoundForMatch(state, next.id) : null;
  const opponentId = next ? (next.homeId === state.humanTeamId ? next.awayId : next.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId);
  const heading = fold(panel.querySelector('h1')?.textContent);
  const won = heading.includes('gyozelem');
  const lost = heading.includes('vereseg');
  const complete = state.status === TOURNAMENT_STATUS.COMPLETE;
  const title = complete
    ? (state.championId === state.humanTeamId ? 'Tornagyőztes!' : 'A torna számodra véget ért')
    : won ? (round?.label ? 'Bejutottál a következő szakaszba!' : 'Győzelemmel folytatod!')
      : lost ? 'A torna számodra véget ért' : 'A forduló lezárult';
  const detail = complete ? 'Nézd meg a végső helyezést és a torna összesítését.'
    : opponent ? `Következő ellenfeled: ${opponent.label}`
      : round?.label ? `Következő szakasz: ${round.label}` : 'A tornaállapot automatikusan elmentve.';
  const transition = document.createElement('section');
  transition.className = 'tx-round-transition';
  transition.innerHTML = `${trophyMarkup(stateTrophy(state), true)}<div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`;
  const actions = panel.querySelector('.result-actions');
  (actions ?? panel.firstElementChild)?.before?.(transition);
}

function enhanceComplete(panel) {
  if (!panel || panel.dataset.experienceV2 === 'true') return;
  const state = tournamentStorageService.read();
  if (!state || state.status !== TOURNAMENT_STATUS.COMPLETE) return;
  panel.dataset.experienceV2 = 'true';
  const champion = tournamentTeamById(state, state.championId);
  const won = state.championId === state.humanTeamId;
  panel.querySelectorAll(':scope > p.eyebrow,:scope > h1').forEach(node => node.remove());
  const hero = document.createElement('section');
  hero.className = 'tx-complete-hero';
  hero.innerHTML = `${trophyMarkup(stateTrophy(state))}<p class="eyebrow">${escapeHtml(state.name)}</p><h1>${won ? 'Tornagyőztes!' : 'A torna véget ért'}</h1><p>${escapeHtml(champion?.label || 'Ismeretlen csapat')} lett a bajnok.</p>`;
  panel.prepend(hero);
  const detailedNodes = [...panel.children].filter(node =>
    node !== hero
    && !node.classList.contains('tournament-actions')
    && !node.classList.contains('tournament-champion')
  );
  if (detailedNodes.length) {
    const details = document.createElement('details');
    details.className = 'tx-complete-details';
    details.innerHTML = '<summary>Részletes tornaeredmények</summary>';
    detailedNodes.forEach(node => details.appendChild(node));
    const actions = panel.querySelector('.tournament-actions');
    if (actions) actions.before(details); else panel.appendChild(details);
  }
  const statistics = document.createElement('section');
  statistics.className = 'tx-complete-statistics';
  statistics.innerHTML = `<h2>Statisztikák</h2>${renderTournamentStatistics(state)}`;
  const actions = panel.querySelector('.tournament-actions');
  if (actions) actions.before(statistics); else panel.appendChild(statistics);
  const newTournament = panel.querySelector('#tournament-new');
  if (newTournament) {
    const replacement = newTournament.cloneNode(true);
    newTournament.replaceWith(replacement);
    replacement.addEventListener('click', () => showExperienceWizard(null, null, 'type'));
  }
}

function refreshExperience() {
  ensureExperienceStyle();
  ensureStatisticsStyle();
  patchMenu(document.querySelector('.menu-panel.mobile-home'));
  enhanceCenter(document.querySelector('.tournament-center'));
  enhanceBracket(document.querySelector('.tournament-center'));
  enhanceResultPanel(document.querySelector('.result-panel--tournament'));
  enhanceComplete(document.querySelector('.tournament-complete'));
}

function installTournamentExperienceV2() {
  ensureExperienceStyle();
  ensureStatisticsStyle();
  installTournamentStatisticsResultHook();
  if (globalThis.__FOCISKARTYAK_TOURNAMENT_EXPERIENCE_V2__) return globalThis.__FOCISKARTYAK_TOURNAMENT_EXPERIENCE_V2__;
  const observer = new MutationObserver(refreshExperience);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis.__FOCISKARTYAK_TOURNAMENT_EXPERIENCE_V2__ = observer;
  globalThis.FociskartyakTournamentExperience = Object.freeze({
    show: returnPanel => showExperienceWizard(returnPanel),
    version: EXPERIENCE_VERSION,
    statisticsVersion: TOURNAMENT_STATISTICS_VERSION,
    refresh: refreshExperience,
  });
  refreshExperience();
  return observer;
}

export { installTournamentExperienceV2, refreshExperience };
