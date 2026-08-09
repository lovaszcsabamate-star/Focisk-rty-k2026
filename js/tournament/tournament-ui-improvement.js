/**
 * Tournament Experience 2.0 – vizuális hierarchia és mobilbarát Torna UX.
 *
 * Ez a modul kizárólag prezentációs réteg. Nem ír torna-domain állapotot, nem módosít
 * játékszabályt, pontozást, AI-t, Session Recovery-t vagy mentési sémát.
 * A klubmegjelenítés egyetlen forrása a központi branding.js.
 */

import '../branding.js';

export const TOURNAMENT_UI_IMPROVEMENT_VERSION = 2;
export const TOURNAMENT_UI_STYLE_ID = 'tournament-experience-2-style';

const TOURNAMENT_UI_CUP_PRESENTATION = Object.freeze([
  Object.freeze({ test: /magyar bajnoksag/, icon: '🏟️', tag: 'Bajnokság', tone: 'league' }),
  Object.freeze({ test: /magyar kupa/, icon: '🏆', tag: 'Kieséses kupa', tone: 'cup' }),
  Object.freeze({ test: /nemzetkozi bajnokok/, icon: '🌍', tag: 'Nemzetközi', tone: 'international' }),
  Object.freeze({ test: /nemzetek kupa|nemzetkozi kupa/, icon: '🌐', tag: 'Nemzetközi', tone: 'international' }),
  Object.freeze({ test: /sajat|uj sajat|mentett sajat/, icon: '✨', tag: 'Saját torna', tone: 'custom' }),
]);

const TOURNAMENT_UI_STEP_LABELS = Object.freeze({
  tornavalasztas: 'Kupa',
  csapatvalasztas: 'Csapat',
  'torna beallitasai': 'Beállítások',
  osszefoglalo: 'Indítás',
});

const tournamentUiText = value => String(value ?? '').trim();
export const foldTournamentUiText = value => tournamentUiText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const branding = () => globalThis.__FOCISKARTYAK_BRANDING__ ?? null;

/**
 * Csak a központi branding által ismert NB I klubokra ad prezentációt.
 * Ismeretlen, válogatott vagy régiós labelnél null marad, így a meglévő flag/icon
 * fallback változatlanul működik.
 */
export function resolveTournamentClubPresentation(label) {
  const api = branding();
  const key = foldTournamentUiText(label);
  return api?.clubPresentations?.[key] ?? null;
}

export function resolveTournamentCupPresentation(label) {
  const folded = foldTournamentUiText(label);
  return TOURNAMENT_UI_CUP_PRESENTATION.find(item => item.test.test(folded)) ?? Object.freeze({
    icon: '🏆', tag: 'Torna', tone: 'neutral',
  });
}

const TOURNAMENT_UI_CSS = `
.tournament-experience-v2,.tx-cup-selector-v3,.tournament-center[data-experience-v2="true"]{--tx2-gold:#f0c968;--tx2-cream:#fff1c2;--tx2-green:#79d95b;--tx2-ink:#07100f;--tx2-panel:rgba(8,18,18,.88);--tx2-soft:rgba(255,255,255,.07);--tx2-border:rgba(239,230,199,.16);--tx2-muted:#b9b7aa}
.tournament-experience-v2{max-width:min(840px,calc(100vw - 18px));gap:12px;overflow-x:hidden}.tournament-experience-v2 *{box-sizing:border-box}.tournament-experience-v2 button:focus-visible,.tx-cup-selector-v3 button:focus-visible,.tournament-center[data-experience-v2="true"] button:focus-visible{outline:3px solid var(--tx2-gold);outline-offset:3px}
.tournament-experience-v2 .tx-header{gap:8px;padding-bottom:10px}.tournament-experience-v2 .tx-header__top{align-items:center}.tournament-experience-v2 .tx-header__top h1{line-height:1.05}.tournament-experience-v2 .tx-header__top [data-exit]{display:grid;place-items:center;min-width:44px;width:44px;min-height:44px;padding:0;border-radius:50%;font-size:1.15rem}.tournament-experience-v2 .tx-stepper{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;overflow:visible;padding:1px}.tournament-experience-v2 .tx-stepper.tx-stepper--four{grid-template-columns:repeat(4,minmax(0,1fr))}.tournament-experience-v2 .tx-step{min-width:0;min-height:46px;grid-template-columns:26px minmax(0,1fr);gap:5px;padding:6px 8px;font-size:.68rem}.tournament-experience-v2 .tx-step b{width:26px;height:26px}.tournament-experience-v2 .tx-step>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tournament-experience-v2 .tx-section{gap:11px;padding:15px;border-radius:18px;background:linear-gradient(150deg,rgba(19,32,29,.88),rgba(7,15,14,.92));border-color:var(--tx2-border)}.tournament-experience-v2 .tx-section-title h2{font-size:1.05rem}.tournament-experience-v2 .tx-help{width:44px;min-height:44px}
.tournament-experience-v2[data-team-focus="true"] .tx-section:has(.tx-team-carousel){padding:18px}.tournament-experience-v2 .tx-team-carousel{grid-template-columns:50px minmax(0,1fr) 50px;gap:10px;align-items:center}.tournament-experience-v2 .tx-team-arrow{display:grid;place-items:center;width:50px;min-height:50px;padding:0;border-radius:50%;font-size:1.8rem}.tournament-experience-v2 .tx-team-hero{gap:10px;padding:20px 14px;border-radius:26px;border-color:rgba(240,201,104,.28);background:radial-gradient(circle at 50% 8%,rgba(240,201,104,.16),transparent 42%),linear-gradient(170deg,rgba(15,30,26,.95),rgba(5,13,12,.96));box-shadow:0 20px 44px rgba(0,0,0,.28);text-align:center}.tournament-experience-v2 .tx-team-hero h2{max-width:100%;margin:0;font-size:clamp(1.55rem,5vw,2.35rem);line-height:1.05;overflow-wrap:anywhere}.tournament-experience-v2 .tx-team-hero p{margin:0;max-width:460px;color:var(--tx2-muted);font-size:.74rem;line-height:1.4}.tournament-experience-v2 .tx-team-hero .tx-team-mark{width:clamp(126px,28vw,168px);height:clamp(126px,28vw,168px)}.tournament-experience-v2 .tx-team-meta{gap:6px}.tournament-experience-v2 .tx-team-meta span{padding:6px 9px;border:1px solid rgba(255,255,255,.08);font-size:.67rem}.tournament-experience-v2 .tx-team-meta span:last-child{display:none}.tournament-experience-v2 .tx-mini-teams{display:none!important}.tournament-experience-v2 .tx-random-wrap{margin-top:2px}.tournament-experience-v2 .tx-random-ball{width:56px;min-height:56px;opacity:.84}.tournament-experience-v2 .tx-actions{gap:8px;padding-top:10px}.tournament-experience-v2 .tx-actions .btn{min-height:50px}.tournament-experience-v2 .tx-actions__primary{font-weight:950;box-shadow:0 12px 26px rgba(0,0,0,.22)}
.tournament-experience-v2 .tx-team-mark.tx-team-mark--club,.safe-tournament-lineup .safe-lineup-team-mark.tx-team-mark--club,.tournament-center .tournament-team-mark__generated.tx-team-mark--club{border:0!important;background:transparent!important;clip-path:none!important;text-shadow:none!important}.tournament-experience-v2 .tx-team-mark .quick-team-mark__image,.safe-tournament-lineup .safe-lineup-team-mark .quick-team-mark__image,.tournament-center .tournament-team-mark__generated .quick-team-mark__image{display:block;width:100%;height:100%;object-fit:contain}
.tx-cup-selector-v3{max-width:min(840px,calc(100vw - 18px));gap:10px}.tx-cup-selector-v3 .tx-cup-head{gap:8px}.tx-cup-selector-v3 .tx-cup-top{grid-template-columns:44px minmax(0,1fr) 44px}.tx-cup-selector-v3 .tx-cup-top h1{font-size:clamp(1.65rem,5vw,2.5rem);line-height:1}.tx-cup-selector-v3 .tx-cup-locations{gap:5px}.tx-cup-selector-v3 .tx-cup-locations button{min-height:50px;padding:6px 8px;overflow:hidden}.tx-cup-selector-v3 .tx-cup-locations b{max-width:100%;white-space:normal;line-height:1.05;text-align:center;overflow-wrap:anywhere}.tx-cup-selector-v3 .tx-cup-stage{min-height:325px;border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.025),0 22px 48px rgba(0,0,0,.24)}.tx-cup-selector-v3 .tx-cup-stage[data-cup-tone="league"]{background:radial-gradient(circle at 50% 28%,rgba(113,190,82,.22),transparent 38%),linear-gradient(180deg,rgba(8,45,32,.76),rgba(4,17,14,.96))}.tx-cup-selector-v3 .tx-cup-stage[data-cup-tone="cup"]{background:radial-gradient(circle at 50% 28%,rgba(241,193,91,.22),transparent 38%),linear-gradient(180deg,rgba(54,34,14,.78),rgba(20,12,8,.97))}.tx-cup-selector-v3 .tx-cup-stage[data-cup-tone="international"]{background:radial-gradient(circle at 50% 26%,rgba(98,174,224,.23),transparent 38%),linear-gradient(180deg,rgba(11,43,70,.82),rgba(5,17,31,.97))}.tx-cup-selector-v3 .tx-cup-stage[data-cup-tone="custom"]{background:radial-gradient(circle at 50% 26%,rgba(125,210,156,.21),transparent 38%),linear-gradient(180deg,rgba(20,57,39,.8),rgba(7,22,16,.97))}.tx-cup-selector-v3 .tx-cup-main{gap:8px;padding:13px 4px}.tx-cup-selector-v3 .tx-cup-main .tx-trophy{width:clamp(142px,30vw,188px);height:clamp(160px,33vw,208px)}.tx-cup-selector-v3 .tx-cup-main h2{font-size:clamp(1.6rem,5vw,2.4rem);line-height:1.04}.tx-cup-selector-v3 .tx-cup-main p{max-width:520px;font-size:.82rem;line-height:1.4}.tx-cup-identity{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:4px 10px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(0,0,0,.22);font-size:.7rem;font-weight:950;letter-spacing:.035em;text-transform:uppercase}.tx-cup-identity__icon{font-size:.9rem}.tx-cup-selector-v3 .tx-cup-meta span{padding:6px 9px;font-size:.7rem}.tx-cup-selector-v3 .tx-cup-types{gap:7px}.tx-cup-selector-v3 .tx-cup-types button{flex:1 1 170px;min-height:48px;padding:6px 9px;border-radius:13px;font-size:.74rem}.tx-cup-selector-v3 .tx-cup-primary{min-height:56px;font-size:1rem!important}
.tournament-center[data-experience-v2="true"]{width:min(920px,100%);gap:15px;overflow-x:hidden}.tournament-center[data-experience-v2="true"]>.tournament-heading,.tournament-center[data-experience-v2="true"]>.tournament-progress,.tournament-center[data-experience-v2="true"]>.tournament-progress-label{display:none!important}.tournament-center[data-experience-v2="true"] .tx-center-status{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--tx2-border);border-radius:18px;background:linear-gradient(145deg,rgba(17,31,29,.95),rgba(7,15,14,.94))}.tournament-center[data-experience-v2="true"] .tx-center-status strong,.tournament-center[data-experience-v2="true"] .tx-center-status small,.tournament-center[data-experience-v2="true"] .tx-center-status span{display:block}.tournament-center[data-experience-v2="true"] .tx-center-status strong{margin:2px 0;font-size:1.05rem;color:var(--tx2-cream)}.tournament-center[data-experience-v2="true"] .tx-center-status small,.tournament-center[data-experience-v2="true"] .tx-center-status span{color:var(--tx2-muted);font-size:.72rem}.tournament-center[data-experience-v2="true"] .tx-center-progress{display:grid;justify-items:end;gap:2px}.tournament-center[data-experience-v2="true"] .tx-center-progress b{font-size:1.2rem;color:var(--tx2-gold)}
.tournament-center[data-experience-v2="true"] .tournament-next-match{position:relative;display:grid;gap:14px;overflow:hidden;padding:22px;border:1px solid rgba(240,201,104,.3);border-radius:28px;background:radial-gradient(circle at 50% 0,rgba(240,201,104,.17),transparent 38%),radial-gradient(ellipse at 50% 105%,rgba(41,108,64,.35),transparent 48%),linear-gradient(165deg,rgba(14,31,28,.98),rgba(5,13,12,.98));box-shadow:0 24px 55px rgba(0,0,0,.32);text-align:center}.tournament-center[data-experience-v2="true"] .tournament-next-match>p{margin:0;color:var(--tx2-gold);font-size:.72rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.tournament-center[data-experience-v2="true"] .tournament-versus{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:18px}.tournament-center[data-experience-v2="true"] .tournament-versus>div{display:grid;justify-items:center;gap:9px;min-width:0}.tournament-center[data-experience-v2="true"] .tournament-versus>div strong{max-width:100%;font-size:clamp(1rem,3vw,1.4rem);line-height:1.05;overflow-wrap:anywhere}.tournament-center[data-experience-v2="true"] .tournament-versus>b{display:grid;place-items:center;width:52px;height:52px;border:1px solid rgba(240,201,104,.35);border-radius:50%;background:rgba(0,0,0,.28);color:var(--tx2-gold);font-size:1rem}.tournament-center[data-experience-v2="true"] .tournament-team-mark__generated,.tournament-center[data-experience-v2="true"] .tournament-team-mark__image,.tournament-center[data-experience-v2="true"] .tournament-team-mark__fallback{width:clamp(82px,18vw,116px);height:clamp(82px,18vw,116px)}.tournament-center[data-experience-v2="true"] .tournament-next-match-meta{display:flex;justify-content:center;flex-wrap:wrap;gap:7px}.tournament-center[data-experience-v2="true"] .tournament-next-match-meta span{padding:6px 10px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(0,0,0,.2);font-size:.7rem}.tournament-center[data-experience-v2="true"] .tournament-play{width:min(520px,100%);min-height:58px;margin:0 auto;border-color:rgba(138,231,103,.65);background:linear-gradient(135deg,#64c94c,#267c38);box-shadow:0 12px 28px rgba(21,86,43,.3);font-size:1.05rem;font-weight:1000;letter-spacing:.055em}.tournament-center[data-experience-v2="true"] .tournament-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;padding:5px;border:1px solid var(--tx2-border);border-radius:17px;background:rgba(3,10,9,.52)}.tournament-center[data-experience-v2="true"] .tournament-tabs button{min-height:44px;border-radius:12px}.tournament-center[data-experience-v2="true"] .tournament-tabs button.is-active{background:rgba(240,201,104,.15);color:var(--tx2-cream);box-shadow:inset 0 0 0 1px rgba(240,201,104,.3)}.tournament-center[data-experience-v2="true"] .tournament-tab-content{padding:15px;border:1px solid var(--tx2-border);border-radius:18px;background:rgba(6,15,14,.66)}.tournament-center[data-experience-v2="true"] .tournament-selected-team{background:rgba(255,255,255,.035)}.tournament-center[data-experience-v2="true"] .tx-center-secondary{border:1px solid var(--tx2-border);border-radius:14px;background:rgba(5,12,11,.5)}.tournament-center[data-experience-v2="true"] .tx-center-secondary summary{min-height:44px;padding:12px 14px;cursor:pointer;font-weight:850}.tournament-center[data-experience-v2="true"] .tx-center-secondary__actions{display:flex;flex-wrap:wrap;gap:8px;padding:0 12px 12px}
.tournament-center[data-experience-v2="true"] .tournament-table{width:100%;border-collapse:separate;border-spacing:0 5px}.tournament-center[data-experience-v2="true"] .tournament-table th{padding:5px 7px;color:var(--tx2-muted);font-size:.66rem;text-transform:uppercase}.tournament-center[data-experience-v2="true"] .tournament-table td{padding:9px 7px;background:rgba(255,255,255,.035)}.tournament-center[data-experience-v2="true"] .tournament-table tr.is-human td{background:rgba(240,201,104,.12);color:var(--tx2-cream)}.tournament-center[data-experience-v2="true"] .tx-bracket-round-nav{display:flex;gap:6px;overflow:auto;padding:3px 0 9px}.tournament-center[data-experience-v2="true"] .tx-bracket-round-nav button{flex:0 0 auto;min-height:42px;padding:7px 11px;border-radius:999px}.tournament-center[data-experience-v2="true"] .tx-bracket-round-nav button.is-active{border-color:var(--tx2-gold);color:var(--tx2-cream)}
.result-panel--tournament[data-experience-v2="true"] .tx-round-transition{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:13px;padding:14px;border:1px solid rgba(240,201,104,.24);border-radius:18px;background:linear-gradient(145deg,rgba(22,34,30,.88),rgba(7,15,14,.92));text-align:left}.result-panel--tournament[data-experience-v2="true"] .tx-round-transition h2,.result-panel--tournament[data-experience-v2="true"] .tx-round-transition p{margin:0}.result-panel--tournament[data-experience-v2="true"] .tx-round-transition h2{color:var(--tx2-cream);font-size:1.15rem}.result-panel--tournament[data-experience-v2="true"] .tx-round-transition p{margin-top:5px;color:var(--tx2-muted);font-size:.78rem;line-height:1.4}.tx-impact-label{display:block;margin-bottom:3px;color:var(--tx2-gold);font-size:.65rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.tournament-complete[data-experience-v2="true"] .tx-complete-hero{padding:24px 16px;border:1px solid rgba(240,201,104,.3);border-radius:26px;background:radial-gradient(circle at 50% 14%,rgba(240,201,104,.18),transparent 42%),rgba(7,15,14,.86);text-align:center}.tournament-complete[data-experience-v2="true"] .tx-complete-hero h1{font-size:clamp(2rem,7vw,3.6rem);color:var(--tx2-cream)}
.safe-tournament-lineup .safe-lineup-team-mark.tx-team-mark--club{padding:0}.safe-tournament-lineup .safe-lineup-versus>div{min-width:0}.safe-tournament-lineup .safe-lineup-versus strong{overflow-wrap:anywhere}
@media(max-width:620px){.tournament-experience-v2,.tx-cup-selector-v3{width:calc(100vw - 8px);max-width:none;padding:10px;gap:10px}.tournament-experience-v2 .tx-header{position:static;background:none}.tournament-experience-v2 .tx-header__top .eyebrow,.tx-cup-selector-v3 .tx-cup-top .eyebrow{display:none}.tournament-experience-v2 .tx-header h1{font-size:1.52rem}.tournament-experience-v2 .tx-step{display:grid;grid-template-columns:1fr;justify-items:center;gap:2px;padding:5px 3px;font-size:.6rem;text-align:center}.tournament-experience-v2 .tx-step>span{white-space:normal;line-height:1.05}.tournament-experience-v2 .tx-section{padding:11px}.tournament-experience-v2 .tx-team-carousel{grid-template-columns:42px minmax(0,1fr) 42px;gap:5px}.tournament-experience-v2 .tx-team-arrow{width:42px;min-height:44px}.tournament-experience-v2 .tx-team-hero{padding:14px 8px}.tournament-experience-v2 .tx-team-hero .tx-team-mark{width:112px;height:112px}.tournament-experience-v2 .tx-team-hero h2{font-size:1.5rem}.tournament-experience-v2 .tx-actions:not(.tx-cup-actions){position:static;padding-bottom:max(5px,env(safe-area-inset-bottom,0px));background:none}.tournament-experience-v2 .tx-actions:not(.tx-cup-actions) .btn{min-width:0;flex:1}.tx-cup-selector-v3 .tx-cup-stage{grid-template-columns:42px minmax(0,1fr) 42px;min-height:285px;border-radius:20px}.tx-cup-selector-v3 .tx-cup-arrow{width:40px;min-height:44px}.tx-cup-selector-v3 .tx-cup-main .tx-trophy{width:122px;height:142px}.tx-cup-selector-v3 .tx-cup-main h2{font-size:1.5rem}.tx-cup-selector-v3 .tx-cup-main p{font-size:.74rem}.tx-cup-selector-v3 .tx-cup-types{justify-content:flex-start}.tx-cup-selector-v3 .tx-cup-types button{flex:0 0 156px}.tx-cup-selector-v3 .tx-cup-actions{position:static;background:none;padding:6px 0 max(5px,env(safe-area-inset-bottom,0px))}.tournament-center[data-experience-v2="true"]{width:calc(100vw - 8px);padding:10px;gap:10px}.tournament-center[data-experience-v2="true"] .tx-center-status{grid-template-columns:auto minmax(0,1fr);padding:10px}.tournament-center[data-experience-v2="true"] .tx-center-progress{grid-column:1/-1;grid-template-columns:auto 1fr;justify-items:start;gap:8px}.tournament-center[data-experience-v2="true"] .tournament-next-match{padding:16px 10px;border-radius:22px}.tournament-center[data-experience-v2="true"] .tournament-versus{gap:8px}.tournament-center[data-experience-v2="true"] .tournament-versus>b{width:42px;height:42px}.tournament-center[data-experience-v2="true"] .tournament-team-mark__generated,.tournament-center[data-experience-v2="true"] .tournament-team-mark__image,.tournament-center[data-experience-v2="true"] .tournament-team-mark__fallback{width:78px;height:78px}.tournament-center[data-experience-v2="true"] .tournament-tabs{display:flex;overflow:auto;scroll-snap-type:x proximity}.tournament-center[data-experience-v2="true"] .tournament-tabs button{flex:0 0 auto;min-width:108px;scroll-snap-align:start}.tournament-center[data-experience-v2="true"] .tournament-tab-content{padding:11px}.tournament-center[data-experience-v2="true"] .tournament-table{font-size:.78rem;min-width:0!important}.tournament-center[data-experience-v2="true"] .tournament-table-wrap{min-width:0;overflow-x:visible}.tournament-center[data-experience-v2="true"] .tournament-bracket{display:block;overflow:visible}.tournament-center[data-experience-v2="true"] .tournament-bracket__round{display:none!important;width:100%!important;min-width:0!important}.tournament-center[data-experience-v2="true"] .tournament-bracket__round.is-mobile-active{display:grid!important}.result-panel--tournament[data-experience-v2="true"] .tx-round-transition{grid-template-columns:1fr;justify-items:center;text-align:center}}
@media(max-width:390px){.tournament-experience-v2 .tx-stepper.tx-stepper--four .tx-step>span{font-size:.55rem}.tournament-experience-v2 .tx-team-hero p{display:none}.tournament-experience-v2 .tx-team-meta{display:grid;grid-template-columns:1fr 1fr;width:100%}.tournament-experience-v2 .tx-team-meta span{font-size:.61rem}.tx-cup-selector-v3 .tx-cup-locations button{gap:3px;padding:5px 3px;font-size:.62rem}.tx-cup-selector-v3 .tx-cup-stage{grid-template-columns:38px minmax(0,1fr) 38px;min-height:270px}.tx-cup-selector-v3 .tx-cup-main .tx-trophy{width:112px;height:130px}.tx-cup-selector-v3 .tx-cup-main h2{font-size:1.4rem}.tx-cup-selector-v3 .tx-cup-main p{max-width:230px}.tournament-center[data-experience-v2="true"] .tournament-versus>div strong{font-size:.92rem}.tournament-center[data-experience-v2="true"] .tournament-team-mark__generated,.tournament-center[data-experience-v2="true"] .tournament-team-mark__image,.tournament-center[data-experience-v2="true"] .tournament-team-mark__fallback{width:68px;height:68px}.tournament-center[data-experience-v2="true"] .tournament-next-match-meta span{font-size:.62rem}}
@media(max-width:340px){.tournament-experience-v2,.tx-cup-selector-v3,.tournament-center[data-experience-v2="true"]{padding:8px}.tournament-experience-v2 .tx-step>span{font-size:.53rem}.tournament-experience-v2 .tx-team-carousel{grid-template-columns:38px minmax(0,1fr) 38px}.tournament-experience-v2 .tx-team-arrow{width:38px}.tournament-experience-v2 .tx-team-hero .tx-team-mark{width:96px;height:96px}.tournament-center[data-experience-v2="true"] .tournament-versus{grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr);gap:5px}.tournament-center[data-experience-v2="true"] .tournament-versus>b{width:34px;height:34px;font-size:.72rem}.tournament-center[data-experience-v2="true"] .tournament-team-mark__generated,.tournament-center[data-experience-v2="true"] .tournament-team-mark__image,.tournament-center[data-experience-v2="true"] .tournament-team-mark__fallback{width:58px;height:58px}}
@media(max-height:720px) and (max-width:620px){.tx-cup-selector-v3 .tx-cup-stage{min-height:245px}.tx-cup-selector-v3 .tx-cup-main .tx-trophy{width:102px;height:118px}.tournament-experience-v2 .tx-team-hero .tx-team-mark{width:94px;height:94px}.tournament-center[data-experience-v2="true"] .tournament-next-match{padding-block:12px}}
@media(prefers-reduced-motion:reduce){.tournament-experience-v2 .tx-trophy,.tx-cup-selector-v3 .tx-trophy{animation:none!important}.tournament-experience-v2 *,.tx-cup-selector-v3 *,.tournament-center[data-experience-v2="true"] *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
@media(forced-colors:active){.tournament-experience-v2 .tx-section,.tournament-experience-v2 .tx-team-hero,.tx-cup-selector-v3 .tx-cup-stage,.tournament-center[data-experience-v2="true"] .tx-center-status,.tournament-center[data-experience-v2="true"] .tournament-next-match,.tournament-center[data-experience-v2="true"] .tournament-tab-content{border:1px solid ButtonText;background:Canvas;color:CanvasText;forced-color-adjust:auto}}
`;

export function installTournamentUiStyles(documentRef = globalThis.document) {
  if (!documentRef?.head || documentRef.getElementById?.(TOURNAMENT_UI_STYLE_ID)) return false;
  const style = documentRef.createElement('style');
  style.id = TOURNAMENT_UI_STYLE_ID;
  style.textContent = TOURNAMENT_UI_CSS;
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
  const versus = mark.closest?.('.tournament-versus > div');
  if (versus?.querySelector?.('strong')) return versus.querySelector('strong').textContent;
  const centerSelected = mark.closest?.('.tournament-selected-team');
  if (centerSelected?.querySelector?.('strong')) return centerSelected.querySelector('strong').textContent;
  return mark.dataset?.teamLabel ?? mark.dataset?.clubLabel ?? '';
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
  mark.dataset.clubLabel = tournamentUiText(label);
  mark.dataset.teamLabel = tournamentUiText(label);
  mark.style?.setProperty?.('--team-primary', presentation.primary);
  mark.style?.setProperty?.('--team-secondary', presentation.secondary);
  mark.classList?.add?.('quick-team-mark', 'quick-team-mark--text', 'tx-team-mark--club');
  mark.textContent = presentation.short;
  return true;
}

function decorateTournamentClubMarks(root) {
  let changed = 0;
  const selectors = [
    '.tournament-experience-v2 .tx-team-mark:not([data-tournament-club-visual])',
    '.safe-tournament-lineup .safe-lineup-team-mark--fallback:not([data-tournament-club-visual])',
    '.tournament-center .tournament-team-mark__generated:not([data-tournament-club-visual])',
  ];
  root.querySelectorAll?.(selectors.join(',')).forEach(mark => {
    const label = mark.matches?.('.safe-lineup-team-mark--fallback')
      ? labelForSafeLineupMark(mark)
      : labelForTournamentMark(mark);
    if (applyGeneratedClubMark(mark, label)) changed += 1;
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
      const short = TOURNAMENT_UI_STEP_LABELS[foldTournamentUiText(label.textContent)];
      if (!short) continue;
      label.dataset.originalTournamentLabel = label.textContent;
      label.dataset.shortTournamentLabel = 'true';
      label.textContent = short;
    }
  });

  root.querySelectorAll?.('.tournament-experience-v2 .tx-header__top [data-exit]').forEach(button => {
    if (button.dataset.compactTournamentExit === 'true') return;
    button.dataset.compactTournamentExit = 'true';
    button.setAttribute('aria-label', tournamentUiText(button.textContent) || 'Kilépés');
    button.textContent = '×';
  });
}

function decorateCupSelector(root) {
  root.querySelectorAll?.('.tx-cup-selector-v3').forEach(selector => {
    const stage = selector.querySelector('.tx-cup-stage');
    const title = stage?.querySelector('.tx-cup-main h2');
    if (stage && title) {
      const presentation = resolveTournamentCupPresentation(title.textContent);
      const identityKey = `${presentation.icon}|${presentation.tag}`;
      stage.dataset.cupTone = presentation.tone;
      const main = stage.querySelector('.tx-cup-main');
      let identity = main?.querySelector('.tx-cup-identity') ?? null;
      if (main && !identity) {
        identity = root.ownerDocument?.createElement?.('div') ?? globalThis.document?.createElement?.('div');
        if (identity) {
          identity.className = 'tx-cup-identity';
          title.before(identity);
        }
      }
      if (identity && identity.dataset.cupIdentity !== identityKey) {
        identity.dataset.cupIdentity = identityKey;
        identity.replaceChildren();
        const icon = (root.ownerDocument ?? globalThis.document).createElement('span');
        icon.className = 'tx-cup-identity__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = presentation.icon;
        const text = (root.ownerDocument ?? globalThis.document).createElement('span');
        text.textContent = presentation.tag;
        identity.append(icon, text);
      }
    }
    selector.querySelectorAll('.tx-cup-types button').forEach(button => {
      const label = button.querySelector('span')?.textContent ?? button.textContent;
      button.dataset.cupTone = resolveTournamentCupPresentation(label).tone;
    });
  });
}

function focusTeamSelection(root) {
  root.querySelectorAll?.('.tournament-experience-v2').forEach(panel => {
    panel.dataset.teamFocus = panel.querySelector('.tx-team-carousel') ? 'true' : 'false';
  });
}

function polishTournamentCenter(root) {
  root.querySelectorAll?.('.tournament-center[data-experience-v2="true"]').forEach(center => {
    center.dataset.tournamentExperience2 = 'true';
    center.querySelector(':scope > .tournament-heading')?.remove();
    center.querySelector(':scope > .tournament-progress')?.remove();
    center.querySelector(':scope > .tournament-progress-label')?.remove();

    const overviewButton = center.querySelector('.tournament-tabs [data-tab="overview"]');
    if (overviewButton && tournamentUiText(overviewButton.textContent) !== 'Áttekintés') {
      overviewButton.textContent = 'Áttekintés';
    }

    const next = center.querySelector('.tournament-next-match');
    if (next) {
      next.classList.add('tx-match-hero');
      const stage = next.querySelector(':scope > p');
      if (stage) stage.classList.add('tx-match-stage');
      const play = next.querySelector('#tournament-play,.tournament-match-intro-trigger');
      if (play && play.dataset.tournamentExperience2 !== 'true') {
        play.dataset.tournamentExperience2 = 'true';
        play.setAttribute('aria-label', 'Mérkőzés előkészítése');
        play.textContent = '▶  MÉRKŐZÉS';
      }
    }
  });
}

function polishTournamentResults(root) {
  root.querySelectorAll?.('.result-panel--tournament[data-experience-v2="true"] .tx-round-transition').forEach(transition => {
    const detail = transition.querySelector('p');
    if (!detail || transition.querySelector('.tx-impact-label')) return;
    const label = (root.ownerDocument ?? globalThis.document).createElement('span');
    label.className = 'tx-impact-label';
    label.textContent = 'Hatása a tornára';
    detail.before(label);
  });
  root.querySelectorAll?.('.tournament-complete[data-experience-v2="true"]').forEach(panel => {
    panel.dataset.tournamentExperience2 = 'true';
  });
}

export function refreshTournamentUiImprovement(root = globalThis.document) {
  if (!root?.querySelectorAll) return Object.freeze({ clubMarks: 0 });
  simplifyTournamentStepper(root);
  decorateCupSelector(root);
  focusTeamSelection(root);
  polishTournamentCenter(root);
  polishTournamentResults(root);
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
  const refresh = () => refreshTournamentUiImprovement(documentRef);
  const observer = observerFactory(refresh);
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
