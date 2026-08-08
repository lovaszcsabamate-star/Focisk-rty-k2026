/**
 * Tournament UI Improvement – jogtiszta klubidentitás és mobilbarát vizuális finomhangolás.
 *
 * A modul nem módosít torna-domain állapotot vagy játékszabályt. A már meglévő
 * Quick Match / branding által használt generált pajzslogó-szerződéshez kapcsolja
 * a Torna v2 csapatválasztót és a Tournament Lineup 1.1 fejlécét.
 */

export const TOURNAMENT_UI_IMPROVEMENT_VERSION = 1;
export const TOURNAMENT_UI_STYLE_ID = 'tournament-ui-improvement-v1-style';

const CLUB_PRESENTATION = Object.freeze({
  dvsc: Object.freeze({ short: 'DVSC', primary: '#c8192e', secondary: '#ffffff' }),
  dvtk: Object.freeze({ short: 'DVTK', primary: '#d71920', secondary: '#ffffff' }),
  'eto fc': Object.freeze({ short: 'ETO', primary: '#159447', secondary: '#ffffff' }),
  'ferencvarosi tc': Object.freeze({ short: 'FTC', primary: '#16854a', secondary: '#ffffff' }),
  'kisvarda master good': Object.freeze({ short: 'KISV', primary: '#d8222a', secondary: '#ffffff' }),
  'kolorcity kazincbarcika sc': Object.freeze({ short: 'KBSC', primary: '#2468a9', secondary: '#f2cf2f' }),
  'mtk budapest': Object.freeze({ short: 'MTK', primary: '#246eb9', secondary: '#ffffff' }),
  'nyiregyhaza spartacus fc': Object.freeze({ short: 'NYÍR', primary: '#c61f30', secondary: '#254f9a' }),
  'paksi fc': Object.freeze({ short: 'PAKS', primary: '#23864a', secondary: '#ffffff' }),
  'puskas akademia fc': Object.freeze({ short: 'PAFC', primary: '#1f66ad', secondary: '#f0c640' }),
  'ujpest fc': Object.freeze({ short: 'UTE', primary: '#6d3a93', secondary: '#ffffff' }),
  'zte fc': Object.freeze({ short: 'ZTE', primary: '#185ea9', secondary: '#ffffff' }),
});

const CUP_PRESENTATION = Object.freeze([
  Object.freeze({ test: /magyar bajnoksag/, icon: '🏟️', tag: 'Szezon', tone: 'league' }),
  Object.freeze({ test: /magyar kupa/, icon: '🏆', tag: 'Kieséses', tone: 'cup' }),
  Object.freeze({ test: /nemzetkozi bajnokok/, icon: '🌍', tag: 'Nemzetközi', tone: 'international' }),
  Object.freeze({ test: /nemzetek kupa|nemzetkozi kupa/, icon: '🌐', tag: 'Válogatott', tone: 'international' }),
  Object.freeze({ test: /sajat|uj sajat|mentett sajat/, icon: '✨', tag: 'Saját', tone: 'custom' }),
]);

const STEP_LABELS = Object.freeze({
  tornavalasztas: 'Kupa',
  csapatvalasztas: 'Csapat',
  'torna beallitasai': 'Beállítások',
  osszefoglalo: 'Indítás',
});

const text = value => String(value ?? '').trim();
export const foldTournamentUiText = value => text(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function resolveTournamentClubPresentation(label) {
  return CLUB_PRESENTATION[foldTournamentUiText(label)] ?? null;
}

export function resolveTournamentCupPresentation(label) {
  const folded = foldTournamentUiText(label);
  return CUP_PRESENTATION.find(item => item.test.test(folded)) ?? Object.freeze({
    icon: '🏆', tag: 'Torna', tone: 'neutral',
  });
}

const UI_CSS = `
.tournament-experience-v2{--tx-ui-gap:12px;max-width:min(820px,calc(100vw - 18px));overflow-x:hidden}
.tournament-experience-v2 .tx-header{gap:8px;padding-bottom:9px}.tournament-experience-v2 .tx-header__top{align-items:center}.tournament-experience-v2 .tx-header__top h1{line-height:1.05}.tournament-experience-v2 .tx-header__top [data-exit]{display:grid;place-items:center;min-width:44px;width:44px;min-height:44px;padding:0;border-radius:50%;font-size:1.15rem}
.tournament-experience-v2 .tx-stepper{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;overflow:visible;padding:1px}.tournament-experience-v2 .tx-stepper.tx-stepper--four{grid-template-columns:repeat(4,minmax(0,1fr))}.tournament-experience-v2 .tx-step{min-width:0;min-height:48px;grid-template-columns:26px minmax(0,1fr);gap:5px;padding:6px 8px;font-size:.68rem}.tournament-experience-v2 .tx-step b{width:26px;height:26px}.tournament-experience-v2 .tx-step>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tournament-experience-v2 .tx-section{gap:10px;padding:14px;border-radius:17px}.tournament-experience-v2 .tx-section-title h2{font-size:1.05rem}.tournament-experience-v2 .tx-help{width:44px;min-height:44px}
.tournament-experience-v2 .tx-team-carousel{grid-template-columns:46px minmax(0,1fr) 46px;gap:8px}.tournament-experience-v2 .tx-team-arrow{width:46px;min-height:46px}.tournament-experience-v2 .tx-team-hero{gap:8px;padding:15px;border-radius:22px}.tournament-experience-v2 .tx-team-hero h2{max-width:100%;margin:0;font-size:clamp(1.45rem,5vw,2.25rem);line-height:1.08;overflow-wrap:anywhere}.tournament-experience-v2 .tx-team-hero p{margin:0;max-width:460px;color:#bcae98;font-size:.72rem;line-height:1.35}.tournament-experience-v2 .tx-team-hero .tx-team-mark{width:clamp(108px,25vw,142px);height:clamp(108px,25vw,142px)}
.tournament-experience-v2 .tx-team-mark.tx-team-mark--club,.safe-tournament-lineup .safe-lineup-team-mark.tx-team-mark--club{border:0!important;background:transparent!important;clip-path:none!important;text-shadow:none!important}.tournament-experience-v2 .tx-team-mark .quick-team-mark__image,.safe-tournament-lineup .safe-lineup-team-mark .quick-team-mark__image{display:block;width:100%;height:100%;object-fit:contain}.tournament-experience-v2 .tx-mini-team .tx-team-mark{width:42px;height:42px}.tournament-experience-v2 .tx-team-meta{gap:5px}.tournament-experience-v2 .tx-team-meta span{padding:5px 8px;font-size:.66rem}.tournament-experience-v2 .tx-team-meta span:last-child{border:1px solid rgba(117,219,88,.34);background:rgba(72,159,59,.2);color:#d9ffd1}.tournament-experience-v2 .tx-mini-teams{gap:7px;padding-bottom:5px}.tournament-experience-v2 .tx-random-ball{width:58px;min-height:58px}.tournament-experience-v2 .tx-actions{gap:8px;padding-top:9px}.tournament-experience-v2 .tx-actions .btn{min-height:48px}.tournament-experience-v2 .tx-actions__primary{font-weight:950}
.tx-cup-selector-v3{max-width:min(820px,calc(100vw - 18px));gap:10px}.tx-cup-selector-v3 .tx-cup-head{gap:8px}.tx-cup-selector-v3 .tx-cup-top{grid-template-columns:44px minmax(0,1fr) 44px}.tx-cup-selector-v3 .tx-cup-top h1{font-size:clamp(1.65rem,5vw,2.45rem);line-height:1}.tx-cup-selector-v3 .tx-cup-locations{gap:5px}.tx-cup-selector-v3 .tx-cup-locations button{min-height:48px;padding:6px 8px}.tx-cup-selector-v3 .tx-cup-locations b{overflow:visible;text-overflow:clip;white-space:normal;line-height:1.05;text-align:center}.tx-cup-selector-v3 .tx-cup-stage{min-height:315px;border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.025)}.tx-cup-selector-v3 .tx-cup-stage[data-cup-tone="league"]{background:radial-gradient(circle at 50% 28%,rgba(113,190,82,.22),transparent 38%),linear-gradient(180deg,rgba(8,45,32,.76),rgba(4,17,14,.96))}.tx-cup-selector-v3 .tx-cup-stage[data-cup-tone="cup"]{background:radial-gradient(circle at 50% 28%,rgba(241,193,91,.22),transparent 38%),linear-gradient(180deg,rgba(54,34,14,.78),rgba(20,12,8,.97))}.tx-cup-selector-v3 .tx-cup-stage[data-cup-tone="international"]{background:radial-gradient(circle at 50% 26%,rgba(98,174,224,.23),transparent 38%),linear-gradient(180deg,rgba(11,43,70,.82),rgba(5,17,31,.97))}.tx-cup-selector-v3 .tx-cup-stage[data-cup-tone="custom"]{background:radial-gradient(circle at 50% 26%,rgba(125,210,156,.21),transparent 38%),linear-gradient(180deg,rgba(20,57,39,.8),rgba(7,22,16,.97))}.tx-cup-selector-v3 .tx-cup-main{gap:7px;padding:12px 4px}.tx-cup-selector-v3 .tx-cup-main .tx-trophy{width:clamp(132px,29vw,178px);height:clamp(150px,32vw,198px)}.tx-cup-selector-v3 .tx-cup-main h2{font-size:clamp(1.55rem,5vw,2.35rem);line-height:1.04}.tx-cup-selector-v3 .tx-cup-main p{max-width:520px;font-size:.82rem;line-height:1.38}.tx-cup-identity{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:4px 9px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(0,0,0,.2);font-size:.7rem;font-weight:950;letter-spacing:.035em;text-transform:uppercase}.tx-cup-identity__icon{font-size:.9rem}.tx-cup-selector-v3 .tx-cup-meta span{padding:6px 9px;font-size:.7rem}.tx-cup-selector-v3 .tx-cup-types{gap:6px}.tx-cup-selector-v3 .tx-cup-types button{flex:1 1 170px;min-height:48px;padding:6px 9px;border-radius:13px;font-size:.74rem}.tx-cup-selector-v3 .tx-cup-types button[data-cup-tone="league"]{border-bottom-color:rgba(112,211,59,.55)}.tx-cup-selector-v3 .tx-cup-types button[data-cup-tone="cup"]{border-bottom-color:rgba(242,196,94,.65)}.tx-cup-selector-v3 .tx-cup-types button[data-cup-tone="international"]{border-bottom-color:rgba(94,174,231,.62)}.tx-cup-selector-v3 .tx-cup-types button[data-cup-tone="custom"]{border-bottom-color:rgba(109,215,151,.62)}.tx-cup-selector-v3 .tx-cup-primary{min-height:54px;font-size:1rem!important}
.safe-tournament-lineup .safe-lineup-team-mark.tx-team-mark--club{padding:0}.safe-tournament-lineup .safe-lineup-versus>div{min-width:0}.safe-tournament-lineup .safe-lineup-versus strong{overflow-wrap:anywhere}
@media(max-width:560px){.tournament-experience-v2{width:calc(100vw - 8px);max-width:none;padding:10px;gap:10px}.tournament-experience-v2 .tx-header{position:static;background:none}.tournament-experience-v2 .tx-header__top .eyebrow{display:none}.tournament-experience-v2 .tx-header h1{font-size:1.55rem}.tournament-experience-v2 .tx-step{display:grid;grid-template-columns:1fr;justify-items:center;gap:2px;padding:5px 3px;font-size:.61rem;text-align:center}.tournament-experience-v2 .tx-step>span{white-space:normal;line-height:1.05}.tournament-experience-v2 .tx-section{padding:11px;border-radius:15px}.tournament-experience-v2 .tx-team-carousel{grid-template-columns:42px minmax(0,1fr) 42px;gap:5px}.tournament-experience-v2 .tx-team-arrow{width:42px;min-height:44px}.tournament-experience-v2 .tx-team-hero{padding:12px 8px}.tournament-experience-v2 .tx-team-hero .tx-team-mark{width:108px;height:108px}.tournament-experience-v2 .tx-team-hero h2{font-size:1.55rem}.tournament-experience-v2 .tx-mini-team{flex-basis:58px;min-height:68px}.tournament-experience-v2 .tx-actions:not(.tx-cup-actions){position:static;padding-bottom:max(5px,env(safe-area-inset-bottom,0px));background:none}.tournament-experience-v2 .tx-actions:not(.tx-cup-actions) .btn{min-width:0;flex:1}.tx-cup-selector-v3{width:calc(100vw - 8px);max-width:none;padding:10px}.tx-cup-selector-v3 .tx-cup-top .eyebrow{display:none}.tx-cup-selector-v3 .tx-cup-locations button{min-width:0;font-size:.68rem}.tx-cup-selector-v3 .tx-cup-stage{grid-template-columns:42px minmax(0,1fr) 42px;min-height:285px;border-radius:20px}.tx-cup-selector-v3 .tx-cup-arrow{width:40px;min-height:44px}.tx-cup-selector-v3 .tx-cup-main .tx-trophy{width:122px;height:142px}.tx-cup-selector-v3 .tx-cup-main h2{font-size:1.55rem}.tx-cup-selector-v3 .tx-cup-main p{font-size:.74rem}.tx-cup-selector-v3 .tx-cup-meta{gap:5px}.tx-cup-selector-v3 .tx-cup-meta span{font-size:.63rem}.tx-cup-selector-v3 .tx-cup-types{justify-content:flex-start}.tx-cup-selector-v3 .tx-cup-types button{flex:0 0 156px}.tx-cup-selector-v3 .tx-cup-actions{position:static;background:none;padding:6px 0 max(5px,env(safe-area-inset-bottom,0px))}}
@media(max-width:390px){.tournament-experience-v2 .tx-stepper.tx-stepper--four .tx-step>span{font-size:.56rem}.tournament-experience-v2 .tx-team-hero p{display:none}.tournament-experience-v2 .tx-team-meta span{font-size:.61rem}.tx-cup-selector-v3 .tx-cup-locations button{gap:3px;padding:5px 3px;font-size:.62rem}.tx-cup-selector-v3 .tx-cup-stage{grid-template-columns:38px minmax(0,1fr) 38px;min-height:270px}.tx-cup-selector-v3 .tx-cup-main .tx-trophy{width:112px;height:130px}.tx-cup-selector-v3 .tx-cup-main h2{font-size:1.42rem}.tx-cup-selector-v3 .tx-cup-main p{max-width:230px}.tx-cup-selector-v3 .tx-cup-meta{display:flex;width:auto}.tx-cup-selector-v3 .tx-cup-meta span{white-space:normal}}
@media(max-width:340px){.tournament-experience-v2 .tx-step>span{font-size:.56rem}.tournament-experience-v2 .tx-team-carousel{grid-template-columns:38px minmax(0,1fr) 38px}.tournament-experience-v2 .tx-team-arrow{width:38px}.tx-cup-selector-v3 .tx-cup-locations b{font-size:.58rem}.tx-cup-selector-v3 .tx-cup-main p{display:none}}
@media(prefers-reduced-motion:reduce){.tournament-experience-v2 .tx-team-hero,.tx-cup-selector-v3 .tx-cup-stage{scroll-behavior:auto}}
`;

function installTournamentUiStyles(documentRef) {
  if (!documentRef?.head || documentRef.getElementById?.(TOURNAMENT_UI_STYLE_ID)) return false;
  const style = documentRef.createElement('style');
  style.id = TOURNAMENT_UI_STYLE_ID;
  style.textContent = UI_CSS;
  documentRef.head.appendChild(style);
  return true;
}

function labelForTournamentMark(mark) {
  const mini = mark.closest?.('.tx-mini-team');
  if (mini?.getAttribute?.('aria-label')) return mini.getAttribute('aria-label');
  const hero = mark.closest?.('.tx-team-hero');
  if (hero?.querySelector?.('h2')) return hero.querySelector('h2').textContent;
  const selected = mark.closest?.('.tx-selected-team');
  if (selected?.querySelector?.('strong')) return selected.querySelector('strong').textContent;
  const candidate = mark.closest?.('.tx-candidate');
  if (candidate?.querySelector?.('strong,h2,h3')) return candidate.querySelector('strong,h2,h3').textContent;
  return '';
}

function labelForSafeLineupMark(mark) {
  const side = mark.closest?.('.safe-lineup-versus > div');
  return side?.querySelector?.('strong')?.textContent ?? '';
}

function applyGeneratedClubMark(mark, label) {
  if (!mark || mark.dataset?.tournamentClubVisual === 'true') return false;
  const presentation = resolveTournamentClubPresentation(label);
  if (!presentation) return false;
  mark.dataset.tournamentClubVisual = 'true';
  mark.dataset.clubLabel = text(label);
  mark.style?.setProperty?.('--team-primary', presentation.primary);
  mark.style?.setProperty?.('--team-secondary', presentation.secondary);
  mark.classList?.add?.('quick-team-mark', 'quick-team-mark--text', 'tx-team-mark--club');
  mark.textContent = presentation.short;
  return true;
}

function decorateTournamentClubMarks(root) {
  let changed = 0;
  root.querySelectorAll?.('.tournament-experience-v2 .tx-team-mark:not([data-tournament-club-visual])').forEach(mark => {
    if (applyGeneratedClubMark(mark, labelForTournamentMark(mark))) changed += 1;
  });
  root.querySelectorAll?.('.safe-tournament-lineup .safe-lineup-team-mark--fallback:not([data-tournament-club-visual])').forEach(mark => {
    if (applyGeneratedClubMark(mark, labelForSafeLineupMark(mark))) changed += 1;
  });
  if (changed) globalThis.__FOCISKARTYAK_TEAM_LOGO_RESTORATION__?.refresh?.();
  return changed;
}

function simplifyTournamentStepper(root) {
  root.querySelectorAll?.('.tournament-experience-v2 .tx-stepper').forEach(stepper => {
    const steps = [...stepper.querySelectorAll('.tx-step')];
    stepper.classList.toggle('tx-stepper--four', steps.length === 4);
    for (const step of steps) {
      const label = step.querySelector('span');
      if (!label || label.dataset.shortTournamentLabel === 'true') continue;
      const short = STEP_LABELS[foldTournamentUiText(label.textContent)];
      if (!short) continue;
      label.dataset.originalTournamentLabel = label.textContent;
      label.dataset.shortTournamentLabel = 'true';
      label.textContent = short;
    }
  });

  root.querySelectorAll?.('.tournament-experience-v2 .tx-header__top [data-exit]').forEach(button => {
    if (button.dataset.compactTournamentExit === 'true') return;
    button.dataset.compactTournamentExit = 'true';
    button.setAttribute('aria-label', text(button.textContent) || 'Kilépés');
    button.textContent = '×';
  });
}

function decorateCupSelector(root) {
  root.querySelectorAll?.('.tx-cup-selector-v3').forEach(selector => {
    const stage = selector.querySelector('.tx-cup-stage');
    const title = stage?.querySelector('.tx-cup-main h2');
    if (stage && title) {
      const presentation = resolveTournamentCupPresentation(title.textContent);
      stage.dataset.cupTone = presentation.tone;
      const main = stage.querySelector('.tx-cup-main');
      if (main && !main.querySelector('.tx-cup-identity')) {
        const identity = root.ownerDocument?.createElement?.('div') ?? globalThis.document?.createElement?.('div');
        if (identity) {
          identity.className = 'tx-cup-identity';
          identity.innerHTML = `<span class="tx-cup-identity__icon" aria-hidden="true">${presentation.icon}</span><span>${presentation.tag}</span>`;
          title.before(identity);
        }
      } else if (main) {
        const identity = main.querySelector('.tx-cup-identity');
        if (identity) identity.innerHTML = `<span class="tx-cup-identity__icon" aria-hidden="true">${presentation.icon}</span><span>${presentation.tag}</span>`;
      }
    }
    selector.querySelectorAll('.tx-cup-types button').forEach(button => {
      const label = button.querySelector('span')?.textContent ?? button.textContent;
      button.dataset.cupTone = resolveTournamentCupPresentation(label).tone;
    });
  });
}

export function refreshTournamentUiImprovement(root = globalThis.document) {
  if (!root?.querySelectorAll) return Object.freeze({ clubMarks: 0 });
  simplifyTournamentStepper(root);
  decorateCupSelector(root);
  const clubMarks = decorateTournamentClubMarks(root);
  return Object.freeze({ clubMarks });
}

export function installTournamentUiImprovement({
  documentRef = globalThis.document,
  observerFactory = callback => new globalThis.MutationObserver(callback),
} = {}) {
  if (!documentRef?.documentElement) return null;
  if (globalThis.__FOCISKARTYAK_TOURNAMENT_UI_IMPROVEMENT__) {
    refreshTournamentUiImprovement(documentRef);
    return globalThis.__FOCISKARTYAK_TOURNAMENT_UI_IMPROVEMENT__;
  }
  installTournamentUiStyles(documentRef);
  let queued = false;
  const refresh = () => {
    queued = false;
    refreshTournamentUiImprovement(documentRef);
  };
  const observer = observerFactory(() => {
    if (queued) return;
    queued = true;
    (globalThis.requestAnimationFrame ?? globalThis.setTimeout)(refresh, 0);
  });
  observer?.observe?.(documentRef.documentElement, { childList: true, subtree: true });
  const api = Object.freeze({
    version: TOURNAMENT_UI_IMPROVEMENT_VERSION,
    refresh,
    disconnect: () => observer?.disconnect?.(),
  });
  globalThis.__FOCISKARTYAK_TOURNAMENT_UI_IMPROVEMENT__ = api;
  refresh();
  return api;
}
