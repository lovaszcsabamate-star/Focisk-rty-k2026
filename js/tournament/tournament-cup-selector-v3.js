/** Letisztult, karusszeles kupa-/tornaválasztó a meglévő V2 folyamat előtt. */
import {
  LOCATION, LOCATION_LABELS, TOURNAMENTS, TOURNAMENT_FORMAT, TOURNAMENT_STATUS,
  runtime, escapeHtml, initialDraft, applyTournament, readDraft, saveDraft,
  makePanel, showPanel, closeTournamentLayers, trophyMarkup, tournamentStorageService,
} from './tournament-experience-v2-shared.js';
import { showExperienceWizard } from './tournament-experience-v2-wizard.js';

const STYLE_ID = 'tournament-cup-selector-v3-style';
const PATCHED = new WeakSet();

const SERIES = Object.freeze([
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

const LOCATION_ICONS = Object.freeze({
  [LOCATION.HUNGARY]:'🇭🇺', [LOCATION.INTERNATIONAL]:'🌐', [LOCATION.CUSTOM]:'🏆＋',
});
const LOCATION_NAMES = Object.freeze({ ...LOCATION_LABELS, [LOCATION.CUSTOM]:'Saját kupa' });

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tournament-cup-selector-v3.css', import.meta.url).href;
  document.head.appendChild(link);
}

function optionsFor(location) { return SERIES.filter(item => item.location === location); }
function selectedFor(draft) {
  return SERIES.find(item => item.key === draft.seriesKey)
    ?? SERIES.find(item => item.type === draft.type && item.format === draft.format)
    ?? optionsFor(draft.location)[0] ?? SERIES[0];
}
function applySeries(draft, series) {
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
function formatName(format) {
  if (format === TOURNAMENT_FORMAT.LEAGUE) return 'Bajnoki rendszer';
  if (format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT) return 'Csoportkör + kiesés';
  return 'Kieséses kupa';
}
function stepMarkup(custom) {
  const labels = custom ? ['Kupa','Csapat','Beállítások','Indítás'] : ['Kupa','Csapat','Indítás'];
  return `<div class="tx-cup-steps" aria-label="Torna létrehozásának lépései">${labels.map((label,index) =>
    `<span class="${index === 0 ? 'is-active' : ''}"><b>${index + 1}</b><small>${label}</small></span>`).join('')}</div>`;
}
function trophyView(series, compact = false) {
  return trophyMarkup({ style:series.style, accent:series.accent }, compact);
}

export function showCupSelectorV3(returnPanel = null, suppliedDraft = null) {
  ensureStyle();
  const restored = suppliedDraft ?? readDraft();
  const draft = restored && TOURNAMENTS[restored.type]
    ? { ...initialDraft(restored.type), ...restored }
    : initialDraft('hungarian-cup');
  let selected = selectedFor(draft);
  if (!draft.seriesKey) applySeries(draft, selected);
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
    const choices = optionsFor(draft.location);
    const index = Math.max(0, choices.findIndex(item => item.key === selected.key));
    selected = choices[(index + offset + choices.length) % choices.length];
    applySeries(draft, selected);
    render();
  };
  runtime.wizard = { previous:exit, exit };

  const render = () => {
    selected = selectedFor(draft);
    const choices = optionsFor(draft.location);
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
        ${stepMarkup(selected.type === 'custom')}
        <p class="tx-cup-help-text" data-help-text hidden>Először csak a kupát választod ki. A csapat, majd a szükséges beállítások külön képernyőn következnek.</p>
      </header>
      <nav class="tx-cup-locations" aria-label="Kupa helye">${Object.values(LOCATION).map(location =>
        `<button type="button" class="${draft.location === location ? 'is-active' : ''}" data-location="${location}" aria-pressed="${draft.location === location}"><span aria-hidden="true">${LOCATION_ICONS[location]}</span><b>${escapeHtml(LOCATION_NAMES[location])}</b></button>`).join('')}</nav>
      <section class="tx-cup-stage" data-pattern="${escapeHtml(selected.pattern)}" aria-live="polite">
        ${hasCarousel ? `<span class="tx-cup-preview tx-cup-preview--left" aria-hidden="true">${trophyView(previous, true)}</span>` : ''}
        ${hasCarousel ? `<button class="tx-cup-arrow tx-cup-arrow--left" type="button" data-prev aria-label="Előző kupa">‹</button>` : ''}
        <div class="tx-cup-stage__main">
          ${trophyView(selected)}
          <h2>${escapeHtml(selected.title)}</h2>
          <p>${escapeHtml(selected.description)}</p>
          <div class="tx-cup-meta"><span>🏆 <b>Típus:</b> ${escapeHtml(formatName(selected.format))}</span><span>👥 <b>Csapatok:</b> ${selected.count}</span></div>
        </div>
        ${hasCarousel ? `<button class="tx-cup-arrow tx-cup-arrow--right" type="button" data-next-series aria-label="Következő kupa">›</button>` : ''}
        ${hasCarousel ? `<span class="tx-cup-preview tx-cup-preview--right" aria-hidden="true">${trophyView(next, true)}</span>` : ''}
      </section>
      <section class="tx-cup-series" aria-label="Elérhető versenysorozatok">${choices.map(item =>
        `<button type="button" class="${item.key === selected.key ? 'is-selected' : ''}" data-series="${item.key}" aria-pressed="${item.key === selected.key}">${trophyView(item, true)}<span>${escapeHtml(item.title)}</span></button>`).join('')}</section>
      <div class="tx-cup-actions"><button class="btn tx-cup-primary" type="button" data-continue>Kupa kiválasztása <span aria-hidden="true">›</span></button></div>`;

    node.querySelectorAll('[data-location]').forEach(button => button.addEventListener('click', () => {
      const first = optionsFor(button.dataset.location)[0];
      if (first) { selected = first; applySeries(draft, first); render(); }
    }));
    node.querySelectorAll('[data-series]').forEach(button => button.addEventListener('click', () => {
      const series = SERIES.find(item => item.key === button.dataset.series);
      if (series) { selected = series; applySeries(draft, series); render(); }
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
    if (optionsFor(draft.location).length < 2) return;
    event.preventDefault();
    cycle(event.key === 'ArrowLeft' ? -1 : 1);
  });
  render();
  showPanel(node);
}

function patchLaunchButton(button, returnPanel) {
  if (!button || PATCHED.has(button)) return;
  const replacement = button.cloneNode(true);
  replacement.dataset.cupSelectorV3 = 'true';
  button.replaceWith(replacement);
  PATCHED.add(replacement);
  replacement.addEventListener('click', () => showCupSelectorV3(returnPanel));
}
function refreshLaunchers() {
  const menu = document.querySelector('.menu-panel.mobile-home');
  const stored = tournamentStorageService.read();
  if (menu && stored?.status !== TOURNAMENT_STATUS.ACTIVE) patchLaunchButton(menu.querySelector('#tournament-mode-btn'), menu);
  patchLaunchButton(menu?.querySelector('.tournament-new-button-v2'), menu);
  patchLaunchButton(document.querySelector('.tournament-complete #tournament-new'), null);
}
export function installCupSelectorV3() {
  ensureStyle();
  if (globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__) return globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__;
  const observer = new MutationObserver(refreshLaunchers);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  globalThis.__FOCISKARTYAK_CUP_SELECTOR_V3__ = observer;
  globalThis.FociskartyakCupSelector = Object.freeze({ show:showCupSelectorV3, refresh:refreshLaunchers, version:3 });
  refreshLaunchers();
  return observer;
}
