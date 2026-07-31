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

const STYLE_ID = 'tournament-rapid-upgrade-styles';
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
  if (label.includes('donto')) return 1;
  if (label.includes('elodont')) return 2;
  if (label.includes('negyeddont')) return 3;
  if (label.includes('nyolcaddont')) return 4;
  if (label.includes('legjobb 32')) return 5;
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

const ensureStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .tournament-center[data-rapid-upgraded='true']{--tournament-rapid-gold:#ffd65a;--tournament-rapid-cream:#fff2c2}
    .tournament-roadmap{display:grid;gap:12px;margin:14px 0 18px;padding:16px;border:1px solid rgba(255,214,90,.34);border-radius:20px;background:radial-gradient(circle at 10% 20%,rgba(255,214,90,.15),transparent 38%),rgba(26,17,11,.66);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
    .tournament-roadmap__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.tournament-roadmap__top p{margin:0;color:#d9c9ab;font-size:.78rem}.tournament-roadmap__top strong{display:block;margin-top:3px;color:#fff4c9;font-size:1rem}.tournament-roadmap__badge{flex:0 0 auto;padding:6px 10px;border:1px solid rgba(255,214,90,.4);border-radius:999px;background:rgba(255,214,90,.1);color:#ffe47f;font-size:.72rem;font-weight:950}
    .tournament-roadmap__stages{display:flex;align-items:stretch;gap:6px;overflow-x:auto;padding:2px 2px 5px}.tournament-roadmap__stage{position:relative;display:grid;place-items:center;flex:1 0 108px;min-height:46px;padding:7px 9px;border:1px solid rgba(255,239,183,.17);border-radius:12px;background:rgba(0,0,0,.18);color:#d5c5a8;font-size:.7rem;font-weight:900;text-align:center}.tournament-roadmap__stage.is-complete{border-color:rgba(105,194,127,.3);background:rgba(73,145,91,.12);color:#bfe9c9}.tournament-roadmap__stage.is-current{border-color:rgba(255,214,90,.58);background:rgba(255,214,90,.13);color:#fff2b4;box-shadow:0 0 0 1px rgba(255,214,90,.15)}.tournament-roadmap__stage:not(:last-child)::after{content:'›';position:absolute;right:-8px;color:#ffd65a;font-size:18px;z-index:2}
    .tournament-next-match.is-rapid-upgraded{position:relative;overflow:hidden;border-color:rgba(255,214,90,.48);background:radial-gradient(circle at 50% 0,rgba(255,214,90,.17),transparent 45%),linear-gradient(150deg,rgba(66,42,20,.84),rgba(26,17,11,.96));box-shadow:0 20px 46px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.08)}
    .tournament-next-match.is-rapid-upgraded::before{content:'KÖVETKEZIK';position:absolute;top:12px;right:-34px;width:130px;padding:5px 0;background:#ffd65a;color:#26180e;font-size:.58rem;font-weight:1000;letter-spacing:.12em;text-align:center;transform:rotate(35deg);box-shadow:0 4px 12px rgba(0,0,0,.25)}
    .tournament-next-match__stakes{margin:10px auto 4px;max-width:560px;color:#fff0ad;font-weight:900;line-height:1.4;text-align:center}.tournament-autosave-note{display:inline-flex;align-items:center;gap:6px;margin:8px auto 0;padding:5px 9px;border-radius:999px;background:rgba(75,150,93,.13);color:#bfe7c8;font-size:.68rem;font-weight:850}.tournament-autosave-note::before{content:'✓';display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:rgba(91,181,112,.2)}
    .tournament-native-play{display:none!important}.tournament-match-intro-trigger{min-width:min(330px,100%);font-size:1rem;box-shadow:0 12px 26px rgba(0,0,0,.28)}
    .tournament-match-intro{display:grid;gap:18px;max-width:760px;margin:auto;text-align:center}.tournament-match-intro__eyebrow{margin:0;color:#ffd65a;font-size:.72rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.tournament-match-intro h1{margin:0;font-size:clamp(1.8rem,7vw,3.1rem)}.tournament-match-intro__stakes{margin:0;color:#fff0b8;font-size:1rem;font-weight:900}.tournament-match-intro__versus{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:18px;padding:22px;border:1px solid rgba(255,214,90,.36);border-radius:26px;background:radial-gradient(circle at 50% 45%,rgba(255,214,90,.14),transparent 34%),rgba(20,13,9,.68);box-shadow:0 24px 54px rgba(0,0,0,.36)}.tournament-match-intro__team{display:grid;justify-items:center;gap:7px;min-width:0}.tournament-match-intro__team small{color:#bcae96;font-size:.66rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.tournament-match-intro__team strong{max-width:100%;font-size:clamp(.92rem,3.5vw,1.25rem);overflow-wrap:anywhere}.tournament-match-intro__vs{color:#ffd65a;font-size:clamp(1.2rem,5vw,2.2rem);font-weight:1000;text-shadow:0 6px 18px rgba(0,0,0,.45)}
    .tournament-match-intro__facts{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.tournament-match-intro__facts span{padding:7px 11px;border:1px solid rgba(255,239,183,.18);border-radius:999px;background:rgba(255,255,255,.05);color:#e4d6bb;font-size:.72rem;font-weight:850}.tournament-match-intro__actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.tournament-match-intro__actions .btn{min-width:190px}
    .tournament-rapid-team-mark{--tournament-team-hue:28;display:grid;place-items:center;flex:0 0 auto;overflow:hidden;border:2px solid rgba(255,255,255,.78);border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-weight:950;text-shadow:0 1px 3px rgba(0,0,0,.8)}.tournament-rapid-team-mark img{width:100%;height:100%;object-fit:contain;padding:4px;box-sizing:border-box}.tournament-rapid-team-mark--large{width:clamp(78px,20vw,118px);height:clamp(78px,20vw,118px);border-width:4px;font-size:clamp(34px,9vw,58px);box-shadow:0 18px 34px rgba(0,0,0,.42)}.tournament-rapid-team-mark--generated{border-radius:43% 43% 48% 48%/30% 30% 62% 62%;background:linear-gradient(145deg,hsl(var(--tournament-team-hue) 62% 42%),hsl(var(--tournament-team-hue) 58% 25%));font-size:clamp(15px,4vw,24px)}.tournament-rapid-team-mark--icon{background:rgba(255,255,255,.94);color:#111;text-shadow:none}
    .tournament-bracket{scroll-snap-type:x proximity}.tournament-bracket__round{scroll-snap-align:start}.tournament-bracket__match.is-human{outline:2px solid rgba(255,214,90,.52);outline-offset:1px;box-shadow:0 10px 24px rgba(0,0,0,.22),inset 0 0 0 1px rgba(255,214,90,.14)}.tournament-bracket__match.is-human::before{content:'TE';position:absolute;top:5px;right:7px;color:#ffd65a;font-size:.52rem;font-weight:1000;letter-spacing:.08em}.tournament-bracket__match{position:relative}
    .result-panel--tournament[data-rapid-upgraded='true'] .tournament-result-context{display:none}.tournament-match-summary{display:grid;gap:12px;margin:14px 0 18px;padding:16px;border:1px solid rgba(255,214,90,.34);border-radius:19px;background:radial-gradient(circle at 12% 20%,rgba(255,214,90,.14),transparent 38%),rgba(27,18,12,.72);text-align:left}.tournament-match-summary__header{display:flex;align-items:center;justify-content:space-between;gap:10px}.tournament-match-summary__header strong{font-size:1.05rem}.tournament-match-summary__saved{color:#bfe7c8;font-size:.68rem;font-weight:900}.tournament-match-summary__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.tournament-match-summary__item{padding:10px;border:1px solid rgba(255,239,183,.15);border-radius:12px;background:rgba(255,255,255,.04)}.tournament-match-summary__item small,.tournament-match-summary__item strong{display:block}.tournament-match-summary__item small{margin-bottom:4px;color:#b9aa91;font-size:.62rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.tournament-match-summary__item strong{color:#fff2c2;font-size:.82rem;overflow-wrap:anywhere}
    .tournament-continue-button[data-rapid-upgraded='true']{border-color:rgba(255,214,90,.48);background:linear-gradient(135deg,rgba(126,84,28,.88),rgba(75,49,23,.92));box-shadow:0 10px 22px rgba(0,0,0,.24)}.tournament-continue-button[data-rapid-upgraded='true'] small{color:#f1dfb4}
    .tournament-achievement{display:grid;grid-template-columns:60px minmax(0,1fr);align-items:center;gap:14px;margin:15px 0;padding:15px;border:1px solid rgba(255,214,90,.48);border-radius:18px;background:radial-gradient(circle at 10% 30%,rgba(255,214,90,.2),transparent 36%),rgba(57,37,17,.66);text-align:left}.tournament-achievement__icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:rgba(255,214,90,.13);font-size:30px;filter:drop-shadow(0 8px 12px rgba(0,0,0,.34))}.tournament-achievement small,.tournament-achievement strong,.tournament-achievement span{display:block}.tournament-achievement small{color:#ffd65a;font-size:.62rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.tournament-achievement strong{margin:3px 0;font-size:1rem}.tournament-achievement span{color:#d9c9aa;font-size:.76rem}
    @media(max-width:620px){.tournament-roadmap__top{display:grid}.tournament-roadmap__badge{justify-self:start}.tournament-match-intro__versus{grid-template-columns:1fr auto 1fr;gap:8px;padding:15px}.tournament-match-summary__grid{grid-template-columns:1fr}.tournament-match-intro__actions{display:grid}.tournament-match-intro__actions .btn{width:100%;min-width:0}}
    @media(prefers-reduced-motion:reduce){.tournament-next-match.is-rapid-upgraded,.tournament-match-intro-trigger{scroll-behavior:auto}}
  `;
  document.head.appendChild(style);
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
    : Number.isFinite(wins) ? `${wins} győzelem a trófeáig` : 'A következő szakasz következik';
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
  title.textContent = round && fold(round.label).includes('donto') ? 'A KUPÁÉRT' : 'MÉRKŐZÉSRE FEL';
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
  eyebrow.textContent = won ? 'Új profiljelvény' : 'Torna teljesítve';
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
  ensureStyles();
  if (runtime.observer) return runtime.observer;
  runtime.observer = new MutationObserver(schedule);
  runtime.observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
  return runtime.observer;
}

installTournamentRapidUpgrade();
