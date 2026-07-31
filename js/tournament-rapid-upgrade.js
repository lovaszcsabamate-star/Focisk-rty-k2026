/**
 * Gyors tornaélmény-fejlesztés.
 * A meglévő tornaállapotot és meccslogikát nem írja felül: csak a központot,
 * a meccsfelvezetést, az eredményképernyőt és a folytatás jelzését bővíti.
 */

import { tournamentStorageService } from './services/tournament-storage-service.js';
import {
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  tournamentMatches,
  tournamentNextHumanMatch,
  tournamentProgress,
  tournamentTeamById,
} from './tournament/tournament-domain.js';

const ACHIEVEMENT_KEY = 'fociskartyak:tournament-achievements:v1';
const runtime = { observer: null, timer: 0 };

const text = value => String(value ?? '').trim();
const fold = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU').replace(/[^a-z0-9]+/g, ' ').trim();
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const initials = value => text(value).split(/\s+/).filter(Boolean).slice(0, 3)
  .map(word => word[0]).join('').toUpperCase() || 'FK';
const hue = value => [...text(value)].reduce((sum, char) => (sum + char.charCodeAt(0) * 7) % 360, 28);

const difficultyLabel = difficulty => ({
  easy: 'Könnyű',
  medium: 'Normál',
  hard: 'Nehéz',
}[difficulty] ?? 'Normál');

const matchModeLabel = mode => mode === 'penalties' ? 'Büntetőpárbaj' : 'Klasszikus mérkőzés';

const roundForMatch = (state, matchId) => state?.rounds?.find(round =>
  round?.matches?.some(match => match.id === matchId),
) ?? null;

export function tournamentWinsToTrophy(state, match = tournamentNextHumanMatch(state)) {
  if (!state || state.status === TOURNAMENT_STATUS.COMPLETE) return 0;
  if (!match || state.format === TOURNAMENT_FORMAT.LEAGUE) return null;
  const label = fold(roundForMatch(state, match.id)?.label ?? match.label);
  if (state.format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT && state.phase === 'group') return null;
  if (label.includes('legjobb 32')) return 5;
  if (label.includes('nyolcaddont')) return 4;
  if (label.includes('negyeddont')) return 3;
  if (label.includes('elodont')) return 2;
  if (label === 'donto') return 1;
  if (label.includes('1 kor') && state.participants?.length === 12) return 4;

  const pendingKnockoutRounds = (state.rounds ?? []).filter(round =>
    round.stage === 'knockout'
    && round.matches?.some(item => item.status !== TOURNAMENT_MATCH_STATUS.COMPLETE),
  ).length;
  return Math.max(1, pendingKnockoutRounds || 1);
}

export function tournamentStageMessage(state, match = tournamentNextHumanMatch(state)) {
  if (!state || !match) return 'A következő mérkőzés sorsolása folyamatban van.';
  const round = roundForMatch(state, match.id);
  const roundName = text(round?.label || match.label || 'Következő mérkőzés');
  if (state.format === TOURNAMENT_FORMAT.LEAGUE) return `${roundName}: minden pont számít a végső helyezéshez.`;
  if (state.format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT && state.phase === 'group') {
    return `${roundName}: gyűjts pontokat a továbbjutáshoz.`;
  }
  const wins = tournamentWinsToTrophy(state, match);
  if (wins === 1) return `${roundName}: a győztes magasba emeli a kupát.`;
  if (Number.isFinite(wins)) return `${roundName}: még ${wins} győzelem választ el a kupától.`;
  return `${roundName}: a győztes továbbjut.`;
}

const createTeamMark = (team, size = 'normal') => {
  const mark = document.createElement('span');
  mark.className = `tournament-rapid-team-mark tournament-rapid-team-mark--${size}`;
  mark.setAttribute('aria-hidden', 'true');
  if (team?.badge) {
    const image = document.createElement('img');
    image.src = team.badge;
    image.alt = '';
    image.loading = 'lazy';
    mark.appendChild(image);
    return mark;
  }
  if (team?.icon) {
    mark.classList.add('tournament-rapid-team-mark--icon');
    mark.textContent = team.icon;
    return mark;
  }
  mark.classList.add('tournament-rapid-team-mark--generated');
  mark.style.setProperty('--tournament-team-hue', String(hue(team?.label)));
  mark.textContent = initials(team?.label);
  return mark;
};

const createTeam = (team, caption) => {
  const node = document.createElement('div');
  node.className = 'tournament-match-intro__team';
  const small = document.createElement('small');
  small.textContent = caption;
  const strong = document.createElement('strong');
  strong.textContent = team?.label || 'Ismeretlen csapat';
  node.append(createTeamMark(team, 'large'), small, strong);
  return node;
};

const ensureStylesheet = () => {
  if (typeof document === 'undefined' || document.querySelector('link[data-tournament-rapid-upgrade]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../css/tournament-rapid-upgrade.css', import.meta.url).href;
  link.dataset.tournamentRapidUpgrade = 'true';
  document.head.appendChild(link);
};

const roadmapLabels = state => {
  if (state.format === TOURNAMENT_FORMAT.LEAGUE) return ['Rajt', 'Fordulók', 'Hajrá', 'Bajnok'];
  if (state.format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT) return ['Csoportkör', 'Kieséses ág', 'Elődöntő', 'Döntő'];
  const count = Math.max(4, Number(state.participants?.length) || 4);
  if (count <= 4) return ['Elődöntő', 'Döntő'];
  if (count <= 8) return ['Negyeddöntő', 'Elődöntő', 'Döntő'];
  if (count === 12) return ['1. kör', 'Negyeddöntő', 'Elődöntő', 'Döntő'];
  if (count <= 16) return ['Nyolcaddöntő', 'Negyeddöntő', 'Elődöntő', 'Döntő'];
  return ['Legjobb 32', 'Nyolcaddöntő', 'Negyeddöntő', 'Elődöntő', 'Döntő'];
};

const currentRoadmapIndex = (state, labels, match) => {
  if (state.format === TOURNAMENT_FORMAT.LEAGUE) {
    const progress = tournamentProgress(state);
    return clamp(Math.floor((progress.percent / 100) * labels.length), 0, labels.length - 1);
  }
  const label = fold(roundForMatch(state, match?.id)?.label);
  const exact = labels.findIndex(item => fold(item) === label);
  if (exact >= 0) return exact;
  if (state.phase === 'group') return 0;
  if (state.phase === 'knockout') return Math.max(1, labels.findIndex(item => fold(item).includes('kieseses')));
  return 0;
};

const createRoadmap = (state, match) => {
  const section = document.createElement('section');
  section.className = 'tournament-roadmap';
  section.setAttribute('aria-label', 'Tornahaladás');
  const progress = tournamentProgress(state);
  const wins = tournamentWinsToTrophy(state, match);
  const top = document.createElement('div');
  top.className = 'tournament-roadmap__top';
  const copy = document.createElement('div');
  const label = document.createElement('p');
  label.textContent = 'A kupához vezető út';
  const strong = document.createElement('strong');
  strong.textContent = state.format === TOURNAMENT_FORMAT.LEAGUE
    ? `${progress.percent}% teljesítve a bajnokságból`
    : Number.isFinite(wins) ? `${wins} győzelem a trófeáig`
      : state.phase === 'group' ? 'Gyűjts pontokat a továbbjutáshoz' : 'A következő szakasz következik';
  copy.append(label, strong);
  const badge = document.createElement('span');
  badge.className = 'tournament-roadmap__badge';
  badge.textContent = `${progress.completed} / ${progress.total} meccs`;
  top.append(copy, badge);

  const stages = document.createElement('div');
  stages.className = 'tournament-roadmap__stages';
  const labels = roadmapLabels(state);
  const current = currentRoadmapIndex(state, labels, match);
  labels.forEach((stageLabel, index) => {
    const stage = document.createElement('span');
    stage.className = 'tournament-roadmap__stage';
    stage.classList.toggle('is-complete', index < current);
    stage.classList.toggle('is-current', index === current);
    stage.textContent = stageLabel;
    stages.appendChild(stage);
  });
  section.append(top, stages);
  return section;
};

const showMatchIntro = (state, match, originalButton) => {
  const overlay = document.querySelector('#overlay');
  const body = document.querySelector('#overlay-body');
  if (!overlay || !body || !match || !originalButton) return;
  const human = tournamentTeamById(state, state.humanTeamId);
  const opponentId = match.homeId === state.humanTeamId ? match.awayId : match.homeId;
  const opponent = tournamentTeamById(state, opponentId);
  const round = roundForMatch(state, match.id);
  const node = document.createElement('div');
  node.className = 'tournament-panel tournament-match-intro mobile-sheet';
  node.tabIndex = -1;

  const eyebrow = document.createElement('p');
  eyebrow.className = 'tournament-match-intro__eyebrow';
  eyebrow.textContent = `${state.name} · ${round?.label || 'Következő mérkőzés'}`;
  const title = document.createElement('h1');
  title.textContent = round && fold(round.label) === 'donto' ? 'A KUPÁÉRT' : 'MÉRKŐZÉSRE FEL';
  const stakes = document.createElement('p');
  stakes.className = 'tournament-match-intro__stakes';
  stakes.textContent = tournamentStageMessage(state, match);
  const versus = document.createElement('div');
  versus.className = 'tournament-match-intro__versus';
  const vs = document.createElement('span');
  vs.className = 'tournament-match-intro__vs';
  vs.textContent = 'VS';
  versus.append(createTeam(human, 'Saját csapat'), vs, createTeam(opponent, 'Ellenfél'));
  const facts = document.createElement('div');
  facts.className = 'tournament-match-intro__facts';
  [matchModeLabel(state.matchMode), `${difficultyLabel(state.difficulty)} AI`, 'Automatikus mentés'].forEach(value => {
    const item = document.createElement('span');
    item.textContent = value;
    facts.appendChild(item);
  });
  const actions = document.createElement('div');
  actions.className = 'tournament-match-intro__actions';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn--ghost';
  back.textContent = 'Vissza a tornaághoz';
  back.addEventListener('click', () => globalThis.FociskartyakTournament?.showCenter?.(state), { once: true });
  const proceed = document.createElement('button');
  proceed.type = 'button';
  proceed.className = 'btn';
  proceed.textContent = 'Keret összeállítása';
  proceed.addEventListener('click', () => originalButton.click(), { once: true });
  actions.append(back, proceed);
  node.append(eyebrow, title, stakes, versus, facts, actions);
  body.replaceChildren(node);
  overlay.hidden = false;
  requestAnimationFrame(() => proceed.focus({ preventScroll: true }));
};

const decorateCenter = panel => {
  const state = tournamentStorageService.read();
  if (!state || state.status === TOURNAMENT_STATUS.COMPLETE) return;
  const match = tournamentNextHumanMatch(state);
  const signature = `${state.id}|${state.updatedAt}|${match?.id ?? 'none'}`;
  if (panel.dataset.rapidSignature === signature) return;
  panel.dataset.rapidSignature = signature;
  panel.dataset.rapidUpgraded = 'true';

  panel.querySelector('.tournament-roadmap')?.remove();
  const progressLabel = panel.querySelector('.tournament-progress-label');
  progressLabel?.after(createRoadmap(state, match));

  const next = panel.querySelector('.tournament-next-match');
  const originalButton = next?.querySelector('#tournament-play');
  if (next && match && originalButton) {
    next.classList.add('is-rapid-upgraded');
    next.querySelector('.tournament-next-match__stakes')?.remove();
    next.querySelector('.tournament-autosave-note')?.remove();
    next.querySelector('.tournament-match-intro-trigger')?.remove();
    const stakes = document.createElement('p');
    stakes.className = 'tournament-next-match__stakes';
    stakes.textContent = tournamentStageMessage(state, match);
    const autosave = document.createElement('span');
    autosave.className = 'tournament-autosave-note';
    autosave.textContent = 'A torna minden meccs után automatikusan mentődik';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'btn tournament-play tournament-match-intro-trigger';
    trigger.textContent = '▶ Mérkőzés felvezetése';
    trigger.addEventListener('click', () => showMatchIntro(state, match, originalButton), { once: true });
    originalButton.classList.add('tournament-native-play');
    originalButton.before(stakes, autosave, trigger);
  }

  panel.querySelectorAll('.tournament-bracket__match.is-human').forEach(item => item.setAttribute('aria-label', `Saját mérkőzés. ${text(item.textContent)}`));
};

const parseScore = panel => {
  const match = panel.querySelector('.final-score')?.textContent?.match(/JÁTÉKOS\s+(\d+)\s*[–-]\s*(\d+)\s+GÉP/i);
  return match ? { human: Number(match[1]), ai: Number(match[2]) } : null;
};

const decorateResult = panel => {
  const state = tournamentStorageService.read();
  const score = parseScore(panel);
  if (!state || !score || panel.querySelector('.tournament-match-summary')) return;
  panel.dataset.rapidUpgraded = 'true';
  const heading = fold(panel.querySelector('h1')?.textContent);
  const outcome = heading.includes('gyozelem') ? 'Győzelem' : heading.includes('vereseg') ? 'Vereség' : 'Döntetlen';
  const next = tournamentNextHumanMatch(state);
  const nextOpponentId = next ? (next.homeId === state.humanTeamId ? next.awayId : next.homeId) : null;
  const nextOpponent = tournamentTeamById(state, nextOpponentId);
  const nextRound = next ? roundForMatch(state, next.id) : null;
  const summary = document.createElement('section');
  summary.className = 'tournament-match-summary';
  summary.setAttribute('aria-label', 'Tornamérkőzés összefoglaló');
  const header = document.createElement('div');
  header.className = 'tournament-match-summary__header';
  const title = document.createElement('strong');
  title.textContent = `${state.name} · ${outcome}`;
  const saved = document.createElement('span');
  saved.className = 'tournament-match-summary__saved';
  saved.textContent = '✓ Eredmény elmentve';
  header.append(title, saved);
  const grid = document.createElement('div');
  grid.className = 'tournament-match-summary__grid';
  const items = [
    ['Végeredmény', `${score.human}–${score.ai}`],
    ['Következő lépés', state.status === TOURNAMENT_STATUS.COMPLETE ? 'Torna végeredménye' : text(nextRound?.label || 'Torna központ')],
    ['Következő ellenfél', nextOpponent?.label || (state.status === TOURNAMENT_STATUS.COMPLETE ? '—' : 'Sorsolás alatt')],
  ];
  items.forEach(([labelText, value]) => {
    const item = document.createElement('div');
    item.className = 'tournament-match-summary__item';
    const small = document.createElement('small');
    small.textContent = labelText;
    const strong = document.createElement('strong');
    strong.textContent = value;
    item.append(small, strong);
    grid.appendChild(item);
  });
  summary.append(header, grid);
  panel.querySelector('.result-actions')?.before(summary);
};

const decorateMenu = panel => {
  const button = panel.querySelector('.tournament-continue-button');
  const state = tournamentStorageService.read();
  if (!button || !state) return;
  const match = tournamentNextHumanMatch(state);
  const opponentId = match ? (match.homeId === state.humanTeamId ? match.awayId : match.homeId) : null;
  const opponent = tournamentTeamById(state, opponentId);
  const small = button.querySelector('small');
  const signature = `${state.id}|${state.updatedAt}|${match?.id ?? 'complete'}`;
  if (button.dataset.rapidSignature === signature) return;
  button.dataset.rapidSignature = signature;
  button.dataset.rapidUpgraded = 'true';
  if (small && state.status !== TOURNAMENT_STATUS.COMPLETE) {
    small.textContent = opponent
      ? `${state.name} · következik: ${opponent.label}`
      : `${state.name} · a következő ellenfél sorsolása folyamatban`;
  }
};

const readAchievements = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY) || '{}');
    return {
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds.map(String) : [],
      cupWins: Math.max(0, Number(parsed.cupWins) || 0),
      unbeatenWins: Math.max(0, Number(parsed.unbeatenWins) || 0),
    };
  } catch {
    return { completedIds: [], cupWins: 0, unbeatenWins: 0 };
  }
};

const humanWasUnbeaten = state => tournamentMatches(state)
  .filter(match => match.status === TOURNAMENT_MATCH_STATUS.COMPLETE
    && [match.homeId, match.awayId].includes(state.humanTeamId))
  .every(match => match.winnerId === state.humanTeamId || match.winnerId == null);

const registerAchievement = state => {
  const record = readAchievements();
  if (record.completedIds.includes(String(state.id))) return record;
  const won = state.championId === state.humanTeamId;
  const unbeaten = won && humanWasUnbeaten(state);
  const next = {
    completedIds: [...record.completedIds, String(state.id)].slice(-100),
    cupWins: record.cupWins + (won ? 1 : 0),
    unbeatenWins: record.unbeatenWins + (unbeaten ? 1 : 0),
  };
  try { localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(next)); } catch { /* A jutalom nem blokkolhatja a játékot. */ }
  return next;
};

const decorateComplete = panel => {
  const state = tournamentStorageService.read();
  if (!state || state.status !== TOURNAMENT_STATUS.COMPLETE || panel.querySelector('.tournament-achievement')) return;
  const won = state.championId === state.humanTeamId;
  const achievements = registerAchievement(state);
  const card = document.createElement('section');
  card.className = 'tournament-achievement';
  const icon = document.createElement('span');
  icon.className = 'tournament-achievement__icon';
  icon.textContent = won ? '🏅' : '📖';
  const copy = document.createElement('div');
  const eyebrow = document.createElement('small');
  eyebrow.textContent = won ? 'Tornajelvény feloldva' : 'Torna teljesítve';
  const title = document.createElement('strong');
  title.textContent = won ? 'Kupagyőztes' : 'Tornarésztvevő';
  const description = document.createElement('span');
  description.textContent = won
    ? `${achievements.cupWins}. megnyert torna · ${achievements.unbeatenWins} veretlen siker`
    : 'A következő tornán újra harcba szállhatsz a kupáért.';
  copy.append(eyebrow, title, description);
  card.append(icon, copy);
  panel.querySelector('.tournament-actions')?.before(card);
};

const decorateVisibleUi = () => {
  document.querySelectorAll('.tournament-center').forEach(decorateCenter);
  document.querySelectorAll('.result-panel--tournament').forEach(decorateResult);
  document.querySelectorAll('.menu-panel.mobile-home').forEach(decorateMenu);
  document.querySelectorAll('.tournament-complete').forEach(decorateComplete);
};

const schedule = () => {
  globalThis.clearTimeout?.(runtime.timer);
  runtime.timer = globalThis.setTimeout?.(decorateVisibleUi, 25) ?? 0;
};

export function installTournamentRapidUpgrade() {
  if (typeof document === 'undefined') return null;
  ensureStylesheet();
  if (runtime.observer) return runtime.observer;
  runtime.observer = new MutationObserver(schedule);
  runtime.observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
  return runtime.observer;
}

installTournamentRapidUpgrade();
