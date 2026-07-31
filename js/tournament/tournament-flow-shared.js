/** Többlépcsős tornaválasztás és megbízható tornaeredmény-navigáció. */

import {
  QUICK_MATCH_CATEGORY,
  TOURNAMENT_LINEUP_STORAGE_KEY,
  buildQuickMatchCatalog,
  quickMatchEntriesForCategory,
  resolveQuickMatchSelection,
  stageQuickMatch,
} from '../deck-selection.js';
import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  createTournament,
  tournamentMatches,
  tournamentNextHumanMatch,
  tournamentProgress,
  tournamentRoundForMatch,
  tournamentShuffle,
  tournamentTeamById,
} from './tournament-domain.js';
import { tournamentStorageService } from '../services/tournament-storage-service.js';

const deckRuntime = globalThis.FociskartyakDeckSelectionRuntime ?? Object.freeze({
  buildQuickMatchCatalog,
  quickMatchEntriesForCategory,
  resolveQuickMatchSelection,
  stageQuickMatch,
  TOURNAMENT_LINEUP_STORAGE_KEY,
});

const FLOW_VERSION = 1;
const MINIMUM_CARDS = 11;
const runtime = {
  observer: null,
  wizard: null,
  resultPanels: new WeakSet(),
  menuPanels: new WeakSet(),
  centers: new WeakSet(),
};

const STYLE_ID = 'tournament-flow-upgrade-style';
const STYLE = `
.tournament-flow{--tf-gold:#f2c45e;--tf-bronze:#a56d35;--tf-green:#438a58;display:grid;gap:18px;width:min(980px,100%);margin:auto;padding-bottom:max(90px,env(safe-area-inset-bottom,0px))}
.tournament-flow *{box-sizing:border-box}.tournament-flow button,.tournament-flow input,.tournament-flow select{min-height:44px}.tournament-flow__header{position:sticky;z-index:4;top:0;display:grid;gap:10px;padding:8px 0 12px;background:linear-gradient(#21150f 72%,transparent)}
.tournament-flow__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.tournament-flow__top h1{margin:2px 0 0;font-size:clamp(1.65rem,6vw,2.7rem)}.tournament-flow__exit{min-width:44px}
.tournament-flow__steps{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px}.tournament-flow__step{flex:1 0 118px;padding:8px;border:1px solid rgba(255,255,255,.15);border-radius:999px;background:rgba(0,0,0,.2);color:#c9bca8;font-size:.7rem;font-weight:900;text-align:center}.tournament-flow__step.is-active{border-color:var(--tf-gold);background:rgba(242,196,94,.15);color:#fff1bd}.tournament-flow__step.is-done{border-color:rgba(67,138,88,.7);color:#bfe5c9}
.tournament-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.tournament-type-card{display:grid;grid-template-rows:auto auto 1fr auto auto;gap:9px;min-height:245px;padding:18px;border:1px solid rgba(242,196,94,.27);border-radius:22px;background:radial-gradient(circle at 15% 10%,rgba(242,196,94,.14),transparent 38%),linear-gradient(150deg,rgba(66,42,24,.94),rgba(26,17,12,.96));color:inherit;text-align:left;box-shadow:0 16px 34px rgba(0,0,0,.28)}.tournament-type-card:hover,.tournament-type-card:focus-visible,.tournament-type-card.is-selected{border-color:var(--tf-gold);transform:translateY(-2px)}.tournament-type-card__icon{font-size:2.5rem}.tournament-type-card h2{margin:0}.tournament-type-card p{margin:0;color:#d6c7b0;line-height:1.45}.tournament-type-card__meta{display:flex;flex-wrap:wrap;gap:6px}.tournament-type-card__meta span{padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.07);font-size:.68rem;font-weight:850}.tournament-type-card .btn{width:100%}
.tournament-team-carousel{display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;gap:12px}.tournament-team-hero{display:grid;justify-items:center;gap:12px;padding:24px;border:1px solid rgba(242,196,94,.3);border-radius:26px;background:radial-gradient(circle at 50% 12%,rgba(242,196,94,.18),transparent 38%),rgba(24,16,12,.82);text-align:center}.tournament-team-hero.is-disabled{filter:grayscale(.55);opacity:.72}.tournament-team-hero__mark{display:grid;place-items:center;width:clamp(118px,30vw,180px);height:clamp(118px,30vw,180px);border:5px solid rgba(255,255,255,.82);border-radius:44% 44% 50% 50%/34% 34% 62% 62%;background:linear-gradient(145deg,var(--team-primary,#6d4d2f),var(--team-secondary,#d5b45d));font-size:clamp(2rem,10vw,4.6rem);font-weight:1000;color:#fff;text-shadow:0 3px 8px #000;box-shadow:0 20px 42px rgba(0,0,0,.42)}.tournament-team-hero__mark img{width:100%;height:100%;object-fit:contain;padding:15px}.tournament-team-hero h2{margin:0;font-size:clamp(1.4rem,5vw,2.1rem)}.tournament-team-hero__facts{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.tournament-team-hero__facts span{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.07);font-size:.74rem;font-weight:900}.tournament-team-hero__facts .is-ok{color:#bce7c7}.tournament-team-hero__facts .is-warning{color:#ffd0a4}.tournament-carousel-arrow{display:grid;place-items:center;width:52px;padding:0;border-radius:50%;font-size:1.5rem}.tournament-random-ball{position:relative;border-radius:50%!important;background:radial-gradient(circle at 35% 30%,#fff 0 16%,#222 17% 25%,#fff 26% 44%,#222 45% 54%,#fff 55%)!important;color:#fff!important;text-shadow:0 1px 4px #000}.tournament-random-ball::after{content:'⚄';position:absolute;right:-5px;bottom:-4px;display:grid;place-items:center;width:25px;height:25px;border-radius:7px;background:#2d1c12;color:#f4ce71;font-size:.9rem}
.tournament-flow__search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.tournament-flow__section{display:grid;gap:12px;padding:16px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:rgba(0,0,0,.2)}.tournament-flow__section h2,.tournament-flow__section h3{margin:0}.tournament-flow__options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tournament-flow__options label{display:grid;gap:6px}.tournament-choice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px}.tournament-choice-grid label{position:relative}.tournament-choice-grid input{position:absolute;opacity:0}.tournament-choice-grid span{display:grid;gap:4px;min-height:72px;padding:12px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.04)}.tournament-choice-grid input:checked+span{border-color:var(--tf-gold);background:rgba(242,196,94,.13);box-shadow:0 0 0 1px rgba(242,196,94,.14)}.tournament-choice-grid input:disabled+span{opacity:.45}.tournament-field-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;max-height:45vh;overflow:auto}.tournament-field-team{display:flex;align-items:center;gap:9px;padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:13px;background:rgba(255,255,255,.04)}.tournament-field-team input{min-width:24px}.tournament-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.tournament-summary__item{padding:12px;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:rgba(255,255,255,.04)}.tournament-summary__item small,.tournament-summary__item strong{display:block}.tournament-summary__item small{color:#bcae99;font-size:.68rem;font-weight:900;text-transform:uppercase}.tournament-summary__item strong{margin-top:4px;color:#fff2c1}.tournament-flow__warning{padding:12px;border:1px solid rgba(215,112,67,.5);border-radius:13px;background:rgba(130,54,30,.2);color:#ffd7bd}.tournament-flow__actions{position:sticky;z-index:5;bottom:0;display:flex;justify-content:space-between;gap:10px;padding:12px 0 max(12px,env(safe-area-inset-bottom,0px));background:linear-gradient(transparent,#21150f 28%)}.tournament-flow__actions .btn{min-width:150px}.tournament-overwrite{display:grid;gap:14px;padding:20px;border:1px solid rgba(242,196,94,.36);border-radius:22px;background:rgba(30,19,13,.97)}
.result-panel--tournament .result-actions[data-tournament-safe-actions='true']{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.result-panel--tournament .result-actions[data-tournament-safe-actions='true'] .btn{min-height:48px;white-space:normal}.tournament-save-verified{color:#bfe7c8;font-size:.74rem;font-weight:900;text-align:center}
@media(max-width:720px){.tournament-type-grid{grid-template-columns:1fr}.tournament-team-carousel{grid-template-columns:44px minmax(0,1fr) 44px;gap:7px}.tournament-carousel-arrow{width:44px}.tournament-flow__options,.tournament-summary{grid-template-columns:1fr}.result-panel--tournament .result-actions[data-tournament-safe-actions='true']{grid-template-columns:1fr}.tournament-flow__actions{display:grid;grid-template-columns:1fr 1fr}.tournament-flow__actions .btn:last-child{grid-column:1/-1}.tournament-flow__actions .btn{min-width:0;width:100%}}
@media(max-width:430px){.tournament-flow{gap:13px}.tournament-flow__top{align-items:center}.tournament-flow__top h1{font-size:1.45rem}.tournament-flow__section{padding:12px}.tournament-team-hero{padding:16px}.tournament-flow__search{grid-template-columns:1fr}.tournament-flow__actions{grid-template-columns:1fr}}
`;

const TYPE_PRESETS = Object.freeze({
  'hungarian-league': Object.freeze({
    key: 'hungarian-league', icon: '🏟️', title: 'Magyar Bajnokság',
    description: 'Válassz magyar klubot, és küzdj meg a bajnoki címért.',
    category: TOURNAMENT_CATEGORY.HUNGARIAN, format: TOURNAMENT_FORMAT.LEAGUE,
    count: 12, sizes: [12], system: 'Liga · mindenki mindenkivel', length: '11 saját mérkőzés', locked: true,
  }),
  'hungarian-cup': Object.freeze({
    key: 'hungarian-cup', icon: '🏆', title: 'Magyar Kupa',
    description: 'Válassz magyar klubot, és juss el a döntőig a kieséses ágon.',
    category: TOURNAMENT_CATEGORY.HUNGARIAN, format: TOURNAMENT_FORMAT.KNOCKOUT,
    count: 12, sizes: [12], system: '12 csapatos kieséses ág', length: 'legfeljebb 4 saját mérkőzés', locked: true,
  }),
  'world-cup': Object.freeze({
    key: 'world-cup', icon: '🌐🏆', title: 'Világkupa',
    description: 'Válassz nemzeti vagy regionális válogatottat, és nyerd meg a világkupát.',
    category: TOURNAMENT_CATEGORY.NATIONS, format: TOURNAMENT_FORMAT.GROUP_KNOCKOUT,
    count: 8, sizes: [8, 16], system: 'Csoportkör + kieséses szakasz', length: '4–7 saját mérkőzés', locked: true,
  }),
  custom: Object.freeze({
    key: 'custom', icon: '🛠️', title: 'Saját torna',
    description: 'Állítsd össze a saját tornádat egyedi szabályokkal.',
    category: TOURNAMENT_CATEGORY.HUNGARIAN, format: TOURNAMENT_FORMAT.LEAGUE,
    count: 4, sizes: [], system: 'Egyedi szabályok', length: 'a beállításoktól függ', locked: false,
  }),
});

const CLUB_COLORS = Object.freeze({
  dvsc: ['#c8192e', '#fff'], dvtk: ['#d71920', '#fff'], 'eto fc': ['#159447', '#fff'],
  'ferencvarosi tc': ['#16854a', '#fff'], 'kisvarda master good': ['#d8222a', '#fff'],
  'kolorcity kazincbarcika sc': ['#2468a9', '#f2cf2f'], 'mtk budapest': ['#246eb9', '#fff'],
  'nyiregyhaza spartacus fc': ['#c61f30', '#254f9a'], 'paksi fc': ['#23864a', '#fff'],
  'puskas akademia fc': ['#1f66ad', '#f0c640'], 'ujpest fc': ['#6d3a93', '#fff'], 'zte fc': ['#185ea9', '#fff'],
});

const text = value => String(value ?? '').trim();
const escapeHtml = value => text(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const fold = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU').replace(/[^a-z0-9]+/g, ' ').trim();
const initials = value => text(value).split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join('').toUpperCase() || 'FK';
const players = () => {
  const payload = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ ?? globalThis.__EMBEDDED_PLAYER_DATA__;
  return Array.isArray(payload?.players) ? payload.players : [];
};
const catalog = () => deckRuntime.buildQuickMatchCatalog(players());
const allTeams = category => {
  const value = catalog();
  const entries = category === TOURNAMENT_CATEGORY.NATIONS
    ? [
        ...deckRuntime.quickMatchEntriesForCategory(value, QUICK_MATCH_CATEGORY.NATIONAL),
        ...deckRuntime.quickMatchEntriesForCategory(value, QUICK_MATCH_CATEGORY.FEDERATION),
      ]
    : deckRuntime.quickMatchEntriesForCategory(value, QUICK_MATCH_CATEGORY.HUNGARIAN);
  return [...new Map(entries.map(entry => [entry.id, entry])).values()]
    .sort((a, b) => text(a.label).localeCompare(text(b.label), 'hu-HU'));
};
const usableTeams = category => allTeams(category).filter(team => team.usable && Number(team.count) >= MINIMUM_CARDS);
const supportedCounts = (category, format, available) => {
  const base = format === TOURNAMENT_FORMAT.LEAGUE ? [4, 6, 8, 10, 12, 16]
    : format === TOURNAMENT_FORMAT.KNOCKOUT
      ? (category === TOURNAMENT_CATEGORY.HUNGARIAN ? [4, 8, 12, 16] : [4, 8, 16])
      : [8, 12, 16, 24];
  return base.filter(count => count <= available && (format !== TOURNAMENT_FORMAT.GROUP_KNOCKOUT || count % 4 === 0));
};
const matchModeLabel = mode => mode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'Büntetőpárbaj' : 'Klasszikus';
const difficultyLabel = value => ({ easy: 'Könnyű', medium: 'Normál', hard: 'Nehéz' }[value] ?? 'Normál');
const formatLabel = value => ({
  [TOURNAMENT_FORMAT.LEAGUE]: 'Liga',
  [TOURNAMENT_FORMAT.KNOCKOUT]: 'Csak kieséses',
  [TOURNAMENT_FORMAT.GROUP_KNOCKOUT]: 'Csoportkör és kieséses szakasz',
}[value] ?? value);

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);
}

function makePanel(className = '') {
  const node = document.createElement('div');
  node.className = `tournament-panel tournament-flow mobile-sheet ${className}`.trim();
  node.tabIndex = -1;
  return node;
}

function showPanel(node) {
  const overlay = document.querySelector('#overlay');
  const body = document.querySelector('#overlay-body');
  if (!overlay || !body) return false;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close?.());
  body.replaceChildren(node);
  overlay.hidden = false;
  requestAnimationFrame(() => node.querySelector('button, input, select')?.focus?.({ preventScroll: true }));
  return true;
}

function closeTournamentLayers() {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close?.());
  document.querySelectorAll('.tournament-match-intro-overlay,[data-tournament-overlay]').forEach(node => node.remove());
  const overlay = document.querySelector('#overlay');
  const body = document.querySelector('#overlay-body');
  if (body) body.replaceChildren();
  if (overlay) overlay.hidden = true;
  document.body.classList.remove('modal-open', 'overlay-open', 'no-scroll');
  document.documentElement.classList.remove('modal-open', 'overlay-open', 'no-scroll');
  document.querySelectorAll('[data-tournament-focus-trap]').forEach(node => node.removeAttribute('data-tournament-focus-trap'));
}

function saveAndVerifyTournament(state) {
  if (!state || !tournamentStorageService.save(state)) throw new Error('A tornaállapot mentése nem sikerült.');
  const restored = tournamentStorageService.read();
  const expectedUpdatedAt = text(state.updatedAt);
  if (!restored || restored.id !== state.id || restored.status !== state.status
    || restored.currentMatchId !== state.currentMatchId
    || (expectedUpdatedAt && text(restored.updatedAt) !== expectedUpdatedAt)) {
    throw new Error('A mentett tornaállapot nem olvasható vissza.');
  }
  return restored;
}

function selectParticipants(pool, count, humanId, requestedIds = []) {
  const human = pool.find(team => team.id === humanId);
  if (!human) return [];
  const requested = new Set(requestedIds);
  const chosen = [human];
  const used = new Set([human.id]);
  pool.filter(team => requested.has(team.id) && !used.has(team.id)).forEach(team => {
    if (chosen.length < count) { chosen.push(team); used.add(team.id); }
  });
  tournamentShuffle(pool.filter(team => !used.has(team.id))).forEach(team => {
    if (chosen.length < count) { chosen.push(team); used.add(team.id); }
  });
  return chosen.slice(0, count);
}

function safeTournamentName(value, fallback) {
  const cleaned = text(value).slice(0, 40);
  return cleaned || fallback;
}

function stepsFor(draft) {
  return draft.type === 'custom'
    ? [
        ['type', 'Tornatípus'], ['rules', 'Szabályok'], ['team', 'Csapat'],
        ['field', 'Mezőny'], ['settings', 'Beállítások'], ['summary', 'Összefoglaló'],
      ]
    : [['type', 'Tornatípus'], ['team', 'Csapat'], ['settings', 'Beállítások'], ['summary', 'Összefoglaló']];
}

function teamMark(team) {
  const colors = CLUB_COLORS[fold(team?.label)] ?? ['#6d4d2f', '#d5b45d'];
  const content = team?.badge
    ? `<img src="${escapeHtml(team.badge)}" alt="">`
    : escapeHtml(team?.icon || initials(team?.label));
  return `<button type="button" class="tournament-team-hero__mark" data-select-current-team style="--team-primary:${colors[0]};--team-secondary:${colors[1]}" aria-label="${escapeHtml(team?.label)} kiválasztása">${content}</button>`;
}

export { deckRuntime, FLOW_VERSION, MINIMUM_CARDS, runtime, TYPE_PRESETS, text, escapeHtml, fold, players, allTeams, usableTeams, supportedCounts, matchModeLabel, difficultyLabel, formatLabel, ensureStyle, makePanel, showPanel, closeTournamentLayers, saveAndVerifyTournament, selectParticipants, safeTournamentName, stepsFor, teamMark, TOURNAMENT_CATEGORY, TOURNAMENT_FORMAT, TOURNAMENT_MATCH_MODE, TOURNAMENT_MATCH_STATUS, TOURNAMENT_STATUS, createTournament, tournamentMatches, tournamentNextHumanMatch, tournamentProgress, tournamentRoundForMatch, tournamentShuffle, tournamentTeamById, tournamentStorageService };
