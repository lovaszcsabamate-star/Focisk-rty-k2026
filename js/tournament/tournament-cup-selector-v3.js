/** Letisztult, karusszeles kupa-/tornaválasztó a meglévő V2 folyamat előtt. */
import {
  LOCATION, LOCATION_LABELS, TOURNAMENTS, TOURNAMENT_FORMAT, TOURNAMENT_STATUS,
  runtime, escapeHtml, initialDraft, applyTournament, readDraft, saveDraft,
  makePanel, showPanel, closeTournamentLayers, trophyMarkup, tournamentStorageService,
} from './tournament-experience-v2-shared.js';
import { showExperienceWizard } from './tournament-experience-v2-wizard.js';

const CUP_SELECTOR_STYLE_ID = 'tournament-cup-selector-v3-style';
const CUP_SELECTOR_PATCHED = new WeakSet();

const CUP_SELECTOR_SERIES = Object.freeze([
  Object.freeze({ key:'hungarian-league', type:'hungarian-league', location:LOCATION.HUNGARY,
    title:'Magyar Bajnokság', description:'Teljes hazai bajnoki idény, minden ellenféllel egy mérkőzés.',
    format:TOURNAMENT_FORMAT.LEAGUE, count:12, style:'shield', accent:'gold', pattern:'stadium', icon:'🇭🇺' }),
  Object.freeze({ key:'hungarian-cup', type:'hungarian-cup', location:LOCATION.HUNGARY,
    title:'Magyar Kupa', description:'Hazai kieséses kupasorozat külön döntőfelvezetéssel.',
    format:TOURNAMENT_FORMAT.KNOCKOUT, count:12, style:'classic', accent:'silver', pattern:'rays', icon:'🇭🇺' }),
  Object.freeze({ key:'international-champions', type:'world-cup', location:LOCATION.INTERNATIONAL,
    title:'Nemzetközi Bajnokok Kupája', description:'Csoportkörből a kieséses szakaszon át vezet az út a döntőig.',
    format:TOURNAMENT_FORMAT.GROUP_KNOCKOUT, count:8, style:'orb', accent:'silver', pattern:'stars', icon:'🌐' }),
  Object.freeze({ key:'nations-cup', type:'world-cup', location:LOCATION.INTERNATIONAL,
    title:'Nemzetek Kupája', description:'Gyors, egyenes kieséses nemzetközi kupasorozat.',
    format:TOURNAMENT_FORMAT.KNOCKOUT, count:8, style:'classic', accent:'gold', pattern:'stars', icon:'🌐' }),
  Object.freeze({ key:'custom', type:'custom', location:LOCATION.CUSTOM,
    title:'Saját kupa', description:'Egyedi név, mezőny, formátum és saját tervezésű serleg.',
    format:TOURNAMENT_FORMAT.KNOCKOUT, count:4, style:'modern', accent:'emerald', pattern:'none', icon:'🏆＋' }),
]);

const CUP_SELECTOR_LOCATION_ICONS = Object.freeze({
  [LOCATION.HUNGARY]:'🇭🇺', [LOCATION.INTERNATIONAL]:'🌐', [LOCATION.CUSTOM]:'🏆＋',
});
const CUP_SELECTOR_LOCATION_NAMES = Object.freeze({ ...LOCATION_LABELS, [LOCATION.CUSTOM]:'Saját kupa' });

function cupSelectorEnsureStyle() {
  if (document.getElementById(CUP_SELECTOR_STYLE_ID) || document.querySelector('[data-standalone-tournament-experience-v2]')) return;
  const link = document.createElement('link');
  link.id = CUP_SELECTOR_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tournament-cup-selector-v3.css', import.meta.url).href;
  document.head.appendChild(link);
}

function cupSelectorOptionsFor(location) { return CUP_SELECTOR_SERIES.filter(item => item.location === location); }
function cupSelectorSelectedFor(draft) {
  return CUP_SELECTOR_SERIES.find(item => item.key === draft.seriesKey)
    ?? CUP_SELECTOR_SERIES.find(item => item.type === draft.type && item.format === draft.format)
    ?? cupSelectorOptionsFor(draft.location)[0] ?? CUP_SELECTOR_SERIES[0];
}
function cupSelectorApplySeries(draft, series) {
  const difficulty = draft.difficulty;
  const matchMode = draft.matchMode;
  const lineupMode = draft.lineupMode;
  applyTournament(draft, series.type);
  Object.assign(draft, {
    seriesKey:series.key, seriesTitle:series.title, location:series.location,
    name:series.title, format:series.format, count:series.count,
    trophyStyle:series.style, trophyAccent:series.accent, trophyPattern:series.pattern,
    difficulty:difficulty ?? 'medium', matchMode:matchMode ?? draft.matchMode,
    lineupMode:lineupMode ?? 'own', humanTeamId:'', participantIds:[], teamIndex:0, candidateIndex:0,
  });
  saveDraft(draft);
}
function cupSelectorFormatName(format) {
  if (format === TOURNAMENT_FORMAT.LEAGUE) return 'Bajnoki rendszer';
  if (format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT) return 'Csoportkör + kiesés';
  return 'Kieséses kupa';
}
function cupSelectorStepMarkup(custom) {
  const labels = custom ? ['Kupa','Csapat','Beállítások','Indítás'] : ['Kupa','Csapat','Indítás'];
  return `<div class="tx-cup-steps tx-cup-steps--${labels.length}" aria-label="Torna létrehozásának lépései">${labels.map((label,index) =>
    `<span class="${index === 0 ? 'is-active' : ''}"><b>${index + 1}</b><small>${label}</small></span>`).join('')}</div>`;
}
function cupSelectorTrophyView(series, compact = false) {
  return trophyMarkup({ style:series.style, accent:series.accent }, compact);
}

export function showCupSelectorV3(returnPanel = null, suppliedDraft = null) {
  cupSelectorEnsureStyle();
  const restored = suppliedDraft ?? readDraft();
  const draft = restored && TOURNAMENTS[restored.type]
    ? { ...initialDraft(restored.type), ...restored }
    : initialDraft('hungarian-cup');
  let selected = cupSelectorSelectedFor(draft);
  if (!draft.seriesKey) cupSelectorApplySeries(draft, selected);
  const node = makePanel('tournament-experience-v2 tx-cup-selector-v3');

  const exit = () => {
    runtime.wizard = null;
    if (returnPanel?.isConnected || returnPanel) showPanel(returnPanel); else closeTournamentLayers();
  };
  const goTeam = () => {
    saveDraft(draft);
    runtime.wizard = null;
    showExperienceWizard(returnPanel, draft, 'team');
  };
  const cycle = offset => {
    const choices = cupSelectorOptionsFor(draft.location);
    const index = Math.max(0, choices.findIndex(item => item.key === selected.key));
    selected = choices[(index + offset + choices.length) % choices.length];
    cupSelectorApplySeries(draft, selected);
    render();
  };
  runtime.wizard = { previous:exit, exit };

  const render = () => {
    selected = cupSelectorSelectedFor(draft);
    const choices = cupSelectorOptionsFor(draft.location);
    const index = Math.max(0, choices.findIndex(item => item.key === selected.key));
    const previous = choices[(index - 1 + choices.length) % choices.length];
    const next = choices[(index + 1) % choices.length];
    const hasCarousel = choices.length > 1;
    node.innerHTML = `
      <header class="tx-cup-header">
        <div class="tx-cup-header__top">
          <button class="tx-cup-back" type="button" data-exit aria-label="Vissza">‹</button>
          <div><p class="eyebrow">Új versenysorozat</p><h1>Torna mód</h1></div>
          <button class="tx-cup-help" type="button" data-help aria-label="Súgó">?</button>
        </div>
        ${cupSelectorStepMarkup(selected.type === 'custom')}
        <p class="tx-cup-help-text" data-help-text hidden>Először csak a kupát választod ki. A csapat, majd a szükséges beállítások külön képernyőn következnek.</p>
      </header>
      <nav class="tx-cup-locations" aria-label="Kupa helye">${Object.values(LOCATION).map(location =>
        `<button type="button" class="${draft.location === location ? 'is-active' : ''}" data-location="${location}" aria-pressed="${draft.location === location}"><span aria-hidden="true">${CUP_SELECTOR_LOCATION_ICONS[location]}</span><b>${escapeHtml(CUP_SELECTOR_LOCATION_NAMES[location])}</b></button>`).join('')}</nav>
      <section class="tx-cup-stage" data-pattern="${escapeHtml(selected.pattern)}" aria-live="polite">
        ${hasCarousel ? `<span class="tx-cup-preview tx-cup-preview--left" aria-hidden="true">${cupSelectorTrophyView(previous, true)}</span>` : ''}
        ${hasCarousel ? `<button class="tx-cup-arrow tx-cup-arrow--left" type="button" data-prev aria-label="Előző kupa">‹</button>` : ''}
        <div class="tx-cup-stage__main">
          ${cupSelectorTrophyView(selected)}
          <h2>${escapeHtml(selected.title)}</h2>
          <p>${escapeHtml(selected.description)}</p>
          <div class="tx-cup-meta"><span>🏆 <b>Típus:</b> ${escapeHtml(cupSelectorFormatName(selected.format))}</span><span>👥 <b>Csapatok:</b> ${selected.count}</span></div>
        </div>
        ${hasCarousel ? `<button class="tx-cup-arrow tx-cup-arrow--right" type="button" data-next-series aria-label="Következő kupa">›</button>` : ''}
        ${hasCarousel ? `<span class="tx-cup-preview tx-cup-preview--right" aria-hidden="true">${cupSelectorTrophyView(next, true)}</span>` : ''}
      </section>
      <section class="tx-cup-series" aria-label="Elérhető versenysorozatok">${choices.map(item =>
        `<button type="button" class="${item.key === selected.key ? 'is-selected' : ''}" data-series="${item.key}" aria-pressed="${item.key === selected.key}">${cupSelectorTrophyView(item, true)}<span>${escapeHtml(item.title)}</span></button>`).join('')}</section>
      <div class="tx-cup-actions"><button class="btn tx-cup-primary" type="button" data-continue>Kupa kiválasztása <span aria-hidden="true">›</span></button></div>`;

    node.querySelectorAll('[data-location]').forEach(button => button.addEventListener('click', () => {
      const first = cupSelectorOptionsFor(button.dataset.location)[0];
      if (first) { selected = first; cupSelectorApplySeries(draft, first); render(); }
    }));
    node.querySelectorAll('[data-series]').forEach(button => button.addEventListener('click', () => {
      const series = CUP_SELECTOR_SERIES.find(item => item.key === button.dataset.series);
      if (series) { selected = series; cupSelectorApplySeries(draft, series); render(); }
    }));
    node.querySelector('[data-prev]')?.addEventListener('click', () => cycle(-1));
    node.querySelector('[data-next-series]')?.addEventListener('click', () => cycle(1));
    node.querySelector('[data-continue]')?.addEventListener('click', goTeam);
    node.querySelector('[data-exit]')?.addEventListener('click', exit);
    node.querySelector('[data-help]')?.addEventListener('click', () => {
      const text = node.querySelector('[data-help-text]');
      if (text) text.hidden = !text.hidden;
    });
    const stage = node.querySelector('.tx-cup-stage');
    let startX = null;
    stage?.addEventListener('touchstart', event => { startX = event.touches?.[0]?.clientX ?? null; }, { passive:true });
    stage?.addEventListener('touchend', event => {
      if (startX === null || !hasCarousel) return;
      const delta = (event.changedTouches?.[0]?.clientX ?? startX) - startX;
      startX = null;
      if (Math.abs(delta) >= 42) cycle(delta > 0 ? -1 : 1);
    }, { passive:true });
  };

  node.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key) || event.target?.matches?.('input,select,textarea')) return;
    if (cupSelectorOptionsFor(draft.location).length < 2) return;
    event.preventDefault();
    cycle(event.key === 'ArrowLeft' ? -1 : 1);
  });
  render();
  showPanel(node);
}

function cupSelectorPatchLaunchButton(button, returnPanel) {
  if (!button || CUP_SELECTOR_PATCHED.has(button)) return;
  const replacement = button.cloneNode(true);
  replacement.dataset.cupSelectorV3 = 'true';
  button.replaceWith(replacement);
  CUP_SELECTOR_PATCHED.add(replacement);
  replacement.addEventListener('click', () => showCupSelectorV3(returnPanel));
}
function cupSelectorRefreshLaunchers() {
  const menu = document.querySelector('.menu-panel.mobile-home');
  const stored = tournamentStorageService.read();
  if (menu && stored?.status !== TOURNAMENT_STATUS.ACTIVE) cupSelectorPatchLaunchButton(menu.querySelector('#tournament-mode-btn'), menu);
  cupSelectorPatchLaunchButton(menu?.querySelector('.tournament-new-button-v2'), menu);
  cupSelectorPatchLaunchButton(document.querySelector('.tournament-complete #tournament-new'), null);
}
export function installCupSelectorV3() {
  cupSelectorEnsureStyle();
  if (globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__) return globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__;
  const observer = new MutationObserver(cupSelectorRefreshLaunchers);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__ = observer;
  globalThis.FociskartyakCupSelector = Object.freeze({ show:showCupSelectorV3, refresh:cupSelectorRefreshLaunchers, version:3 });
  cupSelectorRefreshLaunchers();
  return observer;
}
