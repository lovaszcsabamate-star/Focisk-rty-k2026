/**
 * Stadium-style presentation layer for Tournament mode.
 * It only decorates existing tournament screens and never changes tournament state.
 */

import { tournamentStorageService } from '../services/tournament-storage-service.js';
import { tournamentNextHumanMatch, tournamentTeamById } from './tournament-domain.js';

const STYLE_ID = 'tournament-cup-atmosphere-styles';
const LANGUAGE_STORAGE_KEY = 'fociskartyak:language:v1';

const text = value => String(value ?? '').trim();
const fold = value => text(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const initials = value => text(value).split(/\s+/).filter(Boolean).slice(0, 3)
  .map(word => word[0]).join('').toUpperCase();
const hue = value => [...text(value)].reduce((sum, char) => (sum + char.charCodeAt(0) * 11) % 360, 26);

const englishEnabled = () => {
  if (document.documentElement.lang?.toLowerCase().startsWith('en')) return true;
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en'; } catch { return false; }
};
const tr = (hu, en) => englishEnabled() ? en : hu;

const createTeamMark = (team, size = 'medium') => {
  const mark = document.createElement('span');
  mark.className = `cup-atmosphere-mark cup-atmosphere-mark--${size}`;
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
    mark.classList.add('cup-atmosphere-mark--icon');
    mark.textContent = text(team.icon);
    return mark;
  }
  mark.classList.add('cup-atmosphere-mark--generated');
  mark.style.setProperty('--cup-atmosphere-hue', String(hue(team?.label)));
  mark.textContent = initials(team?.label) || 'FK';
  return mark;
};

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .tournament-center.cup-atmosphere-active{position:relative;isolation:isolate}
    .tournament-center.cup-atmosphere-active::before{content:'';position:absolute;z-index:-1;inset:-18px;border-radius:30px;background:radial-gradient(circle at 50% 12%,rgba(255,217,96,.11),transparent 34%),linear-gradient(180deg,rgba(21,49,31,.3),transparent 32%);pointer-events:none}
    .cup-atmosphere-journey{display:grid;gap:10px;margin:14px 0 18px;padding:14px 15px;border:1px solid rgba(255,220,111,.24);border-radius:18px;background:linear-gradient(145deg,rgba(20,38,27,.88),rgba(19,14,10,.92));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 14px 28px rgba(0,0,0,.2)}
    .cup-atmosphere-journey__heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.cup-atmosphere-journey__heading strong{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}.cup-atmosphere-journey__heading span{color:#f8dc75;font-size:.7rem;font-weight:900}
    .cup-atmosphere-journey__track{display:flex;align-items:center;gap:6px;overflow-x:auto;padding:2px 2px 5px;scrollbar-width:thin}.cup-atmosphere-journey__stage{position:relative;display:grid;place-items:center;flex:1 0 106px;min-height:44px;padding:7px 10px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(0,0,0,.2);color:#a9a397;font-size:.7rem;font-weight:850;text-align:center}.cup-atmosphere-journey__stage:not(:last-child)::after{content:'›';position:absolute;right:-8px;color:rgba(255,220,111,.62);font-size:17px}.cup-atmosphere-journey__stage.is-complete{border-color:rgba(114,214,145,.32);background:rgba(62,137,84,.16);color:#c8f0d3}.cup-atmosphere-journey__stage.is-current{border-color:#f8d55f;background:radial-gradient(circle at 50% 0,rgba(255,226,118,.22),transparent 65%),rgba(111,70,18,.3);color:#fff2b4;box-shadow:inset 0 0 0 1px rgba(255,226,118,.2),0 0 22px rgba(255,198,55,.11)}
    .tournament-next-match.cup-atmosphere-match{position:relative;overflow:hidden;padding:clamp(18px,4vw,30px);border:1px solid rgba(255,221,105,.48);border-radius:26px;background:radial-gradient(circle at 50% 120%,rgba(38,129,70,.44),transparent 44%),radial-gradient(circle at 50% 0,rgba(255,222,115,.15),transparent 36%),linear-gradient(155deg,rgba(23,48,31,.98),rgba(14,12,9,.98));box-shadow:0 24px 55px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08)}
    .tournament-next-match.cup-atmosphere-match::before,.tournament-next-match.cup-atmosphere-match::after{content:'';position:absolute;top:-42%;width:42%;height:100%;background:linear-gradient(180deg,rgba(255,245,195,.2),transparent 70%);filter:blur(4px);transform:rotate(17deg);pointer-events:none}.tournament-next-match.cup-atmosphere-match::before{left:-13%}.tournament-next-match.cup-atmosphere-match::after{right:-13%;transform:rotate(-17deg)}
    .cup-atmosphere-crowd{position:absolute;z-index:0;right:0;bottom:0;left:0;height:35%;opacity:.22;background:radial-gradient(circle at 4px 4px,rgba(255,255,255,.65) 0 1px,transparent 1.5px) 0 0/12px 11px,linear-gradient(180deg,transparent,rgba(0,0,0,.8));mask-image:linear-gradient(180deg,transparent,#000 45%);pointer-events:none}.cup-atmosphere-round{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:8px;width:max-content;max-width:100%;margin:0 auto 12px;padding:7px 12px;border:1px solid rgba(255,224,120,.35);border-radius:999px;background:rgba(0,0,0,.34);color:#ffe58d;font-size:.69rem;font-weight:950;letter-spacing:.11em;text-transform:uppercase}.cup-atmosphere-round::before{content:'◆';font-size:.55rem}.tournament-next-match.cup-atmosphere-match>p{display:none}
    .tournament-next-match.cup-atmosphere-match .tournament-versus{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr);align-items:stretch;gap:clamp(9px,3vw,22px);margin:0}.tournament-next-match.cup-atmosphere-match .tournament-versus>div{position:relative;display:grid;grid-template-rows:auto 1fr auto;place-items:center;gap:9px;min-width:0;padding:14px 10px;border:1px solid rgba(255,255,255,.13);border-radius:21px;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(0,0,0,.2));box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}.tournament-next-match.cup-atmosphere-match .tournament-versus>div:first-child{border-color:rgba(111,202,139,.34);background:linear-gradient(180deg,rgba(64,151,91,.15),rgba(0,0,0,.22))}.tournament-next-match.cup-atmosphere-match .tournament-versus>div:last-child{border-color:rgba(231,114,91,.28);background:linear-gradient(180deg,rgba(159,72,54,.13),rgba(0,0,0,.22))}
    .tournament-next-match.cup-atmosphere-match .tournament-versus .tournament-team-mark__image,.tournament-next-match.cup-atmosphere-match .tournament-versus .tournament-team-mark__fallback,.tournament-next-match.cup-atmosphere-match .tournament-versus .tournament-team-mark__generated{width:clamp(72px,18vw,112px)!important;height:clamp(72px,18vw,112px)!important;padding:8px!important;border:3px solid rgba(255,255,255,.82)!important;border-radius:50%!important;clip-path:none!important;background-color:rgba(255,255,255,.94)!important;object-fit:contain;box-sizing:border-box;filter:drop-shadow(0 15px 16px rgba(0,0,0,.38))}.tournament-next-match.cup-atmosphere-match .tournament-versus .tournament-team-mark__generated{display:grid!important;place-items:center!important;background:linear-gradient(145deg,hsl(var(--cup-team-hue,28) 62% 42%),hsl(var(--cup-team-hue,28) 58% 24%))!important;color:#fff;font-size:clamp(.8rem,2vw,1.1rem)}.tournament-next-match.cup-atmosphere-match .tournament-versus strong{max-width:100%;overflow:hidden;color:#fff8e9;font-size:clamp(.82rem,2.5vw,1.12rem);line-height:1.16;text-align:center;text-overflow:ellipsis}.cup-atmosphere-side{color:#bcb5a6;font-size:.62rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cup-atmosphere-side--human{color:#bce9c9}.cup-atmosphere-side--opponent{color:#efc1b7}
    .tournament-next-match.cup-atmosphere-match .tournament-versus>b{display:grid;place-items:center;align-self:center;min-width:0;color:inherit;font-size:inherit}.cup-atmosphere-versus{display:grid;place-items:center;gap:4px}.cup-atmosphere-versus__ball{display:grid;place-items:center;width:58px;height:58px;border:2px solid rgba(255,255,255,.72);border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff,#d9d9d9 58%,#979797);font-size:31px;box-shadow:0 12px 24px rgba(0,0,0,.38);animation:cup-atmosphere-ball 2.25s ease-in-out infinite}.cup-atmosphere-versus__label{color:#ffe38a;font-size:.7rem;font-weight:1000;letter-spacing:.16em;text-shadow:0 2px 8px #000}.cup-atmosphere-stakes{position:relative;z-index:1;margin:15px auto 0;color:#d6c9ad;font-size:.76rem;font-weight:800;text-align:center}.cup-atmosphere-stakes strong{color:#ffe071}.tournament-next-match.cup-atmosphere-match .tournament-play{position:relative;z-index:1;min-width:min(330px,100%);margin:17px auto 0;box-shadow:0 10px 30px rgba(255,191,50,.18);animation:cup-atmosphere-cta 2.4s ease-in-out infinite}
    .tournament-bracket__match{transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.tournament-bracket__match:hover{transform:translateY(-2px);border-color:rgba(255,215,91,.38);box-shadow:0 11px 22px rgba(0,0,0,.22)}.tournament-bracket-team .cup-experience-team-mark,.tournament-bracket-team .cup-atmosphere-mark{background-color:rgba(255,255,255,.92)}
    .tournament-complete.cup-atmosphere-complete{position:relative;overflow:hidden;text-align:center;background:radial-gradient(circle at 50% 22%,rgba(255,222,91,.17),transparent 31%),linear-gradient(180deg,rgba(49,35,15,.68),transparent 48%)}.tournament-complete.cup-atmosphere-complete .tournament-trophy{position:relative;z-index:2;filter:drop-shadow(0 20px 20px rgba(0,0,0,.45)) drop-shadow(0 0 24px rgba(255,214,74,.28))}.tournament-complete.cup-atmosphere-complete .tournament-champion{position:relative;z-index:2;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;width:min(560px,100%);margin:18px auto;padding:18px;border:1px solid rgba(255,224,112,.45);border-radius:23px;background:linear-gradient(145deg,rgba(113,74,22,.35),rgba(19,14,10,.82));box-shadow:0 20px 45px rgba(0,0,0,.32)}.tournament-complete.cup-atmosphere-complete .tournament-champion .tournament-team-mark__image,.tournament-complete.cup-atmosphere-complete .tournament-champion .tournament-team-mark__fallback,.tournament-complete.cup-atmosphere-complete .tournament-champion .tournament-team-mark__generated{width:92px!important;height:92px!important;padding:8px!important;border:4px solid #ffe584!important;border-radius:50%!important;clip-path:none!important;background-color:#fff!important;object-fit:contain;box-sizing:border-box;filter:drop-shadow(0 13px 16px rgba(0,0,0,.38))}.cup-atmosphere-champion-ribbon{position:relative;z-index:2;display:inline-flex;align-items:center;gap:8px;margin:0 auto 5px;padding:7px 14px;border:1px solid rgba(255,225,119,.42);border-radius:999px;background:rgba(79,51,15,.7);color:#ffe994;font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cup-atmosphere-confetti{position:absolute;z-index:1;inset:0;overflow:hidden;pointer-events:none}.cup-atmosphere-confetti i{position:absolute;top:-12%;left:var(--x);width:7px;height:13px;border-radius:2px;background:hsl(var(--h) 82% 61%);opacity:.9;transform:rotate(var(--r));animation:cup-atmosphere-confetti var(--d) linear var(--delay) infinite}
    .cup-atmosphere-mark{--cup-atmosphere-hue:28;display:grid;place-items:center;overflow:hidden;border:2px solid rgba(255,255,255,.8);border-radius:50%;background:rgba(255,255,255,.93);color:#111;font-weight:950}.cup-atmosphere-mark img{width:100%;height:100%;padding:6px;object-fit:contain;box-sizing:border-box}.cup-atmosphere-mark--medium{width:64px;height:64px}.cup-atmosphere-mark--icon{font-size:32px}.cup-atmosphere-mark--generated{background:linear-gradient(145deg,hsl(var(--cup-atmosphere-hue) 62% 42%),hsl(var(--cup-atmosphere-hue) 58% 24%));color:#fff;font-size:12px;text-shadow:0 1px 3px #000}
    @keyframes cup-atmosphere-ball{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-6px) rotate(6deg)}}@keyframes cup-atmosphere-cta{0%,100%{transform:translateY(0);filter:brightness(1)}50%{transform:translateY(-2px);filter:brightness(1.08)}}@keyframes cup-atmosphere-confetti{0%{transform:translate3d(0,-10%,0) rotate(0);opacity:0}8%{opacity:.9}100%{transform:translate3d(var(--drift),125vh,0) rotate(720deg);opacity:.15}}
    @media(max-width:680px){.tournament-next-match.cup-atmosphere-match .tournament-versus{grid-template-columns:minmax(0,1fr) 62px minmax(0,1fr);gap:7px}.cup-atmosphere-versus__ball{width:46px;height:46px;font-size:24px}.tournament-next-match.cup-atmosphere-match .tournament-versus>div{padding:11px 6px}.tournament-next-match.cup-atmosphere-match .tournament-versus strong{font-size:.78rem}.cup-atmosphere-side{font-size:.54rem}.tournament-complete.cup-atmosphere-complete .tournament-champion{grid-template-columns:1fr;justify-items:center;text-align:center}}@media(max-width:420px){.tournament-next-match.cup-atmosphere-match{padding:17px 10px}.tournament-next-match.cup-atmosphere-match .tournament-versus .tournament-team-mark__image,.tournament-next-match.cup-atmosphere-match .tournament-versus .tournament-team-mark__fallback,.tournament-next-match.cup-atmosphere-match .tournament-versus .tournament-team-mark__generated{width:66px!important;height:66px!important;padding:5px!important}.cup-atmosphere-versus__ball{width:39px;height:39px;font-size:20px}.cup-atmosphere-versus__label{font-size:.58rem}}@media(prefers-reduced-motion:reduce){.cup-atmosphere-versus__ball,.tournament-next-match.cup-atmosphere-match .tournament-play,.cup-atmosphere-confetti i{animation-duration:1ms!important;animation-iteration-count:1!important}.tournament-bracket__match{transition:none}}
  `;
  document.head.appendChild(style);
};

const roundForMatch = (state, match) => state?.rounds?.find(round => round.matches?.some(item => item.id === match?.id)) ?? null;
const roundIsComplete = round => Array.isArray(round?.matches) && round.matches.length > 0
  && round.matches.every(match => match.winnerId || ['complete', 'completed', 'played'].includes(text(match.status).toLowerCase()));
const journeyLabels = state => {
  const labels = (Array.isArray(state?.rounds) ? state.rounds : []).map(round => text(round.label)).filter(Boolean);
  if (labels.length <= 6) return labels;
  return [labels[0], labels[1], '…', labels.at(-3), labels.at(-2), labels.at(-1)];
};

const addJourney = (panel, state, activeRound) => {
  const progressLabel = panel.querySelector('.tournament-progress-label');
  if (!progressLabel || panel.querySelector('.cup-atmosphere-journey')) return;
  const journey = document.createElement('section');
  journey.className = 'cup-atmosphere-journey';
  journey.setAttribute('aria-label', tr('A torna útvonala', 'Tournament journey'));
  const heading = document.createElement('div');
  heading.className = 'cup-atmosphere-journey__heading';
  const title = document.createElement('strong');
  title.textContent = tr('Út a serlegig', 'Road to the trophy');
  const current = document.createElement('span');
  current.textContent = activeRound?.label ?? tr('Következő mérkőzés', 'Next match');
  heading.append(title, current);
  const track = document.createElement('div');
  track.className = 'cup-atmosphere-journey__track';
  const activeFolded = fold(activeRound?.label);
  const completedLabels = new Set((state.rounds ?? []).filter(roundIsComplete).map(round => fold(round.label)));
  journeyLabels(state).forEach(label => {
    const item = document.createElement('span');
    item.className = 'cup-atmosphere-journey__stage';
    item.textContent = label;
    if (label !== '…' && completedLabels.has(fold(label))) item.classList.add('is-complete');
    if (label !== '…' && fold(label) === activeFolded) item.classList.add('is-current');
    track.appendChild(item);
  });
  journey.append(heading, track);
  progressLabel.after(journey);
};

const addSideLabel = (teamNode, label, modifier) => {
  if (!teamNode || teamNode.querySelector('.cup-atmosphere-side')) return;
  const side = document.createElement('span');
  side.className = `cup-atmosphere-side cup-atmosphere-side--${modifier}`;
  side.textContent = label;
  teamNode.prepend(side);
};

const decorateNextMatch = (panel, state, match, activeRound) => {
  const section = panel.querySelector('.tournament-next-match');
  if (!section || section.dataset.cupAtmosphere === 'true') return;
  section.dataset.cupAtmosphere = 'true';
  section.classList.add('cup-atmosphere-match');
  const crowd = document.createElement('span');
  crowd.className = 'cup-atmosphere-crowd';
  crowd.setAttribute('aria-hidden', 'true');
  section.prepend(crowd);
  const round = document.createElement('div');
  round.className = 'cup-atmosphere-round';
  round.textContent = activeRound?.label ?? tr('Következő mérkőzés', 'Next match');
  section.prepend(round);
  const teams = section.querySelectorAll('.tournament-versus > div');
  addSideLabel(teams[0], tr('Saját csapat', 'Your team'), 'human');
  addSideLabel(teams[1], tr('Ellenfél', 'Opponent'), 'opponent');
  const versus = section.querySelector('.tournament-versus > b');
  if (versus) {
    versus.setAttribute('aria-label', tr('ellen', 'versus'));
    versus.innerHTML = '<span class="cup-atmosphere-versus"><span class="cup-atmosphere-versus__ball" aria-hidden="true">⚽</span><span class="cup-atmosphere-versus__label">VS</span></span>';
  }
  const foldedRound = fold(activeRound?.label);
  const stakesText = foldedRound.includes('donto')
    ? tr('<strong>A trófea a tét.</strong> Egyetlen győzelem választ el a kupától.', '<strong>The trophy is at stake.</strong> One win separates you from glory.')
    : foldedRound.includes('elodont')
      ? tr('<strong>Döntőbe jutás a tét.</strong> Nincs javítási lehetőség.', '<strong>A place in the final is at stake.</strong> There are no second chances.')
      : tr('<strong>Továbbjutás a tét.</strong> Nyerd meg a párharcot, és folytatódik a kupamenetelés.', '<strong>Advancement is at stake.</strong> Win the tie to continue the cup run.');
  const stakes = document.createElement('p');
  stakes.className = 'cup-atmosphere-stakes';
  stakes.innerHTML = stakesText;
  section.querySelector('#tournament-play')?.before(stakes);
  const home = tournamentTeamById(state, match?.homeId);
  const away = tournamentTeamById(state, match?.awayId);
  section.setAttribute('aria-label', `${activeRound?.label ?? ''}. ${home?.label ?? ''} – ${away?.label ?? ''}`.trim());
};

const decorateCenter = panel => {
  const state = tournamentStorageService.read();
  if (!state) return;
  const match = tournamentNextHumanMatch(state);
  const activeRound = roundForMatch(state, match);
  panel.classList.add('cup-atmosphere-active');
  addJourney(panel, state, activeRound);
  if (match) decorateNextMatch(panel, state, match, activeRound);
};

const createConfetti = () => {
  const layer = document.createElement('span');
  layer.className = 'cup-atmosphere-confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 30; index += 1) {
    const piece = document.createElement('i');
    piece.style.setProperty('--x', `${(index * 37) % 101}%`);
    piece.style.setProperty('--h', String((index * 53 + 34) % 360));
    piece.style.setProperty('--r', `${(index * 29) % 180}deg`);
    piece.style.setProperty('--d', `${3.8 + (index % 7) * .37}s`);
    piece.style.setProperty('--delay', `${-(index % 11) * .31}s`);
    piece.style.setProperty('--drift', `${((index % 5) - 2) * 34}px`);
    layer.appendChild(piece);
  }
  return layer;
};

const decorateComplete = panel => {
  if (panel.dataset.cupAtmosphere === 'true') return;
  const state = tournamentStorageService.read();
  if (!state) return;
  const champion = tournamentTeamById(state, state.championId);
  panel.dataset.cupAtmosphere = 'true';
  panel.classList.add('cup-atmosphere-complete');
  panel.prepend(createConfetti());
  const ribbon = document.createElement('div');
  ribbon.className = 'cup-atmosphere-champion-ribbon';
  ribbon.textContent = `🏆 ${tr('A torna bajnoka', 'Tournament champion')}`;
  panel.querySelector('.tournament-champion')?.before(ribbon);
  const championNode = panel.querySelector('.tournament-champion');
  if (championNode && champion && !championNode.querySelector('.cup-atmosphere-mark')) {
    championNode.querySelector('.tournament-team-mark__image, .tournament-team-mark__fallback, .tournament-team-mark__generated')
      ?.replaceWith(createTeamMark(champion, 'medium'));
  }
};

const decorateVisiblePanels = () => {
  document.querySelectorAll('.tournament-panel.tournament-center').forEach(decorateCenter);
  document.querySelectorAll('.tournament-panel.tournament-complete').forEach(decorateComplete);
};
let timer = 0;
const schedule = () => {
  globalThis.clearTimeout?.(timer);
  timer = globalThis.setTimeout?.(decorateVisiblePanels, 24) ?? 0;
};

export function installTournamentCupAtmosphere() {
  if (typeof document === 'undefined') return null;
  ensureStyles();
  const root = document.querySelector('#overlay-body') ?? document.body;
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });
  document.addEventListener('languagechange', schedule);
  schedule();
  return observer;
}

installTournamentCupAtmosphere();
