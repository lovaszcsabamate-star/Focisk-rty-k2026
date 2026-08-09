/** Fociskártyák 2026 – Torna mód élményréteg és letisztult kupaválasztó. */
import { installTournamentExperienceV2 } from './tournament/tournament-experience-v2-runtime.js';
import {
  LOCATION, LOCATION_LABELS, TOURNAMENTS, TOURNAMENT_FORMAT, TOURNAMENT_STATUS,
  runtime, escapeHtml, initialDraft, applyTournament, readDraft, saveDraft,
  makePanel, showPanel, closeTournamentLayers, trophyMarkup, tournamentStorageService,
} from './tournament/tournament-experience-v2-shared.js';
import { showExperienceWizard } from './tournament/tournament-experience-v2-wizard.js';
import { installTournamentUiImprovement } from './tournament/tournament-ui-improvement.js';

if (!document.getElementById('tournament-experience-v2-compat-style')) {
  const style = document.createElement('style');
  style.id = 'tournament-experience-v2-compat-style';
  style.textContent = `.menu-panel[data-tournament-experience-v2="true"] .tournament-continue-button{display:none!important}@media(max-width:520px){.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table-wrap{overflow-x:visible}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table{display:block;width:100%}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table tbody{display:block;width:100%}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table tbody tr{display:grid;grid-template-columns:32px repeat(4,minmax(0,1fr)) 44px;grid-template-areas:"pos team team team team pts" "played wins draws losses diff diff";gap:2px 4px;margin:0 0 7px;padding:7px;border:1px solid rgba(255,239,183,.12);border-radius:12px;background:rgba(255,255,255,.025)}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td{display:block!important;min-width:0;padding:5px!important;text-align:center}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(1){grid-area:pos;align-self:center;font-weight:950}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(2){grid-area:team;text-align:left}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(2)>span{max-width:100%;min-width:0}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(2) b{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(3){grid-area:played}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(4){grid-area:wins}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(5){grid-area:draws}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(6){grid-area:losses}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(7){grid-area:diff}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(8){grid-area:pts;align-self:center;color:var(--tx2-cream,#fff1c2);font-size:1rem;font-weight:1000}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(n+3)::before{display:block;margin-bottom:1px;color:var(--tx2-muted,#b9b7aa);font-size:.52rem;font-weight:900;line-height:1;text-transform:uppercase}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(3)::before{content:"M"}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(4)::before{content:"GY"}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(5)::before{content:"D"}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(6)::before{content:"V"}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(7)::before{content:"+/−"}.tournament-center[data-experience-v2="true"] [data-content="table"] .tournament-table td:nth-child(8)::before{content:"P"}}`;
  document.head.appendChild(style);
}

const swipeEnhanced = new WeakSet();
function addHorizontalSwipe(node, onPrevious, onNext) {
  if (!node || swipeEnhanced.has(node)) return;
  swipeEnhanced.add(node);
  let startX = null;
  node.addEventListener('touchstart', event => { startX = event.touches?.[0]?.clientX ?? null; }, { passive:true });
  node.addEventListener('touchend', event => {
    if (startX === null) return;
    const delta = (event.changedTouches?.[0]?.clientX ?? startX) - startX;
    startX = null;
    if (Math.abs(delta) >= 42) (delta > 0 ? onPrevious : onNext)();
  }, { passive:true });
}
function enhanceTournamentSwipes() {
  document.querySelectorAll('.tx-team-carousel').forEach(carousel => addHorizontalSwipe(
    carousel,
    () => carousel.querySelector('[data-team-prev]')?.click?.(),
    () => carousel.querySelector('[data-team-next]')?.click?.(),
  ));
  document.querySelectorAll('.tournament-center[data-experience-v2="true"] .tournament-bracket').forEach(bracket => addHorizontalSwipe(bracket, () => {
    const buttons = [...bracket.previousElementSibling?.querySelectorAll?.('button') ?? []];
    const active = Math.max(0, buttons.findIndex(button => button.classList.contains('is-active')));
    buttons[Math.max(0, active - 1)]?.click?.();
  }, () => {
    const buttons = [...bracket.previousElementSibling?.querySelectorAll?.('button') ?? []];
    const active = Math.max(0, buttons.findIndex(button => button.classList.contains('is-active')));
    buttons[Math.min(buttons.length - 1, active + 1)]?.click?.();
  }));
}
const swipeObserver = new MutationObserver(enhanceTournamentSwipes);
swipeObserver.observe(document.documentElement, { childList:true, subtree:true });
enhanceTournamentSwipes();

const CUP_STYLE_ID = 'tournament-cup-selector-v3-style';
const CUP_PATCHED = new WeakSet();
const CUP_SERIES = Object.freeze([
  { k:'hungarian-league', t:'hungarian-league', l:LOCATION.HUNGARY, n:'Magyar Bajnokság', d:'Teljes hazai bajnoki idény, minden ellenféllel egy mérkőzés.', f:TOURNAMENT_FORMAT.LEAGUE, c:12, s:'shield', a:'gold', p:'stadium' },
  { k:'hungarian-cup', t:'hungarian-cup', l:LOCATION.HUNGARY, n:'Magyar Kupa', d:'Hazai kieséses kupasorozat külön döntőfelvezetéssel.', f:TOURNAMENT_FORMAT.KNOCKOUT, c:12, s:'classic', a:'silver', p:'rays' },
  { k:'international-champions', t:'world-cup', l:LOCATION.INTERNATIONAL, n:'Nemzetközi Bajnokok Kupája', d:'Csoportkörből a kieséses szakaszon át vezet az út a döntőig.', f:TOURNAMENT_FORMAT.GROUP_KNOCKOUT, c:8, s:'orb', a:'silver', p:'stars' },
  { k:'nations-cup', t:'world-cup', l:LOCATION.INTERNATIONAL, n:'Nemzetek Kupája', d:'Gyors, egyenes kieséses nemzetközi kupasorozat.', f:TOURNAMENT_FORMAT.KNOCKOUT, c:8, s:'classic', a:'gold', p:'stars' },
  { k:'custom-new', t:'custom', l:LOCATION.CUSTOM, n:'Új saját kupa létrehozása', d:'Egyedi név, mezőny, formátum és saját tervezésű serleg.', f:TOURNAMENT_FORMAT.KNOCKOUT, c:4, s:'modern', a:'emerald', p:'none' },
  { k:'custom-saved', t:'custom', l:LOCATION.CUSTOM, n:'Mentett saját kupák', d:'A korábban elmentett saját kupabeállítások folytatása.', f:TOURNAMENT_FORMAT.KNOCKOUT, c:4, s:'classic', a:'gold', p:'none', saved:true },
]);
const CUP_LOCATION_ICON = { [LOCATION.HUNGARY]:'🇭🇺', [LOCATION.INTERNATIONAL]:'🌐', [LOCATION.CUSTOM]:'🏆＋' };
const CUP_LOCATION_NAME = { ...LOCATION_LABELS, [LOCATION.CUSTOM]:'Saját kupa' };
const CUP_CSS = `
.tx-cup-selector-v3{--g:#72d83e;--b:rgba(210,230,238,.18);width:min(940px,100%);gap:13px;color:#f7fbfd;background:radial-gradient(circle at 50% 35%,rgba(21,69,82,.28),transparent 50%)}.tx-cup-selector-v3 *{box-sizing:border-box}.tx-cup-selector-v3 button{font:inherit}.tx-cup-selector-v3 button:focus-visible{outline:3px solid #b8f985;outline-offset:3px}
.tx-cup-head{display:grid;gap:10px}.tx-cup-top{display:grid;grid-template-columns:46px 1fr 46px;align-items:center;text-align:center}.tx-cup-top h1,.tx-cup-top p{margin:0}.tx-cup-top h1{font-size:clamp(1.8rem,6vw,3rem)}.tx-cup-icon-btn{display:grid;place-items:center;width:46px;min-height:46px;border:1px solid var(--b);border-radius:15px;background:rgba(5,12,17,.72);color:#fff;font-weight:950;font-size:1.5rem}.tx-cup-icon-btn:last-child{border-radius:50%;font-size:1rem}.tx-cup-helptext{padding:10px;border:1px solid rgba(114,216,62,.3);border-radius:12px;background:rgba(43,112,52,.17);font-size:.76rem}
.tx-cup-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.tx-cup-steps.is-three{grid-template-columns:repeat(3,1fr)}.tx-cup-steps span{position:relative;display:grid;justify-items:center;gap:4px;color:#75838b}.tx-cup-steps span:not(:last-child):after{content:'';position:absolute;top:15px;left:calc(50% + 19px);width:calc(100% - 38px);height:2px;background:rgba(255,255,255,.12)}.tx-cup-steps b{display:grid;place-items:center;width:31px;height:31px;border:1px solid var(--b);border-radius:50%;background:#111b22}.tx-cup-steps .is-active{color:#a7f46d}.tx-cup-steps .is-active b{border-color:#a7f46d;background:#244d24;box-shadow:0 0 16px rgba(114,216,62,.35)}
.tx-cup-locations{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:5px;border:1px solid var(--b);border-radius:18px;background:rgba(5,12,17,.74)}.tx-cup-locations button{display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:52px;padding:7px;border:1px solid transparent;border-radius:13px;background:transparent;color:#aab5bc}.tx-cup-locations b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tx-cup-locations .is-active{border-color:var(--g);background:linear-gradient(135deg,rgba(49,126,44,.65),rgba(22,72,34,.67));color:#fff}
.tx-cup-stage{position:relative;display:grid;grid-template-columns:58px 1fr 58px;align-items:center;min-height:405px;overflow:hidden;border-radius:27px;background:radial-gradient(circle at 50% 35%,rgba(181,224,235,.16),transparent 36%),linear-gradient(180deg,rgba(6,20,31,.5),rgba(4,11,16,.93));touch-action:pan-y}.tx-cup-stage:before{content:'';position:absolute;inset:0;opacity:.28;background:repeating-conic-gradient(from -13deg at 50% 28%,rgba(255,255,255,.07) 0 4deg,transparent 4deg 16deg),radial-gradient(ellipse at 50% 92%,rgba(44,91,50,.56),transparent 43%)}.tx-cup-main{z-index:2;display:grid;justify-items:center;gap:8px;min-width:0;padding:16px 3px;text-align:center}.tx-cup-main .tx-trophy{width:clamp(170px,35vw,230px);height:clamp(190px,39vw,255px)}.tx-cup-main h2,.tx-cup-main p{margin:0}.tx-cup-main h2{font-size:clamp(1.7rem,6vw,3rem)}.tx-cup-main p{max-width:590px;color:#b7c1c7}.tx-cup-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:7px}.tx-cup-meta span{padding:7px 10px;border:1px solid var(--b);border-radius:999px;background:rgba(3,10,15,.58);font-size:.75rem}.tx-cup-meta b{color:#a7f46d}.tx-cup-arrow{z-index:4;display:grid;place-items:center;width:48px;min-height:48px;justify-self:center;border:1px solid rgba(230,241,245,.38);border-radius:50%;background:rgba(8,17,23,.75);color:#fff;font-size:1.8rem}.tx-cup-peek{position:absolute;top:45%;z-index:1;opacity:.18;filter:blur(1px);transform:translateY(-50%) scale(1.4)}.tx-cup-peek.left{left:-40px}.tx-cup-peek.right{right:-40px}
.tx-cup-types{display:flex;justify-content:center;gap:8px;overflow-x:auto;padding:3px 1px 6px}.tx-cup-types button{flex:1 0 185px;display:flex;align-items:center;justify-content:center;gap:7px;min-height:55px;padding:8px 12px;border:1px solid var(--b);border-radius:16px;background:rgba(6,14,20,.75);color:#d7dfe3;font-weight:900}.tx-cup-types button:disabled{opacity:.42;cursor:not-allowed}.tx-cup-types .is-selected{border-color:#8af053;background:linear-gradient(135deg,rgba(39,112,39,.72),rgba(17,62,31,.78));color:#fff}.tx-cup-types .tx-trophy{width:34px;height:39px;filter:none}.tx-cup-types .tx-trophy__cup{top:2px;width:22px!important;height:23px!important;border-width:2px!important}.tx-cup-types .tx-trophy__stem{top:24px!important;width:7px!important;height:8px!important}.tx-cup-types .tx-trophy__base{top:31px!important;width:27px!important;height:7px!important}.tx-cup-actions{position:sticky;z-index:10;bottom:0;padding:9px 0 max(9px,env(safe-area-inset-bottom,0px));background:linear-gradient(transparent,rgba(5,12,17,.98) 28%)}.tx-cup-primary{display:flex!important;align-items:center;justify-content:center;gap:12px;width:min(620px,100%);min-height:58px;margin:auto!important;border-color:#9cf16b!important;background:linear-gradient(135deg,#70d33b,#2c912e)!important;color:#fff!important;font-size:1.1rem!important}
@media(max-width:650px){.tx-cup-selector-v3{gap:10px}.tx-cup-top{grid-template-columns:42px 1fr 42px}.tx-cup-icon-btn{width:42px;min-height:42px}.tx-cup-top .eyebrow{display:none}.tx-cup-steps small{font-size:.64rem}.tx-cup-locations button{min-height:47px;padding:5px;font-size:.7rem}.tx-cup-stage{grid-template-columns:45px 1fr 45px;min-height:350px;border-radius:21px}.tx-cup-arrow{width:40px;min-height:40px}.tx-cup-main .tx-trophy{width:150px;height:174px}.tx-cup-main h2{font-size:1.75rem}.tx-cup-main p{font-size:.78rem}.tx-cup-meta span{font-size:.65rem}.tx-cup-types{justify-content:flex-start}.tx-cup-types button{flex-basis:170px;font-size:.74rem}.tx-cup-peek{display:none}}
@media(max-width:390px){.tx-cup-locations b{font-size:.62rem}.tx-cup-stage{grid-template-columns:40px 1fr 40px;min-height:320px}.tx-cup-main .tx-trophy{width:135px;height:155px}.tx-cup-meta{display:grid;grid-template-columns:1fr 1fr;width:100%}.tx-cup-meta span{white-space:nowrap}}
@media(max-height:720px) and (max-width:650px){.tx-cup-stage{min-height:290px}.tx-cup-main .tx-trophy{width:115px;height:130px}.tx-cup-main p{display:none}}@media(prefers-reduced-motion:reduce){.tx-cup-selector-v3 .tx-trophy{animation:none}}
`;
function cupEnsureStyle() {
  if (document.getElementById(CUP_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = CUP_STYLE_ID;
  style.textContent = CUP_CSS;
  document.head.appendChild(style);
}
const cupOptions = location => CUP_SERIES.filter(item => item.l === location);
const cupSelected = draft => CUP_SERIES.find(item => item.k === draft.seriesKey)
  ?? CUP_SERIES.find(item => item.t === draft.type && item.f === draft.format)
  ?? cupOptions(draft.location)[0] ?? CUP_SERIES[0];
function cupApply(draft, item) {
  const keep = { difficulty:draft.difficulty, matchMode:draft.matchMode, lineupMode:draft.lineupMode };
  applyTournament(draft, item.t);
  Object.assign(draft, keep, { seriesKey:item.k, seriesTitle:item.n, location:item.l, name:item.n,
    format:item.f, count:item.c, trophyStyle:item.s, trophyAccent:item.a, trophyPattern:item.p,
    humanTeamId:'', participantIds:[], teamIndex:0, candidateIndex:0 });
  saveDraft(draft);
}
const cupFormat = value => value === TOURNAMENT_FORMAT.LEAGUE ? 'Bajnoki rendszer'
  : value === TOURNAMENT_FORMAT.GROUP_KNOCKOUT ? 'Csoportkör + kiesés' : 'Kieséses kupa';
const cupTrophy = (item, compact = false) => trophyMarkup({ style:item.s, accent:item.a }, compact);
function cupSteps(custom) {
  const labels = custom ? ['Kupa','Csapat','Beállítások','Indítás'] : ['Kupa','Csapat','Indítás'];
  return `<div class="tx-cup-steps ${custom ? '' : 'is-three'}">${labels.map((label,index) => `<span class="${index ? '' : 'is-active'}"><b>${index + 1}</b><small>${label}</small></span>`).join('')}</div>`;
}
function showCupSelectorV3(returnPanel = null, suppliedDraft = null) {
  cupEnsureStyle();
  const restored = suppliedDraft ?? readDraft();
  const savedCustom = restored?.type === 'custom' ? { ...restored } : null;
  const draft = restored && TOURNAMENTS[restored.type] ? { ...initialDraft(restored.type), ...restored } : initialDraft('hungarian-cup');
  if (savedCustom && (!draft.seriesKey || draft.seriesKey === 'custom')) draft.seriesKey = 'custom-saved';
  let selected = cupSelected(draft);
  if (!draft.seriesKey) cupApply(draft, selected);
  const node = makePanel('tournament-experience-v2 tx-cup-selector-v3');
  const exit = () => { runtime.wizard = null; returnPanel ? showPanel(returnPanel) : closeTournamentLayers(); };
  const cycle = offset => {
    const options = cupOptions(draft.location).filter(item => !item.saved || savedCustom);
    const index = Math.max(0, options.findIndex(item => item.k === selected.k));
    const candidate = options[(index + offset + options.length) % options.length];
    if (candidate) choose(candidate);
  };
  const choose = item => {
    if (item.saved) {
      if (!savedCustom) return;
      Object.assign(draft, initialDraft('custom'), savedCustom, { seriesKey:item.k, seriesTitle:item.n, location:LOCATION.CUSTOM });
      saveDraft(draft);
    } else cupApply(draft, item);
    selected = item; render();
  };
  const goNext = () => { saveDraft(draft); runtime.wizard = null; showExperienceWizard(returnPanel, draft, 'team'); };
  runtime.wizard = { previous:exit, exit };
  const render = () => {
    selected = cupSelected(draft);
    if (selected.saved && savedCustom) selected = { ...selected, n:draft.name || selected.n, f:draft.format, c:draft.count, s:draft.trophyStyle, a:draft.trophyAccent, p:draft.trophyPattern };
    const options = cupOptions(draft.location);
    const carouselOptions = options.filter(item => !item.saved || savedCustom);
    const index = Math.max(0, carouselOptions.findIndex(item => item.k === selected.k));
    const previous = carouselOptions[(index - 1 + carouselOptions.length) % carouselOptions.length];
    const next = carouselOptions[(index + 1) % carouselOptions.length];
    const carousel = carouselOptions.length > 1;
    node.innerHTML = `<header class="tx-cup-head"><div class="tx-cup-top"><button class="tx-cup-icon-btn" data-exit aria-label="Vissza">‹</button><div><p class="eyebrow">Új versenysorozat</p><h1>Torna mód</h1></div><button class="tx-cup-icon-btn" data-help aria-label="Súgó">?</button></div>${cupSteps(selected.t === 'custom')}<p class="tx-cup-helptext" data-helptext hidden>Először csak a kupát választod ki. A csapat és a szükséges beállítások külön képernyőn következnek.</p></header>
      <nav class="tx-cup-locations">${Object.values(LOCATION).map(location => `<button class="${draft.location === location ? 'is-active' : ''}" data-location="${location}"><span>${CUP_LOCATION_ICON[location]}</span><b>${escapeHtml(CUP_LOCATION_NAME[location])}</b></button>`).join('')}</nav>
      <section class="tx-cup-stage" aria-live="polite">${carousel ? `<span class="tx-cup-peek left">${cupTrophy(previous,true)}</span><button class="tx-cup-arrow" data-prev aria-label="Előző kupa">‹</button>` : '<span></span>'}<div class="tx-cup-main">${cupTrophy(selected)}<h2>${escapeHtml(selected.n)}</h2><p>${escapeHtml(selected.d)}</p><div class="tx-cup-meta"><span>🏆 <b>Típus:</b> ${escapeHtml(cupFormat(selected.f))}</span><span>👥 <b>Csapatok:</b> ${selected.c}</span></div></div>${carousel ? `<button class="tx-cup-arrow" data-next-series aria-label="Következő kupa">›</button><span class="tx-cup-peek right">${cupTrophy(next,true)}</span>` : '<span></span>'}</section>
      <section class="tx-cup-types">${options.map(item => `<button class="${item.k === selected.k ? 'is-selected' : ''}" data-series="${item.k}" ${item.saved && !savedCustom ? 'disabled title="Nincs mentett saját kupa"' : ''}>${cupTrophy(item,true)}<span>${escapeHtml(item.n)}</span></button>`).join('')}</section><div class="tx-cup-actions"><button class="btn tx-cup-primary" data-continue>Kupa kiválasztása <span>›</span></button></div>`;
    node.querySelectorAll('[data-location]').forEach(button => button.addEventListener('click', () => { const item = cupOptions(button.dataset.location)[0]; if (item) choose(item) }));
    node.querySelectorAll('[data-series]').forEach(button => button.addEventListener('click', () => { const item = CUP_SERIES.find(value => value.k === button.dataset.series); if (item) choose(item) }));
    node.querySelector('[data-prev]')?.addEventListener('click', () => cycle(-1));
    node.querySelector('[data-next-series]')?.addEventListener('click', () => cycle(1));
    node.querySelector('[data-continue]')?.addEventListener('click', goNext);
    node.querySelector('[data-exit]')?.addEventListener('click', exit);
    node.querySelector('[data-help]')?.addEventListener('click', () => { const text = node.querySelector('[data-helptext]'); if (text) text.hidden = !text.hidden; });
    if (carousel) addHorizontalSwipe(node.querySelector('.tx-cup-stage'), () => cycle(-1), () => cycle(1));
  };
  node.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key) || event.target?.matches?.('input,select,textarea')
      || cupOptions(draft.location).filter(item => !item.saved || savedCustom).length < 2) return;
    event.preventDefault(); cycle(event.key === 'ArrowLeft' ? -1 : 1);
  });
  render(); showPanel(node);
}
function cupPatch(button, returnPanel) {
  if (!button || CUP_PATCHED.has(button)) return;
  const replacement = button.cloneNode(true);
  button.replaceWith(replacement); CUP_PATCHED.add(replacement);
  replacement.addEventListener('click', () => showCupSelectorV3(returnPanel));
}
function cupRefresh() {
  const menu = document.querySelector('.menu-panel.mobile-home');
  const stored = tournamentStorageService.read();
  if (menu && stored?.status !== TOURNAMENT_STATUS.ACTIVE) cupPatch(menu.querySelector('#tournament-mode-btn'), menu);
  cupPatch(menu?.querySelector('.tournament-new-button-v2'), menu);
  cupPatch(document.querySelector('.tournament-complete #tournament-new'), null);
}
function installCupSelectorV3() {
  cupEnsureStyle();
  if (globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__) return globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__;
  const observer = new MutationObserver(cupRefresh);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__ = observer;
  globalThis.FociskartyakCupSelector = Object.freeze({ show:showCupSelectorV3, refresh:cupRefresh, version:3 });
  cupRefresh(); return observer;
}

installTournamentExperienceV2();
installCupSelectorV3();
installTournamentUiImprovement();
export { installTournamentExperienceV2, installCupSelectorV3, showCupSelectorV3 };