/**
 * Fociskártyák 2026 – Torna mód élmény- és információsűrűség-frissítés.
 *
 * A modul a meglévő torna-domainre, mentési szolgáltatásra és mérkőzésindításra
 * épül. Nem módosítja a továbbjutási szabályokat vagy az eredményszámítást.
 */

import {
  FLOW_VERSION,
  MINIMUM_CARDS,
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_STATUS,
  closeTournamentLayers,
  createTournament,
  deckRuntime,
  difficultyLabel,
  escapeHtml,
  formatLabel,
  makePanel,
  matchModeLabel,
  players,
  runtime,
  safeTournamentName,
  saveAndVerifyTournament,
  selectParticipants,
  showPanel,
  tournamentMatches,
  tournamentNextHumanMatch,
  tournamentProgress,
  tournamentRoundForMatch,
  tournamentStorageService,
  tournamentTeamById,
} from './tournament-flow-shared.js';

const EXPERIENCE_VERSION = 2;
const STYLE_ID = 'tournament-experience-v2-style';
const DRAFT_KEY = 'fociskartyak:tournament-draft:v2';
const TEAM_SOURCE = Object.freeze({
  HUNGARIAN: 'hungarian',
  LEAGUE: 'league',
  NATIONAL: 'national',
});
const LOCATION = Object.freeze({
  HUNGARY: 'hungary',
  INTERNATIONAL: 'international',
  CUSTOM: 'custom',
});
const OPPONENT_MODE = Object.freeze({
  RANDOM: 'random',
  MANUAL: 'manual',
  MIXED: 'mixed',
});

const TOURNAMENTS = Object.freeze({
  'hungarian-league': Object.freeze({
    key: 'hungarian-league',
    location: LOCATION.HUNGARY,
    title: 'Magyar Bajnokság',
    description: 'Teljes hazai bajnoki idény, minden ellenféllel egy mérkőzés.',
    shortFormat: '12 csapat · bajnoki rendszer',
    category: TOURNAMENT_CATEGORY.HUNGARIAN,
    teamSource: TEAM_SOURCE.HUNGARIAN,
    format: TOURNAMENT_FORMAT.LEAGUE,
    count: 12,
    trophyStyle: 'shield',
    trophyAccent: 'gold',
    trophyPattern: 'stadium',
  }),
  'hungarian-cup': Object.freeze({
    key: 'hungarian-cup',
    location: LOCATION.HUNGARY,
    title: 'Magyar Kupa',
    description: 'Kieséses hazai kupasorozat, külön döntőfelvezetéssel.',
    shortFormat: '12 csapat · kieséses rendszer',
    category: TOURNAMENT_CATEGORY.HUNGARIAN,
    teamSource: TEAM_SOURCE.HUNGARIAN,
    format: TOURNAMENT_FORMAT.KNOCKOUT,
    count: 12,
    trophyStyle: 'classic',
    trophyAccent: 'bronze',
    trophyPattern: 'rays',
  }),
  'world-cup': Object.freeze({
    key: 'world-cup',
    location: LOCATION.INTERNATIONAL,
    title: 'Nemzetközi Kupa',
    description: 'Nagyszabású csoportkör és kieséses szakasz válogatottakkal.',
    shortFormat: '8 csapat · csoportkör és kiesés',
    category: TOURNAMENT_CATEGORY.NATIONS,
    teamSource: TEAM_SOURCE.NATIONAL,
    format: TOURNAMENT_FORMAT.GROUP_KNOCKOUT,
    count: 8,
    trophyStyle: 'orb',
    trophyAccent: 'silver',
    trophyPattern: 'stars',
  }),
  custom: Object.freeze({
    key: 'custom',
    location: LOCATION.CUSTOM,
    title: 'Saját kupa',
    description: 'Egyedi név, mezőny, formátum és saját tervezésű serleg.',
    shortFormat: '4–16 csapat · személyre szabható',
    category: TOURNAMENT_CATEGORY.HUNGARIAN,
    teamSource: TEAM_SOURCE.HUNGARIAN,
    format: TOURNAMENT_FORMAT.KNOCKOUT,
    count: 4,
    trophyStyle: 'modern',
    trophyAccent: 'emerald',
    trophyPattern: 'none',
  }),
});

const LOCATION_LABELS = Object.freeze({
  [LOCATION.HUNGARY]: 'Magyarország',
  [LOCATION.INTERNATIONAL]: 'Nemzetközi',
  [LOCATION.CUSTOM]: 'Saját',
});

const TROPHY_STYLES = Object.freeze([
  Object.freeze({ key: 'classic', label: 'Klasszikus serleg' }),
  Object.freeze({ key: 'shield', label: 'Bajnoki pajzs' }),
  Object.freeze({ key: 'orb', label: 'Nemzetközi gömbserleg' }),
  Object.freeze({ key: 'modern', label: 'Modern kupa' }),
]);

const TROPHY_ACCENTS = Object.freeze([
  Object.freeze({ key: 'gold', label: 'Arany' }),
  Object.freeze({ key: 'silver', label: 'Ezüst' }),
  Object.freeze({ key: 'bronze', label: 'Bronz' }),
  Object.freeze({ key: 'emerald', label: 'Smaragd' }),
  Object.freeze({ key: 'crimson', label: 'Bíbor' }),
]);

const TROPHY_PATTERNS = Object.freeze([
  Object.freeze({ key: 'none', label: 'Letisztult' }),
  Object.freeze({ key: 'stadium', label: 'Stadionfény' }),
  Object.freeze({ key: 'rays', label: 'Fénysugarak' }),
  Object.freeze({ key: 'stars', label: 'Csillagmező' }),
]);

const text = value => String(value ?? '').trim();
const fold = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU').replace(/[^a-z0-9]+/g, ' ').trim();
const initials = value => text(value).split(/\s+/).filter(Boolean).slice(0, 3)
  .map(word => word[0]).join('').toUpperCase() || 'FK';

function ensureExperienceStyle() {
  if (document.getElementById(STYLE_ID) || document.querySelector('[data-standalone-tournament-experience-v2]')) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tournament-experience-v2.css', import.meta.url).href;
  document.head.appendChild(link);
}

function readDraft() {
  try {
    const raw = globalThis.localStorage?.getItem(DRAFT_KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value?.experienceVersion === EXPERIENCE_VERSION ? value : null;
  } catch {
    return null;
  }
}

function saveDraft(draft) {
  try {
    globalThis.localStorage?.setItem(DRAFT_KEY, JSON.stringify({ ...draft, experienceVersion: EXPERIENCE_VERSION }));
  } catch {
    // A privát böngészési mód nem blokkolhatja a tornaválasztást.
  }
}

function clearDraft() {
  try { globalThis.localStorage?.removeItem(DRAFT_KEY); } catch { /* best effort */ }
}

function presetFor(type) {
  return TOURNAMENTS[type] ?? TOURNAMENTS['hungarian-league'];
}

function initialDraft(type = 'hungarian-league') {
  const preset = presetFor(type);
  return {
    experienceVersion: EXPERIENCE_VERSION,
    location: preset.location,
    type: preset.key,
    teamSource: preset.teamSource,
    category: preset.category,
    format: preset.format,
    count: preset.count,
    humanTeamId: '',
    participantIds: [],
    opponentMode: OPPONENT_MODE.RANDOM,
    matchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
    difficulty: 'medium',
    lineupMode: 'own',
    name: preset.title,
    trophyStyle: preset.trophyStyle,
    trophyAccent: preset.trophyAccent,
    trophyPattern: preset.trophyPattern,
    teamIndex: 0,
    candidateIndex: 0,
  };
}

function applyTournament(draft, type) {
  const preset = presetFor(type);
  const previousDifficulty = draft.difficulty;
  const previousMatchMode = draft.matchMode;
  Object.assign(draft, initialDraft(type));
  draft.difficulty = previousDifficulty ?? 'medium';
  draft.matchMode = previousMatchMode ?? TOURNAMENT_MATCH_MODE.CLASSIC;
  saveDraft(draft);
}

function quickMatchCatalog() {
  return deckRuntime.buildQuickMatchCatalog(players());
}

function teamsForSource(source) {
  const catalog = quickMatchCatalog();
  if (source === TEAM_SOURCE.LEAGUE) {
    return deckRuntime.quickMatchEntriesForCategory(catalog, deckRuntime.QUICK_MATCH_CATEGORY.LEAGUE);
  }
  if (source === TEAM_SOURCE.NATIONAL) {
    return [
      ...deckRuntime.quickMatchEntriesForCategory(catalog, deckRuntime.QUICK_MATCH_CATEGORY.NATIONAL),
      ...deckRuntime.quickMatchEntriesForCategory(catalog, deckRuntime.QUICK_MATCH_CATEGORY.FEDERATION),
    ];
  }
  return deckRuntime.quickMatchEntriesForCategory(catalog, deckRuntime.QUICK_MATCH_CATEGORY.HUNGARIAN);
}

function usableTeamsForSource(source) {
  return [...new Map(teamsForSource(source).map(team => [team.id, team])).values()]
    .filter(team => team.usable && Number(team.count) >= MINIMUM_CARDS)
    .sort((a, b) => text(a.label).localeCompare(text(b.label), 'hu-HU'));
}

function domainCategoryForSource(source) {
  return source === TEAM_SOURCE.HUNGARIAN ? TOURNAMENT_CATEGORY.HUNGARIAN : TOURNAMENT_CATEGORY.NATIONS;
}

function tournamentOptionsForLocation(location) {
  return Object.values(TOURNAMENTS).filter(item => item.location === location);
}

function locationDefaultType(location) {
  return tournamentOptionsForLocation(location)[0]?.key ?? 'hungarian-league';
}

function stepList(draft) {
  return draft.type === 'custom'
    ? [['type', 'Tornaválasztás'], ['team', 'Csapatválasztás'], ['custom', 'Torna beállításai'], ['summary', 'Összefoglaló']]
    : [['type', 'Tornaválasztás'], ['team', 'Csapatválasztás'], ['summary', 'Összefoglaló']];
}

function trophyMarkup(presentation = {}, compact = false) {
  const style = presentation.style ?? presentation.trophyStyle ?? 'classic';
  const accent = presentation.accent ?? presentation.trophyAccent ?? 'gold';
  const className = compact ? 'tx-trophy tx-trophy--compact' : 'tx-trophy';
  return `<span class="${className}" data-style="${escapeHtml(style)}" data-accent="${escapeHtml(accent)}" aria-hidden="true"><span class="tx-trophy__cup"></span><span class="tx-trophy__stem"></span><span class="tx-trophy__base"></span></span>`;
}

function trophyPresentation(draft) {
  return {
    style: draft.trophyStyle,
    accent: draft.trophyAccent,
    pattern: draft.trophyPattern,
  };
}

function teamMark(team, className = 'tx-team-mark') {
  const image = team?.badge
    ? `<img src="${escapeHtml(team.badge)}" alt="" loading="lazy">`
    : escapeHtml(team?.icon || team?.flag || initials(team?.label));
  return `<span class="${className}" aria-hidden="true">${image}</span>`;
}

function headerMarkup(draft, step, exitLabel = 'Kilépés') {
  const steps = stepList(draft);
  const current = steps.findIndex(([key]) => key === step);
  return `<header class="tx-header"><div class="tx-header__top"><div><p class="eyebrow">Torna mód</p><h1>${escapeHtml(steps[current]?.[1] ?? 'Tornaválasztás')}</h1></div><button class="btn btn--ghost" type="button" data-exit>${escapeHtml(exitLabel)}</button></div><div class="tx-stepper" aria-label="Torna létrehozásának lépései">${steps.map(([key, label], index) => `<span class="tx-step ${index === current ? 'is-active' : index < current ? 'is-complete' : ''}" aria-current="${key === step ? 'step' : 'false'}"><b>${index < current ? '✓' : index + 1}</b><span>${escapeHtml(label)}</span></span>`).join('')}</div></header>`;
}

function estimatedMatches(format, count) {
  if (format === TOURNAMENT_FORMAT.LEAGUE) return count * (count - 1) / 2;
  if (format === TOURNAMENT_FORMAT.KNOCKOUT) return Math.max(0, count - 1);
  const groupSize = 4;
  const groups = Math.max(2, count / groupSize);
  const knockoutTeams = Math.max(4, 2 ** Math.floor(Math.log2(Math.max(4, count - 1))));
  return groups * (groupSize * (groupSize - 1) / 2) + knockoutTeams - 1;
}

function estimatedRounds(format, count) {
  if (format === TOURNAMENT_FORMAT.LEAGUE) return Math.max(1, count - 1);
  if (format === TOURNAMENT_FORMAT.KNOCKOUT) return Math.max(1, Math.ceil(Math.log2(count)));
  return 3 + Math.max(2, Math.ceil(Math.log2(Math.max(4, count / 2))));
}

function supportedCustomCounts(draft, poolLength) {
  const candidates = draft.format === TOURNAMENT_FORMAT.LEAGUE ? [4, 6, 8, 10, 12, 16]
    : draft.format === TOURNAMENT_FORMAT.KNOCKOUT ? [4, 8, 16]
      : [8, 12, 16];
  return candidates.filter(count => count <= poolLength && (draft.format !== TOURNAMENT_FORMAT.GROUP_KNOCKOUT || count % 4 === 0));
}

function normaliseParticipantIds(draft, pool) {
  const valid = new Set(pool.map(team => team.id));
  const unique = [...new Set((draft.participantIds ?? []).filter(id => valid.has(id)))];
  draft.participantIds = draft.humanTeamId
    ? [draft.humanTeamId, ...unique.filter(id => id !== draft.humanTeamId)].slice(0, draft.count)
    : unique.slice(0, draft.count);
}

function participantsForDraft(draft) {
  const pool = usableTeamsForSource(draft.teamSource);
  const human = pool.find(team => team.id === draft.humanTeamId);
  if (!human) return [];
  normaliseParticipantIds(draft, pool);
  if (draft.type !== 'custom' || draft.opponentMode === OPPONENT_MODE.RANDOM) {
    return selectParticipants(pool, draft.count, human.id, []);
  }
  if (draft.opponentMode === OPPONENT_MODE.MANUAL) {
    return draft.participantIds.map(id => pool.find(team => team.id === id)).filter(Boolean).slice(0, draft.count);
  }
  return selectParticipants(pool, draft.count, human.id, draft.participantIds);
}

function validationErrors(draft) {
  const preset = presetFor(draft.type);
  const pool = usableTeamsForSource(draft.teamSource);
  const participants = participantsForDraft(draft);
  const errors = [];
  if (!preset) errors.push('Nincs kiválasztott torna.');
  if (!pool.some(team => team.id === draft.humanTeamId)) errors.push('Nincs kiválasztott használható saját csapat.');
  if (!Number.isInteger(Number(draft.count)) || Number(draft.count) < 4) errors.push('A résztvevők száma nem érvényes.');
  if (participants.length !== draft.count) errors.push('A mezőny még nem teljes.');
  if (new Set(participants.map(team => team.id)).size !== participants.length) errors.push('Ugyanaz a csapat többször szerepel.');
  if (draft.type === 'custom' && draft.opponentMode === OPPONENT_MODE.MANUAL && draft.participantIds.length !== draft.count) {
    errors.push('Kézi kiválasztásnál minden résztvevőt meg kell adni.');
  }
  return errors;
}

function createConfiguredTournament(draft) {
  const participants = participantsForDraft(draft);
  const fallbackName = presetFor(draft.type).title;
  const category = domainCategoryForSource(draft.teamSource);
  const base = createTournament({
    name: safeTournamentName(draft.name, fallbackName),
    category,
    format: draft.format,
    matchMode: draft.matchMode,
    participants,
    humanTeamId: draft.humanTeamId,
    difficulty: draft.difficulty,
  });
  return {
    ...base,
    tournamentType: draft.type,
    setupVersion: FLOW_VERSION,
    experienceVersion: EXPERIENCE_VERSION,
    configuration: {
      lineupMode: draft.lineupMode,
      autoSimulateAi: true,
      participantCount: draft.count,
      lockedStructure: draft.type !== 'custom',
      opponentMode: draft.opponentMode,
      teamSource: draft.teamSource,
      trophy: trophyPresentation(draft),
      drawPresented: false,
    },
  };
}

function showDrawScene(state, returnPanel) {
  const node = makePanel('tournament-experience-v2 tx-draw');
  const presentation = state.configuration?.trophy ?? {};
  const firstRound = state.rounds?.find(round => Array.isArray(round.matches) && round.matches.length) ?? null;
  const matches = firstRound?.matches ?? tournamentMatches(state).slice(0, Math.max(1, Math.min(8, state.teams?.length ?? 4)));
  let revealIndex = 0;
  let completed = false;
  let timer = 0;

  const pairMarkup = match => {
    const home = tournamentTeamById(state, match.homeId);
    const away = tournamentTeamById(state, match.awayId);
    const human = [match.homeId, match.awayId].includes(state.humanTeamId);
    return `<div class="tx-draw__pair ${human ? 'is-human' : ''}" data-draw-pair><span>${escapeHtml(home?.label || 'Később dől el')}</span><b>–</b><span>${escapeHtml(away?.label || 'Később dől el')}</span></div>`;
  };

  const finish = () => {
    if (completed) return;
    completed = true;
    globalThis.clearTimeout?.(timer);
    node.querySelectorAll('[data-draw-pair]').forEach(pair => pair.classList.add('is-revealed'));
    node.querySelector('[data-draw-status]')?.removeAttribute('hidden');
    const continueButton = node.querySelector('[data-continue]');
    if (continueButton) continueButton.disabled = false;
    const skipButton = node.querySelector('[data-skip]');
    if (skipButton) skipButton.hidden = true;
    try {
      saveAndVerifyTournament({
        ...state,
        configuration: { ...(state.configuration ?? {}), drawPresented: true },
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[tournament-experience-v2] A sorsolás állapota nem menthető:', error);
    }
  };

  const revealNext = () => {
    const pairs = [...node.querySelectorAll('[data-draw-pair]')];
    if (revealIndex >= pairs.length) { finish(); return; }
    pairs[revealIndex]?.classList.add('is-revealed');
    revealIndex += 1;
    timer = globalThis.setTimeout?.(revealNext, 360) ?? 0;
  };

  node.innerHTML = `${headerMarkup({ type: state.tournamentType ?? 'custom' }, 'summary', 'Sorsolás átugrása')}<p class="eyebrow">${state.format === TOURNAMENT_FORMAT.LEAGUE ? 'Mérkőzéssorrend' : 'Tornasorsolás'}</p><h1>${state.format === TOURNAMENT_FORMAT.LEAGUE ? 'A fordulók összeállítása' : 'A párosítások elkészülnek'}</h1><div class="tx-draw__stage">${trophyMarkup(presentation)}<div class="tx-draw__pairs">${matches.map(pairMarkup).join('')}</div></div><p class="tx-draw__complete" data-draw-status hidden>Elkészült a torna sorsolása</p><div class="tx-actions"><button class="btn btn--ghost" type="button" data-skip>Sorsolás átugrása</button><button class="btn tx-actions__primary" type="button" data-continue disabled>Tovább a tornához</button></div>`;
  node.querySelectorAll('[data-exit],[data-skip]').forEach(button => button.addEventListener('click', finish));
  node.querySelector('[data-continue]')?.addEventListener('click', () => {
    const latest = tournamentStorageService.read() ?? state;
    runtime.wizard = null;
    globalThis.FociskartyakTournament?.showCenter?.(latest, returnPanel);
  });
  showPanel(node);
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduceMotion || matches.length === 0) finish();
  else timer = globalThis.setTimeout?.(revealNext, 220) ?? 0;
}

export {
  EXPERIENCE_VERSION, DRAFT_KEY, TEAM_SOURCE, LOCATION, OPPONENT_MODE, TOURNAMENTS,
  LOCATION_LABELS, TROPHY_STYLES, TROPHY_ACCENTS, TROPHY_PATTERNS,
  FLOW_VERSION, MINIMUM_CARDS, TOURNAMENT_CATEGORY, TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE, TOURNAMENT_STATUS, closeTournamentLayers, createTournament,
  deckRuntime, difficultyLabel, escapeHtml, formatLabel, makePanel, matchModeLabel,
  players, runtime, safeTournamentName, saveAndVerifyTournament, selectParticipants,
  showPanel, tournamentMatches, tournamentNextHumanMatch, tournamentProgress,
  tournamentRoundForMatch, tournamentStorageService, tournamentTeamById,
  text, fold, initials, ensureExperienceStyle, readDraft, saveDraft, clearDraft,
  presetFor, initialDraft, applyTournament, usableTeamsForSource, domainCategoryForSource,
  tournamentOptionsForLocation, locationDefaultType, stepList, trophyMarkup,
  trophyPresentation, teamMark, headerMarkup, estimatedMatches, estimatedRounds,
  supportedCustomCounts, participantsForDraft, validationErrors,
  createConfiguredTournament, showDrawScene,
};
